import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import JSZip from 'jszip';

export type ExcelOrderStatus =
  | 'pendiente'
  | 'pagada'
  | 'entregada'
  | 'error_envio'
  | 'anulada';

export interface ExcelOrderDoc {
  id: string;
  name: string;
  email: string;
  status: ExcelOrderStatus;
  amountCLP: number;
  paymentReference?: string;
  licenseId: string;
  termsAcceptedAt: string;
  createdAt?: unknown;
  paidAt?: string;
  deliveredAt?: string;
  deliveryAttempts: number;
  lastError?: string;
}

export class TemplateMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateMissingError';
  }
}

const BOOTSTRAPPED_ADMIN_EMAIL = 'jose.growy@gmail.com';
const EXCEL_DEFAULT_PRICE_CLP = 4990;
const EXCEL_DEFAULT_PRODUCT_NAME = 'Equilibrio Lite Excel';
const EXCEL_DEFAULT_PAYMENT_URL =
  process.env.VITE_MERCADOPAGO_EXCEL_PAYMENT_URL?.trim() || 'https://mpago.la/2QPhp4N';
const LICENSE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const NON_REPLACEMENT_NOTICE =
  'Equilibrio Lite Excel no reemplaza la tecnología de GROWy. Al tomar Equilibrio tienes un analista financiero (el Analista PYME) que te explica tus cifras con palabras sencillas, y todo el proceso es mucho más automático.';

interface AppletFirebaseConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

let cachedAdminApp: App | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedConfig: AppletFirebaseConfig | null = null;

function readAppletConfig(): AppletFirebaseConfig {
  if (cachedConfig) return cachedConfig;
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as AppletFirebaseConfig;
      cachedConfig = parsed;
      return parsed;
    }
  } catch {
    // Fallback abajo
  }
  cachedConfig = {};
  return cachedConfig;
}

export function getFirebaseAdminContext(): {
  app: App;
  db: Firestore;
  auth: Auth;
  hasServiceAccount: boolean;
} {
  if (cachedAdminApp && cachedDb && cachedAuth) {
    return {
      app: cachedAdminApp,
      db: cachedDb,
      auth: cachedAuth,
      hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()),
    };
  }

  const appletCfg = readAppletConfig();
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    appletCfg.projectId ||
    undefined;
  const databaseId =
    process.env.FIRESTORE_DATABASE_ID?.trim() ||
    appletCfg.firestoreDatabaseId ||
    undefined;

  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  let app: App;

  if (getApps().length > 0) {
    app = getApp();
  } else if (rawSa) {
    const parsedSa = JSON.parse(rawSa) as Record<string, unknown>;
    app = initializeApp({
      credential: cert(parsedSa as Parameters<typeof cert>[0]),
      ...(projectId ? { projectId } : {}),
    });
  } else {
    app = initializeApp(projectId ? { projectId } : undefined);
  }

  const db =
    databaseId && databaseId !== '(default)'
      ? getFirestore(app, databaseId)
      : getFirestore(app);
  const auth = getAuth(app);

  cachedAdminApp = app;
  cachedDb = db;
  cachedAuth = auth;

  return {
    app,
    db,
    auth,
    hasServiceAccount: Boolean(rawSa),
  };
}

export function isAdminCredentialError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('Could not load the default credentials') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('Could not refresh access token')
  );
}

/**
 * Rate limiter por IP en memoria con limpieza automática de ventanas expiradas.
 */
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  return (req.ip || req.socket.remoteAddress || 'unknown').slice(0, 64);
}

export function checkIpRateLimit(
  req: Request,
  bucket: 'create' | 'verify' | 'download',
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (rateLimitBuckets.size > 1500) {
    for (const [k, v] of rateLimitBuckets.entries()) {
      if (v.resetAt <= now) rateLimitBuckets.delete(k);
    }
  }

  const ip = extractClientIp(req);
  const key = `${bucket}:${ip}`;
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

function stripControlChars(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeAndValidateBuyerInput(body: unknown): {
  ok: true;
  name: string;
  email: string;
} | {
  ok: false;
  error: string;
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Datos de compra inválidos.' };
  }
  const raw = body as Record<string, unknown>;
  const name = stripControlChars(typeof raw.name === 'string' ? raw.name : '').slice(0, 100);
  const email = stripControlChars(typeof raw.email === 'string' ? raw.email : '')
    .toLowerCase()
    .slice(0, 160);
  const emailConfirm = stripControlChars(
    typeof raw.emailConfirm === 'string' ? raw.emailConfirm : ''
  )
    .toLowerCase()
    .slice(0, 160);
  const termsAccepted = raw.termsAccepted === true;

  if (name.length < 2 || name.length > 100) {
    return {
      ok: false,
      error: 'Ingresa tu nombre completo (entre 2 y 100 caracteres).',
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) {
    return {
      ok: false,
      error: 'Ingresa un correo electrónico válido.',
    };
  }
  if (email !== emailConfirm) {
    return {
      ok: false,
      error: 'Los correos electrónicos no coinciden. Revísalos para asegurar la entrega.',
    };
  }
  if (!termsAccepted) {
    return {
      ok: false,
      error:
        'Debes aceptar los Términos de licencia personal y la Política de privacidad para continuar.',
    };
  }

  return { ok: true, name, email };
}

function escapeXmlValue(raw: string): string {
  // Elimina caracteres de control no permitidos en XML 1.0 y escapa entidades XML estándar
  const clean = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveExcelTemplatePath(): string {
  const configured = process.env.EXCEL_TEMPLATE_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), 'server-assets', 'EquilibrioLite_plantilla.xlsx');
}

/**
 * Abre la plantilla .xlsx como ZIP (sin librerías destructivas como SheetJS/ExcelJS),
 * reemplaza {{LICENSEE}} y {{LICENSE_ID}} únicamente en entradas .xml y vuelve a empaquetar.
 */
export async function generatePersonalizedExcelBuffer(params: {
  licenseeName: string;
  licenseId: string;
}): Promise<Buffer> {
  const templatePath = resolveExcelTemplatePath();
  if (!fs.existsSync(templatePath)) {
    throw new TemplateMissingError(
      'Falta subir la plantilla EquilibrioLite_plantilla.xlsx en el servidor (EXCEL_TEMPLATE_PATH).'
    );
  }

  const templateBuf = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuf);
  const xmlName = escapeXmlValue(params.licenseeName);
  const xmlId = escapeXmlValue(params.licenseId);

  const xmlEntries = Object.keys(zip.files).filter(
    (entryName) => !zip.files[entryName].dir && /\.xml$/i.test(entryName)
  );

  for (const entryName of xmlEntries) {
    const file = zip.file(entryName);
    if (!file) continue;
    const content = await file.async('string');
    if (content.includes('{{LICENSEE}}') || content.includes('{{LICENSE_ID}}')) {
      const updated = content
        .split('{{LICENSEE}}')
        .join(xmlName)
        .split('{{LICENSE_ID}}')
        .join(xmlId);
      zip.file(entryName, updated);
    }
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function generateLicenseIdCandidate(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += LICENSE_ALPHABET[crypto.randomInt(0, LICENSE_ALPHABET.length)];
  }
  return `GROWY-${code}`;
}

export async function generateUniqueLicenseId(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateLicenseIdCandidate();
    const existing = await db
      .collection('excelOrders')
      .where('licenseId', '==', candidate)
      .limit(1)
      .get();
    if (existing.empty) return candidate;
  }
  throw new Error('No fue posible generar un ID de licencia único.');
}

export async function readExcelConfigFromFirestore(db: Firestore): Promise<{
  active: boolean;
  productName: string;
  priceAmount: number;
  priceLabel: string;
  fallbackPaymentUrl: string;
}> {
  try {
    const snap = await db.collection('appConfig').doc('public').get();
    if (!snap.exists) {
      return {
        active: true,
        productName: EXCEL_DEFAULT_PRODUCT_NAME,
        priceAmount: EXCEL_DEFAULT_PRICE_CLP,
        priceLabel: '$4.990 CLP',
        fallbackPaymentUrl: EXCEL_DEFAULT_PAYMENT_URL,
      };
    }
    const data = snap.data() as {
      excelActive?: boolean;
      excelProductName?: string;
      excelPriceAmount?: number;
      excelPriceLabel?: string;
      excelPaymentUrl?: string;
    };
    const priceAmount =
      typeof data.excelPriceAmount === 'number' &&
      Number.isFinite(data.excelPriceAmount) &&
      data.excelPriceAmount > 0
        ? Math.round(data.excelPriceAmount)
        : EXCEL_DEFAULT_PRICE_CLP;

    const rawPaymentUrl = (data.excelPaymentUrl || '').trim();
    const effectivePaymentUrl =
      !rawPaymentUrl || rawPaymentUrl === 'https://mpago.la/2SUfb1A'
        ? EXCEL_DEFAULT_PAYMENT_URL
        : rawPaymentUrl;

    return {
      active: data.excelActive !== false,
      productName: (data.excelProductName || EXCEL_DEFAULT_PRODUCT_NAME).trim(),
      priceAmount,
      priceLabel:
        (data.excelPriceLabel || `$${priceAmount.toLocaleString('es-CL')} CLP`).trim(),
      fallbackPaymentUrl: effectivePaymentUrl,
    };
  } catch {
    return {
      active: true,
      productName: EXCEL_DEFAULT_PRODUCT_NAME,
      priceAmount: EXCEL_DEFAULT_PRICE_CLP,
      priceLabel: '$4.990 CLP',
      fallbackPaymentUrl: EXCEL_DEFAULT_PAYMENT_URL,
    };
  }
}

function getSigningSecret(): string | null {
  const secret =
    process.env.EXCEL_DOWNLOAD_SIGNING_SECRET?.trim() ||
    process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!secret || secret === 'reemplazar_por_secreto_hmac' || secret === 'reemplazar_por_secreto_descarga_excel') {
    return null;
  }
  return secret;
}

export function buildSignedDownloadUrl(baseUrl: string, orderId: string, licenseId: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const exp = Date.now() + 72 * 60 * 60 * 1000;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}:${licenseId}:${exp}`)
    .digest('hex');
  return `${baseUrl.replace(/\/$/, '')}/api/excel/download?orderId=${encodeURIComponent(orderId)}&exp=${exp}&sig=${sig}`;
}

export function verifySignedDownloadParams(params: {
  orderId: string;
  licenseId: string;
  expRaw: string;
  sigRaw: string;
}): boolean {
  const secret = getSigningSecret();
  if (!secret) return false;
  const exp = Number(params.expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${params.orderId}:${params.licenseId}:${exp}`)
    .digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(params.sigRaw, 'utf8');
  return (
    expectedBuf.length === receivedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, receivedBuf)
  );
}

export function getPublicAppBaseUrl(req?: Request): string {
  const envUrl = process.env.APP_URL?.trim();
  if (envUrl && /^https?:\/\//i.test(envUrl) && !envUrl.includes('MY_APP_URL')) {
    return envUrl.replace(/\/$/, '');
  }
  if (req) {
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto =
      typeof protoHeader === 'string' && protoHeader.trim()
        ? protoHeader.split(',')[0].trim()
        : req.protocol || 'https';
    const host = req.get('host');
    if (host) {
      return `${proto}://${host}`;
    }
  }
  return 'https://growychile.cl';
}

async function sendDeliveryEmailWithResend(params: {
  order: ExcelOrderDoc;
  productName: string;
  xlsxBuffer: Buffer;
  baseUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error: 'Falta configurar RESEND_API_KEY en el servidor para enviar correos.',
    };
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() || 'GROWy Equilibrio <onboarding@resend.dev>';
  const supportEmail = process.env.ADMIN_SUPPORT_EMAIL?.trim() || BOOTSTRAPPED_ADMIN_EMAIL;
  const safeNameHtml = escapeHtml(params.order.name);
  const safeLicenseHtml = escapeHtml(params.order.licenseId);
  const safeProductHtml = escapeHtml(params.productName);
  const equilibrioUrl = `${params.baseUrl.replace(/\/$/, '')}/#equilibrio`;
  const filename = `Equilibrio-Lite-${params.order.licenseId}.xlsx`;

  const buildEmailBodies = (downloadLink?: string) => {
    const text = [
      `Hola ${params.order.name},`,
      '',
      `¡Gracias por elegir ${params.productName}! Tu pago fue confirmado y aquí tienes tu copia personal.`,
      `ID de licencia personal: ${params.order.licenseId}`,
      downloadLink
        ? `Descarga tu planilla personalizada desde este enlace seguro (válido por 72 horas): ${downloadLink}`
        : `Adjunto encontrarás el archivo ${filename} listo para usar en tu computador.`,
      '',
      '3 pasos simples para partir hoy:',
      '1. Abre tu planilla en Microsoft Excel (también funciona en Google Sheets con limitaciones visuales) y revisa la hoja "Inicio".',
      '2. Completa "Mi negocio", "Costos fijos" y registra tus productos (hasta 10) en "Productos".',
      '3. Mira tu meta mínima en "Punto de equilibrio", anota tus movimientos en "Ventas reales" y "Caja", y revisa tus semáforos en "Resumen".',
      '',
      'Nota importante:',
      NON_REPLACEMENT_NOTICE,
      'Las estimaciones tributarias de la planilla son referenciales y no reemplazan a un contador.',
      '',
      `Cuando sientas que quieres ahorrar trabajo manual y contar con automatización y explicaciones en simple, Equilibrio te espera en ${equilibrioUrl}`,
      '',
      `¿Tienes alguna duda o problema para abrir tu archivo? Escríbenos a ${supportEmail}.`,
      '',
      'Un abrazo cercano,',
      'Equipo GROWy.',
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; background: #FFF7F3; color: #1F1B2E; border-radius: 20px;">
        <div style="background: #FFFFFF; border: 1px solid #EFE2E5; border-radius: 18px; padding: 26px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #B4474A; text-transform: uppercase; letter-spacing: 0.05em;">GROWy. · Entrega automática</p>
          <h1 style="margin: 0 0 12px; font-size: 22px; color: #1F1B2E;">Hola ${safeNameHtml}, tu ${safeProductHtml} está listo</h1>
          <p style="margin: 0 0 14px; font-size: 14px; color: #544E63; line-height: 1.6;">
            Confirmamos tu pago único y preparamos tu copia personalizada con licencia personal e intransferible.
          </p>
          <div style="background: #F6F4FA; border: 1px solid #DDD6EC; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; font-size: 13px;">
            <strong>ID de licencia:</strong> <span style="font-family: monospace; font-weight: 700; color: #1F1B2E;">${safeLicenseHtml}</span>
          </div>

          ${
            downloadLink
              ? `<p style="margin: 0 0 18px;"><a href="${escapeHtml(downloadLink)}" style="display: inline-block; background: #1F1B2E; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 13px; padding: 12px 20px; border-radius: 999px;">Descargar mi Equilibrio Lite Excel</a></p>`
              : `<p style="margin: 0 0 16px; font-size: 13px; color: #1E7A6B; font-weight: 600;">Encontrarás tu archivo <strong>${escapeHtml(filename)}</strong> adjunto en este mismo correo.</p>`
          }

          <h2 style="margin: 0 0 8px; font-size: 15px; color: #1F1B2E;">3 pasos para empezar hoy:</h2>
          <ol style="margin: 0 0 18px; padding-left: 18px; font-size: 13px; color: #3D384B; line-height: 1.65;">
            <li><strong>Abre tu planilla:</strong> idealmente en Microsoft Excel de escritorio (funciona en Google Sheets con limitaciones visuales) y lee la hoja <em>Inicio</em>.</li>
            <li><strong>Carga tu base:</strong> completa <em>Mi negocio</em>, tus <em>Costos fijos</em> y tus productos (hasta 10) en <em>Productos</em>.</li>
            <li><strong>Sigue tus cifras:</strong> revisa tu meta en <em>Punto de equilibrio</em>, registra tu mes en <em>Ventas reales</em> y <em>Caja</em>, y mira tus semáforos en <em>Resumen</em>.</li>
          </ol>

          <div style="background: #FFF3EF; border: 1px solid #F2C9BC; border-radius: 14px; padding: 14px 16px; margin-bottom: 16px; font-size: 13px; color: #4A342E; line-height: 1.55;">
            <p style="margin: 0 0 8px; font-weight: 700; color: #9F3E37;">Importante sobre el alcance de esta planilla</p>
            <p style="margin: 0 0 8px;">${escapeHtml(NON_REPLACEMENT_NOTICE)}</p>
            <p style="margin: 0; font-size: 12px; color: #6B5751;">Las estimaciones tributarias de la planilla son referenciales y no reemplazan a un contador.</p>
          </div>

          <p style="margin: 0 0 14px; font-size: 13px; color: #544E63; line-height: 1.6;">
            Cuando quieras dar el siguiente paso para que tus cifras se calculen y se expliquen de forma más automática, siempre puedes <a href="${escapeHtml(equilibrioUrl)}" style="color: #B4474A; font-weight: 700;">conocer Equilibrio aquí</a>, sin apuros.
          </p>

          <p style="margin: 0; font-size: 12px; color: #6E6D7A; border-top: 1px solid #EFE2E5; padding-top: 12px;">
            ¿Necesitas ayuda? Escríbenos directo a <a href="mailto:${escapeHtml(supportEmail)}" style="color: #1F1B2E; font-weight: 600;">${escapeHtml(supportEmail)}</a>.<br/>
            Un abrazo, Equipo GROWy.
          </p>
        </div>
      </div>
    `;

    return { text, html };
  };

  const primaryBodies = buildEmailBodies();
  const primaryRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.order.email],
      reply_to: supportEmail,
      subject: `Tu ${params.productName} está listo · Licencia ${params.order.licenseId}`,
      text: primaryBodies.text,
      html: primaryBodies.html,
      attachments: [
        {
          filename,
          content: params.xlsxBuffer.toString('base64'),
        },
      ],
    }),
  });

  if (primaryRes.ok) {
    return { ok: true };
  }

  const errText = await primaryRes.text().catch(() => '');
  const signedLink = buildSignedDownloadUrl(params.baseUrl, params.order.id, params.order.licenseId);
  if ((primaryRes.status === 413 || primaryRes.status === 422) && signedLink) {
    const linkBodies = buildEmailBodies(signedLink);
    const fallbackRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.order.email],
        reply_to: supportEmail,
        subject: `Tu ${params.productName} está listo · Licencia ${params.order.licenseId}`,
        text: linkBodies.text,
        html: linkBodies.html,
      }),
    });
    if (fallbackRes.ok) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    error: `Resend respondió ${primaryRes.status}: ${errText.slice(0, 220) || 'Error al enviar el correo.'}`,
  };
}

/**
 * Entrega idempotente de una orden de Equilibrio Lite Excel.
 * Si dos webhooks o retornos llegan simultáneamente o repetidos:
 * - Si ya está `entregada` y !forceResend, no regenera ID ni envía correo duplicado.
 * - Si falla plantilla o envío de correo, marca `error_envio` con detalle claro sin caer la app.
 */
const inFlightOrderDeliveries = new Map<string, Promise<FulfillExcelResult>>();

export interface FulfillExcelResult {
  ok: boolean;
  status: ExcelOrderStatus | 'not_found';
  alreadyDelivered?: boolean;
  licenseId?: string;
  message: string;
}

export async function fulfillExcelOrderIdempotent(params: {
  orderId: string;
  paymentReference?: string;
  baseUrl: string;
  forceResend?: boolean;
}): Promise<FulfillExcelResult> {
  const existingFlight = inFlightOrderDeliveries.get(params.orderId);
  if (existingFlight && !params.forceResend) {
    return existingFlight;
  }

  const work = (async (): Promise<FulfillExcelResult> => {
    const { db } = getFirebaseAdminContext();
    const orderRef = db.collection('excelOrders').doc(params.orderId);
    const nowISO = new Date().toISOString();

    const txOutcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) {
        return { action: 'not_found' as const };
      }
      const order = { ...(snap.data() as Omit<ExcelOrderDoc, 'id'>), id: snap.id };

      if (order.status === 'anulada') {
        return { action: 'cancelled' as const, order };
      }

      if (order.status === 'entregada' && !params.forceResend) {
        return { action: 'already_delivered' as const, order };
      }

      const nextAttempts = (Number(order.deliveryAttempts) || 0) + 1;
      const updateFields: Record<string, unknown> = {
        status: 'pagada',
        paidAt: order.paidAt || nowISO,
        deliveryAttempts: nextAttempts,
      };
      if (params.paymentReference && !order.paymentReference) {
        updateFields.paymentReference = params.paymentReference.slice(0, 160);
      }
      tx.update(orderRef, updateFields);

      return {
        action: 'proceed' as const,
        order: {
          ...order,
          status: 'pagada' as ExcelOrderStatus,
          paidAt: order.paidAt || nowISO,
          paymentReference: order.paymentReference || params.paymentReference,
          deliveryAttempts: nextAttempts,
        },
      };
    });

    if (txOutcome.action === 'not_found') {
      return {
        ok: false,
        status: 'not_found',
        message: 'No encontramos la orden solicitada.',
      };
    }

    if (txOutcome.action === 'cancelled') {
      return {
        ok: false,
        status: 'anulada',
        licenseId: txOutcome.order.licenseId,
        message: 'Esta orden fue anulada por administración.',
      };
    }

    if (txOutcome.action === 'already_delivered') {
      return {
        ok: true,
        status: 'entregada',
        alreadyDelivered: true,
        licenseId: txOutcome.order.licenseId,
        message: `Tu Equilibrio Lite Excel ya fue enviado a ${txOutcome.order.email} (Licencia ${txOutcome.order.licenseId}).`,
      };
    }

    const order = txOutcome.order;
    const cfg = await readExcelConfigFromFirestore(db);

    try {
      const xlsxBuffer = await generatePersonalizedExcelBuffer({
        licenseeName: order.name,
        licenseId: order.licenseId,
      });

      const emailResult = await sendDeliveryEmailWithResend({
        order,
        productName: cfg.productName,
        xlsxBuffer,
        baseUrl: params.baseUrl,
      });

      if (!emailResult.ok) {
        const errMsg = emailResult.error.slice(0, 390);
        await orderRef.update({
          status: 'error_envio',
          lastError: errMsg,
        });
        return {
          ok: false,
          status: 'error_envio',
          licenseId: order.licenseId,
          message:
            'Tu pago fue confirmado, pero tuvimos un problema al enviar el correo. El equipo podrá reintentar el envío de inmediato.',
        };
      }

      await orderRef.update({
        status: 'entregada',
        deliveredAt: new Date().toISOString(),
        lastError: FieldValue.delete(),
      });

      return {
        ok: true,
        status: 'entregada',
        licenseId: order.licenseId,
        message: `¡Listo! Enviamos tu ${cfg.productName} personalizado al correo ${order.email} (Licencia ${order.licenseId}).`,
      };
    } catch (err) {
      const safeError = (err instanceof Error ? err.message : 'Error generando o enviando la planilla.').slice(0, 390);
      await orderRef.update({
        status: 'error_envio',
        lastError: safeError,
      });
      console.error(`[Excel Delivery] Error en orden ${order.id}:`, err);
      return {
        ok: false,
        status: 'error_envio',
        licenseId: order.licenseId,
        message:
          err instanceof TemplateMissingError
            ? 'Tu pago quedó confirmado, pero la plantilla aún está pendiente de carga en el servidor. Escríbenos a jose.growy@gmail.com o reintenta desde administración.'
            : 'Tu pago quedó confirmado, pero hubo un error temporal al enviar el correo. Podremos reenviar tu archivo desde administración.',
      };
    }
  })();

  inFlightOrderDeliveries.set(params.orderId, work);
  try {
    return await work;
  } finally {
    inFlightOrderDeliveries.delete(params.orderId);
  }
}

export async function verifyMercadoPagoPaymentForExcelOrder(params: {
  orderId: string;
  paymentId?: string;
  expectedAmountCLP: number;
}): Promise<{
  approved: boolean;
  mpPaymentId?: string;
  mpStatus?: string;
}> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    return { approved: false };
  }

  const checkPaymentRecord = (rec: {
    id?: string | number;
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
  }): { approved: boolean; mpPaymentId?: string; mpStatus?: string } => {
    const idStr = rec.id !== undefined ? String(rec.id) : undefined;
    const okRef = rec.external_reference === params.orderId;
    const okCurrency = !rec.currency_id || rec.currency_id === 'CLP';
    const okAmount = Number(rec.transaction_amount ?? 0) >= params.expectedAmountCLP;
    const approved = rec.status === 'approved' && okRef && okCurrency && okAmount;
    return { approved, mpPaymentId: idStr, mpStatus: rec.status };
  };

  if (params.paymentId) {
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(params.paymentId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (mpRes.ok) {
      const mpData = (await mpRes.json()) as {
        id?: string | number;
        status?: string;
        external_reference?: string;
        transaction_amount?: number;
        currency_id?: string;
      };
      // Verificar coincidencia estricta de external_reference para evitar reutilización de otro pago
      if (mpData.external_reference !== params.orderId) {
        return { approved: false, mpStatus: 'external_reference_mismatch' };
      }
      return checkPaymentRecord(mpData);
    }
  }

  const searchRes = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(params.orderId)}&sort=date_created&criteria=desc&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!searchRes.ok) {
    return { approved: false };
  }
  const searchJson = (await searchRes.json()) as {
    results?: Array<{
      id?: string | number;
      status?: string;
      external_reference?: string;
      transaction_amount?: number;
      currency_id?: string;
    }>;
  };
  const results = Array.isArray(searchJson.results) ? searchJson.results : [];
  for (const rec of results) {
    const evaluated = checkPaymentRecord(rec);
    if (evaluated.approved) return evaluated;
  }
  return {
    approved: false,
    mpPaymentId: results[0]?.id !== undefined ? String(results[0].id) : undefined,
    mpStatus: results[0]?.status,
  };
}

export async function verifyAdminRequest(req: Request): Promise<
  | { ok: true; uid: string; email: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Falta token de autorización.' };
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return { ok: false, status: 401, error: 'Token vacío.' };
  }

  try {
    const { auth, db } = getFirebaseAdminContext();
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.email_verified !== true) {
      return { ok: false, status: 403, error: 'Correo de administrador no verificado.' };
    }
    const email = (decoded.email || '').trim().toLowerCase();
    if (email === BOOTSTRAPPED_ADMIN_EMAIL) {
      return { ok: true, uid: decoded.uid, email };
    }
    const adminMarker = await db.collection('admins').doc(decoded.uid).get();
    if (!adminMarker.exists) {
      return { ok: false, status: 403, error: 'Permisos insuficientes de administrador.' };
    }
    return { ok: true, uid: decoded.uid, email: email || decoded.uid };
  } catch (err) {
    if (isAdminCredentialError(err)) {
      return {
        ok: false,
        status: 503,
        error:
          'Configura FIREBASE_SERVICE_ACCOUNT_JSON en el servidor para habilitar operaciones de Admin SDK.',
      };
    }
    return { ok: false, status: 401, error: 'Sesión administrativa inválida o expirada.' };
  }
}
