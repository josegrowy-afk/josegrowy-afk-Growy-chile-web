import React, { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Sliders, Sparkles } from 'lucide-react';
import {
  calculateBreakEvenAndTarget,
  formatCurrency,
  formatNumber,
  formatPercent,
  getCurrentYearMonth,
  getProductContributionMargin,
  getProductCostBreakdown,
  getProductMarginPercent,
  getTotalFixedCostsForMonth,
} from '../finance/formulas';
import {
  calculateOwnerSalaryImpact,
  calculatePriceSensitivityTable,
} from '../finance/phase2Insights';
import type { BusinessWorkspace, ProductItem } from '../types/finance';
import { DoodleSparkleMotif, EquilibrioProductIcon, GrowyDivider } from './GrowyMotifs';
import { GlassCard, SectionTitle, SolidCard } from './design-system';

interface CalculatorViewProps {
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
}

interface ProductSimulationOverride {
  price?: number;
  variableCost?: number;
}

function getSliderConfig(basePrice: number, baseVarCost: number, decimals: number) {
  const ref = Math.max(basePrice, baseVarCost, decimals > 0 ? 10 : 100);
  let step = 1;
  if (decimals > 0) {
    if (ref <= 40) step = 0.5;
    else if (ref <= 500) step = 1;
    else step = 5;
  } else {
    if (ref <= 150) step = 1;
    else if (ref <= 1500) step = 10;
    else if (ref <= 15000) step = 100;
    else if (ref <= 150000) step = 500;
    else step = 1000;
  }

  const rawMax = Math.max(ref * 2, step * 20);
  const max = Math.ceil(rawMax / step) * step;

  return { min: 0, max, step };
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  business,
  onUpdateBusiness,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [priceDelta, setPriceDelta] = useState(0);
  const [varCostDelta, setVarCostDelta] = useState(0);
  const [fixedCostDelta, setFixedCostDelta] = useState(0);
  const [productOverrides, setProductOverrides] = useState<
    Record<string, ProductSimulationOverride>
  >({});
  const [appliedNotice, setAppliedNotice] = useState(false);

  useEffect(() => {
    setPriceDelta(0);
    setVarCostDelta(0);
    setFixedCostDelta(0);
    setProductOverrides({});
    setAppliedNotice(false);
  }, [business.id]);

  const fixedCostsForMonth = useMemo(
    () => getTotalFixedCostsForMonth(business.fixedCosts, selectedMonth),
    [business.fixedCosts, selectedMonth]
  );

  const baseAnalysis = useMemo(
    () =>
      calculateBreakEvenAndTarget({
        fixedCosts: fixedCostsForMonth,
        products: business.products,
        targetProfit: business.targetProfit,
        expectedUnits: business.expectedMonthlyUnits,
      }),
    [fixedCostsForMonth, business.products, business.targetProfit, business.expectedMonthlyUnits]
  );

  const simulatedProducts: ProductItem[] = useMemo(() => {
    const decimalsFactor = Math.pow(10, business.currency.decimals);
    const roundVal = (v: number) => Math.round(Math.max(0, v) * decimalsFactor) / decimalsFactor;

    return business.products.map((product) => {
      const override = productOverrides[product.id];
      const nextPrice =
        override?.price !== undefined
          ? override.price
          : roundVal(product.price * (1 + priceDelta / 100));
      const nextVarCost =
        override?.variableCost !== undefined
          ? override.variableCost
          : roundVal(product.variableCost * (1 + varCostDelta / 100));

      return {
        ...product,
        price: nextPrice,
        variableCost: nextVarCost,
      };
    });
  }, [business.products, business.currency.decimals, productOverrides, priceDelta, varCostDelta]);

  const simulatedFixedCosts = useMemo(
    () => Math.max(0, fixedCostsForMonth * (1 + fixedCostDelta / 100)),
    [fixedCostsForMonth, fixedCostDelta]
  );

  const simAnalysis = useMemo(
    () =>
      calculateBreakEvenAndTarget({
        fixedCosts: simulatedFixedCosts,
        products: simulatedProducts,
        targetProfit: business.targetProfit,
        expectedUnits: business.expectedMonthlyUnits,
      }),
    [
      simulatedFixedCosts,
      simulatedProducts,
      business.targetProfit,
      business.expectedMonthlyUnits,
    ]
  );

  const hasProductOverrides = useMemo(
    () =>
      business.products.some((p) => {
        const ov = productOverrides[p.id];
        if (!ov) return false;
        return (
          (ov.price !== undefined && Math.abs(ov.price - p.price) > 0.001) ||
          (ov.variableCost !== undefined && Math.abs(ov.variableCost - p.variableCost) > 0.001)
        );
      }),
    [business.products, productOverrides]
  );

  const isSimulating =
    priceDelta !== 0 || varCostDelta !== 0 || fixedCostDelta !== 0 || hasProductOverrides;
  const activeResult = isSimulating ? simAnalysis : baseAnalysis;

  const ownerSalaryImpact = useMemo(
    () => calculateOwnerSalaryImpact(business, selectedMonth),
    [business, selectedMonth]
  );

  const sensitivityRows = useMemo(
    () =>
      calculatePriceSensitivityTable({
        fixedCosts: simulatedFixedCosts,
        products: business.products,
        targetProfit: business.targetProfit,
        expectedUnits: business.expectedMonthlyUnits,
      }),
    [simulatedFixedCosts, business.products, business.targetProfit, business.expectedMonthlyUnits]
  );

  const breakEvenSharePct =
    activeResult.targetTotalUnits > 0
      ? (activeResult.breakEvenUnits / activeResult.targetTotalUnits) * 100
      : 0;

  const resetSimulation = () => {
    setPriceDelta(0);
    setVarCostDelta(0);
    setFixedCostDelta(0);
    setProductOverrides({});
  };

  const handleProductSliderChange = (
    productId: string,
    field: 'price' | 'variableCost',
    value: number
  ) => {
    setAppliedNotice(false);
    setProductOverrides((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: Math.max(0, value),
      },
    }));
  };

  const handleGlobalPriceDelta = (nextDelta: number) => {
    setAppliedNotice(false);
    setPriceDelta(nextDelta);
    // Limpiar overrides individuales de precio para reflejar el ajuste global de forma coherente
    setProductOverrides((prev) => {
      const updated: Record<string, ProductSimulationOverride> = {};
      for (const [id, ov] of Object.entries(prev)) {
        if (ov.variableCost !== undefined) {
          updated[id] = { variableCost: ov.variableCost };
        }
      }
      return updated;
    });
  };

  const handleGlobalVarCostDelta = (nextDelta: number) => {
    setAppliedNotice(false);
    setVarCostDelta(nextDelta);
    setProductOverrides((prev) => {
      const updated: Record<string, ProductSimulationOverride> = {};
      for (const [id, ov] of Object.entries(prev)) {
        if (ov.price !== undefined) {
          updated[id] = { price: ov.price };
        }
      }
      return updated;
    });
  };

  const handleApplySimulatedCatalog = () => {
    const decimalsFactor = Math.pow(10, business.currency.decimals);
    const roundVal = (v: number) => Math.round(Math.max(0, v) * decimalsFactor) / decimalsFactor;

    const updatedProducts = simulatedProducts.map((simProd, index) => {
      const baseProd = business.products[index];
      if (!baseProd?.supplyCostItems || baseProd.supplyCostItems.length === 0) {
        return simProd;
      }
      if (Math.abs(simProd.variableCost - baseProd.variableCost) <= 0.001) {
        return simProd;
      }
      if (simProd.variableCost <= 0) {
        return { ...simProd, supplyCostItems: undefined };
      }
      const oldSum = baseProd.supplyCostItems.reduce((sum, item) => sum + item.amount, 0);
      if (oldSum <= 0) {
        return { ...simProd, supplyCostItems: undefined };
      }
      const ratio = simProd.variableCost / oldSum;
      const scaled = baseProd.supplyCostItems.map((item) => ({
        ...item,
        amount: roundVal(item.amount * ratio),
      }));
      const scaledSum = scaled.reduce((sum, item) => sum + item.amount, 0);
      const diff = roundVal(simProd.variableCost - scaledSum);
      if (diff !== 0 && scaled.length > 0) {
        const lastIdx = scaled.length - 1;
        scaled[lastIdx] = {
          ...scaled[lastIdx],
          amount: Math.max(0, roundVal(scaled[lastIdx].amount + diff)),
        };
      }
      return { ...simProd, supplyCostItems: scaled };
    });

    onUpdateBusiness({ products: updatedProducts });
    setPriceDelta(0);
    setVarCostDelta(0);
    setProductOverrides({});
    setAppliedNotice(true);
    window.setTimeout(() => setAppliedNotice(false), 3000);
  };

  const breakEvenUnitsDelta = simAnalysis.breakEvenUnits - baseAnalysis.breakEvenUnits;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <EquilibrioProductIcon size="xs" />
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              Calculadora Financiera · Punto de Equilibrio
            </span>
          </div>
          <SectionTitle
            as="h1"
            size="md"
            title="Punto de *equilibrio* y meta de ganancia"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Mes de referencia:
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="boho-input ml-2 py-1.5 text-sm font-mono"
            />
          </label>
        </div>
      </header>

      {/* Entradas principales + Resultado hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <SolidCard className="lg:col-span-5 p-5 sm:p-6 space-y-5">
          <div>
            <label
              htmlFor="target-profit-input"
              className="block text-sm font-bold text-[var(--text-primary)]"
            >
              Ganancia que quiero obtener ({business.currency.code})
            </label>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Utilidad neta deseada DESPUÉS de cubrir todos tus costos fijos del mes.
            </p>
            <input
              id="target-profit-input"
              type="number"
              min={0}
              step={1000}
              value={business.targetProfit}
              onChange={(e) =>
                onUpdateBusiness({ targetProfit: Math.max(0, Number(e.target.value) || 0) })
              }
              className="boho-input w-full mt-2 font-mono tabular-nums font-semibold"
            />
          </div>

          <div>
            <label
              htmlFor="expected-units-input"
              className="block text-sm font-bold text-[var(--text-primary)]"
            >
              Ventas mensuales esperadas (unidades totales)
            </label>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Se usa para calcular tu Margen de Seguridad, Apalancamiento y Utilidad estimada.
            </p>
            <input
              id="expected-units-input"
              type="number"
              min={0}
              step={1}
              value={business.expectedMonthlyUnits}
              onChange={(e) =>
                onUpdateBusiness({
                  expectedMonthlyUnits: Math.max(0, Math.round(Number(e.target.value) || 0)),
                })
              }
              className="boho-input w-full mt-2 font-mono tabular-nums font-semibold"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Costos fijos vigentes:</span>
              <span className="font-mono tabular-nums font-semibold">
                {formatCurrency(activeResult.fixedCosts, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">
                Precio promedio del catálogo:
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formatCurrency(activeResult.weightedEconomics.weightedPrice, business.currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">
                Costo variable promedio:
              </span>
              <span className="font-mono tabular-nums font-semibold">
                {formatCurrency(
                  activeResult.weightedEconomics.weightedVariableCost,
                  business.currency
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">
                Margen contribución promedio:
              </span>
              <span className="font-mono tabular-nums font-bold text-[var(--pos-text)]">
                {formatCurrency(
                  activeResult.weightedEconomics.weightedUnitContribution,
                  business.currency
                )}{' '}
                ({formatPercent(activeResult.weightedEconomics.weightedMarginPercent)})
              </span>
            </div>
            {ownerSalaryImpact.included && ownerSalaryImpact.monthlyAmount > 0 ? (
              <div className="p-2.5 rounded-xl bg-[var(--sec-soft)] border border-[var(--sec-border)] text-[11px] text-[var(--sec-text)]">
                Con tu sueldo de dueño (
                <strong className="font-mono">
                  {formatCurrency(ownerSalaryImpact.monthlyAmount, business.currency)}
                </strong>
                /mes): equilibrio referencial ={' '}
                <strong className="font-mono">
                  {formatNumber(ownerSalaryImpact.adjustedBreakEvenUnits)} u.
                </strong>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[var(--warn-soft)] border border-[var(--warn-border)] text-[11px] text-[var(--warn-text)]">
                Sueldo del dueño no incluido: recuerda evitar la{' '}
                <strong>utilidad ilusoria</strong> activándolo en Configuración.
              </div>
            )}
          </div>
        </SolidCard>

        {/* Tarjeta resumen de resultados */}
        <GlassCard className="lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--sec-text)]">
                <DoodleSparkleMotif className="w-4 h-4 shrink-0" />
                <span>
                  {isSimulating
                    ? 'Resultado dinámico en tiempo real · Simulación activa'
                    : 'Cálculo base actual'}
                </span>
              </span>
              {isSimulating && (
                <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                  Equilibrio base: {formatNumber(baseAnalysis.breakEvenUnits)} u. (
                  {breakEvenUnitsDelta > 0 ? `+${breakEvenUnitsDelta}` : breakEvenUnitsDelta} u.)
                </span>
              )}
            </div>

            {activeResult.isViable ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <div className="p-5 rounded-[22px] bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      1. Punto de equilibrio (utilidad = 0)
                    </p>
                    <p
                      className="font-mono tabular-nums text-3xl font-bold text-[var(--text-primary)] mt-1.5"
                      data-testid="break-even-units-value"
                    >
                      {formatNumber(activeResult.breakEvenUnits)} u.
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[var(--text-secondary)] mt-1">
                      Ventas necesarias:{' '}
                      {formatCurrency(activeResult.breakEvenRevenue, business.currency)}
                    </p>
                  </div>

                  <div className="p-5 rounded-[22px] bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
                    <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
                      2. Total para ganar {formatCurrency(business.targetProfit, business.currency)}
                    </p>
                    <p className="font-mono tabular-nums text-3xl font-bold text-[var(--accent-strong)] mt-1.5">
                      {formatNumber(activeResult.targetTotalUnits)} u.
                    </p>
                    <p className="text-xs font-mono tabular-nums text-[var(--accent-soft-muted)] mt-1">
                      Ventas necesarias:{' '}
                      {formatCurrency(activeResult.targetRevenue, business.currency)}
                    </p>
                  </div>
                </div>

                {/* Visualización clara: ventas para costos fijos vs ventas que ya son ganancia */}
                <div className="mt-6">
                  <div className="flex justify-between text-xs font-semibold mb-2">
                    <span className="text-[var(--warn-text)]">
                      Cubren costos fijos: {formatNumber(activeResult.breakEvenUnits)} u.
                    </span>
                    <span className="text-[var(--pos-text)]">
                      Generan tu ganancia: +{formatNumber(activeResult.profitZoneUnits)} u.
                    </span>
                  </div>
                  <div className="h-5 w-full rounded-full overflow-hidden flex bg-[var(--bg-track)]">
                    <div
                      className="h-full bg-[var(--warn-bar)] flex items-center justify-center text-[11px] font-mono font-bold text-[var(--warn-bar-text)]"
                      style={{ width: `${Math.max(12, Math.min(100, breakEvenSharePct))}%` }}
                    >
                      {breakEvenSharePct.toFixed(0)}%
                    </div>
                    <div
                      className="h-full bg-[var(--pos-text)] flex items-center justify-center text-[11px] font-mono font-bold text-[var(--pos-bar-text)]"
                      style={{ width: `${Math.max(0, 100 - breakEvenSharePct)}%` }}
                    >
                      {(100 - breakEvenSharePct).toFixed(0)}%
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                    Con tu margen promedio, para ganar{' '}
                    <strong>{formatCurrency(business.targetProfit, business.currency)}</strong>{' '}
                    necesitas vender aprox.{' '}
                    <strong>{formatNumber(activeResult.targetTotalUnits)} u.</strong> en total (
                    {formatNumber(activeResult.breakEvenUnits)} u. cubren costos fijos y{' '}
                    +{formatNumber(activeResult.profitZoneUnits)} u. generan tu ganancia). Revisa el
                    detalle individual por producto más abajo.
                  </p>
                </div>
              </>
            ) : (
              <div className="mt-4 p-4 rounded-2xl bg-[var(--danger-soft)] text-sm text-[var(--danger-text)]">
                El margen de contribución promedio debe ser mayor a cero para alcanzar el punto de
                equilibrio. Ajusta el precio de venta por encima del costo variable unitario.
              </div>
            )}
          </div>

          {/* Indicadores MBA extra */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-[var(--border-hairline)]">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Utilidad estimada</p>
              <p
                className={`font-mono tabular-nums text-lg font-bold mt-0.5 ${
                  activeResult.expectedProfit >= 0
                    ? 'text-[var(--pos-text)]'
                    : 'text-[var(--danger-text)]'
                }`}
              >
                {formatCurrency(activeResult.expectedProfit, business.currency)}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Con {formatNumber(business.expectedMonthlyUnits)} u. esperadas
              </p>
            </div>

            <div>
              <p className="text-xs text-[var(--text-secondary)]">Margen de seguridad</p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)] mt-0.5">
                {formatPercent(activeResult.marginOfSafetyPercent)}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                {formatCurrency(activeResult.marginOfSafetyMoney, business.currency)} de colchón
              </p>
            </div>

            <div>
              <p className="text-xs text-[var(--text-secondary)]">Apalancamiento operativo</p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)] mt-0.5">
                {activeResult.operatingLeverage !== null
                  ? `${activeResult.operatingLeverage.toFixed(2)}x`
                  : 'N/A'}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {activeResult.operatingLeverage !== null
                  ? `+1% ventas = +${activeResult.operatingLeverage.toFixed(2)}% utilidad`
                  : 'Requiere utilidad positiva'}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Sliders dinámicos: ajuste por producto + simulador global "¿Y si...?" */}
      <SolidCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[var(--accent-strong)] shrink-0" />
            <SectionTitle
              as="h2"
              size="sm"
              title="Ajuste dinámico de *precios* y costos variables"
              subtitle="Desliza los controles por producto o globales para ver el cambio instantáneo en tu punto de equilibrio."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(hasProductOverrides || priceDelta !== 0 || varCostDelta !== 0) &&
              business.products.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplySimulatedCatalog}
                  style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2 rounded-full text-xs font-bold cursor-pointer hover:opacity-92 transition-opacity shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar precios y costos en catálogo</span>
                </button>
              )}
            {isSimulating && (
              <button
                type="button"
                onClick={resetSimulation}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full border border-[var(--border-hairline)] text-xs font-semibold hover:bg-[var(--bg-soft)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer sliders</span>
              </button>
            )}
          </div>
        </div>

        {appliedNotice && (
          <p className="mt-3 text-xs font-semibold text-[var(--pos-text)] bg-[var(--pos-soft)] px-4 py-2.5 rounded-2xl">
            Nuevos precios de venta y costos variables guardados en el catálogo del negocio.
          </p>
        )}

        {/* Sliders individuales por producto */}
        {business.products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {business.products.map((baseProduct, index) => {
              const simProduct = simulatedProducts[index] ?? baseProduct;
              const { min, max, step } = getSliderConfig(
                baseProduct.price,
                baseProduct.variableCost,
                business.currency.decimals
              );
              const unitBreakdown = getProductCostBreakdown(simProduct);
              const unitMargin = getProductContributionMargin(simProduct);
              const marginPct = getProductMarginPercent(simProduct);
              const priceChanged = Math.abs(simProduct.price - baseProduct.price) > 0.001;
              const costChanged =
                Math.abs(simProduct.variableCost - baseProduct.variableCost) > 0.001;
              const hasExtraUnitCosts =
                unitBreakdown.cardFeePercent > 0 ||
                unitBreakdown.taxPercent > 0 ||
                unitBreakdown.shippingCost > 0 ||
                unitBreakdown.personalTimeCost > 0;

              return (
                <div
                  key={baseProduct.id}
                  className="p-5 rounded-[24px] border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        {baseProduct.name}
                      </h3>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Margen unitario:{' '}
                        <span
                          className={`font-mono tabular-nums font-bold ${
                            unitMargin > 0
                              ? 'text-[var(--pos-text)]'
                              : 'text-[var(--danger-text)]'
                          }`}
                        >
                          {formatCurrency(unitMargin, business.currency)} (
                          {formatPercent(marginPct)})
                        </span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline text-xs font-semibold mb-1.5 gap-2">
                      <label htmlFor={`price-range-${baseProduct.id}`}>Precio de venta</label>
                      <span className="font-mono tabular-nums text-[var(--pos-text)]">
                        {formatCurrency(simProduct.price, business.currency)}
                        {priceChanged && (
                          <span className="ml-1.5 text-[11px] text-[var(--text-secondary)] font-normal">
                            (base: {formatCurrency(baseProduct.price, business.currency)})
                          </span>
                        )}
                      </span>
                    </div>
                    <input
                      id={`price-range-${baseProduct.id}`}
                      type="range"
                      min={min}
                      max={Math.max(max, simProduct.price)}
                      step={step}
                      value={simProduct.price}
                      onChange={(e) =>
                        handleProductSliderChange(
                          baseProduct.id,
                          'price',
                          Number(e.target.value)
                        )
                      }
                      className="w-full boho-slider"
                      aria-label={`Precio de venta de ${baseProduct.name}`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-baseline text-xs font-semibold mb-1.5 gap-2">
                      <label htmlFor={`varcost-range-${baseProduct.id}`}>
                        Costo variable base (insumos)
                      </label>
                      <span className="font-mono tabular-nums text-[var(--accent-strong)]">
                        {formatCurrency(simProduct.variableCost, business.currency)}
                        {costChanged && (
                          <span className="ml-1.5 text-[11px] text-[var(--text-secondary)] font-normal">
                            (base: {formatCurrency(baseProduct.variableCost, business.currency)})
                          </span>
                        )}
                      </span>
                    </div>
                    <input
                      id={`varcost-range-${baseProduct.id}`}
                      type="range"
                      min={min}
                      max={Math.max(max, simProduct.variableCost)}
                      step={step}
                      value={simProduct.variableCost}
                      onChange={(e) =>
                        handleProductSliderChange(
                          baseProduct.id,
                          'variableCost',
                          Number(e.target.value)
                        )
                      }
                      className="w-full boho-slider"
                      aria-label={`Costo variable de ${baseProduct.name}`}
                    />
                  </div>

                  {hasExtraUnitCosts && (
                    <div className="pt-2.5 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-secondary)] space-y-1">
                      <div className="flex justify-between font-semibold text-[var(--text-primary)]">
                        <span>Costo variable total unitario:</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(unitBreakdown.totalUnitVariableCost, business.currency)}
                        </span>
                      </div>
                      <p className="leading-relaxed">
                        {[
                          unitBreakdown.cardFeePercent > 0
                            ? `Tarjeta ${unitBreakdown.cardFeePercent}% (${formatCurrency(unitBreakdown.cardFeeAmount, business.currency)})`
                            : null,
                          unitBreakdown.taxPercent > 0
                            ? `Imp. ${unitBreakdown.taxPercent}% (${formatCurrency(unitBreakdown.taxAmount, business.currency)})`
                            : null,
                          unitBreakdown.shippingCost > 0
                            ? `Envío ${formatCurrency(unitBreakdown.shippingCost, business.currency)}`
                            : null,
                          unitBreakdown.personalTimeCost > 0
                            ? `Tiempo ${formatCurrency(unitBreakdown.personalTimeCost, business.currency)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sliders porcentuales globales */}
        <div className="mt-6 pt-5 border-t border-[var(--border-hairline)]">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-4">
            Ajustes porcentuales globales ("¿Y si...?")
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <label htmlFor="global-price-delta-range">Variación global en precios</label>
                <span className="font-mono tabular-nums text-[var(--pos-text)]">
                  {priceDelta > 0 ? `+${priceDelta}%` : `${priceDelta}%`}
                </span>
              </div>
              <input
                id="global-price-delta-range"
                type="range"
                min={-30}
                max={50}
                step={1}
                value={priceDelta}
                onChange={(e) => handleGlobalPriceDelta(Number(e.target.value))}
                className="w-full boho-slider"
                aria-label="Variación porcentual global en precios"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <label htmlFor="global-varcost-delta-range">Variación global costo variable</label>
                <span className="font-mono tabular-nums text-[var(--warn-text)]">
                  {varCostDelta > 0 ? `+${varCostDelta}%` : `${varCostDelta}%`}
                </span>
              </div>
              <input
                id="global-varcost-delta-range"
                type="range"
                min={-30}
                max={50}
                step={1}
                value={varCostDelta}
                onChange={(e) => handleGlobalVarCostDelta(Number(e.target.value))}
                className="w-full boho-slider"
                aria-label="Variación porcentual global en costo variable"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <label htmlFor="global-fixedcost-delta-range">Variación en costos fijos</label>
                <span className="font-mono tabular-nums text-[var(--accent-strong)]">
                  {fixedCostDelta > 0 ? `+${fixedCostDelta}%` : `${fixedCostDelta}%`}
                </span>
              </div>
              <input
                id="global-fixedcost-delta-range"
                type="range"
                min={-40}
                max={60}
                step={1}
                value={fixedCostDelta}
                onChange={(e) => setFixedCostDelta(Number(e.target.value))}
                className="w-full boho-slider"
                aria-label="Variación porcentual en costos fijos"
              />
            </div>
          </div>
        </div>

        {isSimulating && (
          <div className="mt-5 p-4 rounded-2xl bg-[var(--accent-soft)] flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-strong)] shrink-0" />
              <span>
                Nuevo equilibrio:{' '}
                <strong className="font-mono tabular-nums">
                  {simAnalysis.isViable
                    ? `${formatNumber(simAnalysis.breakEvenUnits)} u.`
                    : 'No viable (margen ≤ 0)'}
                </strong>
                {simAnalysis.isViable && (
                  <>
                    {' '}
                    (cambio de{' '}
                    <strong className="font-mono tabular-nums">
                      {breakEvenUnitsDelta > 0 ? '+' : ''}
                      {breakEvenUnitsDelta} u.
                    </strong>
                    )
                  </>
                )}
              </span>
            </div>
            <span className="font-mono tabular-nums text-xs text-[var(--text-secondary)]">
              Nueva utilidad estimada:{' '}
              {formatCurrency(simAnalysis.expectedProfit, business.currency)}
            </span>
          </div>
        )}

        {/* 2.6 Tabla de sensibilidad de precios ("¿Y si subo o bajo 5%, 10%?") — Solo lectura */}
        {business.products.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[var(--border-hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                  Tabla "¿Y si subo o bajo el precio 5% o 10%?"
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Comparativa instantánea del nuevo punto de equilibrio. Es solo simulación y no cambia tus datos guardados.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--sec-text)] bg-[var(--sec-soft)] border border-[var(--sec-border)] px-3 py-1 rounded-full">
                No modifica tu catálogo
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                    <th className="py-2 pr-3 font-semibold">Escenario de precio</th>
                    <th className="py-2 px-3 font-semibold text-right">Precio prom.</th>
                    <th className="py-2 px-3 font-semibold text-right">Margen unit.</th>
                    <th className="py-2 px-3 font-semibold text-right">Nuevo equilibrio</th>
                    <th className="py-2 px-3 font-semibold text-right">Dif. unidades</th>
                    <th className="py-2 pl-3 font-semibold text-right">Utilidad esp.</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityRows.map((row) => (
                    <tr
                      key={row.deltaPercent}
                      className={`border-b border-[var(--border-hairline)] last:border-0 ${
                        row.isBaseline ? 'bg-[var(--accent-soft)]/55 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 pr-3 text-[var(--text-primary)]">{row.label}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(row.weightedPrice, business.currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(row.weightedUnitContribution, business.currency)}{' '}
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          ({formatPercent(row.weightedMarginPercent)})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[var(--text-primary)]">
                        {row.isViable ? (
                          <>
                            {formatNumber(row.breakEvenUnits)} u.{' '}
                            <span className="block text-[10px] font-normal text-[var(--text-secondary)]">
                              {formatCurrency(row.breakEvenRevenue, business.currency)}
                            </span>
                          </>
                        ) : (
                          <span className="text-[var(--danger-text)]">No viable</span>
                        )}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                          row.breakEvenUnitsDelta < 0
                            ? 'text-[var(--pos-text)]'
                            : row.breakEvenUnitsDelta > 0
                              ? 'text-[var(--danger-text)]'
                              : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {!row.isViable
                          ? '—'
                          : row.breakEvenUnitsDelta === 0
                            ? 'Base'
                            : `${row.breakEvenUnitsDelta > 0 ? '+' : ''}${row.breakEvenUnitsDelta} u.`}
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-mono tabular-nums font-semibold ${
                          row.expectedProfit >= 0
                            ? 'text-[var(--pos-text)]'
                            : 'text-[var(--danger-text)]'
                        }`}
                      >
                        {formatCurrency(row.expectedProfit, business.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SolidCard>

      <GrowyDivider />

      {/* Análisis individual por producto */}
      {activeResult.perProduct.length > 0 && (
        <SolidCard className="p-5 sm:p-6">
          <SectionTitle
            as="h2"
            size="sm"
            title="Análisis *individual* por producto o servicio"
            subtitle="Unidades necesarias si este ítem cubriera por sí solo tus costos fijos y meta de ganancia."
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                  <th className="py-2.5 pr-4 font-semibold">Producto / Servicio</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Margen unitario</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Equilibrio (u.)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Solo ganancia (u.)</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Total meta (u.)</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Ingreso en meta</th>
                </tr>
              </thead>
              <tbody>
                {activeResult.perProduct.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-b border-[var(--border-hairline)] last:border-0"
                  >
                    <td className="py-3 pr-4 font-semibold text-[var(--text-primary)]">
                      {row.productName}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {row.unitContributionMargin > 0 ? (
                        <span className="text-[var(--pos-text)] font-semibold">
                          {formatCurrency(row.unitContributionMargin, business.currency)}{' '}
                          <span className="text-xs font-normal text-[var(--text-secondary)]">
                            ({formatPercent(row.contributionMarginPercent, 1)})
                          </span>
                        </span>
                      ) : (
                        <span className="text-[var(--danger-text)] font-semibold">
                          {formatCurrency(row.unitContributionMargin, business.currency)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {row.unitContributionMargin > 0
                        ? formatNumber(row.standaloneBreakEvenUnits)
                        : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[var(--pos-text)]">
                      {row.unitContributionMargin > 0
                        ? `+${formatNumber(row.standaloneProfitOnlyUnits)}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[var(--accent-strong)]">
                      {row.unitContributionMargin > 0
                        ? formatNumber(row.standaloneTargetUnits)
                        : '—'}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums">
                      {row.unitContributionMargin > 0
                        ? formatCurrency(row.standaloneTargetRevenue, business.currency)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SolidCard>
      )}
    </div>
  );
};
