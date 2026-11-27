import crypto from 'node:crypto';
import type { Request } from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  ANNUAL_PRICE_CLP,
  buildReceiptNumber,
  computeAnnualDueDate,
  computeNextCycleDueDate,
  isComplimentaryClientEmail,
  MONTHLY_PRICE_CLP,
} from '../src/finance/subscription';
import type { BillingDay, PlanType } from '../src/types/finance';
import {
  getFirebaseAdminContext,
  getPublicAppBaseUrl,
  isAdminCredentialError,
} from './excelDelivery';

export type EquilibrioOrderStatus =
  | 'pendiente'
  | 'pagada'
  | 'rechazada'
  | 'reembolsada'
  | 'error';

export interface EquilibrioOrderDoc {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  productCode: 'equilibrio';
  planType: PlanType;
  billingDay?: BillingDay;
  amountCLP: number;
  status: EquilibrioOrderStatus;
  mpPaymentId?: string;
  nextPaymentDueAt?: string;
  lastError?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  paidAt?: string;
}

const DEFAULT_MONTHLY_MP_URL =
  process.env.VITE_MERCADOPAGO_PAYMENT_URL?.trim() || 'https://mpago.la/1muS2bx';
const DEFAULT_ANNUAL_MP_URL =
  process.env.VITE_MERCADOPAGO_ANNUAL_PAYMENT_URL?.trim() || 'https://mpago.la/1htV6zn';

const PLACEHOLDER_SECRETS = new Set([
  '',
  'reemplazar_por_secreto_hmac',
  'reemplazar_por_secreto_descarga_excel',
  'reemplazar_por_secreto_webhook_mp',
]);

function getRealSecret(value?: string): string | null {
  const clean = (value ?? '').trim();
  if (!clean || PLACEHOLDER_SECRETS.has(clean)) return null;
  return clean;
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clampStr(val: unknown, max: number): string {
  if (typeof val !== 'string') return '';
  return val.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
}

/**
 * Verifica el token Bearer de Firebase Auth de cualquier usuario verificado.
 * Nota: verifyIdToken usa las llaves públicas de Google y funciona sin FIREBASE_SERVICE_ACCOUNT_JSON.
 */
export async function verifyAuthenticatedUserRequest(req: Request): Promise<
  | { ok: true; uid: string; email: string; displayName: string }
  | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Debes iniciar sesión para continuar.' };
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return { ok: false, status: 401, error: 'Token de sesión vacío.' };
  }

  try {
    const { auth } = getFirebaseAdminContext();
    const decoded = await auth.verifyIdToken(idToken);
    if (decoded.email_verified !== true) {
      return {
        ok: false,
        status: 403,
        error: 'Verifica tu correo electrónico antes de continuar.',
      };
    }
    const email = (decoded.email || '').trim().toLowerCase();
    if (!email) {
      return { ok: false, status: 400, error: 'Tu cuenta no tiene un correo asociado.' };
    }
    const displayName =
      typeof decoded.name === 'string' && decoded.name.trim()
        ? decoded.name.trim().slice(0, 100)
        : email.split('@')[0];
    return { ok: true, uid: decoded.uid, email, displayName };
  } catch {
    return { ok: false, status: 401, error: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
  }
}

/**
 * Valida la firma de webhooks de Mercado Pago (`x-signature` + `x-request-id`)
 * o firma HMAC personalizada (`x-webhook-signature`).
 */
export function verifyMercadoPagoWebhookSignature(params: {
  req: Request;
  rawBody: Buffer;
  parsedBody: Record<string, unknown>;
}): { ok: boolean; verifiedWithSecret: boolean; reason?: string } {
  const { req, rawBody, parsedBody } = params;
  const mpSecret = getRealSecret(process.env.MP_WEBHOOK_SECRET);
  const legacySecret = getRealSecret(process.env.PAYMENT_WEBHOOK_SECRET);

  const legacySig = req.headers['x-webhook-signature'];
  if (legacySecret && typeof legacySig === 'string' && legacySig.trim()) {
    const expected = crypto.createHmac('sha256', legacySecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(legacySig.trim(), 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, verifiedWithSecret: true };
    }
    return {
      ok: false,
      verifiedWithSecret: false,
      reason: 'Firma x-webhook-signature inválida.',
    };
  }

  const effectiveMpSecret = mpSecret || legacySecret;
  const xSignatureRaw = req.headers['x-signature'];

  if (typeof xSignatureRaw === 'string' && xSignatureRaw.trim() && effectiveMpSecret) {
    const parts = xSignatureRaw.split(',');
    let ts = '';
    let v1 = '';
    for (const part of parts) {
      const idx = part.indexOf('=');
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k === 'ts') ts = v;
      if (k === 'v1') v1 = v.toLowerCase();
    }

    if (!ts || !v1) {
      return {
        ok: false,
        verifiedWithSecret: false,
        reason: 'Encabezado x-signature incompleto.',
      };
    }

    const xRequestId =
      typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].trim() : '';

    const rawDataId =
      (typeof req.query['data.id'] === 'string' ? req.query['data.id'] : undefined) ??
      (typeof req.query.id === 'string' ? req.query.id : undefined) ??
      (parsedBody.data && typeof parsedBody.data === 'object'
        ? (parsedBody.data as { id?: unknown }).id
        : undefined);
    const dataIdNormalized =
      rawDataId !== undefined && rawDataId !== null
        ? String(rawDataId).trim().toLowerCase()
        : '';

    const manifestParts: string[] = [];
    if (dataIdNormalized) manifestParts.push(`id:${dataIdNormalized}`);
    if (xRequestId) manifestParts.push(`request-id:${xRequestId}`);
    manifestParts.push(`ts:${ts}`);
    const manifest = `${manifestParts.join(';')};`;

    const expectedV1 = crypto
      .createHmac('sha256', effectiveMpSecret)
      .update(manifest)
      .digest('hex')
      .toLowerCase();

    const a = Buffer.from(expectedV1, 'utf8');
    const b = Buffer.from(v1, 'utf8');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, verifiedWithSecret: true };
    }
    return {
      ok: false,
      verifiedWithSecret: false,
      reason: 'Firma x-signature de Mercado Pago no coincide.',
    };
  }

  // Si MP_WEBHOOK_SECRET fue configurado explícitamente, exigir x-signature válido siempre
  if (mpSecret) {
    return {
      ok: false,
      verifiedWithSecret: false,
      reason: 'Falta encabezado x-signature requerido.',
    };
  }

  return { ok: true, verifiedWithSecret: false };
}

export async function readEquilibrioPricingFromFirestore(db?: Firestore): Promise<{
  monthlyPriceClp: number;
  annualPriceClp: number;
  monthlyPaymentUrl: string;
  annualPaymentUrl: string;
}> {
  const defaults = {
    monthlyPriceClp: MONTHLY_PRICE_CLP,
    annualPriceClp: ANNUAL_PRICE_CLP,
    monthlyPaymentUrl: DEFAULT_MONTHLY_MP_URL,
    annualPaymentUrl: DEFAULT_ANNUAL_MP_URL,
  };
  if (!db) return defaults;

  try {
    const snap = await db.collection('appConfig').doc('public').get();
    if (!snap.exists) return defaults;
    const data = snap.data() as {
      monthlyPriceClp?: number;
      annualPriceClp?: number;
      paymentUrl?: string;
      annualPaymentUrl?: string;
    };
    const monthlyPriceClp =
      typeof data.monthlyPriceClp === 'number' && data.monthlyPriceClp >= 1000
        ? Math.round(data.monthlyPriceClp)
        : MONTHLY_PRICE_CLP;
    const annualPriceClp =
      typeof data.annualPriceClp === 'number' &&
      data.annualPriceClp >= 1000 &&
      data.annualPriceClp !== 50000
        ? Math.round(data.annualPriceClp)
        : ANNUAL_PRICE_CLP;

    const rawMonthlyUrl = (data.paymentUrl || '').trim();
    const rawAnnualUrl = (data.annualPaymentUrl || '').trim();

    return {
      monthlyPriceClp,
      annualPriceClp,
      monthlyPaymentUrl: /^https?:\/\//i.test(rawMonthlyUrl) ? rawMonthlyUrl : DEFAULT_MONTHLY_MP_URL,
      annualPaymentUrl: /^https?:\/\//i.test(rawAnnualUrl) ? rawAnnualUrl : DEFAULT_ANNUAL_MP_URL,
    };
  } catch {
    return defaults;
  }
}

export async function createEquilibrioCheckoutOrder(params: {
  req: Request;
  uid: string;
  email: string;
  displayName: string;
  planType: PlanType;
  billingDay?: BillingDay;
}): Promise<{
  ok: boolean;
  orderId: string;
  checkoutUrl: string;
  mode: 'preference' | 'static_fallback';
  message: string;
}> {
  const orderId = `eq_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
  const isAnnual = params.planType === 'annual';
  const safeBillingDay: BillingDay | undefined =
    !isAnnual &&
    (params.billingDay === 5 || params.billingDay === 15 || params.billingDay === 30)
      ? params.billingDay
      : !isAnnual
        ? 5
        : undefined;

  let db: Firestore | undefined;
  try {
    db = getFirebaseAdminContext().db;
  } catch {
    db = undefined;
  }

  const pricing = await readEquilibrioPricingFromFirestore(db);
  const amountCLP = isAnnual ? pricing.annualPriceClp : pricing.monthlyPriceClp;
  const fallbackUrl = isAnnual ? pricing.annualPaymentUrl : pricing.monthlyPaymentUrl;

  if (db) {
    try {
      const orderPayload: Record<string, unknown> = {
        id: orderId,
        uid: params.uid,
        email: params.email,
        displayName: clampStr(params.displayName, 100) || params.email,
        productCode: 'equilibrio',
        planType: isAnnual ? 'annual' : 'monthly',
        amountCLP,
        status: 'pendiente',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (safeBillingDay) {
        orderPayload.billingDay = safeBillingDay;
      }
      await db.collection('equilibrioOrders').doc(orderId).set(orderPayload);
    } catch (err) {
      if (!isAdminCredentialError(err)) {
        console.warn('[Equilibrio Checkout] No se pudo guardar orden en Firestore:', err);
      }
    }
  }

  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (mpToken) {
    const baseUrl = getPublicAppBaseUrl(params.req);
    const backSuccess = `${baseUrl}/?equilibrio_order=${encodeURIComponent(orderId)}&mp_return=success`;
    const backPending = `${baseUrl}/?equilibrio_order=${encodeURIComponent(orderId)}&mp_return=pending`;
    const backFailure = `${baseUrl}/?equilibrio_order=${encodeURIComponent(orderId)}&mp_return=failure`;

    try {
      const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              id: isAnnual ? 'equilibrio-anual' : 'equilibrio-mensual',
              title: isAnnual
                ? 'GROWy Equilibrio · Plan Anual (12 meses)'
                : 'GROWy Equilibrio · Plan Mensual',
              description: isAnnual
                ? 'Acceso completo por 12 meses a Equilibrio de GROWy'
                : `Suscripción mensual Equilibrio (renovación día ${safeBillingDay ?? 5})`,
              quantity: 1,
              currency_id: 'CLP',
              unit_price: amountCLP,
            },
          ],
          payer: {
            name: clampStr(params.displayName, 100),
            email: params.email,
          },
          external_reference: orderId,
          metadata: {
            uid: params.uid,
            email: params.email,
            productCode: 'equilibrio',
            planType: isAnnual ? 'annual' : 'monthly',
            ...(safeBillingDay ? { billingDay: safeBillingDay } : {}),
          },
          back_urls: {
            success: backSuccess,
            pending: backPending,
            failure: backFailure,
          },
          auto_return: 'approved',
          notification_url: `${baseUrl}/api/webhooks/payment?source_news=webhooks`,
          statement_descriptor: 'GROWY EQUILIBRIO',
        }),
      });

      if (prefRes.ok) {
        const prefData = (await prefRes.json()) as {
          init_point?: string;
          sandbox_init_point?: string;
        };
        const checkoutUrl = prefData.init_point || prefData.sandbox_init_point;
        if (checkoutUrl) {
          return {
            ok: true,
            orderId,
            checkoutUrl,
            mode: 'preference',
            message: 'Redirigiendo al pago oficial en Mercado Pago...',
          };
        }
      }
    } catch (err) {
      console.warn('[Equilibrio Checkout] Falló creación de preferencia MP:', err);
    }
  }

  return {
    ok: true,
    orderId,
    checkoutUrl: fallbackUrl,
    mode: 'static_fallback',
    message:
      'Abriendo el enlace oficial de Mercado Pago. Asegúrate de pagar con tu mismo correo de GROWy.',
  };
}

export interface MercadoPagoPaymentDetails {
  id: string;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string;
  payerEmail?: string;
  metadata?: Record<string, unknown>;
}

export async function fetchMercadoPagoPaymentById(
  mpPaymentId: string
): Promise<MercadoPagoPaymentDetails | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(mpPaymentId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id?: string | number;
    status?: string;
    transaction_amount?: number;
    currency_id?: string;
    external_reference?: string;
    payer?: { email?: string };
    metadata?: Record<string, unknown>;
  };
  return {
    id: data.id !== undefined ? String(data.id) : mpPaymentId,
    status: String(data.status || '').toLowerCase(),
    transaction_amount: Number(data.transaction_amount ?? 0),
    currency_id: String(data.currency_id || 'CLP').toUpperCase(),
    external_reference:
      typeof data.external_reference === 'string' ? data.external_reference.trim() : undefined,
    payerEmail:
      typeof data.payer?.email === 'string'
        ? data.payer.email.trim().toLowerCase()
        : undefined,
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : undefined,
  };
}

export async function searchLatestMercadoPagoPaymentByExternalRef(
  externalReference: string
): Promise<MercadoPagoPaymentDetails | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const res = await fetch(
    `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: Array<{
      id?: string | number;
      status?: string;
      transaction_amount?: number;
      currency_id?: string;
      external_reference?: string;
      payer?: { email?: string };
      metadata?: Record<string, unknown>;
    }>;
  };
  const results = Array.isArray(json.results) ? json.results : [];
  if (results.length === 0) return null;

  const approvedOne = results.find((r) => String(r.status || '').toLowerCase() === 'approved');
  const chosen = approvedOne || results[0];
  return {
    id: chosen.id !== undefined ? String(chosen.id) : '',
    status: String(chosen.status || '').toLowerCase(),
    transaction_amount: Number(chosen.transaction_amount ?? 0),
    currency_id: String(chosen.currency_id || 'CLP').toUpperCase(),
    external_reference:
      typeof chosen.external_reference === 'string'
        ? chosen.external_reference.trim()
        : undefined,
    payerEmail:
      typeof chosen.payer?.email === 'string'
        ? chosen.payer.email.trim().toLowerCase()
        : undefined,
    metadata:
      chosen.metadata && typeof chosen.metadata === 'object' ? chosen.metadata : undefined,
  };
}

async function sendEquilibrioReceiptEmailServer(params: {
  email: string;
  displayName: string;
  planType: PlanType;
  amountClp: number;
  transactionId: string;
  paidAt: string;
  periodCoveredEnd: string;
  receiptNumber: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const cleanPlanLabel =
    params.planType === 'annual'
      ? 'Plan Anual GROWy Equilibrio (12 meses · Precio por lanzamiento)'
      : 'Plan Mensual GROWy Equilibrio (Precio por lanzamiento)';
  const formattedAmount = `$${Math.max(0, Math.round(params.amountClp)).toLocaleString('es-CL')} CLP`;
  const paidDateDisplay = params.paidAt.slice(0, 10);

  const textBody = [
    `Comprobante de pago GROWy — Folio ${params.receiptNumber}`,
    '',
    `Hola ${params.displayName || params.email},`,
    'Confirmamos la activación automática de tu acceso a Equilibrio en GROWy:',
    `- Plan: ${cleanPlanLabel}`,
    `- Monto pagado: ${formattedAmount}`,
    `- ID de transacción: ${params.transactionId}`,
    `- Medio de pago: Mercado Pago`,
    `- Fecha de registro: ${paidDateDisplay}`,
    `- Vigencia cubierta hasta: ${params.periodCoveredEnd}`,
    '',
    'Equipo GROWy',
  ].join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #FDF4F5; color: #1A1A1E; border-radius: 16px;">
      <div style="background: #FFFFFF; border: 1px solid #EFE2E5; border-radius: 16px; padding: 24px;">
        <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #C9535B; text-transform: uppercase;">Activación automática · Comprobante oficial</p>
        <h1 style="margin: 0 0 12px; font-size: 20px;">GROWy · Folio ${escapeHtml(params.receiptNumber)}</h1>
        <p style="margin: 0 0 16px; font-size: 14px; color: #6E6D7A;">
          Hola <strong>${escapeHtml(params.displayName || params.email)}</strong>, tu suscripción a Equilibrio quedó activa automáticamente.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Plan</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; font-weight: 600; text-align: right;">${escapeHtml(cleanPlanLabel)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Monto pagado</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; font-weight: 700; text-align: right;">${escapeHtml(formattedAmount)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">ID de transacción</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; font-family: monospace; text-align: right;">${escapeHtml(params.transactionId)}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Fecha de pago</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; text-align: right;">${escapeHtml(paidDateDisplay)}</td></tr>
          <tr><td style="padding: 8px 0; color: #6E6D7A;">Vigencia hasta</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${escapeHtml(params.periodCoveredEnd)}</td></tr>
        </table>
      </div>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'GROWy Pagos <onboarding@resend.dev>',
        to: [params.email],
        subject: `[GROWy] Comprobante de pago ${params.receiptNumber} (${formattedAmount})`,
        text: textBody,
        html: htmlBody,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function activateEquilibrioPaymentIdempotent(params: {
  mpPaymentId: string;
  uid: string;
  planType: PlanType;
  billingDayHint?: BillingDay;
  amountCLP: number;
  orderId?: string;
  payerEmail?: string;
}): Promise<{
  ok: boolean;
  alreadyProcessed: boolean;
  uid: string;
  planType: PlanType;
  nextPaymentDueAt?: string;
  emailed?: boolean;
  reason?: string;
}> {
  const cleanPaymentId = params.mpPaymentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  if (!cleanPaymentId) {
    return {
      ok: false,
      alreadyProcessed: false,
      uid: params.uid,
      planType: params.planType,
      reason: 'missing_payment_id',
    };
  }

  const { db } = getFirebaseAdminContext();
  const processedDocId = `mp_${cleanPaymentId}`;
  const processedRef = db.collection('processedPayments').doc(processedDocId);
  const userRef = db.collection('users').doc(params.uid);
  const paymentHistoryRef = userRef.collection('paymentHistory').doc(processedDocId);
  const orderRef = params.orderId
    ? db.collection('equilibrioOrders').doc(params.orderId)
    : null;

  const nowISO = new Date().toISOString();
  const receiptNumber = buildReceiptNumber(cleanPaymentId, nowISO);

  const txOutcome = await db.runTransaction(async (tx) => {
    const processedSnap = await tx.get(processedRef);
    if (processedSnap.exists) {
      const existingData = processedSnap.data() as {
        outcome?: string;
        planType?: PlanType;
        nextPaymentDueAt?: string;
      };
      if (existingData.outcome === 'activated') {
        return {
          status: 'already_processed' as const,
          planType: existingData.planType || params.planType,
          nextPaymentDueAt: existingData.nextPaymentDueAt,
        };
      }
    }

    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) {
      return { status: 'user_not_found' as const };
    }

    const userData = userSnap.data() as {
      email?: string;
      displayName?: string;
      role?: string;
      planType?: PlanType;
      billingDay?: BillingDay;
      nextPaymentDueAt?: string;
    };

    const existingDueISO =
      typeof userData.nextPaymentDueAt === 'string' ? userData.nextPaymentDueAt : undefined;
    const effectiveBillingDay: BillingDay =
      params.billingDayHint === 5 || params.billingDayHint === 15 || params.billingDayHint === 30
        ? params.billingDayHint
        : userData.billingDay === 5 || userData.billingDay === 15 || userData.billingDay === 30
          ? userData.billingDay
          : 5;

    const nextDue =
      params.planType === 'annual'
        ? computeAnnualDueDate(existingDueISO)
        : computeNextCycleDueDate(effectiveBillingDay, existingDueISO);

    const userUpdate: Record<string, unknown> = {
      accessStatus: 'active',
      paymentStatus: 'paid',
      planType: params.planType,
      nextPaymentDueAt: nextDue,
      lastPaymentAt: nowISO,
      paymentReference: `Mercado Pago (${cleanPaymentId})`.slice(0, 120),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (params.planType === 'monthly') {
      userUpdate.billingDay = effectiveBillingDay;
    }

    tx.update(userRef, userUpdate);

    tx.set(paymentHistoryRef, {
      id: processedDocId,
      ownerUid: params.uid,
      planType: params.planType,
      amountClp: Math.max(0, Math.round(params.amountCLP)),
      transactionId: cleanPaymentId,
      paymentMethod: 'mercadopago',
      paidAt: nowISO,
      periodCoveredEnd: nextDue,
      receiptStatus: 'disponible_descarga',
      receiptNumber,
      notes:
        params.planType === 'annual'
          ? 'Plan Anual 12 meses · Activación automática Mercado Pago'
          : `Plan Mensual (día ${effectiveBillingDay}) · Activación automática Mercado Pago`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (orderRef) {
      const orderSnap = await tx.get(orderRef);
      if (orderSnap.exists) {
        tx.update(orderRef, {
          status: 'pagada',
          mpPaymentId: cleanPaymentId,
          paidAt: nowISO,
          nextPaymentDueAt: nextDue,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    tx.set(processedRef, {
      id: processedDocId,
      mpPaymentId: cleanPaymentId,
      productCode: 'equilibrio',
      planType: params.planType,
      uid: params.uid,
      email: (userData.email || params.payerEmail || '').toLowerCase().slice(0, 160),
      ...(params.orderId ? { orderId: params.orderId } : {}),
      amountCLP: Math.max(0, Math.round(params.amountCLP)),
      status: 'approved',
      outcome: 'activated',
      nextPaymentDueAt: nextDue,
      processedAt: nowISO,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      status: 'activated' as const,
      email: (userData.email || params.payerEmail || '').trim(),
      displayName: (userData.displayName || userData.email || 'Emprendedor').trim(),
      nextPaymentDueAt: nextDue,
    };
  });

  if (txOutcome.status === 'already_processed') {
    return {
      ok: true,
      alreadyProcessed: true,
      uid: params.uid,
      planType: txOutcome.planType,
      nextPaymentDueAt: txOutcome.nextPaymentDueAt,
    };
  }

  if (txOutcome.status === 'user_not_found') {
    return {
      ok: false,
      alreadyProcessed: false,
      uid: params.uid,
      planType: params.planType,
      reason: 'user_not_found',
    };
  }

  let emailed = false;
  if (txOutcome.email) {
    emailed = await sendEquilibrioReceiptEmailServer({
      email: txOutcome.email,
      displayName: txOutcome.displayName,
      planType: params.planType,
      amountClp: params.amountCLP,
      transactionId: cleanPaymentId,
      paidAt: nowISO,
      periodCoveredEnd: txOutcome.nextPaymentDueAt,
      receiptNumber,
    });
    if (emailed) {
      try {
        await paymentHistoryRef.update({
          receiptStatus: 'enviado_correo',
          receiptSentTo: txOutcome.email.slice(0, 160),
          receiptSentAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // Silencioso si ya quedó registrado el historial
      }
    }
  }

  try {
    await db.collection('adminLogs').add({
      adminUid: 'system-webhook',
      adminEmail: 'mercadopago@growy.app',
      action: 'Activación automática MP',
      target: (txOutcome.email || params.uid).slice(0, 160),
      details: `Plan ${params.planType} ($${Math.round(params.amountCLP).toLocaleString('es-CL')}) · Pago MP-${cleanPaymentId} · Vence ${txOutcome.nextPaymentDueAt}`.slice(
        0,
        400
      ),
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // No bloquear activación si falla bitácora secundaria
  }

  return {
    ok: true,
    alreadyProcessed: false,
    uid: params.uid,
    planType: params.planType,
    nextPaymentDueAt: txOutcome.nextPaymentDueAt,
    emailed,
  };
}

export async function recordUnmatchedPaymentInFirestore(params: {
  mpPaymentId: string;
  amountCLP: number;
  payerEmail?: string;
  status: string;
  reason: string;
  externalReference?: string;
}): Promise<void> {
  const cleanPaymentId = params.mpPaymentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  if (!cleanPaymentId) return;
  try {
    const { db } = getFirebaseAdminContext();
    const processedDocId = `mp_${cleanPaymentId}`;
    await db
      .collection('processedPayments')
      .doc(processedDocId)
      .set(
        {
          id: processedDocId,
          mpPaymentId: cleanPaymentId,
          productCode: 'equilibrio',
          email: (params.payerEmail || '').toLowerCase().slice(0, 160),
          ...(params.externalReference ? { orderId: params.externalReference.slice(0, 128) } : {}),
          amountCLP: Math.max(0, Math.round(params.amountCLP)),
          status: params.status.slice(0, 40),
          outcome: 'unmatched_email',
          reason: params.reason.slice(0, 240),
          processedAt: new Date().toISOString(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch {
    // No bloquear webhook si Admin SDK no tiene permisos locales
  }
}

export async function handleEquilibrioNonApprovedStatus(params: {
  mpPaymentId: string;
  mpStatus: string;
  orderId?: string;
  uidHint?: string;
  payerEmail?: string;
  amountCLP?: number;
  isPreapprovalEvent?: boolean;
}): Promise<{ handled: boolean; action: 'revoked' | 'marked_rejected' | 'pending' | 'ignored' }> {
  const cleanStatus = params.mpStatus.toLowerCase();
  const cleanPaymentId = params.mpPaymentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 100);
  const { db } = getFirebaseAdminContext();
  const nowISO = new Date().toISOString();

  let targetUid = params.uidHint;
  let targetOrderId = params.orderId;
  let detectedProductCode: 'equilibrio' | 'excel_lite' =
    targetOrderId?.startsWith('exl_') ? 'excel_lite' : 'equilibrio';

  if (!targetUid && targetOrderId && targetOrderId.startsWith('eq_')) {
    const orderSnap = await db.collection('equilibrioOrders').doc(targetOrderId).get();
    if (orderSnap.exists) {
      targetUid = (orderSnap.data() as EquilibrioOrderDoc).uid;
    }
  }

  if (cleanPaymentId) {
    const procSnap = await db.collection('processedPayments').doc(`mp_${cleanPaymentId}`).get();
    if (procSnap.exists) {
      const procData = procSnap.data() as {
        uid?: string;
        orderId?: string;
        productCode?: 'equilibrio' | 'excel_lite';
      };
      if (procData.productCode === 'excel_lite') {
        detectedProductCode = 'excel_lite';
      }
      if (!targetOrderId && procData.orderId) {
        targetOrderId = procData.orderId;
      }
      if (!targetUid && procData.productCode === 'equilibrio') {
        targetUid = procData.uid;
      }
    }
  }

  if (!targetUid && detectedProductCode === 'equilibrio' && params.payerEmail) {
    const cleanPayerEmail = params.payerEmail.trim().toLowerCase();
    if (cleanPayerEmail) {
      const userMatchSnap = await db
        .collection('users')
        .where('email', '==', cleanPayerEmail)
        .limit(2)
        .get();
      if (userMatchSnap.size === 1) {
        targetUid = userMatchSnap.docs[0].id;
      }
    }
  }

  if (cleanStatus === 'refunded' || cleanStatus === 'charged_back') {
    if (detectedProductCode === 'excel_lite' && targetOrderId?.startsWith('exl_')) {
      await db
        .collection('excelOrders')
        .doc(targetOrderId)
        .set(
          {
            status: 'anulada',
            lastError: `Pago ${cleanStatus} en Mercado Pago (${cleanPaymentId || 'sin-id'})`,
          },
          { merge: true }
        );
    }

    if (targetOrderId && targetOrderId.startsWith('eq_')) {
      await db
        .collection('equilibrioOrders')
        .doc(targetOrderId)
        .set(
          {
            status: 'reembolsada',
            lastError: `Pago marcado como ${cleanStatus} en Mercado Pago`,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    if (cleanPaymentId) {
      await db
        .collection('processedPayments')
        .doc(`mp_${cleanPaymentId}`)
        .set(
          {
            id: `mp_${cleanPaymentId}`,
            mpPaymentId: cleanPaymentId,
            productCode: detectedProductCode,
            ...(targetUid ? { uid: targetUid } : {}),
            ...(params.payerEmail ? { email: params.payerEmail.toLowerCase().slice(0, 160) } : {}),
            ...(targetOrderId ? { orderId: targetOrderId } : {}),
            amountCLP: Math.max(0, Math.round(params.amountCLP ?? 0)),
            status: cleanStatus,
            outcome: 'revoked',
            processedAt: nowISO,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    if (targetUid && detectedProductCode === 'equilibrio') {
      const userRef = db.collection('users').doc(targetUid);
      const userSnap = await userRef.get();
      if (userSnap.exists) {
        const u = userSnap.data() as { role?: string; email?: string };
        if (u.role !== 'admin' && !isComplimentaryClientEmail(u.email)) {
          await userRef.update({
            accessStatus: 'revoked',
            paymentReference: `Reembolso/Contracargo MP-${cleanPaymentId}`.slice(0, 120),
            updatedAt: FieldValue.serverTimestamp(),
          });
          try {
            await db.collection('adminLogs').add({
              adminUid: 'system-webhook',
              adminEmail: 'mercadopago@growy.app',
              action: 'Revocación automática MP',
              target: (u.email || targetUid).slice(0, 160),
              details: `Acceso revocado por estado "${cleanStatus}" en pago MP-${cleanPaymentId}`.slice(
                0,
                400
              ),
              createdAt: FieldValue.serverTimestamp(),
            });
          } catch {
            // Silencioso si falla bitácora secundaria
          }
        }
      }
    }
    return { handled: true, action: 'revoked' };
  }

  if (
    params.isPreapprovalEvent &&
    (cleanStatus === 'cancelled' || cleanStatus === 'paused') &&
    targetUid
  ) {
    const userRef = db.collection('users').doc(targetUid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      await userRef.update({
        mpSubscriptionStatus: cleanStatus === 'paused' ? 'paused' : 'cancelled',
        autoRenewEnabled: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { handled: true, action: 'marked_rejected' };
  }

  if (cleanStatus === 'rejected' || cleanStatus === 'cancelled') {
    if (targetOrderId && targetOrderId.startsWith('eq_')) {
      await db
        .collection('equilibrioOrders')
        .doc(targetOrderId)
        .set(
          {
            status: 'rechazada',
            lastError: `Pago ${cleanStatus} en Mercado Pago`,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }
    return { handled: true, action: 'marked_rejected' };
  }

  if (cleanStatus === 'pending' || cleanStatus === 'in_process') {
    return { handled: true, action: 'pending' };
  }

  return { handled: false, action: 'ignored' };
}

export async function resolveEquilibrioTargetForApprovedPayment(params: {
  mpPaymentId: string;
  amountCLP: number;
  externalReference?: string;
  payerEmail?: string;
  metadata?: Record<string, unknown>;
  uidHint?: string;
  planHint?: PlanType;
}): Promise<
  | {
      found: true;
      uid: string;
      planType: PlanType;
      billingDayHint?: BillingDay;
      orderId?: string;
      minExpectedCLP: number;
    }
  | { found: false; reason: string }
> {
  const { db } = getFirebaseAdminContext();
  const pricing = await readEquilibrioPricingFromFirestore(db);
  const extRef = (params.externalReference || '').trim();

  // 1. Orden explícita creada vía /api/payments/equilibrio-checkout
  if (extRef.startsWith('eq_')) {
    const orderSnap = await db.collection('equilibrioOrders').doc(extRef).get();
    if (orderSnap.exists) {
      const order = orderSnap.data() as EquilibrioOrderDoc;
      return {
        found: true,
        uid: order.uid,
        planType: order.planType === 'annual' ? 'annual' : 'monthly',
        billingDayHint: order.billingDay,
        orderId: extRef,
        minExpectedCLP: order.amountCLP || (order.planType === 'annual' ? pricing.annualPriceClp : pricing.monthlyPriceClp),
      };
    }
  }

  // 2. External reference de suscripción preapproval (`growy_<uid>_monthly|annual`)
  if (extRef.startsWith('growy_')) {
    const match = /^growy_([a-zA-Z0-9_-]+)_(annual|monthly)$/.exec(extRef);
    if (match) {
      const planType: PlanType = match[2] === 'annual' ? 'annual' : 'monthly';
      return {
        found: true,
        uid: match[1],
        planType,
        minExpectedCLP: planType === 'annual' ? pricing.annualPriceClp : pricing.monthlyPriceClp,
      };
    }
  }

  // 3. Metadata explícita de Checkout Pro
  const metaUid = typeof params.metadata?.uid === 'string' ? params.metadata.uid.trim() : '';
  if (metaUid && /^[a-zA-Z0-9_-]{4,128}$/.test(metaUid)) {
    const metaPlan: PlanType =
      params.metadata?.planType === 'annual' || params.amountCLP >= 45000 ? 'annual' : 'monthly';
    const metaDayRaw = Number(params.metadata?.billingDay);
    const metaDay: BillingDay | undefined =
      metaDayRaw === 5 || metaDayRaw === 15 || metaDayRaw === 30 ? metaDayRaw : undefined;
    return {
      found: true,
      uid: metaUid,
      planType: metaPlan,
      billingDayHint: metaDay,
      minExpectedCLP: metaPlan === 'annual' ? pricing.annualPriceClp : pricing.monthlyPriceClp,
    };
  }

  // 4. Respaldo para links fijos antiguos sin external_reference: coincidencia por correo
  // Nota: Excluimos montos <= $5.500 (rango Excel Lite $4.990) para no confundir productos.
  if (params.amountCLP > 0 && params.amountCLP < 5500) {
    return { found: false, reason: 'amount_below_equilibrio_minimum' };
  }

  const candidateEmail = (params.payerEmail || '').trim().toLowerCase();
  if (candidateEmail) {
    const snap = await db
      .collection('users')
      .where('email', '==', candidateEmail)
      .limit(2)
      .get();
    if (snap.size === 1) {
      const userDoc = snap.docs[0];
      const detectedPlan: PlanType =
        params.amountCLP >= 45000 || params.planHint === 'annual' ? 'annual' : 'monthly';
      return {
        found: true,
        uid: userDoc.id,
        planType: detectedPlan,
        minExpectedCLP: detectedPlan === 'annual' ? pricing.annualPriceClp : pricing.monthlyPriceClp,
      };
    }
  }

  // 5. Fallback por uidHint solo si proviene de verificación autenticada en retorno con monto válido
  if (params.uidHint && /^[a-zA-Z0-9_-]{4,128}$/.test(params.uidHint)) {
    const userSnap = await db.collection('users').doc(params.uidHint).get();
    if (userSnap.exists) {
      const userEmail = String((userSnap.data() as { email?: string }).email || '')
        .trim()
        .toLowerCase();
      if (!candidateEmail || !userEmail || candidateEmail === userEmail) {
        const detectedPlan: PlanType =
          params.amountCLP >= 45000 || params.planHint === 'annual' ? 'annual' : 'monthly';
        return {
          found: true,
          uid: params.uidHint,
          planType: detectedPlan,
          minExpectedCLP: detectedPlan === 'annual' ? pricing.annualPriceClp : pricing.monthlyPriceClp,
        };
      }
    }
  }

  return { found: false, reason: 'no_matching_user_or_order' };
}
