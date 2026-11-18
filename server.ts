import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type webPushType from 'web-push';
import {
  buildPaymentReminderNotification,
  toISODateLocal,
} from './src/finance/subscription';
import type { BillingDay, PaymentStatus, PlanType, UserProfile, UserRole } from './src/types/finance';

const require = createRequire(import.meta.url);
const webPush = require('web-push') as typeof webPushType;

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

interface StoredPushRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  accessStatus: 'pending' | 'active' | 'revoked';
  paymentStatus: PaymentStatus;
  planType?: PlanType;
  billingDay?: BillingDay;
  nextPaymentDueAt?: string;
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  enabled: boolean;
  lastNotifiedDate?: string;
  updatedAt: string;
}

const VAPID_FILE_PATH = path.resolve(process.cwd(), '.vapid-keys.json');
const PUSH_STORE_PATH = path.resolve(process.cwd(), '.push-subscriptions.json');

function loadOrCreateVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const subject =
    process.env.VAPID_SUBJECT ||
    `mailto:${process.env.ADMIN_SUPPORT_EMAIL || 'jose.growy@gmail.com'}`;

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim(),
      subject,
    };
  }

  try {
    if (fs.existsSync(VAPID_FILE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(VAPID_FILE_PATH, 'utf8')) as {
        publicKey?: string;
        privateKey?: string;
      };
      if (parsed.publicKey && parsed.privateKey) {
        return { publicKey: parsed.publicKey, privateKey: parsed.privateKey, subject };
      }
    }
  } catch {
    // Regenerar si falla la lectura
  }

  const generated = webPush.generateVAPIDKeys();
  try {
    fs.writeFileSync(
      VAPID_FILE_PATH,
      JSON.stringify({ publicKey: generated.publicKey, privateKey: generated.privateKey }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('[WebPush] No se pudo persistir .vapid-keys.json:', err);
  }
  return { publicKey: generated.publicKey, privateKey: generated.privateKey, subject };
}

function readPushStore(): StoredPushRecord[] {
  try {
    if (!fs.existsSync(PUSH_STORE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(PUSH_STORE_PATH, 'utf8')) as StoredPushRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePushStore(records: StoredPushRecord[]): void {
  try {
    fs.writeFileSync(PUSH_STORE_PATH, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('[WebPush] No se pudo guardar .push-subscriptions.json:', err);
  }
}

function makePushRecordId(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 24);
}

async function startServer() {
  const app = express();

  /**
   * Webhook de pasarela de pago mensual Mercado Pago ($5.990) u otros proveedores.
   * Acepta notificaciones IPN/Webhook de Mercado Pago (action/type payment) y webhooks genéricos HMAC.
   */
  app.post(
    '/api/webhooks/payment',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const secret = process.env.PAYMENT_WEBHOOK_SECRET;
        const signatureHeader = req.headers['x-webhook-signature'];
        const rawBody = req.body as Buffer;

        if (secret && secret !== 'reemplazar_por_secreto_hmac' && typeof signatureHeader === 'string') {
          const expected = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

          const expectedBuf = Buffer.from(expected, 'utf8');
          const receivedBuf = Buffer.from(signatureHeader, 'utf8');
          if (
            expectedBuf.length !== receivedBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, receivedBuf)
          ) {
            res.status(401).json({ error: 'Firma HMAC inválida.' });
            return;
          }
        }

        const payload = JSON.parse(rawBody.toString('utf8')) as {
          event?: string;
          type?: string;
          action?: string;
          uid?: string;
          email?: string;
          paymentId?: string;
          planType?: 'monthly' | 'annual';
          status?: string;
          data?: { id?: string | number };
        };

        const mpPaymentId = payload.data?.id ? String(payload.data.id) : payload.paymentId;
        let isPaid = payload.status === 'paid' || payload.status === 'approved' || payload.event === 'payment.succeeded';
        let detectedPlan: 'monthly' | 'annual' = payload.planType === 'annual' ? 'annual' : 'monthly';

        // Si viene un evento de Mercado Pago y hay MERCADOPAGO_ACCESS_TOKEN, consultar estado real en API de Mercado Pago
        if ((payload.type === 'payment' || payload.action?.startsWith('payment.')) && mpPaymentId && process.env.MERCADOPAGO_ACCESS_TOKEN) {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(mpPaymentId)}`, {
            headers: {
              Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
            },
          });
          if (mpRes.ok) {
            const mpData = (await mpRes.json()) as {
              status?: string;
              transaction_amount?: number;
              external_reference?: string;
            };
            if (mpData.status === 'approved') {
              isPaid = true;
            }
            if ((mpData.transaction_amount ?? 0) >= 45000) {
              detectedPlan = 'annual';
            }
          }
        }

        if (!isPaid) {
          res.status(200).json({ received: true, activated: false, reason: 'Evento pendiente o ignorado' });
          return;
        }

        console.info(`[Webhook Pago Mercado Pago ${detectedPlan === 'annual' ? '$50.000 Anual' : '$5.990 Mensual'}] Pago confirmado:`, {
          uid: payload.uid,
          email: payload.email,
          paymentId: mpPaymentId,
          planType: detectedPlan,
        });

        res.status(200).json({
          received: true,
          activated: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
          paymentId: mpPaymentId ?? null,
          planType: detectedPlan,
          note: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            ? `Pago ${detectedPlan === 'annual' ? 'anual (12 meses)' : 'mensual'} validado para activación automática.`
            : 'Webhook validado. Configura FIREBASE_SERVICE_ACCOUNT_JSON o activa manualmente desde el Panel Admin.',
        });
      } catch (err) {
        console.error('[Webhook Pago] Error:', err);
        res.status(400).json({ error: 'Payload inválido en webhook de pago.' });
      }
    }
  );

  app.use(express.json({ limit: '2mb' }));

  app.post('/api/payments/mercadopago-verify', async (req, res) => {
    try {
      const { paymentId, uid, email, planType } = req.body as {
        paymentId?: string;
        uid?: string;
        email?: string;
        planType?: 'monthly' | 'annual';
      };
      if (!paymentId) {
        res.status(400).json({ verified: false, activated: false, message: 'Falta paymentId.' });
        return;
      }

      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        res.status(200).json({
          verified: false,
          activated: false,
          message:
            'Recibimos el identificador de Mercado Pago. Si tu cuenta no se activa de inmediato, adjunta tu comprobante abajo para que el administrador la habilite.',
        });
        return;
      }

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        },
      });
      if (!mpRes.ok) {
        res.status(200).json({
          verified: false,
          activated: false,
          message: 'No pudimos consultar ese pago en Mercado Pago todavía.',
        });
        return;
      }

      const mpData = (await mpRes.json()) as { status?: string; transaction_amount?: number };
      const approved = mpData.status === 'approved';
      const isAnnualAmount = (mpData.transaction_amount ?? 0) >= 45000 || planType === 'annual';
      console.info('[Verificación MP]', {
        paymentId,
        uid,
        email,
        status: mpData.status,
        amount: mpData.transaction_amount,
        detectedPlan: isAnnualAmount ? 'annual' : 'monthly',
      });
      res.status(200).json({
        verified: approved,
        activated: Boolean(approved && process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
        planType: isAnnualAmount ? 'annual' : 'monthly',
        message: approved
          ? `Pago ${isAnnualAmount ? 'anual ($50.000 · 12 meses)' : 'mensual ($5.990)'} aprobado en Mercado Pago. Si el espacio aún aparece bloqueado, adjunta la captura abajo para activación instantánea.`
          : `Estado actual del pago en Mercado Pago: ${mpData.status ?? 'pendiente'}.`,
      });
    } catch {
      res.status(200).json({
        verified: false,
        activated: false,
        message: 'No se pudo verificar el pago en línea en este momento.',
      });
    }
  });

  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({ status: 'ok', service: 'growy' });
  });

  app.get('/robots.txt', (_req, res) => {
    const robotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      res.type('text/plain').sendFile(robotsPath);
      return;
    }
    res
      .type('text/plain')
      .send('User-agent: *\nAllow: /\n\nSitemap: https://growychile.cl/sitemap.xml\n');
  });

  app.get('/sitemap.xml', (_req, res) => {
    const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      res.type('application/xml').sendFile(sitemapPath);
      return;
    }
    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://growychile.cl/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n</urlset>\n'
    );
  });

  /**
   * Reenvía notificaciones de dudas, sugerencias o reportes de problema (con adjuntos) al administrador (jose.growy@gmail.com)
   */
  app.post('/api/support/notify', async (req, res) => {
    try {
      const { ticketId, ticketType, name, email, subject, message, attachments } = req.body as {
        ticketId?: string;
        ticketType?: string;
        name?: string;
        email?: string;
        subject?: string;
        message?: string;
        attachments?: Array<{ name?: string; mimeType?: string; dataUrl?: string }>;
      };

      if (!email || !subject || !message) {
        res.status(400).json({ error: 'Faltan campos requeridos.' });
        return;
      }

      const adminEmail = process.env.ADMIN_SUPPORT_EMAIL || 'jose.growy@gmail.com';
      const kindLabel =
        ticketType === 'sugerencia'
          ? 'Sugerencia'
          : ticketType === 'problema'
            ? 'Problema / Pago'
            : 'Duda';
      const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 2) : [];
      let emailed = false;

      if (process.env.RESEND_API_KEY) {
        const resendAttachments = safeAttachments
          .map((att) => {
            const base64Part = (att.dataUrl ?? '').split(',')[1];
            if (!base64Part) return null;
            return {
              filename: att.name || 'comprobante',
              content: base64Part,
            };
          })
          .filter(Boolean);

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'GROWy Soporte <onboarding@resend.dev>',
            to: [adminEmail],
            reply_to: email,
            subject: `[GROWy · ${kindLabel}] ${subject}`,
            text: [
              `Nuevo mensaje de soporte (${kindLabel})`,
              `Ticket: ${ticketId ?? 'sin-id'}`,
              `De: ${name || 'Usuario'} <${email}>`,
              `Asunto: ${subject}`,
              safeAttachments.length > 0
                ? `Documentos adjuntos: ${safeAttachments.map((a) => a.name).join(', ')}`
                : 'Sin adjuntos',
              '',
              message,
            ].join('\n'),
            ...(resendAttachments.length > 0 ? { attachments: resendAttachments } : {}),
          }),
        });
        emailed = resendRes.ok;
      }

      if (process.env.SUPPORT_WEBHOOK_URL) {
        await fetch(process.env.SUPPORT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: adminEmail,
            ticketId,
            ticketType: kindLabel,
            name,
            email,
            subject,
            message,
            attachments: safeAttachments,
          }),
        });
      }

      console.info(
        `[Soporte GROWy -> ${adminEmail}] (${kindLabel}) ${subject} — de ${email} (adjuntos: ${safeAttachments.length})`
      );
      res.status(200).json({ ok: true, adminEmail, emailed });
    } catch (err) {
      console.error('[Soporte GROWy] Error notificando al admin:', err);
      res.status(200).json({ ok: false, emailed: false });
    }
  });

  /**
   * Envía comprobante oficial de pago (mensual o anual) al correo del cliente
   */
  app.post('/api/payments/send-receipt', async (req, res) => {
    try {
      const {
        email,
        displayName,
        planType,
        amountClp,
        transactionId,
        paidAt,
        periodCoveredEnd,
        paymentMethod,
        receiptNumber,
      } = req.body as {
        email?: string;
        displayName?: string;
        planType?: 'monthly' | 'annual';
        amountClp?: number;
        transactionId?: string;
        paidAt?: string;
        periodCoveredEnd?: string;
        paymentMethod?: string;
        receiptNumber?: string;
      };

      if (!email || !transactionId) {
        res.status(400).json({ ok: false, emailed: false, error: 'Faltan email o transactionId.' });
        return;
      }

      const cleanPlanLabel =
        planType === 'annual'
          ? 'Plan Anual GROWy (12 meses · Precio por lanzamiento)'
          : 'Plan Mensual GROWy (Precio por lanzamiento)';
      const safeAmount = Math.max(0, Math.round(Number(amountClp) || (planType === 'annual' ? 50000 : 5990)));
      const formattedAmount = `$${safeAmount.toLocaleString('es-CL')} CLP`;
      const methodLabel =
        paymentMethod === 'codigo_acceso'
          ? 'Código de acceso'
          : paymentMethod === 'mercadopago'
            ? 'Mercado Pago'
            : 'Registro confirmado / Mercado Pago';
      const folio =
        receiptNumber ||
        `GRW-${new Date().getFullYear()}-${transactionId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-8).padStart(4, '0')}`;
      const paidDateDisplay = (paidAt || new Date().toISOString()).slice(0, 10);
      const validUntilDisplay = periodCoveredEnd || 'Vigente';

      const textBody = [
        `Comprobante de pago GROWy — Folio ${folio}`,
        '',
        `Hola ${displayName || email},`,
        'Confirmamos la recepción de tu pago en GROWy:',
        `- Plan: ${cleanPlanLabel}`,
        `- Monto pagado: ${formattedAmount}`,
        `- ID de transacción: ${transactionId}`,
        `- Medio de pago: ${methodLabel}`,
        `- Fecha de registro: ${paidDateDisplay}`,
        `- Vigencia cubierta hasta: ${validUntilDisplay}`,
        '',
        'Mantienes el valor promocional por lanzamiento mientras tu suscripción permanezca activa.',
        'También puedes consultar y descargar este comprobante en cualquier momento desde Configuración -> Historial de pagos.',
        '',
        'Equipo GROWy',
      ].join('\n');

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #FDF4F5; color: #1A1A1E; border-radius: 16px;">
          <div style="background: #FFFFFF; border: 1px solid #EFE2E5; border-radius: 16px; padding: 24px;">
            <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #C9535B; text-transform: uppercase;">Comprobante oficial de pago</p>
            <h1 style="margin: 0 0 12px; font-size: 20px;">GROWy · Folio ${folio}</h1>
            <p style="margin: 0 0 16px; font-size: 14px; color: #6E6D7A;">
              Hola <strong>${displayName || email}</strong>, registramos correctamente tu suscripción.
            </p>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Plan</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; font-weight: 600; text-align: right;">${cleanPlanLabel}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Monto pagado</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; font-weight: 700; text-align: right;">${formattedAmount}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">ID de transacción</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; font-family: monospace; text-align: right;">${transactionId}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Medio de pago</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; text-align: right;">${methodLabel}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; color: #6E6D7A;">Fecha de pago</td><td style="padding: 8px 0; border-bottom: 1px solid #EFE2E5; text-align: right;">${paidDateDisplay}</td></tr>
              <tr><td style="padding: 8px 0; color: #6E6D7A;">Vigencia hasta</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${validUntilDisplay}</td></tr>
            </table>
            <p style="margin: 0; font-size: 12px; color: #1E7A6B; background: #E9F5F2; padding: 10px 12px; border-radius: 10px;">
              Conservaste el valor promocional por lanzamiento de GROWy. Puedes revisar tu historial completo dentro de Configuración.
            </p>
          </div>
        </div>
      `;

      let emailed = false;
      if (process.env.RESEND_API_KEY) {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL || 'GROWy Pagos <onboarding@resend.dev>',
            to: [email],
            subject: `[GROWy] Comprobante de pago ${folio} (${formattedAmount})`,
            text: textBody,
            html: htmlBody,
          }),
        });
        emailed = resendRes.ok;
      }

      if (process.env.SUPPORT_WEBHOOK_URL) {
        await fetch(process.env.SUPPORT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'payment_receipt',
            to: email,
            folio,
            planType,
            amountClp: safeAmount,
            transactionId,
            paidAt: paidDateDisplay,
            periodCoveredEnd: validUntilDisplay,
          }),
        }).catch(() => {});
      }

      console.info(
        `[Comprobante GROWy -> ${email}] Folio ${folio} · ${formattedAmount} · Tx ${transactionId} · emailed=${emailed}`
      );

      res.status(200).json({
        ok: true,
        emailed,
        receiptNumber: folio,
        receiptStatus: emailed ? 'enviado_correo' : 'disponible_descarga',
        sentAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Comprobante GROWy] Error:', err);
      res.status(200).json({
        ok: false,
        emailed: false,
        receiptStatus: 'pendiente_envio',
      });
    }
  });

  /**
   * Web Push: gestión VAPID, suscripciones por usuario y recordatorios automáticos de vencimiento
   */
  const vapidConfig = loadOrCreateVapidKeys();
  webPush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

  const sendPushToRecord = async (
    record: StoredPushRecord,
    payload: { title: string; body: string; tag: string; url: string; requireInteraction?: boolean }
  ): Promise<'sent' | 'expired' | 'failed'> => {
    try {
      await webPush.sendNotification(record.subscription, JSON.stringify(payload), {
        TTL: 60 * 60 * 24,
      });
      return 'sent';
    } catch (err: unknown) {
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        return 'expired';
      }
      console.warn('[WebPush] Falló envío a', record.email, statusCode || err);
      return 'failed';
    }
  };

  const dispatchDueReminders = async (onlyUid?: string): Promise<{ checked: number; sent: number }> => {
    const todayISO = toISODateLocal(new Date());
    const records = readPushStore();
    let changed = false;
    let sent = 0;
    const surviving: StoredPushRecord[] = [];

    for (const rec of records) {
      if (!rec.enabled) {
        surviving.push(rec);
        continue;
      }
      if (onlyUid && rec.uid !== onlyUid) {
        surviving.push(rec);
        continue;
      }

      const profileSnapshot: UserProfile = {
        uid: rec.uid,
        email: rec.email,
        displayName: rec.displayName,
        role: rec.role,
        accessStatus: rec.accessStatus,
        paymentStatus: rec.paymentStatus,
        planType: rec.planType,
        billingDay: rec.billingDay,
        nextPaymentDueAt: rec.nextPaymentDueAt,
      };

      const notification = buildPaymentReminderNotification(profileSnapshot, new Date());
      if (!notification || rec.lastNotifiedDate === todayISO) {
        surviving.push(rec);
        continue;
      }

      const result = await sendPushToRecord(rec, {
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        url: notification.url,
        requireInteraction: notification.requireInteraction,
      });

      if (result === 'expired') {
        changed = true;
        continue;
      }
      if (result === 'sent') {
        rec.lastNotifiedDate = todayISO;
        rec.updatedAt = new Date().toISOString();
        changed = true;
        sent += 1;
      }
      surviving.push(rec);
    }

    if (changed) {
      writePushStore(surviving);
    }
    return { checked: records.length, sent };
  };

  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: vapidConfig.publicKey });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    try {
      const { subscription, user } = req.body as {
        subscription?: StoredPushRecord['subscription'];
        user?: Partial<UserProfile>;
      };

      if (
        !subscription?.endpoint ||
        !subscription.keys?.p256dh ||
        !subscription.keys?.auth ||
        !user?.uid ||
        !user?.email
      ) {
        res.status(400).json({ ok: false, error: 'Datos de suscripción Web Push incompletos.' });
        return;
      }

      const id = makePushRecordId(subscription.endpoint);
      const existing = readPushStore();
      const prev = existing.find((r) => r.id === id);

      const record: StoredPushRecord = {
        id,
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email,
        role: user.role === 'admin' ? 'admin' : 'user',
        accessStatus:
          user.accessStatus === 'active' || user.accessStatus === 'revoked'
            ? user.accessStatus
            : 'pending',
        paymentStatus: user.paymentStatus || 'unpaid',
        planType: user.planType === 'annual' ? 'annual' : 'monthly',
        billingDay:
          user.billingDay === 5 || user.billingDay === 15 || user.billingDay === 30
            ? user.billingDay
            : undefined,
        nextPaymentDueAt: user.nextPaymentDueAt,
        subscription,
        enabled: true,
        lastNotifiedDate: prev?.lastNotifiedDate,
        updatedAt: new Date().toISOString(),
      };

      const updated = [...existing.filter((r) => r.id !== id), record];
      writePushStore(updated);

      const dispatch = await dispatchDueReminders(record.uid);
      res.status(200).json({ ok: true, id, dispatch });
    } catch (err) {
      console.error('[WebPush] Error al guardar suscripción:', err);
      res.status(500).json({ ok: false, error: 'No se pudo registrar la suscripción push.' });
    }
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    try {
      const { endpoint, uid } = req.body as { endpoint?: string; uid?: string };
      if (!endpoint) {
        res.status(400).json({ ok: false, error: 'Falta endpoint.' });
        return;
      }
      const records = readPushStore();
      const next = records.filter(
        (r) => r.subscription.endpoint !== endpoint && (!uid || r.uid !== uid || r.subscription.endpoint !== endpoint)
      );
      writePushStore(next);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[WebPush] Error al desuscribir:', err);
      res.status(500).json({ ok: false });
    }
  });

  app.post('/api/push/test', async (req, res) => {
    try {
      const { subscription, user } = req.body as {
        subscription?: StoredPushRecord['subscription'];
        user?: Partial<UserProfile>;
      };
      if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        res.status(400).json({ ok: false, error: 'Falta suscripción push del navegador.' });
        return;
      }

      const profileSnapshot: UserProfile | null = user?.uid
        ? {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Usuario',
            role: user.role === 'admin' ? 'admin' : 'user',
            accessStatus: user.accessStatus === 'active' ? 'active' : 'pending',
            paymentStatus: user.paymentStatus || 'paid',
            planType: user.planType === 'annual' ? 'annual' : 'monthly',
            billingDay:
              user.billingDay === 5 || user.billingDay === 15 || user.billingDay === 30
                ? user.billingDay
                : undefined,
            nextPaymentDueAt: user.nextPaymentDueAt,
          }
        : null;

      const reminderPayload = buildPaymentReminderNotification(profileSnapshot, new Date());
      const payload = reminderPayload
        ? {
            title: reminderPayload.title,
            body: reminderPayload.body,
            tag: `growy-test-${Date.now()}`,
            url: reminderPayload.url,
            requireInteraction: reminderPayload.requireInteraction,
          }
        : {
            title: 'GROWy · Recordatorios de pago activos',
            body: 'Te avisaremos antes de tu fecha de vencimiento mensual o anual para que tu cuenta nunca quede bloqueada sin aviso.',
            tag: `growy-test-${Date.now()}`,
            url: '/?reminder=payment',
            requireInteraction: false,
          };

      await webPush.sendNotification(subscription, JSON.stringify(payload), { TTL: 3600 });
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('[WebPush] Error en notificación de prueba:', err);
      res.status(500).json({ ok: false, error: 'No se pudo enviar la notificación push de prueba.' });
    }
  });

  app.post('/api/push/check-reminders', async (req, res) => {
    try {
      const { uid } = (req.body ?? {}) as { uid?: string };
      const result = await dispatchDueReminders(uid);
      res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.error('[WebPush] Error en check-reminders:', err);
      res.status(500).json({ ok: false });
    }
  });

  // Revisión periódica automática en segundo plano cada 6 horas (+ revisión inicial a los 15 s)
  setTimeout(() => {
    void dispatchDueReminders();
  }, 15_000);
  setInterval(() => {
    void dispatchDueReminders();
  }, 6 * 60 * 60 * 1000);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.webmanifest') ||
            filePath.endsWith('index.html')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        res.status(503).send('Build de producción en progreso o faltante (ejecuta npm run build).');
        return;
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(indexPath);
    });
  }

  const server = app.listen(PORT, () => {
    const addr = server.address();
    const hostLabel = typeof addr === 'object' && addr ? addr.address : '::';
    console.log(
      `GROWy escuchando en http://${hostLabel === '::' ? '[::]' : hostLabel}:${PORT} (${isProduction ? 'production' : 'development'})`
    );
  });
}

startServer();
