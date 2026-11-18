import type {
  BusinessWorkspace,
  CurrencyConfig,
  FixedCost,
  FixedCostCategory,
  MonthlyActualRecord,
  ProductItem,
} from '../types/finance';

/**
 * ============================================================================
 * LUNA NUMÉRICA — MOTOR DE FÓRMULAS FINANCIERAS (MBA & COSTOS)
 * Todas las fórmulas están aisladas de la capa visual para facilitar su auditoría.
 * ============================================================================
 */

export const CURRENCY_PRESETS: Record<string, CurrencyConfig> = {
  CLP: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
  MXN: { code: 'MXN', symbol: '$', locale: 'es-MX', decimals: 0 },
  USD: { code: 'USD', symbol: 'US$', locale: 'en-US', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', locale: 'es-ES', decimals: 2 },
  ARS: { code: 'ARS', symbol: '$', locale: 'es-AR', decimals: 0 },
  COP: { code: 'COP', symbol: '$', locale: 'es-CO', decimals: 0 },
  PEN: { code: 'PEN', symbol: 'S/', locale: 'es-PE', decimals: 2 },
};

export const FIXED_COST_CATEGORY_LABELS: Record<FixedCostCategory, string> = {
  arriendo: 'Arriendo y espacio',
  sueldos: 'Sueldos y honorarios',
  servicios_basicos: 'Servicios básicos',
  marketing: 'Marketing y difusión',
  software: 'Software y herramientas',
  otros: 'Otros costos fijos',
};

/**
 * Formatea un monto monetario usando separadores de miles según la moneda configurada.
 */
export function formatCurrency(amount: number, currency: CurrencyConfig): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const absFormatted = new Intl.NumberFormat(currency.locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(Math.abs(safe));

  const sign = safe < -0.004 ? '-' : '';
  return `${sign}${currency.symbol}${absFormatted}`;
}

export function formatNumber(value: number, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatPercent(value: number, decimals = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(decimals)}%`;
}

/**
 * Utilidades de calendario en formato YYYY-MM
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function addMonths(yearMonth: string, offset: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const monthIndex = (Number(mStr) || 1) - 1 + offset;
  const d = new Date(year, monthIndex, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(yearMonth: string, short = false): string {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  const date = new Date(year, month, 1);
  const formatted = new Intl.DateTimeFormat('es-ES', {
    month: short ? 'short' : 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function generateMonthRange(startMonth: string, count: number): string[] {
  const total = Math.max(12, count);
  return Array.from({ length: total }, (_, idx) => addMonths(startMonth, idx));
}

/**
 * ----------------------------------------------------------------------------
 * 1. COSTOS FIJOS
 * ----------------------------------------------------------------------------
 */

/**
 * Retorna el monto vigente de un costo fijo en un mes YYYY-MM específico.
 * Si tiene un cambio programado y month >= effectiveFromMonth, aplica newAmount.
 */
export function getFixedCostAmountForMonth(cost: FixedCost, month: string): number {
  const base = Math.max(0, Number(cost.amount) || 0);
  if (
    cost.scheduledChange &&
    cost.scheduledChange.effectiveFromMonth &&
    month >= cost.scheduledChange.effectiveFromMonth
  ) {
    return Math.max(0, Number(cost.scheduledChange.newAmount) || 0);
  }
  return base;
}

export function getTotalFixedCostsForMonth(fixedCosts: FixedCost[], month: string): number {
  return fixedCosts.reduce((sum, item) => sum + getFixedCostAmountForMonth(item, month), 0);
}

export function getFixedCostsByCategory(
  fixedCosts: FixedCost[],
  month: string
): Array<{ category: FixedCostCategory; label: string; amount: number; sharePercent: number }> {
  const totals = new Map<FixedCostCategory, number>();
  for (const item of fixedCosts) {
    const val = getFixedCostAmountForMonth(item, month);
    totals.set(item.category, (totals.get(item.category) ?? 0) + val);
  }
  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0);
  return (Object.keys(FIXED_COST_CATEGORY_LABELS) as FixedCostCategory[])
    .map((cat) => {
      const amount = totals.get(cat) ?? 0;
      return {
        category: cat,
        label: FIXED_COST_CATEGORY_LABELS[cat],
        amount,
        sharePercent: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
      };
    })
    .filter((row) => row.amount > 0);
}

/**
 * ----------------------------------------------------------------------------
 * 2. PRODUCTOS, MARGEN DE CONTRIBUCIÓN Y MIX DE VENTAS PONDERADO
 * ----------------------------------------------------------------------------
 */

export interface ProductCostBreakdown {
  baseVariableCost: number;
  cardFeePercent: number;
  cardFeeAmount: number;
  taxPercent: number;
  taxAmount: number;
  shippingCost: number;
  personalTimeCost: number;
  totalUnitVariableCost: number;
}

export interface ProductEconomics {
  product: ProductItem;
  costBreakdown: ProductCostBreakdown;
  totalUnitVariableCost: number;
  unitContributionMargin: number;
  contributionMarginPercent: number;
  rawMixPercent: number;
  normalizedWeight: number;
}

export interface WeightedMixEconomics {
  items: ProductEconomics[];
  rawMixSum: number;
  isMixBalanced: boolean;
  weightedPrice: number;
  weightedVariableCost: number;
  weightedUnitContribution: number;
  weightedMarginPercent: number;
}

/**
 * Desglosa todos los costos variables por unidad:
 * costo base + comisión tarjeta (%) + impuestos (%) + envío/despacho + tiempo personal involucrado.
 */
export function getProductCostBreakdown(product: ProductItem): ProductCostBreakdown {
  const price = Math.max(0, Number(product.price) || 0);
  const baseVariableCost = Math.max(0, Number(product.variableCost) || 0);
  const cardFeePercent = Math.max(0, Number(product.cardFeePercent) || 0);
  const taxPercent = Math.max(0, Number(product.taxPercent) || 0);
  const shippingCost = Math.max(0, Number(product.shippingCost) || 0);
  const personalTimeCost = Math.max(0, Number(product.personalTimeCost) || 0);

  const cardFeeAmount = price * (cardFeePercent / 100);
  const taxAmount = price * (taxPercent / 100);
  const totalUnitVariableCost =
    baseVariableCost + cardFeeAmount + taxAmount + shippingCost + personalTimeCost;

  return {
    baseVariableCost,
    cardFeePercent,
    cardFeeAmount,
    taxPercent,
    taxAmount,
    shippingCost,
    personalTimeCost,
    totalUnitVariableCost,
  };
}

export function getProductTotalVariableCost(product: ProductItem): number {
  return getProductCostBreakdown(product).totalUnitVariableCost;
}

/**
 * Margen de contribución unitario = Precio - Costo variable total unitario
 */
export function getProductContributionMargin(product: ProductItem): number {
  return Math.max(0, Number(product.price) || 0) - getProductTotalVariableCost(product);
}

/**
 * Margen de contribución porcentual = (Margen unitario / Precio) * 100
 */
export function getProductMarginPercent(product: ProductItem): number {
  const price = Number(product.price) || 0;
  if (price <= 0) return 0;
  return (getProductContributionMargin(product) / price) * 100;
}

/**
 * Calcula los promedios del catálogo dando el mismo peso a cada producto o servicio.
 */
export function getWeightedMixEconomics(products: ProductItem[]): WeightedMixEconomics {
  if (products.length === 0) {
    return {
      items: [],
      rawMixSum: 0,
      isMixBalanced: true,
      weightedPrice: 0,
      weightedVariableCost: 0,
      weightedUnitContribution: 0,
      weightedMarginPercent: 0,
    };
  }

  const equalWeight = 1 / products.length;

  const items: ProductEconomics[] = products.map((product) => {
    const costBreakdown = getProductCostBreakdown(product);
    return {
      product,
      costBreakdown,
      totalUnitVariableCost: costBreakdown.totalUnitVariableCost,
      unitContributionMargin: getProductContributionMargin(product),
      contributionMarginPercent: getProductMarginPercent(product),
      rawMixPercent: equalWeight * 100,
      normalizedWeight: equalWeight,
    };
  });

  const weightedPrice = items.reduce(
    (sum, item) => sum + (Number(item.product.price) || 0) * item.normalizedWeight,
    0
  );
  const weightedVariableCost = items.reduce(
    (sum, item) => sum + item.totalUnitVariableCost * item.normalizedWeight,
    0
  );
  const weightedUnitContribution = weightedPrice - weightedVariableCost;
  const weightedMarginPercent =
    weightedPrice > 0 ? (weightedUnitContribution / weightedPrice) * 100 : 0;

  return {
    items,
    rawMixSum: 100,
    isMixBalanced: true,
    weightedPrice,
    weightedVariableCost,
    weightedUnitContribution,
    weightedMarginPercent,
  };
}

/**
 * ----------------------------------------------------------------------------
 * 3. PUNTO DE EQUILIBRIO, META DE GANANCIA E INDICADORES MBA
 * ----------------------------------------------------------------------------
 */

export interface ProductTargetBreakdown {
  productId: string;
  productName: string;
  unitContributionMargin: number;
  contributionMarginPercent: number;
  standaloneBreakEvenUnits: number;
  standaloneTargetUnits: number;
  standaloneProfitOnlyUnits: number;
  standaloneTargetRevenue: number;
  weightPercent: number;
  breakEvenUnitsExact: number;
  breakEvenUnitsRounded: number;
  targetUnitsExact: number;
  targetUnitsRounded: number;
  profitOnlyUnitsExact: number;
  expectedRevenueAtTarget: number;
}

export interface BreakEvenAnalysis {
  fixedCosts: number;
  targetProfit: number;
  expectedUnits: number;
  weightedEconomics: WeightedMixEconomics;
  isViable: boolean;
  /** Unidades exactas para cubrir costos fijos = CF / MCU_ponderado */
  breakEvenUnitsExact: number;
  /** Unidades enteras sugeridas (ceil) para asegurar cubrir costos fijos */
  breakEvenUnits: number;
  /** Dinero en ventas necesario para punto de equilibrio = CF / (MC%_ponderado) */
  breakEvenRevenue: number;
  /** Unidades totales necesarias para cubrir CF + Ganancia Objetivo */
  targetTotalUnitsExact: number;
  targetTotalUnits: number;
  /** Unidades adicionales por encima del equilibrio que generan la ganancia objetivo */
  profitZoneUnitsExact: number;
  profitZoneUnits: number;
  /** Ventas en dinero necesarias para alcanzar la ganancia objetivo */
  targetRevenue: number;
  /** Desglose por producto según el mix */
  perProduct: ProductTargetBreakdown[];
  /** Indicadores extra dado un nivel de ventas esperadas (expectedUnits) */
  expectedRevenue: number;
  expectedVariableCosts: number;
  expectedTotalCosts: number;
  expectedContributionMarginTotal: number;
  expectedProfit: number;
  /** Margen de Seguridad ($) = Ventas esperadas - Ventas de equilibrio */
  marginOfSafetyMoney: number;
  /** Margen de Seguridad (%) = (Ventas esperadas - Ventas PE) / Ventas esperadas */
  marginOfSafetyPercent: number;
  /** Grado de Apalancamiento Operativo (GAO) = Margen de contribución total / Utilidad operativa */
  operatingLeverage: number | null;
}

export function calculateBreakEvenAndTarget(params: {
  fixedCosts: number;
  products: ProductItem[];
  targetProfit: number;
  expectedUnits: number;
}): BreakEvenAnalysis {
  const fixedCosts = Math.max(0, Number(params.fixedCosts) || 0);
  const targetProfit = Math.max(0, Number(params.targetProfit) || 0);
  const expectedUnits = Math.max(0, Number(params.expectedUnits) || 0);
  const weighted = getWeightedMixEconomics(params.products);

  const mcu = weighted.weightedUnitContribution;
  const mcRatio = weighted.weightedMarginPercent / 100;
  const isViable = params.products.length > 0 && mcu > 0 && mcRatio > 0;

  const breakEvenUnitsExact = isViable ? fixedCosts / mcu : 0;
  const breakEvenUnits = isViable ? Math.ceil(breakEvenUnitsExact) : 0;
  const breakEvenRevenue = isViable ? fixedCosts / mcRatio : 0;

  const targetTotalUnitsExact = isViable ? (fixedCosts + targetProfit) / mcu : 0;
  const targetTotalUnits = isViable ? Math.ceil(targetTotalUnitsExact) : 0;
  const profitZoneUnitsExact = Math.max(0, targetTotalUnitsExact - breakEvenUnitsExact);
  const profitZoneUnits = Math.max(0, targetTotalUnits - breakEvenUnits);
  const targetRevenue = isViable ? (fixedCosts + targetProfit) / mcRatio : 0;

  const perProduct: ProductTargetBreakdown[] = weighted.items.map((item) => {
    const beExact = breakEvenUnitsExact * item.normalizedWeight;
    const tgtExact = targetTotalUnitsExact * item.normalizedWeight;
    const prodMcu = item.unitContributionMargin;
    const prodPrice = Number(item.product.price) || 0;
    const standaloneBreakEvenUnits = prodMcu > 0 ? Math.ceil(fixedCosts / prodMcu) : 0;
    const standaloneTargetUnits = prodMcu > 0 ? Math.ceil((fixedCosts + targetProfit) / prodMcu) : 0;
    const standaloneProfitOnlyUnits = Math.max(0, standaloneTargetUnits - standaloneBreakEvenUnits);
    return {
      productId: item.product.id,
      productName: item.product.name,
      unitContributionMargin: prodMcu,
      contributionMarginPercent: item.contributionMarginPercent,
      standaloneBreakEvenUnits,
      standaloneTargetUnits,
      standaloneProfitOnlyUnits,
      standaloneTargetRevenue: standaloneTargetUnits * prodPrice,
      weightPercent: item.normalizedWeight * 100,
      breakEvenUnitsExact: beExact,
      breakEvenUnitsRounded: Math.ceil(beExact),
      targetUnitsExact: tgtExact,
      targetUnitsRounded: Math.ceil(tgtExact),
      profitOnlyUnitsExact: Math.max(0, tgtExact - beExact),
      expectedRevenueAtTarget: tgtExact * prodPrice,
    };
  });

  const expectedRevenue = expectedUnits * weighted.weightedPrice;
  const expectedVariableCosts = expectedUnits * weighted.weightedVariableCost;
  const expectedTotalCosts = fixedCosts + expectedVariableCosts;
  const expectedContributionMarginTotal = expectedUnits * mcu;
  const expectedProfit = expectedContributionMarginTotal - fixedCosts;

  const marginOfSafetyMoney = expectedRevenue - breakEvenRevenue;
  const marginOfSafetyPercent =
    expectedRevenue > 0 ? (marginOfSafetyMoney / expectedRevenue) * 100 : 0;

  // GAO solo tiene sentido económico clásico cuando la utilidad operativa es positiva
  const operatingLeverage =
    expectedProfit > 0 ? expectedContributionMarginTotal / expectedProfit : null;

  return {
    fixedCosts,
    targetProfit,
    expectedUnits,
    weightedEconomics: weighted,
    isViable,
    breakEvenUnitsExact,
    breakEvenUnits,
    breakEvenRevenue,
    targetTotalUnitsExact,
    targetTotalUnits,
    profitZoneUnitsExact,
    profitZoneUnits,
    targetRevenue,
    perProduct,
    expectedRevenue,
    expectedVariableCosts,
    expectedTotalCosts,
    expectedContributionMarginTotal,
    expectedProfit,
    marginOfSafetyMoney,
    marginOfSafetyPercent,
    operatingLeverage,
  };
}

/**
 * Simulador "¿Y si...?": aplica variaciones porcentuales a precio, costo variable y costos fijos
 * sin mutar los datos originales del negocio.
 */
export function simulateWhatIf(params: {
  fixedCosts: number;
  products: ProductItem[];
  targetProfit: number;
  expectedUnits: number;
  priceDeltaPercent: number;
  variableCostDeltaPercent: number;
  fixedCostDeltaPercent: number;
}): BreakEvenAnalysis {
  const adjustedFixedCosts = Math.max(
    0,
    params.fixedCosts * (1 + params.fixedCostDeltaPercent / 100)
  );
  const adjustedProducts: ProductItem[] = params.products.map((p) => ({
    ...p,
    price: Math.max(0, p.price * (1 + params.priceDeltaPercent / 100)),
    variableCost: Math.max(0, p.variableCost * (1 + params.variableCostDeltaPercent / 100)),
    shippingCost:
      p.shippingCost !== undefined
        ? Math.max(0, p.shippingCost * (1 + params.variableCostDeltaPercent / 100))
        : undefined,
    personalTimeCost:
      p.personalTimeCost !== undefined
        ? Math.max(0, p.personalTimeCost * (1 + params.variableCostDeltaPercent / 100))
        : undefined,
  }));

  return calculateBreakEvenAndTarget({
    fixedCosts: adjustedFixedCosts,
    products: adjustedProducts,
    targetProfit: params.targetProfit,
    expectedUnits: params.expectedUnits,
  });
}

/**
 * ----------------------------------------------------------------------------
 * 4. PROYECCIÓN MENSUAL (12+ MESES)
 * ----------------------------------------------------------------------------
 */

export interface MonthlyProjectionRow {
  month: string;
  monthLabel: string;
  monthIndex: number;
  unitsByProduct: Record<string, number>;
  totalUnits: number;
  projectedRevenue: number;
  projectedVariableCosts: number;
  projectedFixedCosts: number;
  projectedTotalCosts: number;
  projectedProfit: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  isManualOverride: boolean;
}

/**
 * Construye la proyección mes a mes desde startMonth.
 * Si no existe un override manual para un mes, aplica crecimiento compuesto (1 + g)^t
 * sobre las unidades base del mes 1 de cada producto.
 */
export function buildMonthlyProjections(business: BusinessWorkspace): MonthlyProjectionRow[] {
  const months = generateMonthRange(business.startMonth, Math.max(12, business.projectionMonthsCount));
  const growthRate = (Number(business.monthlyGrowthPercent) || 0) / 100;

  // Si algún producto no tiene base inicial definida, derivar según su mix * expectedMonthlyUnits
  const weighted = getWeightedMixEconomics(business.products);

  return months.map((month, idx) => {
    const override = business.projectionOverrides?.[month];
    const isManualOverride = Boolean(
      override?.unitsByProduct && Object.keys(override.unitsByProduct).length > 0
    );

    const unitsByProduct: Record<string, number> = {};
    let totalUnits = 0;
    let projectedRevenue = 0;
    let projectedVariableCosts = 0;

    weighted.items.forEach((item) => {
      const p = item.product;
      const fallbackBase = Math.round(business.expectedMonthlyUnits * item.normalizedWeight);
      const baseUnits =
        business.baseMonthlyUnitsByProduct?.[p.id] !== undefined
          ? Math.max(0, Number(business.baseMonthlyUnitsByProduct[p.id]) || 0)
          : fallbackBase;

      const autoUnits = Math.max(0, Math.round(baseUnits * Math.pow(1 + growthRate, idx)));
      const units =
        override?.unitsByProduct && override.unitsByProduct[p.id] !== undefined
          ? Math.max(0, Math.round(Number(override.unitsByProduct[p.id]) || 0))
          : autoUnits;

      unitsByProduct[p.id] = units;
      totalUnits += units;
      projectedRevenue += units * (Number(p.price) || 0);
      projectedVariableCosts += units * item.totalUnitVariableCost;
    });

    const projectedFixedCosts = getTotalFixedCostsForMonth(business.fixedCosts, month);
    const projectedTotalCosts = projectedFixedCosts + projectedVariableCosts;
    const projectedProfit = projectedRevenue - projectedTotalCosts;

    const beAnalysis = calculateBreakEvenAndTarget({
      fixedCosts: projectedFixedCosts,
      products: business.products,
      targetProfit: business.targetProfit,
      expectedUnits: totalUnits,
    });

    return {
      month,
      monthLabel: formatMonthLabel(month, true),
      monthIndex: idx,
      unitsByProduct,
      totalUnits,
      projectedRevenue,
      projectedVariableCosts,
      projectedFixedCosts,
      projectedTotalCosts,
      projectedProfit,
      breakEvenUnits: beAnalysis.breakEvenUnits,
      breakEvenRevenue: beAnalysis.breakEvenRevenue,
      isManualOverride,
    };
  });
}

/**
 * ----------------------------------------------------------------------------
 * 5. RESULTADOS REALES Y COMPARACIÓN PROYECTADO VS. REAL
 * ----------------------------------------------------------------------------
 */

export type PerformanceStatus = 'good' | 'warning' | 'negative' | 'pending';

export interface ActualTotalsSummary {
  month: string;
  hasData: boolean;
  income: number;
  fixedExpense: number;
  variableExpense: number;
  otherExpense: number;
  totalExpense: number;
  profit: number;
  unitsSold: number;
  transactionCount: number;
}

export interface MonthComparisonResult {
  month: string;
  monthLabel: string;
  projected: MonthlyProjectionRow;
  actual: ActualTotalsSummary;
  revenueDiffMoney: number;
  revenueDiffPercent: number;
  expenseDiffMoney: number;
  expenseDiffPercent: number;
  profitDiffMoney: number;
  profitDiffPercent: number;
  breakEvenCoveragePercent: number;
  status: PerformanceStatus;
  statusLabel: string;
  interpretation: string;
}

export function summarizeActualRecord(
  month: string,
  record?: MonthlyActualRecord
): ActualTotalsSummary {
  if (!record) {
    return {
      month,
      hasData: false,
      income: 0,
      fixedExpense: 0,
      variableExpense: 0,
      otherExpense: 0,
      totalExpense: 0,
      profit: 0,
      unitsSold: 0,
      transactionCount: 0,
    };
  }

  const txs = record.transactions ?? [];
  const txIncome = txs
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Math.max(0, Number(t.amount) || 0), 0);
  const txFixed = txs
    .filter((t) => t.type === 'fixed_expense')
    .reduce((s, t) => s + Math.max(0, Number(t.amount) || 0), 0);
  const txVariable = txs
    .filter((t) => t.type === 'variable_expense')
    .reduce((s, t) => s + Math.max(0, Number(t.amount) || 0), 0);
  const txOther = txs
    .filter((t) => t.type === 'other_expense')
    .reduce((s, t) => s + Math.max(0, Number(t.amount) || 0), 0);
  const txUnits = txs
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Math.max(0, Number(t.units) || 0), 0);

  const income = txIncome + Math.max(0, Number(record.manualIncome) || 0);
  const fixedExpense = txFixed + Math.max(0, Number(record.manualFixedExpense) || 0);
  const variableExpense = txVariable + Math.max(0, Number(record.manualVariableExpense) || 0);
  const otherExpense = txOther + Math.max(0, Number(record.manualOtherExpense) || 0);
  const totalExpense = fixedExpense + variableExpense + otherExpense;
  const profit = income - totalExpense;
  const unitsSold = Math.max(0, Number(record.actualUnitsSold) || 0) || txUnits;

  const hasData =
    txs.length > 0 ||
    income > 0 ||
    totalExpense > 0 ||
    unitsSold > 0;

  return {
    month,
    hasData,
    income,
    fixedExpense,
    variableExpense,
    otherExpense,
    totalExpense,
    profit,
    unitsSold,
    transactionCount: txs.length,
  };
}

export function compareMonthActualVsProjected(params: {
  projected: MonthlyProjectionRow;
  actualRecord?: MonthlyActualRecord;
  business: BusinessWorkspace;
}): MonthComparisonResult {
  const { projected, actualRecord, business } = params;
  const actual = summarizeActualRecord(projected.month, actualRecord);
  const monthLabel = formatMonthLabel(projected.month, false);

  const revenueDiffMoney = actual.income - projected.projectedRevenue;
  const revenueDiffPercent =
    projected.projectedRevenue > 0
      ? (revenueDiffMoney / projected.projectedRevenue) * 100
      : 0;

  const expenseDiffMoney = actual.totalExpense - projected.projectedTotalCosts;
  const expenseDiffPercent =
    projected.projectedTotalCosts > 0
      ? (expenseDiffMoney / projected.projectedTotalCosts) * 100
      : 0;

  const profitDiffMoney = actual.profit - projected.projectedProfit;
  const profitDiffPercent =
    Math.abs(projected.projectedProfit) > 0.01
      ? (profitDiffMoney / Math.abs(projected.projectedProfit)) * 100
      : actual.profit >= 0
      ? 100
      : -100;

  // Cobertura del punto de equilibrio en dinero
  const breakEvenRev = projected.breakEvenRevenue;
  const breakEvenCoveragePercent =
    breakEvenRev > 0 ? (actual.income / breakEvenRev) * 100 : 0;

  const weighted = getWeightedMixEconomics(business.products);
  const currency = business.currency;

  if (!actual.hasData) {
    return {
      month: projected.month,
      monthLabel,
      projected,
      actual,
      revenueDiffMoney: 0,
      revenueDiffPercent: 0,
      expenseDiffMoney: 0,
      expenseDiffPercent: 0,
      profitDiffMoney: 0,
      profitDiffPercent: 0,
      breakEvenCoveragePercent: 0,
      status: 'pending',
      statusLabel: 'Sin registros aún',
      interpretation:
        'Aún no registras movimientos reales para este mes. Cuando cargues tus ingresos y egresos verás aquí la comparación.',
    };
  }

  // Semáforo financiero equilibrado (evaluando punto de equilibrio y cumplimiento de proyección)
  let status: PerformanceStatus = 'good';
  let statusLabel = 'En armonía';

  const hitBreakEven = actual.profit >= 0 && (breakEvenRev === 0 || actual.income >= breakEvenRev);
  const vsProjRatio =
    projected.projectedRevenue > 0 ? actual.income / projected.projectedRevenue : 1;

  if (hitBreakEven && vsProjRatio >= 0.95) {
    status = 'good';
    statusLabel = 'Supera meta';
  } else if (actual.profit >= -projected.projectedFixedCosts * 0.08 && vsProjRatio >= 0.8) {
    status = 'warning';
    statusLabel = 'Alerta suave';
  } else {
    status = 'negative';
    statusLabel = 'Desvío negativo';
  }

  // Mensaje de interpretación en lenguaje claro y cercano
  let interpretation = '';
  if (breakEvenRev > 0) {
    const overUnderPercent = breakEvenCoveragePercent - 100;
    const mcu = weighted.weightedUnitContribution;
    const equivUnitsGap =
      mcu > 0 && weighted.weightedPrice > 0
        ? Math.ceil(Math.abs(breakEvenRev - actual.income) / weighted.weightedPrice)
        : 0;

    if (overUnderPercent >= 1) {
      interpretation = `Este mes superaste el punto de equilibrio en un ${overUnderPercent.toFixed(1)}%`;
      if (actual.profit > 0) {
        interpretation += ` y generaste una utilidad real de ${formatCurrency(actual.profit, currency)}.`;
      } else {
        interpretation += `, aunque los egresos reales superaron lo previsto (${formatCurrency(actual.totalExpense, currency)}).`;
      }
    } else if (overUnderPercent <= -1) {
      interpretation = `Te faltó un ${Math.abs(overUnderPercent).toFixed(1)}% para alcanzar el punto de equilibrio en ventas`;
      if (equivUnitsGap > 0) {
        interpretation += ` (aprox. ${equivUnitsGap} ${equivUnitsGap === 1 ? 'venta' : 'ventas'} promedio del catálogo).`;
      } else {
        interpretation += '.';
      }
    } else {
      interpretation = 'Cerraste prácticamente justo en el punto de equilibrio del mes.';
    }
  } else {
    interpretation = `Registraste ingresos reales por ${formatCurrency(actual.income, currency)} y una utilidad neta de ${formatCurrency(actual.profit, currency)}.`;
  }

  if (projected.projectedRevenue > 0) {
    const diffDir = revenueDiffPercent >= 0 ? 'por encima' : 'por debajo';
    interpretation += ` Frente a tu proyección, tus ingresos estuvieron un ${Math.abs(revenueDiffPercent).toFixed(1)}% ${diffDir}.`;
  }

  return {
    month: projected.month,
    monthLabel,
    projected,
    actual,
    revenueDiffMoney,
    revenueDiffPercent,
    expenseDiffMoney,
    expenseDiffPercent,
    profitDiffMoney,
    profitDiffPercent,
    breakEvenCoveragePercent,
    status,
    statusLabel,
    interpretation,
  };
}

/**
 * Datos para el gráfico clásico de Punto de Equilibrio (línea de Ingresos Totales vs Costos Totales)
 */
export function buildBreakEvenChartSeries(params: {
  fixedCosts: number;
  weightedPrice: number;
  weightedVariableCost: number;
  breakEvenUnits: number;
  targetUnits: number;
  expectedUnits: number;
}) {
  const maxRef = Math.max(
    10,
    params.targetUnits * 1.25,
    params.breakEvenUnits * 1.6,
    params.expectedUnits * 1.25
  );
  const steps = 8;
  const maxUnits = Math.ceil(maxRef / steps) * steps;

  const labels: number[] = [];
  const revenueLine: number[] = [];
  const totalCostLine: number[] = [];
  const fixedCostLine: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const q = Math.round((maxUnits / steps) * i);
    labels.push(q);
    revenueLine.push(Math.round(q * params.weightedPrice));
    totalCostLine.push(Math.round(params.fixedCosts + q * params.weightedVariableCost));
    fixedCostLine.push(Math.round(params.fixedCosts));
  }

  return { labels, revenueLine, totalCostLine, fixedCostLine };
}
