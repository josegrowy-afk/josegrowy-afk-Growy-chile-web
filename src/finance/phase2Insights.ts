import {
  addMonths,
  calculateBreakEvenAndTarget,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  getCurrentYearMonth,
  getTotalFixedCostsForMonth,
  simulateWhatIf,
  summarizeActualRecord,
} from './formulas.ts';
import {
  calculateCashFlowProjection,
  calculateInventorySummary,
  calculatePayablesSummary,
  calculateReceivablesSummary,
  calculateWorkingCapital,
} from './smeIntelligence.ts';
import { diffCalendarDays, toISODateLocal } from './subscription.ts';
import type {
  AccountPayable,
  AccountReceivable,
  BusinessWorkspace,
  ProductItem,
} from '../types/finance';

/**
 * ============================================================================
 * GROWy Equilibrio — Indicadores y cálculos Fase 2 (Caja, cobranza y realidad chilena)
 * Módulo independiente para conservar intactas las fórmulas base en formulas.ts.
 * ============================================================================
 */

export const IVA_DISCLAIMER_TEXT = 'Estimación referencial, no reemplaza a tu contador';

/** Umbrales documentados para semáforos de Fase 2 */
export const RUNWAY_GREEN_MIN_MONTHS = 3;
export const RUNWAY_YELLOW_MIN_MONTHS = 1;

export const CURRENT_RATIO_GREEN_MIN = 1.5;
export const CURRENT_RATIO_YELLOW_MIN = 1.0;

export const QUICK_RATIO_GREEN_MIN = 1.0;
export const QUICK_RATIO_YELLOW_MIN = 0.7;

export const INVENTORY_DAYS_GREEN_MAX = 45;
export const INVENTORY_DAYS_YELLOW_MAX = 90;

export type Phase2TrafficStatus = 'verde' | 'amarillo' | 'rojo' | 'sin_datos';

/* ============================================================================
 * 2.1 ALERTA DE CAJA Y MESES DE CAJA DISPONIBLE (RUNWAY)
 * ============================================================================ */

export interface CashAlertAndRunwayResult {
  hasCashData: boolean;
  currentAvailableCash: number;
  averageMonthlyOutflow: number;
  averageMonthlyInflow: number;
  /** Meses que dura tu caja actual al ritmo promedio de egresos mensuales (null si no hay egresos) */
  runwayMonths: number | null;
  hasNegativeCashNow: boolean;
  firstDeficitMonth: string | null;
  firstDeficitMonthLabel: string | null;
  firstDeficitProjectedBalance: number | null;
  deficitMonthsCount: number;
  status: 'verde' | 'amarillo' | 'rojo';
  statusLabel: string;
  headline: string;
  simpleExplanation: string;
}

export function calculateCashAlertAndRunway(
  business: BusinessWorkspace,
  referenceDate: Date = new Date()
): CashAlertAndRunwayResult {
  const cf = calculateCashFlowProjection(business, referenceDate);
  const c = business.currency;
  const rows12 = cf.rows.slice(0, 12);

  const nonZeroOutflowRows = rows12.filter((r) => r.totalOutflows > 0);
  const averageMonthlyOutflow =
    nonZeroOutflowRows.length > 0
      ? nonZeroOutflowRows.reduce((s, r) => s + r.totalOutflows, 0) / nonZeroOutflowRows.length
      : getTotalFixedCostsForMonth(business.fixedCosts, getCurrentYearMonth());

  const averageMonthlyInflow =
    rows12.length > 0
      ? rows12.reduce((s, r) => s + r.totalInflows, 0) / rows12.length
      : 0;

  const firstNegativeRow = cf.rows.find((r) => r.closingBalance < 0) ?? null;
  const negativeRowsCount = cf.rows.filter((r) => r.closingBalance < 0).length;
  const hasNegativeCashNow = cf.currentAvailableCash < 0;

  let runwayMonths: number | null = null;
  if (cf.currentAvailableCash <= 0 && (cf.hasCashData || averageMonthlyOutflow > 0)) {
    runwayMonths = 0;
  } else if (averageMonthlyOutflow > 0) {
    runwayMonths = Math.round((cf.currentAvailableCash / averageMonthlyOutflow) * 10) / 10;
  }

  let status: 'verde' | 'amarillo' | 'rojo' = 'verde';
  let statusLabel = 'Caja saludable';

  if (
    hasNegativeCashNow ||
    firstNegativeRow !== null ||
    (runwayMonths !== null && runwayMonths < RUNWAY_YELLOW_MIN_MONTHS)
  ) {
    status = 'rojo';
    statusLabel = hasNegativeCashNow
      ? 'Caja en negativo hoy'
      : firstNegativeRow
        ? `Alerta en ${firstNegativeRow.monthLabel}`
        : 'Menos de 1 mes de caja';
  } else if (
    !cf.hasCashData ||
    cf.deficitMonths.length > 0 ||
    (runwayMonths !== null && runwayMonths < RUNWAY_GREEN_MIN_MONTHS)
  ) {
    status = 'amarillo';
    statusLabel = !cf.hasCashData ? 'Falta saldo inicial' : 'Colchón ajustado';
  }

  let headline = '';
  let simpleExplanation = '';

  if (hasNegativeCashNow) {
    headline = `Tu caja real disponible hoy está en negativo (${formatCurrency(cf.currentAvailableCash, c)})`;
    simpleExplanation =
      'Hoy han salido más platas de las que han entrado efectivamente a tu cuenta o caja. Prioriza cobrar ventas pendientes y frenar gastos no urgentes.';
  } else if (firstNegativeRow) {
    headline = `Tu saldo proyectado cae bajo cero en ${firstNegativeRow.monthLabel} (${formatCurrency(firstNegativeRow.closingBalance, c)})`;
    simpleExplanation = `Al ritmo actual de ingresos, egresos y pagos programados, tu caja se quedaría sin fondos en ${firstNegativeRow.monthLabel}. Hoy tienes aprox. ${
      runwayMonths !== null ? `${runwayMonths.toFixed(1)} meses` : 'sin referencia'
    } de caja disponible frente a salidas promedio de ${formatCurrency(averageMonthlyOutflow, c)}/mes.`;
  } else if (!cf.hasCashData) {
    headline = 'Configura tu saldo inicial de caja para medir tus meses de respaldo';
    simpleExplanation =
      'Cuando anotas cuánta plata tienes hoy en caja o banco, calculamos cuántos meses aguantaría tu negocio pagando sus gastos del mes.';
  } else if (runwayMonths === null) {
    headline = `Tienes ${formatCurrency(cf.currentAvailableCash, c)} disponibles y sin egresos registrados`;
    simpleExplanation =
      'Registra tus costos fijos y egresos del mes para saber exactamente cuántos meses cubre tu caja actual.';
  } else if (runwayMonths < RUNWAY_GREEN_MIN_MONTHS) {
    headline = `Tienes ${runwayMonths.toFixed(1)} meses de caja disponible (colchón ajustado)`;
    simpleExplanation = `Con ${formatCurrency(cf.currentAvailableCash, c)} en caja y egresos mensuales promedio de ${formatCurrency(averageMonthlyOutflow, c)}, tu respaldo alcanza para ${runwayMonths.toFixed(1)} meses si no entraran nuevas ventas. Lo ideal es apuntar a 3 meses o más.`;
  } else {
    headline = `Tienes ${runwayMonths.toFixed(1)} meses de caja disponible y sin déficit proyectado`;
    simpleExplanation = `Con ${formatCurrency(cf.currentAvailableCash, c)} disponibles frente a egresos promedio de ${formatCurrency(averageMonthlyOutflow, c)} al mes, tu caja cubre más de 3 meses de operación y no cae bajo cero en la proyección.`;
  }

  return {
    hasCashData: cf.hasCashData,
    currentAvailableCash: cf.currentAvailableCash,
    averageMonthlyOutflow,
    averageMonthlyInflow,
    runwayMonths,
    hasNegativeCashNow,
    firstDeficitMonth: firstNegativeRow?.month ?? null,
    firstDeficitMonthLabel: firstNegativeRow?.monthLabel ?? null,
    firstDeficitProjectedBalance: firstNegativeRow?.closingBalance ?? null,
    deficitMonthsCount: negativeRowsCount,
    status,
    statusLabel,
    headline,
    simpleExplanation,
  };
}

/* ============================================================================
 * 2.2 ANTIGÜEDAD DE CxC Y CxP (0–30, 31–60, 61+ DÍAS) Y DÍAS PROMEDIO
 * ============================================================================ */

export type AgingBucketKey = '0_30' | '31_60' | '61_plus';

export interface AgingBucketSummary {
  key: AgingBucketKey;
  label: string;
  count: number;
  amount: number;
  overdueAmount: number;
  sharePercent: number;
}

export interface AgingBreakdown {
  totalPending: number;
  pendingDocumentsCount: number;
  buckets: AgingBucketSummary[];
}

export interface ArApAgingSummary {
  receivablesAging: AgingBreakdown;
  payablesAging: AgingBreakdown;
  averageCollectionDays: number | null;
  averagePaymentDays: number | null;
  paidReceivablesCount: number;
  paidPayablesCount: number;
  gapWarning: string | null;
}

function buildAgingBuckets<
  T extends { amount: number; paidAmount: number; issueDate: string; dueDate: string }
>(items: T[], todayISO: string): AgingBreakdown {
  const bucketTotals: Record<AgingBucketKey, { count: number; amount: number; overdueAmount: number }> = {
    '0_30': { count: 0, amount: 0, overdueAmount: 0 },
    '31_60': { count: 0, amount: 0, overdueAmount: 0 },
    '61_plus': { count: 0, amount: 0, overdueAmount: 0 },
  };

  let totalPending = 0;
  let pendingDocumentsCount = 0;

  for (const item of items) {
    const amount = Math.max(0, Number(item.amount) || 0);
    const paid = Math.min(amount, Math.max(0, Number(item.paidAmount) || 0));
    const pending = Math.max(0, amount - paid);
    if (pending <= 0.01) continue;

    totalPending += pending;
    pendingDocumentsCount += 1;

    const refDate = item.issueDate || item.dueDate || todayISO;
    const ageDays = Math.max(0, diffCalendarDays(refDate, todayISO));
    const isOverdue = Boolean(item.dueDate) && diffCalendarDays(todayISO, item.dueDate) < 0;

    const key: AgingBucketKey =
      ageDays <= 30 ? '0_30' : ageDays <= 60 ? '31_60' : '61_plus';

    bucketTotals[key].count += 1;
    bucketTotals[key].amount += pending;
    if (isOverdue) {
      bucketTotals[key].overdueAmount += pending;
    }
  }

  const labels: Record<AgingBucketKey, string> = {
    '0_30': '0–30 días',
    '31_60': '31–60 días',
    '61_plus': '61+ días',
  };

  const buckets: AgingBucketSummary[] = (['0_30', '31_60', '61_plus'] as AgingBucketKey[]).map(
    (key) => ({
      key,
      label: labels[key],
      count: bucketTotals[key].count,
      amount: bucketTotals[key].amount,
      overdueAmount: bucketTotals[key].overdueAmount,
      sharePercent: totalPending > 0 ? (bucketTotals[key].amount / totalPending) * 100 : 0,
    })
  );

  return {
    totalPending,
    pendingDocumentsCount,
    buckets,
  };
}

function calculateAverageSettlementDays(
  items: Array<AccountReceivable | AccountPayable>
): { averageDays: number | null; paidCount: number } {
  const durations: number[] = [];
  let paidCount = 0;

  for (const item of items) {
    const amount = Math.max(0, Number(item.amount) || 0);
    const paidAmount = Math.min(amount, Math.max(0, Number(item.paidAmount) || 0));
    const pending = Math.max(0, amount - paidAmount);
    if (pending > 0.01) continue;

    paidCount += 1;
    const lastPaymentDate =
      item.payments && item.payments.length > 0
        ? item.payments[item.payments.length - 1].date
        : undefined;
    if (item.issueDate && lastPaymentDate) {
      const diff = diffCalendarDays(item.issueDate, lastPaymentDate);
      if (diff >= 0) {
        durations.push(diff);
      }
    }
  }

  const averageDays =
    durations.length > 0
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
      : null;

  return { averageDays, paidCount };
}

export function calculateArApAgingAndDurations(
  business: BusinessWorkspace,
  referenceDate: Date = new Date()
): ArApAgingSummary {
  const todayISO = toISODateLocal(referenceDate);
  const receivables = business.receivables ?? [];
  const payables = business.payables ?? [];

  const receivablesAging = buildAgingBuckets(receivables, todayISO);
  const payablesAging = buildAgingBuckets(payables, todayISO);

  const arSummary = calculateReceivablesSummary(receivables, referenceDate);
  const apSettlement = calculateAverageSettlementDays(payables);

  const averageCollectionDays = arSummary.averageCollectionDays;
  const averagePaymentDays = apSettlement.averageDays;

  let gapWarning: string | null = null;
  if (
    averageCollectionDays !== null &&
    averagePaymentDays !== null &&
    averageCollectionDays > averagePaymentDays + 5
  ) {
    gapWarning = `En promedio cobras en ${averageCollectionDays} días, pero pagas en ${averagePaymentDays} días. Esa diferencia de ${(
      averageCollectionDays - averagePaymentDays
    ).toFixed(1)} días te exige tener más caja para financiar a tus clientes.`;
  } else if (receivablesAging.buckets[2].amount > 0) {
    gapWarning = `Tienes ${receivablesAging.buckets[2].count} documento(s) por cobrar con más de 60 días de antigüedad.`;
  }

  return {
    receivablesAging,
    payablesAging,
    averageCollectionDays,
    averagePaymentDays,
    paidReceivablesCount: arSummary.paidCount,
    paidPayablesCount: apSettlement.paidCount,
    gapWarning,
  };
}

/* ============================================================================
 * 2.3 RAZONES FINANCIERAS SIMPLES CON SEMÁFORO
 * ============================================================================ */

export interface SimpleFinancialRatioItem {
  id: 'current_ratio' | 'quick_ratio' | 'inventory_days';
  name: string;
  value: number | null;
  formattedValue: string;
  status: Phase2TrafficStatus;
  statusLabel: string;
  thresholdRuleText: string;
  simpleMeaning: string;
  liveExample: string;
}

export interface FinancialRatiosSummary {
  ratios: SimpleFinancialRatioItem[];
  currentRatio: SimpleFinancialRatioItem;
  quickRatio: SimpleFinancialRatioItem;
  inventoryDays: SimpleFinancialRatioItem;
}

export function calculateFinancialRatiosWithStatus(
  business: BusinessWorkspace
): FinancialRatiosSummary {
  const c = business.currency;
  const inv = calculateInventorySummary(business);
  const wc = calculateWorkingCapital(business, undefined, undefined, undefined, inv);

  // 1. Liquidez corriente = Activo corriente / Pasivo corriente
  let currentRatioStatus: Phase2TrafficStatus = 'sin_datos';
  let currentRatioLabel = 'Sin pasivos de corto plazo';
  let currentRatioFormatted = 'N/A';

  if (wc.totalCurrentLiabilities > 0) {
    const val = wc.totalCurrentAssets / wc.totalCurrentLiabilities;
    currentRatioFormatted = `${val.toFixed(2)}x`;
    if (val >= CURRENT_RATIO_GREEN_MIN) {
      currentRatioStatus = 'verde';
      currentRatioLabel = 'Respaldo holgado';
    } else if (val >= CURRENT_RATIO_YELLOW_MIN) {
      currentRatioStatus = 'amarillo';
      currentRatioLabel = 'Justo a tiempo';
    } else {
      currentRatioStatus = 'rojo';
      currentRatioLabel = 'Bajo presión';
    }
  } else if (wc.hasEnoughData && wc.totalCurrentAssets > 0) {
    currentRatioStatus = 'verde';
    currentRatioLabel = 'Sin deudas cortas';
    currentRatioFormatted = 'Sin deuda';
  }

  const currentRatio: SimpleFinancialRatioItem = {
    id: 'current_ratio',
    name: 'Liquidez corriente',
    value: wc.currentRatio,
    formattedValue: currentRatioFormatted,
    status: currentRatioStatus,
    statusLabel: currentRatioLabel,
    thresholdRuleText: `Verde ≥ ${CURRENT_RATIO_GREEN_MIN.toFixed(1)}x · Amarillo ${CURRENT_RATIO_YELLOW_MIN.toFixed(1)}x–1,49x · Rojo < ${CURRENT_RATIO_YELLOW_MIN.toFixed(1)}x`,
    simpleMeaning:
      'Mide cuántas veces puedes pagar tus compromisos de los próximos 12 meses (proveedores, sueldos, impuestos) usando tu caja, lo que te deben e inventario.',
    liveExample:
      wc.totalCurrentLiabilities > 0
        ? `Tienes ${formatCurrency(wc.totalCurrentAssets, c)} en activos rápidos frente a ${formatCurrency(wc.totalCurrentLiabilities, c)} por pagar pronto.`
        : wc.totalCurrentAssets > 0
          ? `Tienes ${formatCurrency(wc.totalCurrentAssets, c)} a favor y hoy no registras deudas de corto plazo.`
          : 'Registra tu caja inicial, cuentas por cobrar o por pagar para calcular tu liquidez.',
  };

  // 2. Prueba ácida = (Activo corriente - Inventario) / Pasivo corriente
  const quickAssets = wc.totalCurrentAssets - wc.inventoryValue;
  const quickRatioValue =
    wc.totalCurrentLiabilities > 0 ? quickAssets / wc.totalCurrentLiabilities : null;

  let quickStatus: Phase2TrafficStatus = 'sin_datos';
  let quickLabel = 'Sin pasivos de corto plazo';
  let quickFormatted = 'N/A';

  if (quickRatioValue !== null) {
    quickFormatted = `${quickRatioValue.toFixed(2)}x`;
    if (quickRatioValue >= QUICK_RATIO_GREEN_MIN) {
      quickStatus = 'verde';
      quickLabel = 'Liquidez rápida sana';
    } else if (quickRatioValue >= QUICK_RATIO_YELLOW_MIN) {
      quickStatus = 'amarillo';
      quickLabel = 'Dependes algo de cobrar';
    } else {
      quickStatus = 'rojo';
      quickLabel = 'Falta efectivo inmediato';
    }
  } else if (wc.hasEnoughData && quickAssets > 0) {
    quickStatus = 'verde';
    quickLabel = 'Sin deudas cortas';
    quickFormatted = 'Sin deuda';
  }

  const quickRatio: SimpleFinancialRatioItem = {
    id: 'quick_ratio',
    name: 'Prueba ácida',
    value: quickRatioValue,
    formattedValue: quickFormatted,
    status: quickStatus,
    statusLabel: quickLabel,
    thresholdRuleText: `Verde ≥ ${QUICK_RATIO_GREEN_MIN.toFixed(1)}x · Amarillo ${QUICK_RATIO_YELLOW_MIN.toFixed(1)}x–0,99x · Rojo < ${QUICK_RATIO_YELLOW_MIN.toFixed(1)}x`,
    simpleMeaning:
      'Es más exigente que la liquidez corriente: mide si puedes pagar tus deudas rápidas SIN tener que salir a vender tu mercadería guardada.',
    liveExample:
      wc.totalCurrentLiabilities > 0
        ? `Descontando inventario (${formatCurrency(wc.inventoryValue, c)}), te quedan ${formatCurrency(quickAssets, c)} en caja y cobranzas para cubrir ${formatCurrency(wc.totalCurrentLiabilities, c)}.`
        : 'Sin cuentas por pagar de corto plazo registradas hoy.',
  };

  // 3. Días de inventario = (Valor inventario actual / Costo de ventas mensual) * 30
  const saleMovements = (business.inventoryMovements ?? []).filter((m) => m.type === 'sale');
  const distinctSaleMonths = new Set(
    saleMovements.map((m) => (m.date || '').slice(0, 7)).filter((m) => m.length === 7)
  );
  const monthlyCogsFromMovements =
    inv.totalCostOfGoodsSold > 0
      ? inv.totalCostOfGoodsSold / Math.max(1, distinctSaleMonths.size)
      : 0;

  let invDaysValue: number | null = null;
  let invDaysStatus: Phase2TrafficStatus = 'sin_datos';
  let invDaysLabel = 'Activa stock y ventas';
  let invDaysFormatted = 'N/A';

  if (inv.hasTrackedProducts) {
    if (inv.totalCurrentValue <= 0) {
      invDaysValue = 0;
      invDaysFormatted = '0 días';
      invDaysStatus = 'rojo';
      invDaysLabel = 'Sin stock disponible';
    } else if (monthlyCogsFromMovements > 0) {
      invDaysValue = Math.round((inv.totalCurrentValue / monthlyCogsFromMovements) * 30);
      invDaysFormatted = `${invDaysValue} días`;
      if (invDaysValue <= INVENTORY_DAYS_GREEN_MAX) {
        invDaysStatus = 'verde';
        invDaysLabel = 'Rotación ágil';
      } else if (invDaysValue <= INVENTORY_DAYS_YELLOW_MAX) {
        invDaysStatus = 'amarillo';
        invDaysLabel = 'Rotación moderada';
      } else {
        invDaysStatus = 'rojo';
        invDaysLabel = 'Stock muy lento';
      }
    } else {
      invDaysLabel = 'Sin salidas registradas';
    }
  }

  const inventoryDays: SimpleFinancialRatioItem = {
    id: 'inventory_days',
    name: 'Días de inventario',
    value: invDaysValue,
    formattedValue: invDaysFormatted,
    status: invDaysStatus,
    statusLabel: invDaysLabel,
    thresholdRuleText: `Verde ≤ ${INVENTORY_DAYS_GREEN_MAX} d. · Amarillo 46–${INVENTORY_DAYS_YELLOW_MAX} d. · Rojo > ${INVENTORY_DAYS_YELLOW_MAX} d.`,
    simpleMeaning:
      'Indica cuántos días promedio demora tu mercadería guardada en convertirse en ventas. Mientras menos días esté detenida, menos plata tienes inmovilizada en bodega.',
    liveExample: !inv.hasTrackedProducts
      ? 'Activa el control de stock en Catálogo e Inventario en tus productos físicos para medirlo.'
      : invDaysValue === null
        ? `Tienes ${formatCurrency(inv.totalCurrentValue, c)} en stock; registra salidas por venta para calcular en cuántos días rota.`
        : invDaysValue === 0
          ? 'Tu stock valorizado llegó a $0: corres riesgo de perder ventas por quiebre de stock.'
          : `Al ritmo actual de salidas (${formatCurrency(monthlyCogsFromMovements, c)}/mes en costo), tu stock de ${formatCurrency(inv.totalCurrentValue, c)} alcanza para aprox. ${invDaysValue} días.`,
  };

  return {
    ratios: [currentRatio, quickRatio, inventoryDays],
    currentRatio,
    quickRatio,
    inventoryDays,
  };
}

/* ============================================================================
 * 2.4 ESTIMADOR DE IVA MENSUAL (REFERENCIAL) Y F29 (NETO VS IVA INCLUIDO)
 * ============================================================================ */

export interface MonthlyIvaEstimateResult {
  enabled: boolean;
  month: string;
  monthLabel: string;
  pricesIncludeIva: boolean;
  ivaRatePercent: number;
  f29Day: number;
  isProjectedReference: boolean;
  grossSalesBase: number;
  netSalesBase: number;
  ivaDebito: number;
  grossPurchasesBase: number;
  netPurchasesBase: number;
  ivaCredito: number;
  netIvaResult: number;
  ivaToPay: number;
  ivaFavorRemanente: number;
  declarationDueDateISO: string;
  nextF29ReminderISO: string;
  daysUntilNextF29: number;
  disclaimer: string;
}

export function calculateMonthlyIvaEstimate(
  business: BusinessWorkspace,
  month: string = getCurrentYearMonth(),
  referenceDate: Date = new Date()
): MonthlyIvaEstimateResult {
  const settings = business.ivaSettings ?? {};
  const enabled = settings.enabled ?? true;
  const pricesIncludeIva = settings.pricesIncludeIva ?? true;
  const rawDay = Math.round(Number(settings.f29Day) || 12);
  const f29Day = Math.max(1, Math.min(28, rawDay));
  const rawRate = Number(settings.ivaRatePercent ?? 19);
  const ivaRatePercent = Math.max(0, Math.min(50, Number.isFinite(rawRate) ? rawRate : 19));

  const actualSummary = summarizeActualRecord(month, business.actuals?.[month]);
  let salesBase = 0;
  let purchasesBase = 0;
  let isProjectedReference = false;

  if (actualSummary.hasData) {
    salesBase = Math.max(0, actualSummary.income);
    // Para IVA crédito consideramos egresos operativos variables y fijos registrados del mes
    purchasesBase = Math.max(0, actualSummary.variableExpense + actualSummary.fixedExpense);
  } else {
    isProjectedReference = true;
    const fixedProj = getTotalFixedCostsForMonth(business.fixedCosts, month);
    const beProj = calculateBreakEvenAndTarget({
      fixedCosts: fixedProj,
      products: business.products,
      targetProfit: business.targetProfit,
      expectedUnits: business.expectedMonthlyUnits,
    });
    salesBase = Math.max(0, beProj.expectedRevenue);
    purchasesBase = Math.max(0, beProj.expectedVariableCosts + fixedProj);
  }

  const rateDecimal = ivaRatePercent / 100;
  let netSalesBase = salesBase;
  let ivaDebito = 0;
  let netPurchasesBase = purchasesBase;
  let ivaCredito = 0;

  if (rateDecimal > 0) {
    if (pricesIncludeIva) {
      netSalesBase = salesBase / (1 + rateDecimal);
      ivaDebito = salesBase - netSalesBase;
      netPurchasesBase = purchasesBase / (1 + rateDecimal);
      ivaCredito = purchasesBase - netPurchasesBase;
    } else {
      netSalesBase = salesBase;
      ivaDebito = salesBase * rateDecimal;
      netPurchasesBase = purchasesBase;
      ivaCredito = purchasesBase * rateDecimal;
    }
  }

  const decimalsFactor = Math.pow(10, business.currency.decimals);
  const roundAmt = (v: number) => Math.round(v * decimalsFactor) / decimalsFactor;

  const ivaDebitoRounded = roundAmt(ivaDebito);
  const ivaCreditoRounded = roundAmt(ivaCredito);
  const netIvaResult = roundAmt(ivaDebitoRounded - ivaCreditoRounded);
  const ivaToPay = netIvaResult > 0 ? netIvaResult : 0;
  const ivaFavorRemanente = netIvaResult < 0 ? Math.abs(netIvaResult) : 0;

  // El F29 de un mes YYYY-MM vence en el mes siguiente
  const nextMonth = addMonths(month, 1);
  const paddedDay = String(f29Day).padStart(2, '0');
  const declarationDueDateISO = `${nextMonth}-${paddedDay}`;

  // Próximo vencimiento calendario desde referenceDate
  const todayISO = toISODateLocal(referenceDate);
  const currentMonthISO = `${getCurrentYearMonth()}-${paddedDay}`;
  const candidateTodayMonth = `${todayISO.slice(0, 7)}-${paddedDay}`;
  const nextF29ReminderISO =
    diffCalendarDays(todayISO, candidateTodayMonth) >= 0
      ? candidateTodayMonth
      : `${addMonths(todayISO.slice(0, 7), 1)}-${paddedDay}`;
  const daysUntilNextF29 = Math.max(0, diffCalendarDays(todayISO, nextF29ReminderISO));
  void currentMonthISO;

  return {
    enabled,
    month,
    monthLabel: formatMonthLabel(month, false),
    pricesIncludeIva,
    ivaRatePercent,
    f29Day,
    isProjectedReference,
    grossSalesBase: roundAmt(pricesIncludeIva ? salesBase : salesBase + ivaDebito),
    netSalesBase: roundAmt(netSalesBase),
    ivaDebito: ivaDebitoRounded,
    grossPurchasesBase: roundAmt(pricesIncludeIva ? purchasesBase : purchasesBase + ivaCredito),
    netPurchasesBase: roundAmt(netPurchasesBase),
    ivaCredito: ivaCreditoRounded,
    netIvaResult,
    ivaToPay,
    ivaFavorRemanente,
    declarationDueDateISO,
    nextF29ReminderISO,
    daysUntilNextF29,
    disclaimer: IVA_DISCLAIMER_TEXT,
  };
}

/* ============================================================================
 * 2.5 SUELDO DEL DUEÑO COMO COSTO FIJO OPCIONAL (AVISO UTILIDAD ILUSORIA)
 * ============================================================================ */

export interface OwnerSalaryImpactResult {
  included: boolean;
  monthlyAmount: number;
  activeSalaryApplied: number;
  hasIllusoryProfitRisk: boolean;
  illusoryProfitWarning: string | null;
  baseFixedCosts: number;
  adjustedFixedCosts: number;
  baseBreakEvenUnits: number;
  adjustedBreakEvenUnits: number;
  extraBreakEvenUnits: number;
  baseBreakEvenRevenue: number;
  adjustedBreakEvenRevenue: number;
  baseExpectedProfit: number;
  adjustedExpectedProfit: number;
}

export function calculateOwnerSalaryImpact(
  business: BusinessWorkspace,
  month: string = getCurrentYearMonth()
): OwnerSalaryImpactResult {
  const included = Boolean(business.ownerSalary?.included);
  const monthlyAmount = Math.max(0, Number(business.ownerSalary?.monthlyAmount) || 0);
  const activeSalaryApplied = included ? monthlyAmount : 0;

  const baseFixedCosts = getTotalFixedCostsForMonth(business.fixedCosts, month);
  const adjustedFixedCosts = baseFixedCosts + activeSalaryApplied;

  const baseBe = calculateBreakEvenAndTarget({
    fixedCosts: baseFixedCosts,
    products: business.products,
    targetProfit: business.targetProfit,
    expectedUnits: business.expectedMonthlyUnits,
  });

  const adjustedBe = calculateBreakEvenAndTarget({
    fixedCosts: adjustedFixedCosts,
    products: business.products,
    targetProfit: business.targetProfit,
    expectedUnits: business.expectedMonthlyUnits,
  });

  const hasIllusoryProfitRisk = !included || monthlyAmount <= 0;

  const illusoryProfitWarning = hasIllusoryProfitRisk
    ? 'Aviso de utilidad ilusoria: aún no incluyes tu sueldo como dueño dentro de los costos fijos. Sin pagarte un sueldo, parte de la ganancia que ves en el tablero en realidad está pagando tus propias horas de trabajo.'
    : null;

  return {
    included,
    monthlyAmount,
    activeSalaryApplied,
    hasIllusoryProfitRisk,
    illusoryProfitWarning,
    baseFixedCosts,
    adjustedFixedCosts,
    baseBreakEvenUnits: baseBe.breakEvenUnits,
    adjustedBreakEvenUnits: adjustedBe.breakEvenUnits,
    extraBreakEvenUnits: Math.max(0, adjustedBe.breakEvenUnits - baseBe.breakEvenUnits),
    baseBreakEvenRevenue: baseBe.breakEvenRevenue,
    adjustedBreakEvenRevenue: adjustedBe.breakEvenRevenue,
    baseExpectedProfit: baseBe.expectedProfit,
    adjustedExpectedProfit: adjustedBe.expectedProfit,
  };
}

/* ============================================================================
 * 2.6 PRECIO SUGERIDO SEGÚN MARGEN OBJETIVO Y TABLA DE SENSIBILIDAD
 * ============================================================================ */

export interface SuggestedPriceResult {
  isValid: boolean;
  errorMessage: string | null;
  suggestedPrice: number;
  fixedUnitCosts: number;
  percentageCostsSum: number;
  projectedTotalVariableCost: number;
  projectedUnitMargin: number;
  targetMarginPercent: number;
}

export function calculateSuggestedProductPrice(params: {
  variableCost: number;
  cardFeePercent?: number;
  taxPercent?: number;
  shippingCost?: number;
  personalTimeCost?: number;
  targetMarginPercent: number;
  decimals?: number;
}): SuggestedPriceResult {
  const baseVar = Math.max(0, Number(params.variableCost) || 0);
  const cardFeePercent = Math.max(0, Number(params.cardFeePercent) || 0);
  const taxPercent = Math.max(0, Number(params.taxPercent) || 0);
  const shippingCost = Math.max(0, Number(params.shippingCost) || 0);
  const personalTimeCost = Math.max(0, Number(params.personalTimeCost) || 0);
  const targetMarginPercent = Number(params.targetMarginPercent);
  const decimals = Math.max(0, Math.min(4, Number(params.decimals) || 0));

  const fixedUnitCosts = baseVar + shippingCost + personalTimeCost;
  const percentageCostsSum = cardFeePercent + taxPercent;

  if (!Number.isFinite(targetMarginPercent) || targetMarginPercent < 0 || targetMarginPercent >= 100) {
    return {
      isValid: false,
      errorMessage: 'Ingresa un margen objetivo entre 0% y 99%.',
      suggestedPrice: 0,
      fixedUnitCosts,
      percentageCostsSum,
      projectedTotalVariableCost: fixedUnitCosts,
      projectedUnitMargin: 0,
      targetMarginPercent: Number.isFinite(targetMarginPercent) ? targetMarginPercent : 0,
    };
  }

  const denominator = 1 - (percentageCostsSum + targetMarginPercent) / 100;
  if (denominator <= 0.0001) {
    return {
      isValid: false,
      errorMessage: `Tu margen objetivo (${targetMarginPercent}%) más tarjeta e impuestos (${percentageCostsSum.toFixed(
        1
      )}%) suma 100% o más. Reduce el margen deseado para poder calcular un precio.`,
      suggestedPrice: 0,
      fixedUnitCosts,
      percentageCostsSum,
      projectedTotalVariableCost: fixedUnitCosts,
      projectedUnitMargin: 0,
      targetMarginPercent,
    };
  }

  const rawPrice = fixedUnitCosts / denominator;
  const factor = Math.pow(10, decimals);
  const suggestedPrice = decimals === 0 ? Math.ceil(rawPrice) : Math.round(rawPrice * factor) / factor;
  const variableFromPct = suggestedPrice * (percentageCostsSum / 100);
  const projectedTotalVariableCost = fixedUnitCosts + variableFromPct;
  const projectedUnitMargin = suggestedPrice - projectedTotalVariableCost;

  return {
    isValid: true,
    errorMessage: null,
    suggestedPrice,
    fixedUnitCosts,
    percentageCostsSum,
    projectedTotalVariableCost,
    projectedUnitMargin,
    targetMarginPercent,
  };
}

export interface PriceSensitivityRow {
  deltaPercent: number;
  label: string;
  isBaseline: boolean;
  isViable: boolean;
  weightedPrice: number;
  weightedUnitContribution: number;
  weightedMarginPercent: number;
  breakEvenUnits: number;
  breakEvenUnitsDelta: number;
  breakEvenRevenue: number;
  expectedProfit: number;
}

export function calculatePriceSensitivityTable(params: {
  fixedCosts: number;
  products: ProductItem[];
  targetProfit: number;
  expectedUnits: number;
  variations?: number[];
}): PriceSensitivityRow[] {
  const variations = params.variations ?? [-10, -5, 0, 5, 10];
  const base = calculateBreakEvenAndTarget({
    fixedCosts: params.fixedCosts,
    products: params.products,
    targetProfit: params.targetProfit,
    expectedUnits: params.expectedUnits,
  });

  return variations.map((delta) => {
    const sim =
      delta === 0
        ? base
        : simulateWhatIf({
            fixedCosts: params.fixedCosts,
            products: params.products,
            targetProfit: params.targetProfit,
            expectedUnits: params.expectedUnits,
            priceDeltaPercent: delta,
            variableCostDeltaPercent: 0,
            fixedCostDeltaPercent: 0,
          });

    return {
      deltaPercent: delta,
      label: delta === 0 ? 'Precio actual (0%)' : delta > 0 ? `Subir +${delta}%` : `Bajar ${delta}%`,
      isBaseline: delta === 0,
      isViable: sim.isViable,
      weightedPrice: sim.weightedEconomics.weightedPrice,
      weightedUnitContribution: sim.weightedEconomics.weightedUnitContribution,
      weightedMarginPercent: sim.weightedEconomics.weightedMarginPercent,
      breakEvenUnits: sim.breakEvenUnits,
      breakEvenUnitsDelta: sim.isViable && base.isViable ? sim.breakEvenUnits - base.breakEvenUnits : 0,
      breakEvenRevenue: sim.breakEvenRevenue,
      expectedProfit: sim.expectedProfit,
    };
  });
}

/* ============================================================================
 * HELPER PARA "EXPLÍCAME SIMPLE" FASE 2
 * ============================================================================ */

export interface Phase2GlossaryItem {
  term: string;
  meaning: string;
  liveExample: string;
  status?: Phase2TrafficStatus;
}

export function buildPhase2SimpleInsights(
  business: BusinessWorkspace,
  month: string = getCurrentYearMonth()
): { glossary: Phase2GlossaryItem[] } {
  const c = business.currency;
  const cash = calculateCashAlertAndRunway(business);
  const ratios = calculateFinancialRatiosWithStatus(business);
  const aging = calculateArApAgingAndDurations(business);
  const iva = calculateMonthlyIvaEstimate(business, month);
  const salary = calculateOwnerSalaryImpact(business, month);

  const glossary: Phase2GlossaryItem[] = [
    {
      term: 'Meses de caja disponible (Runway)',
      meaning:
        'Es cuánto tiempo alcanzaría a funcionar tu negocio pagando sus gastos mensuales solo con la plata que hoy tienes en caja o banco, si dejaran de entrar ventas.',
      liveExample: cash.headline,
      status: cash.status,
    },
    {
      term: 'Liquidez corriente (con semáforo)',
      meaning:
        'Compara lo que tienes en caja, por cobrar e inventario frente a todo lo que debes pagar pronto. Verde (≥ 1,5x), Amarillo (1,0–1,49x), Rojo (< 1,0x).',
      liveExample: `${ratios.currentRatio.formattedValue} (${ratios.currentRatio.statusLabel}) — ${ratios.currentRatio.liveExample}`,
      status: ratios.currentRatio.status,
    },
    {
      term: 'Prueba ácida (con semáforo)',
      meaning:
        'Igual que la liquidez corriente, pero sin contar la mercadería en bodega. Muestra si puedes pagar tus cuentas rápidas sin depender de vender stock primero.',
      liveExample: `${ratios.quickRatio.formattedValue} (${ratios.quickRatio.statusLabel}) — ${ratios.quickRatio.liveExample}`,
      status: ratios.quickRatio.status,
    },
    {
      term: 'Días de inventario (con semáforo)',
      meaning:
        'Cuántos días promedio pasa un producto guardado antes de venderse. Verde (≤ 45 d.), Amarillo (46–90 d.), Rojo (> 90 d.).',
      liveExample: `${ratios.inventoryDays.formattedValue} (${ratios.inventoryDays.statusLabel}) — ${ratios.inventoryDays.liveExample}`,
      status: ratios.inventoryDays.status,
    },
    {
      term: 'Antigüedad de cobros y pagos (0–30 / 31–60 / 61+ días)',
      meaning:
        'Ordena las boletas o facturas pendientes según cuántos días llevan emitidas. Si te pagan más lento de lo que tú pagas, tu caja se aprieta aunque vendas harto.',
      liveExample: `Cobro promedio: ${
        aging.averageCollectionDays !== null ? `${aging.averageCollectionDays} d.` : 'sin historial'
      } · Pago promedio: ${
        aging.averagePaymentDays !== null ? `${aging.averagePaymentDays} d.` : 'sin historial'
      }.`,
    },
    {
      term: 'IVA mensual referencial y F29',
      meaning: `Calcula la diferencia entre el IVA de tus ventas (débito) y el IVA de tus compras y gastos (crédito) antes de tu F29 (día ${iva.f29Day}). ${IVA_DISCLAIMER_TEXT}.`,
      liveExample:
        iva.ivaToPay > 0
          ? `Para ${iva.monthLabel}: IVA débito ${formatCurrency(iva.ivaDebito, c)} − IVA crédito ${formatCurrency(iva.ivaCredito, c)} = ${formatCurrency(iva.ivaToPay, c)} aprox. a pagar (${iva.pricesIncludeIva ? 'precios con IVA incluido' : 'precios netos'}).`
          : `Para ${iva.monthLabel}: tendrías ${formatCurrency(iva.ivaFavorRemanente, c)} de remanente a favor (estimación referencial).`,
    },
    {
      term: 'Sueldo del dueño y "utilidad ilusoria"',
      meaning:
        'Si no pones tu propio sueldo en los costos fijos, el negocio parece ganar más de lo real, pero en verdad esa ganancia solo está pagando tu tiempo (utilidad ilusoria).',
      liveExample: salary.included && salary.monthlyAmount > 0
        ? `Tu sueldo de ${formatCurrency(salary.monthlyAmount, c)}/mes suma ${formatNumber(salary.extraBreakEvenUnits)} ventas extra para cubrirlo de forma sana.`
        : 'Hoy está desactivado en Configuración: actívalo para saber cuánto necesitas vender para pagarte tu propio sueldo.',
    },
  ];

  return { glossary };
}
