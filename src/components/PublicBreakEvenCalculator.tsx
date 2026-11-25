import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  HelpCircle,
  Mail,
  Tag,
  Target,
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

type MiniCalculatorTab = 'breakeven' | 'pricing' | 'profit_goal';

const CLP_CURRENCY: CurrencyConfig = {
  code: 'CLP',
  symbol: '$',
  locale: 'es-CL',
  decimals: 0,
};

function parseInputNumber(raw: string): number | null {
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export const PublicBreakEvenCalculator: React.FC<PublicBreakEvenCalculatorProps> = ({
  onSaveAndContinue,
  onOpenPrivacy,
  authLoading,
  isSignedIn,
}) => {
  const [activeTool, setActiveTool] = useState<MiniCalculatorTab>('breakeven');

  // Entradas compartidas para Punto de equilibrio y Meta de ganancia
  const [fixedCostsInput, setFixedCostsInput] = useState('450000');
  const [variableCostInput, setVariableCostInput] = useState('3500');
  const [unitPriceInput, setUnitPriceInput] = useState('12500');
  const [showContributionTooltip, setShowContributionTooltip] = useState(false);

  // Mini-calculadora 2: Precio sugerido y margen
  const [pricingCostInput, setPricingCostInput] = useState('3500');
  const [pricingMarginInput, setPricingMarginInput] = useState('45');

  // Mini-calculadora 3: Meta de ganancia mensual
  const [targetProfitInput, setTargetProfitInput] = useState('600000');

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

  const pricingResult = useMemo(() => {
    const rawCost = parseInputNumber(pricingCostInput);
    const rawMargin = parseInputNumber(pricingMarginInput);

    if ((rawCost !== null && rawCost < 0) || (rawMargin !== null && rawMargin < 0)) {
      return {
        isValid: false,
        validationMessage: 'Usa valores positivos para calcular tu precio sugerido.',
        unitCost: 0,
        marginPct: 0,
        suggestedNetPrice: 0,
        suggestedIvaPrice: 0,
        unitProfit: 0,
        markupPct: 0,
      };
    }

    const unitCost = Math.max(0, rawCost ?? 0);
    const marginPct = Math.max(0, rawMargin ?? 0);

    if (rawCost === null || unitCost <= 0) {
      return {
        isValid: false,
        validationMessage: 'Ingresa un costo por unidad mayor a $0 para sugerir un precio.',
        unitCost,
        marginPct,
        suggestedNetPrice: 0,
        suggestedIvaPrice: 0,
        unitProfit: 0,
        markupPct: 0,
      };
    }

    if (rawMargin === null || marginPct >= 100) {
      return {
        isValid: false,
        validationMessage:
          'El margen sobre el precio de venta debe ser menor a 100% (por ejemplo, entre 25% y 60%).',
        unitCost,
        marginPct,
        suggestedNetPrice: 0,
        suggestedIvaPrice: 0,
        unitProfit: 0,
        markupPct: 0,
      };
    }

    const suggestedNetPrice = Math.round(unitCost / (1 - marginPct / 100));
    const suggestedIvaPrice = Math.round(suggestedNetPrice * 1.19);
    const unitProfit = Math.max(0, suggestedNetPrice - unitCost);
    const markupPct = unitCost > 0 ? (unitProfit / unitCost) * 100 : 0;

    return {
      isValid: true,
      validationMessage: null,
      unitCost,
      marginPct,
      suggestedNetPrice,
      suggestedIvaPrice,
      unitProfit,
      markupPct,
    };
  }, [pricingCostInput, pricingMarginInput]);

  const profitGoalResult = useMemo(() => {
    const rawProfit = parseInputNumber(targetProfitInput);
    if (rawProfit !== null && rawProfit < 0) {
      return {
        isValid: false,
        validationMessage: 'Ingresa una meta de ganancia mensual igual o mayor a $0.',
        targetProfit: 0,
        targetUnits: 0,
        extraUnits: 0,
        targetSalesClp: 0,
        breakEvenUnits: result.breakEvenUnits,
      };
    }

    if (result.validationMessage) {
      return {
        isValid: false,
        validationMessage: result.validationMessage,
        targetProfit: Math.max(0, rawProfit ?? 0),
        targetUnits: 0,
        extraUnits: 0,
        targetSalesClp: 0,
        breakEvenUnits: 0,
      };
    }

    const targetProfit = Math.max(0, rawProfit ?? 0);
    const totalToCover = result.fixedCosts + targetProfit;
    const targetUnits =
      result.unitContributionMargin > 0
        ? Math.ceil(totalToCover / result.unitContributionMargin)
        : 0;
    const extraUnits = Math.max(0, targetUnits - result.breakEvenUnits);
    const targetSalesClp = targetUnits * result.unitPrice;

    return {
      isValid: true,
      validationMessage: null,
      targetProfit,
      targetUnits,
      extraUnits,
      targetSalesClp,
      breakEvenUnits: result.breakEvenUnits,
    };
  }, [result, targetProfitInput]);

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
    setPricingCostInput('3500');
    setPricingMarginInput('45');
    setTargetProfitInput('600000');
    trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
  };

  const handleSaveDraftAndSignIn = () => {
    if (activeTool === 'pricing' && pricingResult.isValid) {
      trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
      onSaveAndContinue({
        fixedCosts: result.fixedCosts,
        variableCost: pricingResult.unitCost,
        unitPrice: pricingResult.suggestedNetPrice > 0 ? pricingResult.suggestedNetPrice : 12500,
      });
      return;
    }

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
        variableCost:
          activeTool === 'pricing' && pricingResult.isValid
            ? pricingResult.unitCost
            : result.variableCost,
        unitPrice:
          activeTool === 'pricing' && pricingResult.isValid
            ? pricingResult.suggestedNetPrice
            : result.unitPrice,
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

  const activeHeadline =
    activeTool === 'breakeven'
      ? 'Prueba ahora tu *punto de equilibrio*'
      : activeTool === 'pricing'
        ? 'Calcula tu *precio sugerido* y margen'
        : 'Simula tu *meta de ganancia* mensual';

  const activeSubtitle =
    activeTool === 'breakeven'
      ? 'Ingresa tus 3 números en pesos chilenos (CLP) y descubre al instante cuántas ventas necesitas al mes para cubrir tus costos.'
      : activeTool === 'pricing'
        ? 'Define cuánto cuesta hacer o comprar cada unidad y el margen real que quieres conservar sobre la venta.'
        : 'Calcula exactamente cuántas unidades necesitas vender al mes para cubrir tus costos y llevarte la ganancia que buscas.';

  return (
    <SolidCard radius="lg" className="p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.04em] uppercase text-[var(--accent-strong)]">
            <Calculator className="w-4 h-4 shrink-0" />
            <span>Calculadoras gratuitas · Sin registro previo</span>
          </span>
          <h3 className="font-display text-2xl sm:text-[1.75rem] font-extrabold text-[var(--text-primary)] tracking-tight">
            <EditorialText text={activeHeadline} />
          </h3>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
            {activeSubtitle}
          </p>
        </div>

        <ChipLink
          variant="lilac"
          label="Cargar *ejemplo* de velas"
          onClick={handleLoadCandleExample}
          className="self-start sm:self-center shrink-0"
        />
      </div>

      {/* Selector de 3 mini-calculadoras rápidas */}
      <div className="overflow-x-auto pb-1">
        <div
          role="tablist"
          aria-label="Calculadoras financieras públicas"
          className="growy-tab-track"
        >
          {[
            {
              id: 'breakeven' as const,
              label: 'Punto de equilibrio',
              icon: <Calculator className="w-3.5 h-3.5 shrink-0" />,
            },
            {
              id: 'pricing' as const,
              label: 'Precio y margen',
              icon: <Tag className="w-3.5 h-3.5 shrink-0" />,
            },
            {
              id: 'profit_goal' as const,
              label: 'Meta de ganancia',
              icon: <Target className="w-3.5 h-3.5 shrink-0" />,
            },
          ].map((tab) => {
            const active = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTool(tab.id)}
                style={
                  active
                    ? {
                        backgroundColor: 'var(--btn-navy-bg)',
                        color: 'var(--btn-navy-text)',
                      }
                    : undefined
                }
                className={`min-h-[40px] px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MINI-CALCULADORA 1: PUNTO DE EQUILIBRIO */}
      {activeTool === 'breakeven' && (
        <>
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
        </>
      )}

      {/* MINI-CALCULADORA 2: PRECIO SUGERIDO Y MARGEN */}
      {activeTool === 'pricing' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
              <label
                htmlFor="public-price-cost"
                className="block text-xs font-bold text-[var(--text-primary)]"
              >
                1. Costo por unidad (CLP)
              </label>
              <input
                id="public-price-cost"
                type="number"
                min={0}
                step="any"
                placeholder="Ej. 3500"
                value={pricingCostInput}
                onChange={(e) => {
                  setPricingCostInput(e.target.value);
                  trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
                }}
                className="boho-input w-full font-mono tabular-nums text-base font-semibold"
              />
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                Cuánto te cuesta producir, comprar o preparar cada unidad lista para vender.
              </p>
            </div>

            <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
              <label
                htmlFor="public-price-margin"
                className="block text-xs font-bold text-[var(--text-primary)]"
              >
                2. Margen deseado sobre la venta (%)
              </label>
              <input
                id="public-price-margin"
                type="number"
                min={1}
                max={95}
                step="any"
                placeholder="Ej. 45"
                value={pricingMarginInput}
                onChange={(e) => {
                  setPricingMarginInput(e.target.value);
                  trackFunnelStepOncePerSession('first_calculation', { source: 'public_calculator' });
                }}
                className="boho-input w-full font-mono tabular-nums text-base font-semibold"
              />
              <p className="text-[11px] text-[var(--text-secondary)] leading-snug">
                Porcentaje del precio final que quieres que quede libre antes de gastos fijos.
              </p>
            </div>
          </div>

          {!pricingResult.isValid ? (
            <div
              role="status"
              className="p-5 rounded-[24px] bg-[var(--warn-soft)] border border-[var(--warn-border)] flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-[var(--warn-text)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="font-bold text-[var(--text-primary)]">
                  {pricingResult.validationMessage}
                </p>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Ejemplo rápido: si tu costo es $3.500 y buscas un 45% de margen, el precio neto sugerido es $6.364.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-[22px] bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
                  <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
                    Precio sugerido (neto)
                  </p>
                  <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                    {formatCurrency(pricingResult.suggestedNetPrice, CLP_CURRENCY)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Margen de {pricingResult.marginPct.toFixed(1)}% sobre venta
                  </p>
                </div>

                <div className="p-4 rounded-[22px] bg-[var(--sec-soft)] border border-[var(--sec-border)]">
                  <p className="text-xs font-semibold text-[var(--sec-text)]">
                    Precio ref. con IVA (19%)
                  </p>
                  <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                    {formatCurrency(pricingResult.suggestedIvaPrice, CLP_CURRENCY)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Valor aproximado a público afecto a IVA
                  </p>
                </div>

                <div className="p-4 rounded-[22px] bg-[var(--pos-soft)] border border-[var(--pos-border)]">
                  <p className="text-xs font-semibold text-[var(--pos-text)]">
                    Ganancia por unidad
                  </p>
                  <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                    {formatCurrency(pricingResult.unitProfit, CLP_CURRENCY)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Equivale a {pricingResult.markupPct.toFixed(1)}% sobre tu costo
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-[22px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[var(--pos-text)] shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
                  <strong>En simple:</strong> si vendes a{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(pricingResult.suggestedNetPrice, CLP_CURRENCY)}
                  </strong>{' '}
                  neto cada unidad, recuperas tus{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(pricingResult.unitCost, CLP_CURRENCY)}
                  </strong>{' '}
                  de costo y te quedan{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(pricingResult.unitProfit, CLP_CURRENCY)}
                  </strong>{' '}
                  libres por venta para pagar tus costos fijos y ganar dinero.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* MINI-CALCULADORA 3: META DE GANANCIA MENSUAL */}
      {activeTool === 'profit_goal' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
              <label
                htmlFor="public-goal-fixed"
                className="block text-xs font-bold text-[var(--text-primary)]"
              >
                1. Costos fijos (CLP)
              </label>
              <input
                id="public-goal-fixed"
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
            </div>

            <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
              <label
                htmlFor="public-goal-variable"
                className="block text-xs font-bold text-[var(--text-primary)]"
              >
                2. Costo variable (CLP)
              </label>
              <input
                id="public-goal-variable"
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
            </div>

            <div className="p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
              <label
                htmlFor="public-goal-price"
                className="block text-xs font-bold text-[var(--text-primary)]"
              >
                3. Precio unidad (CLP)
              </label>
              <input
                id="public-goal-price"
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
            </div>

            <div className="p-4 rounded-[22px] bg-[var(--pos-soft)]/50 border border-[var(--pos-border)] space-y-1.5">
              <label
                htmlFor="public-goal-profit"
                className="block text-xs font-bold text-[var(--pos-text)]"
              >
                4. Ganancia meta mes (CLP)
              </label>
              <input
                id="public-goal-profit"
                type="number"
                min={0}
                step="any"
                placeholder="Ej. 600000"
                value={targetProfitInput}
                onChange={(e) => {
                  setTargetProfitInput(e.target.value);
                  notifyCalculationInteraction(fixedCostsInput, variableCostInput, unitPriceInput);
                }}
                className="boho-input w-full font-mono tabular-nums text-base font-semibold"
              />
            </div>
          </div>

          {!profitGoalResult.isValid ? (
            <div
              role="status"
              className="p-5 rounded-[24px] bg-[var(--warn-soft)] border border-[var(--warn-border)] flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-[var(--warn-text)] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm">
                <p className="font-bold text-[var(--text-primary)]">
                  {profitGoalResult.validationMessage}
                </p>
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  Asegúrate de que el precio de venta supere al costo variable por unidad y define tu meta mensual en pesos positivos.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-[22px] bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
                  <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
                    Unidades para tu meta
                  </p>
                  <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                    {formatNumber(profitGoalResult.targetUnits)} u.
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Para lograr {formatCurrency(profitGoalResult.targetProfit, CLP_CURRENCY)} libres al mes
                  </p>
                </div>

                <div className="p-4 rounded-[22px] bg-[var(--pos-soft)] border border-[var(--pos-border)]">
                  <p className="text-xs font-semibold text-[var(--pos-text)]">
                    Ventas mensuales necesarias
                  </p>
                  <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                    {formatCurrency(profitGoalResult.targetSalesClp, CLP_CURRENCY)}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Facturación objetivo en CLP
                  </p>
                </div>

                <div className="p-4 rounded-[22px] bg-[var(--sec-soft)] border border-[var(--sec-border)]">
                  <p className="text-xs font-semibold text-[var(--sec-text)]">
                    Sobre tu equilibrio
                  </p>
                  <p className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
                    +{formatNumber(profitGoalResult.extraUnits)} u.
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Equilibrio base: {formatNumber(profitGoalResult.breakEvenUnits)} u./mes
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-[22px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[var(--pos-text)] shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
                  <strong>En simple:</strong> las primeras{' '}
                  <strong className="font-mono tabular-nums">
                    {formatNumber(profitGoalResult.breakEvenUnits)} unidades
                  </strong>{' '}
                  cubren tus costos del mes, y vendiendo{' '}
                  <strong className="font-mono tabular-nums">
                    {formatNumber(profitGoalResult.extraUnits)} unidades adicionales
                  </strong>{' '}
                  alcanzas tu meta de{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrency(profitGoalResult.targetProfit, CLP_CURRENCY)}
                  </strong>{' '}
                  de ganancia mensual.
                </p>
              </div>
            </div>
          )}
        </>
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
