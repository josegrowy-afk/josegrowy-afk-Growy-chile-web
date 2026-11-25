import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  createExcelCheckoutOrder,
  DEFAULT_LANDING_CONTENT,
} from '../firebase/services';
import type { AppConfig } from '../types/finance';
import { SectionTitle, SolidCard } from './design-system';
import { GROWY_EASE, ScrollReveal } from './MotionPrimitives';

export interface ExcelReturnStatus {
  loading: boolean;
  ok?: boolean;
  status?: string;
  licenseId?: string;
  message?: string;
}

interface EquilibrioLiteExcelSectionProps {
  config: AppConfig;
  returnStatus: ExcelReturnStatus | null;
  onDismissReturnStatus: () => void;
  onOpenLicenseTerms: () => void;
  onOpenPrivacy: () => void;
}

const SHEET_NAMES = [
  'Inicio',
  'Resumen',
  'Mi negocio',
  'Costos fijos',
  'Productos',
  'Punto de equilibrio',
  'Ventas reales',
  'Caja',
  'Cobrar y pagar',
  'Siguiente paso',
];

function splitLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const EquilibrioLiteExcelSection: React.FC<EquilibrioLiteExcelSectionProps> = ({
  config,
  returnStatus,
  onDismissReturnStatus,
  onOpenLicenseTerms,
  onOpenPrivacy,
}) => {
  const lc = {
    ...DEFAULT_LANDING_CONTENT,
    ...(config.landingContent ?? {}),
  };

  const productName = config.excelProductName || lc.excelTitle || 'Equilibrio Lite Excel';
  const priceLabel = config.excelPriceLabel || '$4.990 CLP';
  const equPriceLabel = config.priceLabel || '$5.990 / mes';
  const includesLines = splitLines(lc.excelIncludesList);

  const [modalOpen, setModalOpen] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerEmailConfirm, setBuyerEmailConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (config.excelActive === false) {
    return null;
  }

  const handleOpenModal = () => {
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = buyerName.trim();
    const cleanEmail = buyerEmail.trim().toLowerCase();
    const cleanConfirm = buyerEmailConfirm.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 100) {
      setFormError('Escribe tu nombre completo (entre 2 y 100 caracteres).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setFormError('Ingresa un correo electrónico válido.');
      return;
    }
    if (cleanEmail !== cleanConfirm) {
      setFormError('Los correos electrónicos no coinciden.');
      return;
    }
    if (!termsAccepted) {
      setFormError(
        'Debes aceptar los Términos de licencia personal y la Política de privacidad.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await createExcelCheckoutOrder({
        name: cleanName,
        email: cleanEmail,
        emailConfirm: cleanConfirm,
        termsAccepted: true,
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      setFormError('No recibimos el enlace de pago de Mercado Pago. Intenta nuevamente.');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'No pudimos iniciar tu compra en este momento.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="equilibrio-lite-excel"
      className="pb-16 sm:pb-22 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24"
    >
      {/* Estado de retorno desde Mercado Pago */}
      {returnStatus && (
        <SolidCard
          radius="lg"
          className={`p-5 sm:p-6 border ${
            returnStatus.loading
              ? 'border-[var(--sec-border)] bg-[var(--sec-soft)]/50'
              : returnStatus.ok
                ? 'border-[var(--pos-border)] bg-[var(--pos-soft)]/60'
                : 'border-[var(--warn-border)] bg-[var(--warn-soft)]/60'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {returnStatus.loading ? (
                <Sparkles className="w-5 h-5 text-[var(--sec-text)] shrink-0 mt-0.5 animate-pulse" />
              ) : returnStatus.ok ? (
                <CheckCircle2 className="w-5 h-5 text-[var(--pos-text)] shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[var(--warn-text)] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                  {returnStatus.loading
                    ? 'Confirmando tu pago de Equilibrio Lite Excel...'
                    : returnStatus.ok
                      ? '¡Pago confirmado y planilla enviada!'
                      : 'Estado de tu compra de Equilibrio Lite Excel'}
                </p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {returnStatus.message ||
                    'Estamos consultando con Mercado Pago para generar tu copia personalizada y enviarla a tu correo.'}
                </p>
                {returnStatus.licenseId && (
                  <p className="text-xs font-mono font-bold text-[var(--text-primary)] pt-1">
                    Licencia personal: {returnStatus.licenseId}
                  </p>
                )}
              </div>
            </div>
            {!returnStatus.loading && (
              <button
                type="button"
                onClick={onDismissReturnStatus}
                aria-label="Cerrar aviso de compra"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full hover:bg-[var(--bg-surface)] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </SolidCard>
      )}

      <ScrollReveal>
        <SolidCard radius="lg" className="p-6 sm:p-10 space-y-8">
          {/* Encabezado del producto + tarjeta de precio + aviso obligatorio sin scroll */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.06em] text-[var(--sec-text)]">
                <span className="w-9 h-9 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] flex items-center justify-center text-[var(--pos-text)]">
                  <FileSpreadsheet className="w-5 h-5" />
                </span>
                <span>{lc.excelEyebrow}</span>
              </div>

              <SectionTitle
                as="h2"
                size="lg"
                title={productName}
                subtitle={lc.excelSubtitle}
              />

              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {lc.excelAudienceText}
              </p>

              {/* Aviso obligatorio visible sin necesidad de hacer scroll dentro de la tarjeta */}
              <div className="p-4 rounded-[20px] bg-[var(--warn-soft)]/70 border border-[var(--warn-border)] space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--warn-text)]">
                  Importante antes de elegir
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
                  {lc.excelNonReplacementNotice}
                </p>
              </div>
            </div>

            {/* Caja de precio pago único y botones */}
            <div className="lg:col-span-5 p-6 rounded-[26px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-5">
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--sec-text)]">
                  Pago único · Entrega automática por correo
                </p>
                <div className="flex items-baseline gap-2.5">
                  <span className="font-mono tabular-nums text-4xl font-extrabold text-[var(--text-primary)]">
                    {priceLabel}
                  </span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">
                    una sola vez
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Copia personalizada con tu nombre e ID de licencia único. Sin mensualidades.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleOpenModal}
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="w-full min-h-[48px] px-6 py-3 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-92 transition-opacity cursor-pointer shadow-xs"
                >
                  <span>{lc.excelCtaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <a
                  href="#equilibrio"
                  className="w-full min-h-[44px] px-5 py-2.5 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>{lc.excelSecondaryLabel}</span>
                </a>
              </div>

              <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2 text-xs text-[var(--text-secondary)]">
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-[var(--pos-text)] shrink-0" />
                  <span>Recibes el archivo .xlsx en tu correo apenas se aprueba el pago.</span>
                </p>
                <p className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[var(--sec-text)] shrink-0" />
                  <span>Licencia personal e intransferible para uso propio.</span>
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onOpenLicenseTerms}
                    className="underline font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    Términos de licencia personal
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPrivacy}
                    className="underline font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    Política de privacidad
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Qué incluye: 10 hojas + semáforos y gráficos */}
          <div className="pt-6 border-t border-[var(--border-hairline)] grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--pos-text)]">
                  Qué incluye la planilla
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
                  10 hojas ordenadas, con semáforos y gráficos listos para llenar
                </h3>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {SHEET_NAMES.map((sheet, idx) => (
                  <span
                    key={sheet}
                    className="px-3 py-1 rounded-xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <span className="font-mono text-[var(--sec-text)] mr-1">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {sheet}
                  </span>
                ))}
              </div>

              <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]">
                {includesLines.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[var(--pos-text)] shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-[var(--text-secondary)] p-3.5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                {lc.excelTaxDisclaimer} Funciona en Microsoft Excel y, con limitaciones visuales, en Google Sheets.
              </p>
            </div>

            {/* Tabla comparativa simple: Equilibrio Lite Excel vs Equilibrio */}
            <div className="lg:col-span-6 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--sec-text)]">
                  Comparación clara
                </p>
                <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
                  {productName} vs Equilibrio
                </h3>
              </div>

              <div className="overflow-x-auto rounded-[22px] border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] bg-[var(--bg-soft-alt)]">
                      <th className="py-3 px-4 font-bold text-[var(--text-secondary)]">
                        Criterio
                      </th>
                      <th className="py-3 px-4 font-bold text-[var(--text-primary)]">
                        {productName}
                      </th>
                      <th className="py-3 px-4 font-bold text-[var(--accent-strong)]">
                        Equilibrio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)]">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        Cómo se usa
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        Lo llenas tú a mano en tu planilla
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        Más automático y guiado paso a paso
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        Explicación de tus cifras
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        Semáforos y gráficos básicos
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        Analista PYME y &ldquo;Explícame simple&rdquo;
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        Capacidad y control
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        Hasta 10 productos
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        Inventario, cuentas por cobrar y por pagar integradas
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        Negocios y respaldo
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)]">
                        Archivo local para un negocio
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)]">
                        Varios negocios, respaldos en la nube y notificaciones
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                        Modalidad
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--text-primary)]">
                        Pago único ({priceLabel})
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-[var(--accent-strong)]">
                        Mensualidad ({equPriceLabel})
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-[20px] bg-[var(--sec-soft)]/50 border border-[var(--sec-border)] text-center">
                <p className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)] italic">
                  &ldquo;{lc.excelBridgeQuote}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </SolidCard>
      </ScrollReveal>

      {/* Modal de compra */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-checkout-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: GROWY_EASE }}
              className="w-full max-w-lg growy-solid rounded-[28px] p-6 sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--sec-text)]">
                    Compra única · {priceLabel}
                  </p>
                  <h3
                    id="excel-checkout-title"
                    className="font-display text-2xl font-extrabold text-[var(--text-primary)]"
                  >
                    {productName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  aria-label="Cerrar formulario de compra"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Aviso obligatorio visible en el formulario */}
              <div className="p-3.5 rounded-2xl bg-[var(--warn-soft)]/70 border border-[var(--warn-border)] text-xs text-[var(--text-primary)] leading-relaxed">
                <strong>Recuerda:</strong> {lc.excelNonReplacementNotice}
              </div>

              {formError && (
                <div className="p-3 rounded-2xl bg-[var(--danger-soft)] border border-[var(--danger-border)] text-xs font-semibold text-[var(--danger-text)] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitOrder} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--text-primary)]">
                    Nombre completo (aparecerá en tu licencia personal)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Ej. Camila Rojas Soto"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="boho-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--text-primary)]">
                    Correo electrónico (donde enviaremos tu planilla)
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    placeholder="tu@correo.cl"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="boho-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--text-primary)]">
                    Confirma tu correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={160}
                    placeholder="Repite tu correo"
                    value={buyerEmailConfirm}
                    onChange={(e) => setBuyerEmailConfirm(e.target.value)}
                    className="boho-input w-full"
                  />
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[var(--text-secondary)] cursor-pointer leading-relaxed">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[var(--accent-strong)] shrink-0"
                  />
                  <span>
                    Acepto los{' '}
                    <button
                      type="button"
                      onClick={onOpenLicenseTerms}
                      className="underline font-bold text-[var(--text-primary)] cursor-pointer"
                    >
                      Términos de licencia personal
                    </button>{' '}
                    (uso propio, sin copia ni reventa) y la{' '}
                    <button
                      type="button"
                      onClick={onOpenPrivacy}
                      className="underline font-bold text-[var(--text-primary)] cursor-pointer"
                    >
                      Política de privacidad
                    </button>
                    .
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="w-full min-h-[48px] px-6 py-3 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-92 transition-opacity cursor-pointer disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Preparando tu orden y Mercado Pago...'
                      : `Ir a pagar ${priceLabel} en Mercado Pago`}
                  </span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
