import {
  formatCurrency,
  getProductContributionMargin,
  getProductMarginPercent,
  getWeightedMixEconomics,
  summarizeActualRecord,
} from './formulas.ts';
import { ANNUAL_PRICE_CLP, MONTHLY_PRICE_CLP, formatCLPAmount } from './subscription.ts';
import type {
  AppConfig,
  BusinessWorkspace,
  CurrencyConfig,
  ProductItem,
  PublicBreakEvenDraft,
} from '../types/finance';

/**
 * ============================================================================
 * GROWy Equilibrio — Indicadores y cálculos Fase 1
 * Módulo independiente para conservar intactas las fórmulas base en formulas.ts.
 * ============================================================================
 */

export const SAFETY_MARGIN_GREEN_MIN_PERCENT = 25;
export const SAFETY_MARGIN_YELLOW_MIN_PERCENT = 10;

export const LOW_MARGIN_THRESHOLD_PERCENT = 25;
export const RELATIVE_LOW_MARGIN_FACTOR = 0.5;
export const RELATIVE_LOW_MARGIN_CAP_PERCENT = 30;

export const PUBLIC_BE_DRAFT_STORAGE_KEY = 'growy_public_be_draft_v1';

const CLP_DEFAULT: CurrencyConfig = {
  code: 'CLP',
  symbol: '$',
  locale: 'es-CL',
  decimals: 0,
};

function sanitizeNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/\s+/g, ''));
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * 1.1 Calculadora pública de punto de equilibrio (sin login).
 */
export interface PublicBreakEvenResult {
  isReady: boolean;
  isViable: boolean;
  hasNegativeInput: boolean;
  validationMessage: string | null;
  fixedCosts: number;
  variableCost: number;
  unitPrice: number;
  unitContributionMargin: number;
  contributionMarginPercent: number;
  breakEvenUnitsExact: number;
  breakEvenUnits: number;
  breakEvenSalesClp: number;
  simpleExplanation: string;
}

export function calculatePublicBreakEven(params: {
  fixedCosts: number | string | null | undefined;
  variableCost: number | string | null | undefined;
  unitPrice: number | string | null | undefined;
}): PublicBreakEvenResult {
  const rawFixed = sanitizeNonNegativeNumber(params.fixedCosts);
  const rawVar = sanitizeNonNegativeNumber(params.variableCost);
  const rawPrice = sanitizeNonNegativeNumber(params.unitPrice);

  const hasNegativeInput =
    (rawFixed !== null && rawFixed < 0) ||
    (rawVar !== null && rawVar < 0) ||
    (rawPrice !== null && rawPrice < 0);

  const fixedCosts = Math.max(0, rawFixed ?? 0);
  const variableCost = Math.max(0, rawVar ?? 0);
  const unitPrice = Math.max(0, rawPrice ?? 0);

  if (hasNegativeInput) {
    return {
      isReady: false,
      isViable: false,
      hasNegativeInput: true,
      validationMessage: 'Usa números positivos o cero para que el cálculo refleje tu realidad.',
      fixedCosts,
      variableCost,
      unitPrice,
      unitContributionMargin: 0,
      contributionMarginPercent: 0,
      breakEvenUnitsExact: 0,
      breakEvenUnits: 0,
      breakEvenSalesClp: 0,
      simpleExplanation:
        'Corrige los valores negativos para ver cuántas ventas necesitas para cubrir tus gastos del mes.',
    };
  }

  if (rawPrice === null || unitPrice <= 0) {
    return {
      isReady: false,
      isViable: false,
      hasNegativeInput: false,
      validationMessage: 'Ingresa un precio de venta mayor a $0 para calcular tu punto de equilibrio.',
      fixedCosts,
      variableCost,
      unitPrice,
      unitContributionMargin: 0,
      contributionMarginPercent: 0,
      breakEvenUnitsExact: 0,
      breakEvenUnits: 0,
      breakEvenSalesClp: 0,
      simpleExplanation:
        'Con el precio de venta, el costo variable y tus costos fijos calculamos al instante cuántas ventas cubren tu mes.',
    };
  }

  const unitContributionMargin = unitPrice - variableCost;
  const contributionMarginPercent =
    unitPrice > 0 ? (unitContributionMargin / unitPrice) * 100 : 0;

  if (unitContributionMargin <= 0) {
    return {
      isReady: true,
      isViable: false,
      hasNegativeInput: false,
      validationMessage:
        'Tu precio de venta es menor o igual a tu costo variable por unidad. Hoy no queda margen para cubrir costos fijos: te conviene revisar tu precio o bajar costos por unidad.',
      fixedCosts,
      variableCost,
      unitPrice,
      unitContributionMargin,
      contributionMarginPercent,
      breakEvenUnitsExact: 0,
      breakEvenUnits: 0,
      breakEvenSalesClp: 0,
      simpleExplanation:
        'Cada venta te está dejando $0 o pérdida antes de pagar arriendo y cuentas fijas. Ajusta el precio o revisa el costo de producir cada unidad.',
    };
  }

  const breakEvenUnitsExact = fixedCosts / unitContributionMargin;
  const breakEvenUnits = fixedCosts === 0 ? 0 : Math.ceil(breakEvenUnitsExact);
  const breakEvenSalesClp = Math.round(breakEvenUnits * unitPrice);

  const simpleExplanation =
    fixedCosts === 0
      ? `Cada unidad vendida te deja ${formatCurrency(unitContributionMargin, CLP_DEFAULT)} libres (${contributionMarginPercent.toFixed(1)}%). Si tienes costos fijos este mes, agrégalos arriba para saber tu meta mínima.`
      : `De cada venta de ${formatCurrency(unitPrice, CLP_DEFAULT)}, pagas ${formatCurrency(variableCost, CLP_DEFAULT)} de costo variable y te quedan ${formatCurrency(unitContributionMargin, CLP_DEFAULT)} libres (${contributionMarginPercent.toFixed(1)}%) para pagar tus gastos fijos. Con ${breakEvenUnits} ${breakEvenUnits === 1 ? 'venta' : 'ventas'} (${formatCurrency(breakEvenSalesClp, CLP_DEFAULT)} en ingresos) cubres tus ${formatCurrency(fixedCosts, CLP_DEFAULT)} fijos; desde la venta siguiente empiezas a generar ganancia real.`;

  return {
    isReady: true,
    isViable: true,
    hasNegativeInput: false,
    validationMessage: null,
    fixedCosts,
    variableCost,
    unitPrice,
    unitContributionMargin,
    contributionMarginPercent,
    breakEvenUnitsExact,
    breakEvenUnits,
    breakEvenSalesClp,
    simpleExplanation,
  };
}

/**
 * 1.2 Anclaje dinámico del plan anual desde appConfig.
 */
export interface PlanComparisonSummary {
  monthlyPriceClp: number;
  annualPriceClp: number;
  twelveMonthsTotalClp: number;
  savingsClp: number;
  savingsPercentRounded: number;
  equivalentMonthlyClp: number;
  monthlyPriceFormatted: string;
  annualPriceFormatted: string;
  twelveMonthsTotalFormatted: string;
  savingsFormatted: string;
  equivalentMonthlyFormatted: string;
  anchorComparisonText: string;
  monthlyAnchorLine: string;
  annualHighlightBadge: string;
}

function parseClpFromLabel(label?: string): number | null {
  if (!label) return null;
  const digits = label.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculatePlanComparisonFromConfig(
  config?: Partial<Pick<AppConfig, 'monthlyPriceClp' | 'annualPriceClp' | 'priceLabel'>> | null
): PlanComparisonSummary {
  const configuredMonthly = Number(config?.monthlyPriceClp);
  const parsedMonthlyFromLabel = parseClpFromLabel(config?.priceLabel);
  const monthlyPriceClp =
    Number.isFinite(configuredMonthly) && configuredMonthly > 0
      ? Math.round(configuredMonthly)
      : parsedMonthlyFromLabel && parsedMonthlyFromLabel > 0
      ? Math.round(parsedMonthlyFromLabel)
      : MONTHLY_PRICE_CLP;

  const configuredAnnual = Number(config?.annualPriceClp);
  const annualPriceClp =
    Number.isFinite(configuredAnnual) && configuredAnnual > 0
      ? Math.round(configuredAnnual)
      : ANNUAL_PRICE_CLP;

  const twelveMonthsTotalClp = monthlyPriceClp * 12;
  const savingsClp = Math.max(0, twelveMonthsTotalClp - annualPriceClp);
  const savingsPercentRounded =
    twelveMonthsTotalClp > 0 ? Math.round((savingsClp / twelveMonthsTotalClp) * 100) : 0;
  const equivalentMonthlyClp = Math.round(annualPriceClp / 12);

  const monthlyPriceFormatted = formatCLPAmount(monthlyPriceClp);
  const annualPriceFormatted = formatCLPAmount(annualPriceClp);
  const twelveMonthsTotalFormatted = formatCLPAmount(twelveMonthsTotalClp);
  const savingsFormatted = formatCLPAmount(savingsClp);
  const equivalentMonthlyFormatted = formatCLPAmount(equivalentMonthlyClp);

  const anchorComparisonText =
    savingsClp > 0
      ? `12 × ${monthlyPriceFormatted} = ${twelveMonthsTotalFormatted} vs ${annualPriceFormatted} anual · Ahorras ${savingsFormatted} (~${savingsPercentRounded}%), equivalente a ~${equivalentMonthlyFormatted}/mes.`
      : `${annualPriceFormatted} al año (equivalente a ~${equivalentMonthlyFormatted}/mes).`;

  return {
    monthlyPriceClp,
    annualPriceClp,
    twelveMonthsTotalClp,
    savingsClp,
    savingsPercentRounded,
    equivalentMonthlyClp,
    monthlyPriceFormatted,
    annualPriceFormatted,
    twelveMonthsTotalFormatted,
    savingsFormatted,
    equivalentMonthlyFormatted,
    anchorComparisonText,
    monthlyAnchorLine: `12 meses por separado: ${twelveMonthsTotalFormatted}`,
    annualHighlightBadge: 'Más conveniente',
  };
}

/**
 * 1.3 Margen de contribución y margen de seguridad con semáforo para Resumen del día.
 *
 * Umbrales documentados del semáforo de Margen de Seguridad:
 * - Verde  (>= 25%): Colchón saludable; tus ventas superan el equilibrio por al menos un 25%.
 * - Amarillo (>= 10% y < 25%): Colchón ajustado; alcanzas equilibrio pero una baja moderada te acerca a pérdidas.
 * - Rojo (< 10% o ventas <= equilibrio): Zona de riesgo; aún estás bajo el equilibrio o muy cerca de él.
 */
export type SafetyMarginTrafficLight = 'verde' | 'amarillo' | 'rojo';

export interface MarginOfSafetyAnalysis {
  hasSalesReference: boolean;
  isViable: boolean;
  isActualSales: boolean;
  referenceSales: number;
  breakEvenRevenue: number;
  weightedUnitContribution: number;
  weightedMarginPercent: number;
  totalContributionMargin: number;
  marginOfSafetyMoney: number;
  marginOfSafetyPercent: number;
  status: SafetyMarginTrafficLight;
  statusLabel: string;
  simpleExplanation: string;
  tooltipText: string;
}

export function calculateMarginOfSafetyAnalysis(params: {
  fixedCosts: number;
  weightedUnitContribution: number;
  weightedMarginPercent: number;
  currentOrProjectedSales: number;
  breakEvenRevenue: number;
  isActualSales?: boolean;
  currency?: CurrencyConfig;
}): MarginOfSafetyAnalysis {
  const currency = params.currency ?? CLP_DEFAULT;
  const fixedCosts = Math.max(0, Number(params.fixedCosts) || 0);
  const weightedUnitContribution = Number(params.weightedUnitContribution) || 0;
  const weightedMarginPercent = Math.max(0, Math.min(100, Number(params.weightedMarginPercent) || 0));
  const referenceSales = Math.max(0, Number(params.currentOrProjectedSales) || 0);
  const breakEvenRevenue = Math.max(0, Number(params.breakEvenRevenue) || 0);
  const isActualSales = Boolean(params.isActualSales);

  const isViable = weightedUnitContribution > 0 && weightedMarginPercent > 0;
  const totalContributionMargin = referenceSales * (weightedMarginPercent / 100);
  const marginOfSafetyMoney = referenceSales - breakEvenRevenue;
  const marginOfSafetyPercent =
    referenceSales > 0 ? (marginOfSafetyMoney / referenceSales) * 100 : 0;

  let status: SafetyMarginTrafficLight = 'rojo';
  let statusLabel = 'Riesgo (rojo)';

  if (!isViable || referenceSales <= 0) {
    status = 'rojo';
    statusLabel = 'Sin respaldo suficiente';
  } else if (marginOfSafetyPercent >= SAFETY_MARGIN_GREEN_MIN_PERCENT) {
    status = 'verde';
    statusLabel = 'Colchón holgado';
  } else if (marginOfSafetyPercent >= SAFETY_MARGIN_YELLOW_MIN_PERCENT) {
    status = 'amarillo';
    statusLabel = 'Colchón ajustado';
  } else {
    status = 'rojo';
    statusLabel = marginOfSafetyPercent >= 0 ? 'Margen estrecho' : 'Bajo equilibrio';
  }

  const basisWord = isActualSales ? 'ventas reales del mes' : 'ventas proyectadas';

  let simpleExplanation = '';
  if (!isViable) {
    simpleExplanation =
      'Todavía necesitas productos con margen positivo (precio mayor al costo variable) para calcular tu colchón de seguridad.';
  } else if (referenceSales <= 0) {
    simpleExplanation =
      'Aún no hay ventas esperadas ni registradas para compararlas contra tu punto de equilibrio.';
  } else if (marginOfSafetyMoney >= 0) {
    const coverText =
      fixedCosts > 0
        ? `Tu margen de contribución de este nivel (${formatCurrency(totalContributionMargin, currency)}, ${weightedMarginPercent.toFixed(1)}%) alcanza para cubrir los ${formatCurrency(fixedCosts, currency)} de costos fijos.`
        : 'Tus costos fijos actuales están en $0, por lo que todo margen se convierte en excedente.';
    simpleExplanation = `Con tus ${basisWord} (${formatCurrency(referenceSales, currency)}), tus ventas podrían caer hasta un ${marginOfSafetyPercent.toFixed(1)}% (${formatCurrency(marginOfSafetyMoney, currency)}) antes de empezar a perder dinero. ${coverText}`;
  } else {
    const gap = Math.abs(marginOfSafetyMoney);
    simpleExplanation = `Con tus ${basisWord} (${formatCurrency(referenceSales, currency)}), todavía te faltan ${formatCurrency(gap, currency)} en ventas para alcanzar el equilibrio (${formatCurrency(breakEvenRevenue, currency)}).`;
  }

  const tooltipText =
    'El Margen de Seguridad mide cuánto pueden bajar tus ventas antes de quedar en $0 de utilidad: (Ventas - Ventas de equilibrio) ÷ Ventas. Verde: 25% o más; Amarillo: entre 10% y 24,9%; Rojo: menos de 10%.';

  return {
    hasSalesReference: referenceSales > 0,
    isViable,
    isActualSales,
    referenceSales,
    breakEvenRevenue,
    weightedUnitContribution,
    weightedMarginPercent,
    totalContributionMargin,
    marginOfSafetyMoney,
    marginOfSafetyPercent,
    status,
    statusLabel,
    simpleExplanation,
    tooltipText,
  };
}

/**
 * 1.4 Rentabilidad por producto: Ranking, Pareto 80/20, margen por hora y alerta "Vende harto pero deja poco".
 */
export interface ProductProfitabilityRow {
  rank: number;
  productId: string;
  productName: string;
  category: string;
  price: number;
  unitContributionMargin: number;
  contributionMarginPercent: number;
  units: number;
  volumeSource: 'actual' | 'projected';
  revenue: number;
  totalMargin: number;
  profitSharePercent: number;
  cumulativeProfitSharePercent: number;
  isParetoTop80: boolean;
  personalTimeMinutes: number | null;
  marginPerHour: number | null;
  isHighVolumeLowMargin: boolean;
  highVolumeLowMarginReason: string | null;
}

export interface ProductProfitabilityRanking {
  rows: ProductProfitabilityRow[];
  totalRevenue: number;
  totalUnits: number;
  totalPositiveMargin: number;
  totalNetMargin: number;
  paretoCoreCount: number;
  volumeSourceUsed: 'actual' | 'projected' | 'mixed';
  highVolumeLowMarginCount: number;
}

function getProjectedMonthlyUnitsByProduct(business: BusinessWorkspace): Record<string, number> {
  const result: Record<string, number> = {};
  const weighted = getWeightedMixEconomics(business.products);
  const expectedTotal = Math.max(0, Number(business.expectedMonthlyUnits) || 0);

  for (const item of weighted.items) {
    const p = item.product;
    const baseVal = business.baseMonthlyUnitsByProduct?.[p.id];
    const units =
      baseVal !== undefined
        ? Math.max(0, Number(baseVal) || 0)
        : Math.round(expectedTotal * item.normalizedWeight);
    result[p.id] = units;
  }
  return result;
}

function getActualUnitsByProductForMonth(
  business: BusinessWorkspace,
  month?: string
): Record<string, number> {
  const unitsByProduct: Record<string, number> = {};
  if (!month) return unitsByProduct;
  const record = business.actuals?.[month];
  if (!record || !record.transactions) return unitsByProduct;

  for (const tx of record.transactions) {
    if (tx.type === 'income' && tx.productId && Number(tx.units) > 0) {
      unitsByProduct[tx.productId] =
        (unitsByProduct[tx.productId] ?? 0) + Math.max(0, Number(tx.units) || 0);
    }
  }
  return unitsByProduct;
}

export function calculateProductProfitabilityRanking(
  business: BusinessWorkspace,
  referenceMonth?: string
): ProductProfitabilityRanking {
  const products: ProductItem[] = business.products ?? [];
  if (products.length === 0) {
    return {
      rows: [],
      totalRevenue: 0,
      totalUnits: 0,
      totalPositiveMargin: 0,
      totalNetMargin: 0,
      paretoCoreCount: 0,
      volumeSourceUsed: 'projected',
      highVolumeLowMarginCount: 0,
    };
  }

  const actualUnitsMap = getActualUnitsByProductForMonth(business, referenceMonth);
  const hasActualProductUnits = Object.values(actualUnitsMap).some((u) => u > 0);
  const projectedUnitsMap = getProjectedMonthlyUnitsByProduct(business);

  let usedActual = 0;
  let usedProjected = 0;

  const baseRows = products.map((product) => {
    const actualUnits = actualUnitsMap[product.id];
    const useActual = hasActualProductUnits && actualUnits !== undefined;
    const units = useActual ? actualUnits : projectedUnitsMap[product.id] ?? 0;
    if (useActual) usedActual += 1;
    else usedProjected += 1;

    const price = Math.max(0, Number(product.price) || 0);
    const unitContributionMargin = getProductContributionMargin(product);
    const contributionMarginPercent = getProductMarginPercent(product);
    const revenue = units * price;
    const totalMargin = units * unitContributionMargin;

    const rawMinutes = Number(product.personalTimeMinutes);
    const personalTimeMinutes =
      Number.isFinite(rawMinutes) && rawMinutes > 0 ? rawMinutes : null;
    const marginPerHour =
      personalTimeMinutes !== null ? (unitContributionMargin / personalTimeMinutes) * 60 : null;

    return {
      product,
      units,
      volumeSource: (useActual ? 'actual' : 'projected') as 'actual' | 'projected',
      price,
      unitContributionMargin,
      contributionMarginPercent,
      revenue,
      totalMargin,
      personalTimeMinutes,
      marginPerHour,
    };
  });

  // Ordenar de mayor a menor margen total (luego por margen % en caso de empate)
  baseRows.sort((a, b) => {
    if (b.totalMargin !== a.totalMargin) return b.totalMargin - a.totalMargin;
    return b.contributionMarginPercent - a.contributionMarginPercent;
  });

  const totalUnits = baseRows.reduce((s, r) => s + r.units, 0);
  const totalRevenue = baseRows.reduce((s, r) => s + r.revenue, 0);
  const totalNetMargin = baseRows.reduce((s, r) => s + r.totalMargin, 0);
  const totalPositiveMargin = baseRows.reduce(
    (s, r) => s + (r.totalMargin > 0 ? r.totalMargin : 0),
    0
  );

  const averageUnits = products.length > 0 ? totalUnits / products.length : 0;
  const averageRevenue = products.length > 0 ? totalRevenue / products.length : 0;
  const weightedCatalogMarginPercent =
    totalRevenue > 0 ? (totalNetMargin / totalRevenue) * 100 : 0;

  let runningShare = 0;
  let paretoReached80 = false;
  let paretoCoreCount = 0;
  let highVolumeLowMarginCount = 0;

  const rows: ProductProfitabilityRow[] = baseRows.map((item, idx) => {
    const profitSharePercent =
      totalPositiveMargin > 0 && item.totalMargin > 0
        ? (item.totalMargin / totalPositiveMargin) * 100
        : 0;
    const prevRunning = runningShare;
    runningShare = Math.min(100, runningShare + profitSharePercent);

    // En vista Pareto 80/20: pertenecen al núcleo 80/20 los productos con aporte positivo
    // hasta completar (o cruzar por primera vez) el 80% acumulado de la utilidad.
    const isParetoTop80 =
      totalPositiveMargin > 0 &&
      item.totalMargin > 0 &&
      (!paretoReached80 || prevRunning < 80);
    if (isParetoTop80) {
      paretoCoreCount += 1;
    }
    if (runningShare >= 80) {
      paretoReached80 = true;
    }

    // Criterio "Vende harto pero deja poco":
    // 1) Volumen relevante: unidades >= promedio (o ventas >= promedio cuando varios productos).
    // 2) Margen bajo: margen % < 25%, o menor a la mitad del margen promedio ponderado del catálogo (y < 30%).
    const hasHighVolume =
      item.units > 0 &&
      (item.units >= Math.max(1, averageUnits) ||
        (averageRevenue > 0 && item.revenue >= averageRevenue));

    const hasLowMargin =
      item.contributionMarginPercent < LOW_MARGIN_THRESHOLD_PERCENT ||
      (weightedCatalogMarginPercent > 0 &&
        item.contributionMarginPercent <
          Math.min(
            RELATIVE_LOW_MARGIN_CAP_PERCENT,
            weightedCatalogMarginPercent * RELATIVE_LOW_MARGIN_FACTOR
          ));

    const isHighVolumeLowMargin = hasHighVolume && hasLowMargin;
    if (isHighVolumeLowMargin) highVolumeLowMarginCount += 1;

    let highVolumeLowMarginReason: string | null = null;
    if (isHighVolumeLowMargin) {
      highVolumeLowMarginReason =
        item.unitContributionMargin <= 0
          ? 'Se vende con frecuencia, pero su margen por unidad es cero o negativo.'
          : `Representa alto movimiento (${item.units} u.), pero deja solo ${item.contributionMarginPercent.toFixed(1)}% de margen por cada peso vendido.`;
    }

    return {
      rank: idx + 1,
      productId: item.product.id,
      productName: item.product.name,
      category: item.product.category,
      price: item.price,
      unitContributionMargin: item.unitContributionMargin,
      contributionMarginPercent: item.contributionMarginPercent,
      units: item.units,
      volumeSource: item.volumeSource,
      revenue: item.revenue,
      totalMargin: item.totalMargin,
      profitSharePercent,
      cumulativeProfitSharePercent: runningShare,
      isParetoTop80,
      personalTimeMinutes: item.personalTimeMinutes,
      marginPerHour: item.marginPerHour,
      isHighVolumeLowMargin,
      highVolumeLowMarginReason,
    };
  });

  const volumeSourceUsed: 'actual' | 'projected' | 'mixed' =
    usedActual > 0 && usedProjected > 0
      ? 'mixed'
      : usedActual > 0
      ? 'actual'
      : 'projected';

  return {
    rows,
    totalRevenue,
    totalUnits,
    totalPositiveMargin,
    totalNetMargin,
    paretoCoreCount,
    volumeSourceUsed,
    highVolumeLowMarginCount,
  };
}

/**
 * Explicaciones simples para "Explícame simple" sobre los nuevos indicadores de Fase 1
 * (mantiene intacto buildSimpleApplesAndPearsStory en smeIntelligence.ts).
 */
export interface Phase1SimpleGlossaryEntry {
  term: string;
  meaning: string;
  liveExample: string;
}

export function buildPhase1SimpleInsights(
  business: BusinessWorkspace,
  referenceMonth?: string
): {
  safetyMargin: MarginOfSafetyAnalysis;
  ranking: ProductProfitabilityRanking;
  glossary: Phase1SimpleGlossaryEntry[];
} {
  const month = referenceMonth || business.startMonth;
  const fixedCosts = business.fixedCosts.reduce((sum, f) => sum + Math.max(0, Number(f.amount) || 0), 0);
  const weighted = getWeightedMixEconomics(business.products);
  const mcRatio = weighted.weightedMarginPercent / 100;
  const breakEvenRevenue = mcRatio > 0 ? fixedCosts / mcRatio : 0;

  const actualSummary = summarizeActualRecord(month, business.actuals?.[month]);
  const projectedSales = Math.max(0, Number(business.expectedMonthlyUnits) || 0) * weighted.weightedPrice;
  const useActual = actualSummary.hasData && actualSummary.income > 0;
  const referenceSales = useActual ? actualSummary.income : projectedSales;

  const safetyMargin = calculateMarginOfSafetyAnalysis({
    fixedCosts,
    weightedUnitContribution: weighted.weightedUnitContribution,
    weightedMarginPercent: weighted.weightedMarginPercent,
    currentOrProjectedSales: referenceSales,
    breakEvenRevenue,
    isActualSales: useActual,
    currency: business.currency,
  });

  const ranking = calculateProductProfitabilityRanking(business, month);
  const topProduct = ranking.rows[0];
  const hourExample = ranking.rows.find((r) => r.marginPerHour !== null);

  const glossary: Phase1SimpleGlossaryEntry[] = [
    {
      term: 'Margen de contribución',
      meaning:
        'Es la plata que te queda libre de cada venta después de descontar lo que cuesta producir o entregar esa unidad (insumos, comisiones, envío). Esa plata primero paga tus costos fijos y luego es ganancia.',
      liveExample:
        weighted.weightedUnitContribution > 0
          ? `En tu catálogo promedio, de cada venta te quedan ${formatCurrency(weighted.weightedUnitContribution, business.currency)} libres (${weighted.weightedMarginPercent.toFixed(1)}%).`
          : 'Agrega tus productos con su precio y costo variable para verlo en pesos reales.',
    },
    {
      term: 'Margen de seguridad',
      meaning:
        'Es tu colchón antes de perder plata: te dice qué porcentaje pueden caer tus ventas actuales o esperadas sin quedar bajo el punto de equilibrio. Verde (25%+) es holgado, amarillo (10%–24%) es ajustado y rojo (<10%) pide atención.',
      liveExample: safetyMargin.hasSalesReference
        ? `${safetyMargin.statusLabel}: ${safetyMargin.marginOfSafetyPercent.toFixed(1)}% (${formatCurrency(safetyMargin.marginOfSafetyMoney, business.currency)}).`
        : 'Define tus ventas esperadas o registra ventas reales del mes para medir tu colchón.',
    },
    {
      term: 'Vista Pareto 80/20 y margen por hora',
      meaning:
        'En muchas pymes, unos pocos productos explican cerca del 80% de la ganancia total. El margen por hora mide cuánta ganancia libre te deja cada hora de tu propio trabajo en ese producto.',
      liveExample: topProduct
        ? `${topProduct.productName} aporta el ${topProduct.profitSharePercent.toFixed(1)}% de tu utilidad total${hourExample && hourExample.marginPerHour !== null ? ` · ${hourExample.productName} rinde ${formatCurrency(hourExample.marginPerHour, business.currency)}/hora.` : '.'}`
        : 'Cuando cargues tu catálogo y minutos por unidad verás qué producto rinde más por tu tiempo.',
    },
  ];

  return { safetyMargin, ranking, glossary };
}

/**
 * Helpers para conservar el borrador de la calculadora pública al iniciar sesión.
 */
export function savePublicBreakEvenDraft(draft: Omit<PublicBreakEvenDraft, 'createdAt'>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const payload: PublicBreakEvenDraft = {
      fixedCosts: Math.max(0, Number(draft.fixedCosts) || 0),
      variableCost: Math.max(0, Number(draft.variableCost) || 0),
      unitPrice: Math.max(0, Number(draft.unitPrice) || 0),
      createdAt: new Date().toISOString(),
    };
    window.localStorage.setItem(PUBLIC_BE_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignorar errores de almacenamiento privado
  }
}

export function readPublicBreakEvenDraft(): PublicBreakEvenDraft | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(PUBLIC_BE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicBreakEvenDraft>;
    const fixedCosts = Number(parsed.fixedCosts);
    const variableCost = Number(parsed.variableCost);
    const unitPrice = Number(parsed.unitPrice);
    if (
      !Number.isFinite(fixedCosts) ||
      !Number.isFinite(variableCost) ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
    ) {
      return null;
    }
    return {
      fixedCosts: Math.max(0, fixedCosts),
      variableCost: Math.max(0, variableCost),
      unitPrice: Math.max(0, unitPrice),
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearPublicBreakEvenDraft(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(PUBLIC_BE_DRAFT_STORAGE_KEY);
  } catch {
    // Ignorar errores de almacenamiento
  }
}
