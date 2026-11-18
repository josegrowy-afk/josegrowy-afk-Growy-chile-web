import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCheck2,
  Mail,
  Printer,
  Receipt,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  ANNUAL_PRICE_CLP,
  buildReceiptNumber,
  formatCLPAmount,
  formatISODateSpanish,
  MONTHLY_PRICE_CLP,
} from '../finance/subscription';
import {
  recordPaymentAndSendReceipt,
  resendPaymentReceiptEmail,
} from '../firebase/services';
import type {
  PaymentHistoryEntry,
  PaymentReceiptStatus,
  UserProfile,
} from '../types/finance';

interface PaymentHistorySectionProps {
  profile: UserProfile;
  entries: PaymentHistoryEntry[];
}

function formatPaidDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso.slice(0, 10);
  return dt.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getMethodLabel(method: PaymentHistoryEntry['paymentMethod']): string {
  if (method === 'mercadopago') return 'Mercado Pago';
  if (method === 'codigo_acceso') return 'Código de acceso';
  return 'Confirmación / Admin';
}

function getReceiptStatusMeta(status: PaymentReceiptStatus): {
  label: string;
  badgeClass: string;
} {
  if (status === 'enviado_correo') {
    return {
      label: 'Enviado al correo',
      badgeClass: 'bg-[var(--pos-soft)] text-[var(--pos-text)]',
    };
  }
  if (status === 'pendiente_envio') {
    return {
      label: 'Pendiente de envío',
      badgeClass: 'bg-[var(--warn-soft)] text-[var(--warn-text)]',
    };
  }
  return {
    label: 'Listo para descarga',
    badgeClass: 'bg-[var(--sec-soft)] text-[var(--sec-text)]',
  };
}

function buildPrintableReceiptHtml(profile: UserProfile, entry: PaymentHistoryEntry): string {
  const folio = entry.receiptNumber || buildReceiptNumber(entry.transactionId, entry.paidAt);
  const planName =
    entry.planType === 'annual'
      ? 'Plan Anual GROWy (12 meses · Precio por lanzamiento)'
      : 'Plan Mensual GROWy (Precio por lanzamiento)';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Comprobante GROWy ${folio}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FDF4F5; color: #1A1A1E; padding: 32px; margin: 0; }
    .card { max-width: 580px; margin: 0 auto; background: #fff; border: 1px solid #EFE2E5; border-radius: 18px; padding: 28px; }
    .eyebrow { font-size: 11px; font-weight: 700; color: #C9535B; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 6px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .sub { font-size: 13px; color: #6E6D7A; margin: 0 0 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 10px 0; border-bottom: 1px solid #EFE2E5; }
    td.val { text-align: right; font-weight: 600; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .note { margin-top: 18px; padding: 12px 14px; border-radius: 12px; background: #E9F5F2; color: #1E7A6B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <p class="eyebrow">Comprobante de suscripción GROWy</p>
    <h1>Folio ${folio}</h1>
    <p class="sub">Titular: <strong>${profile.displayName}</strong> (${profile.email})</p>
    <table>
      <tr><td>Plan contratado</td><td class="val">${planName}</td></tr>
      <tr><td>Monto pagado</td><td class="val">${formatCLPAmount(entry.amountClp)} CLP</td></tr>
      <tr><td>ID de transacción</td><td class="val mono">${entry.transactionId}</td></tr>
      <tr><td>Medio de pago</td><td class="val">${getMethodLabel(entry.paymentMethod)}</td></tr>
      <tr><td>Fecha de pago</td><td class="val">${formatPaidDateTime(entry.paidAt)}</td></tr>
      <tr><td>Vigencia cubierta hasta</td><td class="val">${formatISODateSpanish(entry.periodCoveredEnd)}</td></tr>
    </table>
    <div class="note">
      Tarifa promocional por lanzamiento conservada durante la vigencia indicada.
    </div>
  </div>
</body>
</html>`;
}

export const PaymentHistorySection: React.FC<PaymentHistorySectionProps> = ({
  profile,
  entries,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [syncingLegacy, setSyncingLegacy] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentHistoryEntry | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const totalPaid = entries.reduce((sum, item) => sum + (Number(item.amountClp) || 0), 0);
  const canSyncLegacyPayment =
    entries.length === 0 &&
    Boolean(profile.lastPaymentAt) &&
    Boolean(profile.nextPaymentDueAt) &&
    (profile.paymentStatus === 'paid' || profile.paymentStatus === 'code_redeemed');

  const handleCopyTx = async (entry: PaymentHistoryEntry) => {
    try {
      await navigator.clipboard.writeText(entry.transactionId);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignorar si clipboard no está disponible
    }
  };

  const handleResendEmail = async (entry: PaymentHistoryEntry) => {
    setSendingId(entry.id);
    setFeedback(null);
    try {
      const result = await resendPaymentReceiptEmail(profile, entry);
      setFeedback({
        type: 'ok',
        text: result.emailed
          ? `Comprobante ${result.receiptNumber} enviado correctamente a ${profile.email}.`
          : `Comprobante ${result.receiptNumber} preparado. Puedes descargarlo aquí directamente (el envío automático por correo requiere configurar RESEND_API_KEY en el servidor).`,
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo procesar el comprobante en este momento. Intenta nuevamente.',
      });
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadReceipt = (entry: PaymentHistoryEntry) => {
    const html = buildPrintableReceiptHtml(profile, entry);
    const folio = entry.receiptNumber || buildReceiptNumber(entry.transactionId, entry.paidAt);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprobante-growy-${folio}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSyncLegacyPayment = async () => {
    if (!profile.lastPaymentAt || !profile.nextPaymentDueAt) return;
    setSyncingLegacy(true);
    setFeedback(null);
    try {
      const isAnnual = profile.planType === 'annual';
      const txId =
        profile.accessCodeUsed ||
        profile.paymentReference ||
        `GRW-${profile.lastPaymentAt.slice(0, 10).replace(/-/g, '')}`;
      const entry = await recordPaymentAndSendReceipt({
        id: `legacy_${profile.lastPaymentAt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        planType: isAnnual ? 'annual' : 'monthly',
        amountClp: isAnnual ? ANNUAL_PRICE_CLP : MONTHLY_PRICE_CLP,
        transactionId: txId,
        paymentMethod: profile.paymentStatus === 'code_redeemed' ? 'codigo_acceso' : 'mercadopago',
        paidAt: profile.lastPaymentAt,
        periodCoveredEnd: profile.nextPaymentDueAt,
        notes: 'Pago previo sincronizado al historial',
      });
      setFeedback({
        type: 'ok',
        text:
          entry.receiptStatus === 'enviado_correo'
            ? `Pago registrado y comprobante enviado a ${profile.email}.`
            : 'Pago sincronizado al historial y comprobante listo para descargar.',
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo sincronizar el pago anterior.',
      });
    } finally {
      setSyncingLegacy(false);
    }
  };

  return (
    <section className="boho-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--pos-soft)] flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5 text-[var(--pos-text)]" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Historial de pagos y comprobantes
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Registro transparente de tus suscripciones mensuales y anuales, IDs de transacción y
              comprobantes enviados a <strong>{profile.email}</strong>.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
          <div className="px-3 py-1.5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
            <span className="text-[var(--text-secondary)]">Pagos: </span>
            <strong className="font-mono tabular-nums text-[var(--text-primary)]">
              {entries.length}
            </strong>
          </div>
          <div className="px-3 py-1.5 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)]">
            <span className="text-[var(--pos-muted)]">Total: </span>
            <strong className="font-mono tabular-nums text-[var(--pos-text)]">
              {formatCLPAmount(totalPaid)}
            </strong>
          </div>
        </div>
      </div>

      {feedback && (
        <p
          className={`text-xs font-semibold p-3 rounded-2xl ${
            feedback.type === 'ok'
              ? 'bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)]'
              : 'bg-[var(--danger-soft)] text-[var(--danger-text)] border border-[var(--accent-soft-border)]'
          }`}
        >
          {feedback.text}
        </p>
      )}

      {entries.length === 0 ? (
        <div className="p-5 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {canSyncLegacyPayment
                ? 'Tienes un pago activo previo listo para agregar a tu historial'
                : 'Aún no hay pagos registrados en este historial'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {canSyncLegacyPayment
                ? `Último pago registrado el ${formatPaidDateTime(profile.lastPaymentAt!)} (vigencia hasta ${formatISODateSpanish(profile.nextPaymentDueAt)}). Sincronízalo para obtener tu folio y enviar el comprobante a tu correo.`
                : 'Cada vez que se confirme un pago mensual ($5.990) o anual ($50.000), verás aquí la fecha, ID de transacción, monto y estado del comprobante enviado a tu correo.'}
            </p>
          </div>
          {canSyncLegacyPayment && (
            <button
              type="button"
              disabled={syncingLegacy}
              onClick={() => void handleSyncLegacyPayment()}
              className="min-h-[40px] px-5 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingLegacy ? 'animate-spin' : ''}`} />
              <span>{syncingLegacy ? 'Sincronizando...' : 'Generar comprobante'}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Vista tabla escritorio */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[var(--text-secondary)]">
                  <th className="py-2.5 pr-3">Fecha</th>
                  <th className="py-2.5 px-3">Plan y vigencia</th>
                  <th className="py-2.5 px-3">ID de transacción</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                  <th className="py-2.5 px-3">Comprobante</th>
                  <th className="py-2.5 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const statusMeta = getReceiptStatusMeta(entry.receiptStatus);
                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-[var(--border-hairline)] last:border-0"
                    >
                      <td className="py-3 pr-3 whitespace-nowrap font-medium text-[var(--text-primary)]">
                        {formatPaidDateTime(entry.paidAt)}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-[var(--text-primary)]">
                          {entry.planType === 'annual'
                            ? 'Plan Anual (12 meses · Lanzamiento)'
                            : 'Plan Mensual (Lanzamiento)'}
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {getMethodLabel(entry.paymentMethod)} · Vigente hasta{' '}
                          {formatISODateSpanish(entry.periodCoveredEnd)}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <div className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[11px] bg-[var(--bg-soft-alt)] px-2.5 py-1 rounded-xl border border-[var(--border-hairline)]">
                          <span className="truncate max-w-[170px]">{entry.transactionId}</span>
                          <button
                            type="button"
                            onClick={() => void handleCopyTx(entry)}
                            aria-label={`Copiar ID ${entry.transactionId}`}
                            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {copiedId === entry.id ? (
                              <Check className="w-3 h-3 text-[var(--pos-text)]" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[var(--text-primary)] whitespace-nowrap">
                        {formatCLPAmount(entry.amountClp)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${statusMeta.badgeClass}`}
                        >
                          <FileCheck2 className="w-3 h-3" />
                          <span>{statusMeta.label}</span>
                        </span>
                        {entry.receiptNumber && (
                          <p className="font-mono text-[10px] text-[var(--text-secondary)] mt-0.5">
                            Folio: {entry.receiptNumber}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(entry)}
                            className="min-h-[34px] px-3.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] font-semibold text-[var(--text-primary)] cursor-pointer"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            disabled={sendingId === entry.id}
                            onClick={() => void handleResendEmail(entry)}
                            className="min-h-[34px] px-3.5 rounded-full border border-[var(--sec-border)] bg-[var(--sec-soft)] text-[var(--sec-text)] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Mail className="w-3 h-3" />
                            <span>
                              {sendingId === entry.id
                                ? 'Enviando...'
                                : entry.receiptStatus === 'enviado_correo'
                                  ? 'Reenviar'
                                  : 'Enviar correo'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista tarjetas móvil */}
          <div className="md:hidden space-y-3">
            {entries.map((entry) => {
              const statusMeta = getReceiptStatusMeta(entry.receiptStatus);
              return (
                <div
                  key={entry.id}
                  className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">
                        {entry.planType === 'annual'
                          ? 'Plan Anual (12M · Lanzamiento)'
                          : 'Plan Mensual (Lanzamiento)'}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {formatPaidDateTime(entry.paidAt)} · {getMethodLabel(entry.paymentMethod)}
                      </p>
                    </div>
                    <strong className="font-mono tabular-nums text-sm text-[var(--text-primary)]">
                      {formatCLPAmount(entry.amountClp)}
                    </strong>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      Tx: {entry.transactionId}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Vigencia hasta: <strong>{formatISODateSpanish(entry.periodCoveredEnd)}</strong>
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(entry)}
                      className="min-h-[36px] px-3.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] font-semibold cursor-pointer"
                    >
                      Ver comprobante
                    </button>
                    <button
                      type="button"
                      disabled={sendingId === entry.id}
                      onClick={() => void handleResendEmail(entry)}
                      className="min-h-[36px] px-3.5 rounded-full bg-[var(--sec-soft)] text-[var(--sec-text)] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{sendingId === entry.id ? 'Enviando...' : 'Enviar al correo'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL DE COMPROBANTE DETALLADO DESCARGABLE / IMPRIMIBLE */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md boho-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-strong)]">
                  Comprobante de pago GROWy
                </p>
                <h3 className="font-display text-xl font-bold text-[var(--text-primary)] mt-0.5">
                  Folio{' '}
                  {selectedReceipt.receiptNumber ||
                    buildReceiptNumber(selectedReceipt.transactionId, selectedReceipt.paidAt)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Cerrar comprobante"
                className="min-w-[36px] min-h-[36px] rounded-full bg-[var(--bg-soft)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <dl className="space-y-2.5 text-xs border-y border-[var(--border-hairline)] py-3.5">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Titular</dt>
                <dd className="font-semibold text-right">{profile.displayName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Correo</dt>
                <dd className="font-medium text-right">{profile.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Plan</dt>
                <dd className="font-semibold text-right">
                  {selectedReceipt.planType === 'annual'
                    ? 'Plan Anual (12M · Lanzamiento)'
                    : 'Plan Mensual (Lanzamiento)'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Monto pagado</dt>
                <dd className="font-mono tabular-nums font-bold text-right">
                  {formatCLPAmount(selectedReceipt.amountClp)} CLP
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">ID de transacción</dt>
                <dd className="font-mono text-right break-all">{selectedReceipt.transactionId}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Fecha de pago</dt>
                <dd className="text-right">{formatPaidDateTime(selectedReceipt.paidAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Vigencia hasta</dt>
                <dd className="font-semibold text-right">
                  {formatISODateSpanish(selectedReceipt.periodCoveredEnd)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--text-secondary)]">Estado comprobante</dt>
                <dd className="font-bold text-right">
                  {getReceiptStatusMeta(selectedReceipt.receiptStatus).label}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDownloadReceipt(selectedReceipt)}
                className="flex-1 min-h-[42px] px-4 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
