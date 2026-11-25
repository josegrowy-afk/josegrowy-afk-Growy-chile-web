import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  HelpCircle,
  Mail,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../finance/formulas';
import { calculatePublicBreakEven } from '../finance/phase1Insights';
import {
  savePublicBreakEvenGuideLead,
  trackFunnelStepOncePerSession,
} from '../firebase/services';
import type { CurrencyConfig, PublicBreakEvenDraft } from '../types/finance';
import { ChipLink } from './design-system/ChipLink';
import { SolidCard } from './design-system/GlassCard';
import { EditorialText } from './design-system/SectionTitle';

interface PublicBreakEvenCalculatorProps {
  onSaveAndContinue: (draft: Omit<PublicBreakEvenDraft, 'createdAt'>) => void;
  onOpenPrivacy: () => void;
  authLoading: boolean;
  isSignedIn: boolean;
}

const CLP_CURRENCY: CurrencyConfig = {
  code: 'CLP',
  symbol: '$',
  locale: 'es-CL',
  decimals: 0,
};

export const PublicBreakEvenCalculator: React.FC<PublicBreakEvenCalculatorProps> = ({
  onSaveAndContinue,
  onOpenPrivacy,
  authLoading,
  isSignedIn,
}) => {
  const [fixedCostsInput, setFixedCostsInput] = useState('450000');
  const [variableCostInput, setVariableCostInput] = useState('3500');
  const [unitPriceInput, setUnitPriceInput] = useState('12500');
  const [showContributionTooltip, setShowContributionTooltip] = useState(false);

  // Envío opcional de guía práctica por correo
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadConsent, setLeadConsent] = useState(false);
  const [leadSending, setLeadSending] = useState(false);
  const [leadFeedback, setLeadFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  const result = useMemo(
    () =>
      calculatePublicBreakEven({
        fixedCosts: fixedCostsInput,
        variableCost: variableCostInput,
        unitPrice: unitPriceInput,
      }),
    [fixedCostsInput, variableCostInput, unitPriceInput]
  );

  const notifyCalculationInteraction = (nextFixed: string, nextVar: string, nextPrice: string) => {
    const check = calculatePublicBreakEven({
      fixedCosts: nextFixed,
      variableCost: nextVar,
      unitPrice: nextPrice,
    });
    if (check.isViable) {
      trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
    }
  };

  const handleLoadCandleExample = () => {
    setFixedCostsInput('450000');
    setVariableCostInput('3500');
    setUnitPriceInput('12500');
    trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
  };

  const handleSaveDraftAndSignIn = () => {
    if (result.isViable) {
      trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
    }
    onSaveAndContinue({
      fixedCosts: result.fixedCosts,
      variableCost: result.variableCost,
      unitPrice: result.unitPrice > 0 ? result.unitPrice : 12500,
    });
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadSending(true);
    setLeadFeedback(null);
    try {
      const response = await savePublicBreakEvenGuideLead({
        email: leadEmail,
        fixedCosts: result.fixedCosts,
        variableCost: result.variableCost,
        unitPrice: result.unitPrice,
        breakEvenUnits: result.isViable ? result.breakEvenUnits : undefined,
        consentAccepted: leadConsent,
      });
      setLeadEmail('');
      setLeadConsent(false);
      setLeadFeedback({
        type: 'ok',
        text: response.emailed
          ? '¡Listo! Te enviamos la guía práctica con tus cifras al correo.'
          : '¡Correo registrado! Guardamos tu solicitud para enviarte la guía práctica.',
      });
    } catch (err) {
      setLeadFeedback({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'No pudimos guardar tu correo ahora. Intenta nuevamente en unos segundos.',
      });
    } finally {
      setLeadSending(false);
    }
  };

  return (
    <SolidCard radius="lg" className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.04em] uppercase text-[var(--accent-strong)]">
            <Calculator className="w-4 h-4 shrink-0" />
            <span>Calculadora gratuita · Sin registro previo</span>
          </span>
          <h3 className="font-display text-2xl sm:text-[1.75rem] font-extrabold text-[var(--text-primary)] tracking-tight">
            <EditorialText text="Prueba ahora tu *punto de equilibrio*" />
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Ingresa tus 3 números en pesos chilenos (CLP) y descubre al instante cuántas ventas necesitas al mes para cubrir tus costos.
          </p>
        </div>

        <ChipLink
          variant="lilac"
          label="Cargar *ejemplo* de velas"
          onClick={handleLoadCandleExample}
          className="self-start sm:self-center"
        />
      </div>

      {/* 3 Campos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
          <label
            htmlFor="public-be-fixed"
            className="block text-xs font-bold text-[var(--text-primary)]"
          >
            1. Costos fijos del mes (CLP)
          </label>
          <input
            id="public-be-fixed"
            type="number"
            min={0}
            step="any"
            placeholder="Ej. 450000"
            value={fixedCostsInput}
            onChange={(e) => {
              setFixedCostsInput(e.target.value);
              notifyCalculationInteraction(e.target.value, variableCostInput, unitPriceInput);
            }}
            className="boho-input w-full font-mono tabular-nums text-base font-semibold"
          />
          <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
            Arriendo, cuentas básicas, internet, sueldos fijos o herramientas.
          </p>
        </div>

        <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
          <label
            htmlFor="public-be-variable"
            className="block text-xs font-bold text-[var(--text-primary)]"
          >
            2. Costo variable por unidad (CLP)
          </label>
          <input
            id="public-be-variable"
            type="number"
            min={0}
            step="any"
            placeholder="Ej. 3500"
            value={variableCostInput}
            onChange={(e) => {
              setVariableCostInput(e.target.value);
              notifyCalculationInteraction(fixedCostsInput, e.target.value, unitPriceInput);
            }}
            className="boho-input w-full font-mono tabular-nums text-base font-semibold"
          />
          <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
            Insumos, envase, comisión de tarjeta y despacho de cada venta.
          </p>
        </div>

        <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
          <label
            htmlFor="public-be-price"
            className="block text-xs font-bold text-[var(--text-primary)]"
          >
            3. Precio de venta por unidad (CLP)
          </label>
          <input
            id="public-be-price"
            type="number"
            min={0}
            step="any"
            placeholder="Ej. 12500"
            value={unitPriceInput}
            onChange={(e) => {
              setUnitPriceInput(e.target.value);
              notifyCalculationInteraction(fixedCostsInput, variableCostInput, e.target.value);
            }}
            className="boho-input w-full font-mono tabular-nums text-base font-semibold"
          />
          <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
            Lo que paga tu cliente por cada producto o servicio.
          </p>
        </div>
      </div>

      {/* Mensaje de validación amable o resultados inmediatos */}
      {result.validationMessage ? (
        <div
          role="status"
          className="p-5 rounded-[24px] bg-[var(--warn-soft)] border border-[var(--warn-border)] flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-[var(--warn-text)] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <p className="font-bold text-[var(--text-primary)]">{result.validationMessage}</p>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {result.simpleExplanation}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-[22px] bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
              <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
                Unidades de equilibrio
              </p>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                {formatNumber(result.breakEvenUnits)} u.
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Meta mínima mensual en unidades
              </p>
            </div>

            <div className="p-4 rounded-[22px] bg-[var(--pos-soft)] border border-[var(--pos-border)]">
              <p className="text-xs font-semibold text-[var(--pos-text)]">
                Ventas de equilibrio en CLP
              </p>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                {formatCurrency(result.breakEvenSalesClp, CLP_CURRENCY)}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Ingresos mínimos para no perder
              </p>
            </div>

            <div className="p-4 rounded-[22px] bg-[var(--sec-soft)] border border-[var(--sec-border)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--sec-text)]">
                  Margen de contribución
                </p>
                <button
                  type="button"
                  onClick={() => setShowContributionTooltip((prev) => !prev)}
                  aria-label="¿Qué es el margen de contribución?"
                  aria-expanded={showContributionTooltip}
                  className="text-[var(--sec-text)] hover:opacity-80 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                {formatCurrency(result.unitContributionMargin, CLP_CURRENCY)}
                <span className="text-sm font-semibold text-[var(--sec-text)] ml-1.5">
                  ({result.contributionMarginPercent.toFixed(1)}%)
                </span>
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                {showContributionTooltip
                  ? 'Es la plata que te queda libre por unidad después de restar su costo variable.'
                  : 'Lo que aporta cada venta a tus gastos fijos'}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[22px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[var(--pos-text)] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
              <strong>En simple:</strong> {result.simpleExplanation}
            </p>
          </div>
        </div>
      )}

      {/* CTA principal + opción de recibir guía por correo */}
      <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            disabled={authLoading}
            onClick={handleSaveDraftAndSignIn}
            style={{
              backgroundColor: 'var(--btn-navy-bg)',
              color: 'var(--btn-navy-text)',
            }}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-full hover:opacity-92 text-sm font-bold transition-opacity whitespace-nowrap shadow-xs cursor-pointer disabled:opacity-60"
          >
            <span>
              {isSignedIn
                ? 'Llevar estos números a Equilibrio'
                : authLoading
                  ? 'Conectando con Google...'
                  : 'Guarda y proyecta esto en Equilibrio'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowEmailForm((prev) => !prev);
              setLeadFeedback(null);
            }}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-xs font-semibold text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-[var(--sec-text)]" />
            <span>
              {showEmailForm
                ? 'Ocultar envío por correo'
                : 'Recibir guía práctica en mi correo (opcional)'}
            </span>
          </button>
        </div>

        {showEmailForm && (
          <form
            onSubmit={handleLeadSubmit}
            className="p-4 sm:p-5 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-3"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                Recibe esta mini guía con tus resultados por correo
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Solo te enviaremos esta guía de punto de equilibrio. Nunca vendemos ni compartimos tu correo. Revisa nuestro{' '}
                <button
                  type="button"
                  onClick={onOpenPrivacy}
                  className="underline font-semibold text-[var(--accent-strong)] cursor-pointer"
                >
                  Aviso de privacidad
                </button>
                .
              </p>
            </div>

            {leadFeedback && (
              <p
                className={`text-xs font-semibold p-3 rounded-xl ${
                  leadFeedback.type === 'ok'
                    ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                    : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                }`}
              >
                {leadFeedback.text}
              </p>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="email"
                required
                placeholder="tucorreo@pyme.cl"
                aria-label="Correo electrónico para recibir la guía de punto de equilibrio"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className="boho-input flex-1 rounded-full px-5"
              />
              <button
                type="submit"
                disabled={leadSending}
                style={{
                  backgroundColor: 'var(--btn-navy-bg)',
                  color: 'var(--btn-navy-text)',
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60 hover:opacity-92"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{leadSending ? 'Enviando...' : 'Enviar guía'}</span>
              </button>
            </div>

            <label className="inline-flex items-start gap-2 text-[11px] text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={leadConsent}
                onChange={(e) => setLeadConsent(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-[var(--accent-strong)]"
              />
              <span>Autorizo a GROWy a enviarme esta guía práctica de punto de equilibrio a mi correo.</span>
            </label>
          </form>
        )}
      </div>
    </SolidCard>
  );
};
