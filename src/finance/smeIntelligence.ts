import type {
  AccountPayable,
  AccountReceivable,
  ActualTransaction,
  BusinessWorkspace,
  InventoryMovement,
  OperationalObligationCategory,
  PayablePriority,
  ProductItem,
  ViewTab,
} from '../types/finance';
import {
  buildMonthlyProjections,
  calculateBreakEvenAndTarget,
  compareMonthActualVsProjected,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  getCurrentYearMonth,
  getProductContributionMargin,
  getProductMarginPercent,
  getTotalFixedCostsForMonth,
  summarizeActualRecord,
} from './formulas';
import { diffCalendarDays, toISODateLocal } from './subscription';

export const OBLIGATION_CATEGORY_LABELS: Record<OperationalObligationCategory, string> = {
  proveedores: 'Proveedores e insumos',
  remuneraciones: 'Remuneraciones y cotizaciones',
  impuestos: 'Impuestos y F29 / SII',
  credito: 'Cuotas de créditos',
  otros: 'Otros pagos operativos',
};

/* ============================================================================
 * 1. CONTROL INTELIGENTE DE CUENTAS POR COBRAR (CxC) Y POR PAGAR (CxP)
 * ============================================================================ */

export type DocumentPaymentStatus = 'pendiente' | 'proxima' | 'vencida' | 'pagada';

export interface EvaluatedReceivable {
  item: AccountReceivable;
  pendingBalance: number;
  daysOverdue: number;
  daysUntilDue: number;
  status: DocumentPaymentStatus;
  statusLabel: string;
}

export interface LateClientAlert {
  clientName: string;
  overdueCount: number;
  totalOverdueAmount: number;
  maxDaysOverdue: number;
}

export interface ReceivablesSummary {
  items: EvaluatedReceivable[];
  totalBilled: number;
  totalCollected: number;
  totalPending: number;
  pendingCount: number;
  upcomingCount: number;
  overdueCount: number;
  overdueAmount: number;
  paidCount: number;
  averageCollectionDays: number | null;
  lateClientAlerts: LateClientAlert[];
}

export function calculateReceivablesSummary(
  receivables: AccountReceivable[] = [],
  referenceDate: Date = new Date()
): ReceivablesSummary {
  const todayISO = toISODateLocal(referenceDate);
  let totalBilled = 0;
  let totalCollected = 0;
  let totalPending = 0;
  let pendingCount = 0;
  let upcomingCount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidCount = 0;

  const collectionDurations: number[] = [];
  const lateClientMap = new Map<string, LateClientAlert>();

  const items: EvaluatedReceivable[] = receivables.map((item) => {
    const amount = Math.max(0, Number(item.amount) || 0);
    const paidAmount = Math.min(amount, Math.max(0, Number(item.paidAmount) || 0));
    const pendingBalance = Math.max(0, amount - paidAmount);

    totalBilled += amount;
    totalCollected += paidAmount;
    totalPending += pendingBalance;

    const daysUntilDue = item.dueDate ? diffCalendarDays(todayISO, item.dueDate) : 0;
    const daysOverdue = pendingBalance > 0 && daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

    let status: DocumentPaymentStatus = 'pendiente';
    let statusLabel = 'Pendiente';

    if (pendingBalance <= 0.01) {
      status = 'pagada';
      statusLabel = 'Pagada';
      paidCount += 1;

      const lastPaymentDate =
        item.payments && item.payments.length > 0
          ? item.payments[item.payments.length - 1].date
          : undefined;
      if (item.issueDate && lastPaymentDate) {
        const diff = diffCalendarDays(item.issueDate, lastPaymentDate);
        if (diff >= 0) collectionDurations.push(diff);
      }
    } else if (daysUntilDue < 0) {
      status = 'vencida';
      statusLabel = `Vencida (${daysOverdue} d.)`;
      overdueCount += 1;
      overdueAmount += pendingBalance;

      const key = item.clientName.trim().toLowerCase() || 'sin-nombre';
      const prev = lateClientMap.get(key) ?? {
        clientName: item.clientName.trim() || 'Cliente sin nombre',
        overdueCount: 0,
        totalOverdueAmount: 0,
        maxDaysOverdue: 0,
      };
      lateClientMap.set(key, {
        clientName: prev.clientName,
        overdueCount: prev.overdueCount + 1,
        totalOverdueAmount: prev.totalOverdueAmount + pendingBalance,
        maxDaysOverdue: Math.max(prev.maxDaysOverdue, daysOverdue),
      });
    } else if (daysUntilDue <= 7) {
      status = 'proxima';
      statusLabel = daysUntilDue === 0 ? 'Vence hoy' : `Vence en ${daysUntilDue} d.`;
      upcomingCount += 1;
    } else {
      status = 'pendiente';
      statusLabel = `Pendiente (${daysUntilDue} d.)`;
      pendingCount += 1;
    }

    return {
      item,
      pendingBalance,
      daysOverdue,
      daysUntilDue,
      status,
      statusLabel,
    };
  });

  // Ordenar: vencidas primero, luego próximas, pendientes y pagadas al final
  const rank: Record<DocumentPaymentStatus, number> = {
    vencida: 0,
    proxima: 1,
    pendiente: 2,
    pagada: 3,
  };
  items.sort((a, b) => rank[a.status] - rank[b.status] || a.daysUntilDue - b.daysUntilDue);

  const averageCollectionDays =
    collectionDurations.length > 0
      ? Math.round(
          (collectionDurations.reduce((s, d) => s + d, 0) / collectionDurations.length) * 10
        ) / 10
      : null;

  const lateClientAlerts = Array.from(lateClientMap.values()).sort(
    (a, b) => b.overdueCount - a.overdueCount || b.totalOverdueAmount - a.totalOverdueAmount
  );

  return {
    items,
    totalBilled,
    totalCollected,
    totalPending,
    pendingCount,
    upcomingCount,
    overdueCount,
    overdueAmount,
    paidCount,
    averageCollectionDays,
    lateClientAlerts,
  };
}

export interface EvaluatedPayable {
  item: AccountPayable;
  pendingBalance: number;
  daysOverdue: number;
  daysUntilDue: number;
  status: DocumentPaymentStatus;
  statusLabel: string;
  urgencyScore: number;
}

export interface PayablesSummary {
  items: EvaluatedPayable[];
  totalCommitted: number;
  totalPaid: number;
  totalPending: number;
  overdueCount: number;
  overdueAmount: number;
  upcomingCount: number;
  highPriorityAmount: number;
  pendingByCategory: Record<OperationalObligationCategory, number>;
}

export function calculatePayablesSummary(
  payables: AccountPayable[] = [],
  referenceDate: Date = new Date()
): PayablesSummary {
  const todayISO = toISODateLocal(referenceDate);
  let totalCommitted = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let upcomingCount = 0;
  let highPriorityAmount = 0;

  const pendingByCategory: Record<OperationalObligationCategory, number> = {
    proveedores: 0,
    remuneraciones: 0,
    impuestos: 0,
    credito: 0,
    otros: 0,
  };

  const priorityWeight: Record<PayablePriority, number> = {
    alta: 30,
    media: 15,
    baja: 5,
  };

  const items: EvaluatedPayable[] = payables.map((item) => {
    const amount = Math.max(0, Number(item.amount) || 0);
    const paidAmount = Math.min(amount, Math.max(0, Number(item.paidAmount) || 0));
    const pendingBalance = Math.max(0, amount - paidAmount);

    totalCommitted += amount;
    totalPaid += paidAmount;
    totalPending += pendingBalance;

    const daysUntilDue = item.dueDate ? diffCalendarDays(todayISO, item.dueDate) : 0;
    const daysOverdue = pendingBalance > 0 && daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

    let status: DocumentPaymentStatus = 'pendiente';
    let statusLabel = 'Pendiente';

    if (pendingBalance <= 0.01) {
      status = 'pagada';
      statusLabel = 'Pagada';
    } else {
      pendingByCategory[item.category] = (pendingByCategory[item.category] ?? 0) + pendingBalance;
      if (item.priority === 'alta') {
        highPriorityAmount += pendingBalance;
      }

      if (daysUntilDue < 0) {
        status = 'vencida';
        statusLabel = `Vencida (${daysOverdue} d.)`;
        overdueCount += 1;
        overdueAmount += pendingBalance;
      } else if (daysUntilDue <= 7) {
        status = 'proxima';
        statusLabel = daysUntilDue === 0 ? 'Vence hoy' : `Vence en ${daysUntilDue} d.`;
        upcomingCount += 1;
      } else {
        status = 'pendiente';
        statusLabel = `Pendiente (${daysUntilDue} d.)`;
      }
    }

    const urgencyScore =
      pendingBalance <= 0.01
        ? -100
        : (status === 'vencida' ? 100 : status === 'proxima' ? 60 : 20) +
          (priorityWeight[item.priority] ?? 10) -
          Math.min(20, Math.max(-20, daysUntilDue));

    return {
      item,
      pendingBalance,
      daysOverdue,
      daysUntilDue,
      status,
      statusLabel,
      urgencyScore,
    };
  });

  items.sort((a, b) => b.urgencyScore - a.urgencyScore);

  return {
    items,
    totalCommitted,
    totalPaid,
    totalPending,
    overdueCount,
    overdueAmount,
    upcomingCount,
    highPriorityAmount,
    pendingByCategory,
  };
}

/* ============================================================================
 * 2. GESTIÓN INTELIGENTE DE INVENTARIO
 * ============================================================================ */

export type ProductStockStatus =
  | 'agotado'
  | 'bajo_minimo'
  | 'baja_rotacion'
  | 'saludable'
  | 'sin_control';

export interface ProductInventoryRow {
  product: ProductItem;
  trackInventory: boolean;
  initialStock: number;
  purchasesIn: number;
  adjustmentsIn: number;
  salesOut: number;
  damageLossOut: number;
  currentStock: number;
  minStock: number;
  unitCost: number;
  initialInventoryValue: number;
  currentInventoryValue: number;
  costOfGoodsSoldReal: number;
  turnoverRatio: number | null;
  status: ProductStockStatus;
  statusLabel: string;
}

export interface InventorySummary {
  hasTrackedProducts: boolean;
  trackedCount: number;
  rows: ProductInventoryRow[];
  totalInitialValue: number;
  totalCurrentValue: number;
  totalCostOfGoodsSold: number;
  averageInventoryValue: number;
  globalTurnoverRatio: number | null;
  outOfStockProducts: ProductInventoryRow[];
  lowStockProducts: ProductInventoryRow[];
  slowMovingProducts: ProductInventoryRow[];
  fastMovingProducts: ProductInventoryRow[];
  totalDamageLossUnits: number;
  totalDamageLossValue: number;
}

export function calculateInventorySummary(business: BusinessWorkspace): InventorySummary {
  const movements = business.inventoryMovements ?? [];

  const rows: ProductInventoryRow[] = business.products.map((product) => {
    const initialStock = Math.max(0, Number(product.initialStock) || 0);
    const minStock = Math.max(0, Number(product.minStock) || 0);
    const prodMovements = movements.filter((m) => m.productId === product.id);
    const trackInventory =
      Boolean(product.trackInventory) || initialStock > 0 || prodMovements.length > 0;
    const unitCost = Math.max(0, Number(product.variableCost) || 0);

    let purchasesIn = 0;
    let adjustmentsIn = 0;
    let salesOut = 0;
    let damageLossOut = 0;
    let costOfGoodsSoldReal = 0;

    for (const mov of prodMovements) {
      const qty = Math.max(0, Number(mov.quantity) || 0);
      const movCost = Number(mov.unitCost) > 0 ? Number(mov.unitCost) : unitCost;
      if (mov.type === 'purchase') {
        purchasesIn += qty;
      } else if (mov.type === 'adjustment_in') {
        adjustmentsIn += qty;
      } else if (mov.type === 'sale') {
        salesOut += qty;
        costOfGoodsSoldReal += qty * movCost;
      } else if (mov.type === 'damage_loss') {
        damageLossOut += qty;
      }
    }

    const currentStock = Math.max(
      0,
      initialStock + purchasesIn + adjustmentsIn - salesOut - damageLossOut
    );
    const initialInventoryValue = initialStock * unitCost;
    const currentInventoryValue = currentStock * unitCost;
    const avgVal = (initialInventoryValue + currentInventoryValue) / 2;
    const turnoverRatio =
      trackInventory && avgVal > 0 && costOfGoodsSoldReal > 0
        ? costOfGoodsSoldReal / avgVal
        : null;

    let status: ProductStockStatus = 'sin_control';
    let statusLabel = 'Sin control de stock';

    if (trackInventory) {
      if (currentStock <= 0) {
        status = 'agotado';
        statusLabel = 'Agotado';
      } else if (minStock > 0 && currentStock <= minStock) {
        status = 'bajo_minimo';
        statusLabel = 'Bajo stock mínimo';
      } else if (currentStock > 0 && salesOut === 0 && initialStock + purchasesIn > 0) {
        status = 'baja_rotacion';
        statusLabel = 'Sin ventas registradas';
      } else if (turnoverRatio !== null && turnoverRatio < 0.4) {
        status = 'baja_rotacion';
        statusLabel = 'Baja rotación';
      } else {
        status = 'saludable';
        statusLabel = 'Stock saludable';
      }
    }

    return {
      product,
      trackInventory,
      initialStock,
      purchasesIn,
      adjustmentsIn,
      salesOut,
      damageLossOut,
      currentStock,
      minStock,
      unitCost,
      initialInventoryValue,
      currentInventoryValue,
      costOfGoodsSoldReal,
      turnoverRatio,
      status,
      statusLabel,
    };
  });

  const trackedRows = rows.filter((r) => r.trackInventory);
  const totalInitialValue = trackedRows.reduce((s, r) => s + r.initialInventoryValue, 0);
  const totalCurrentValue = trackedRows.reduce((s, r) => s + r.currentInventoryValue, 0);
  const totalCostOfGoodsSold = trackedRows.reduce((s, r) => s + r.costOfGoodsSoldReal, 0);
  const averageInventoryValue = (totalInitialValue + totalCurrentValue) / 2;

  const globalTurnoverRatio =
    trackedRows.length > 0 && averageInventoryValue > 0 && totalCostOfGoodsSold > 0
      ? totalCostOfGoodsSold / averageInventoryValue
      : null;

  const outOfStockProducts = trackedRows.filter((r) => r.status === 'agotado');
  const lowStockProducts = trackedRows.filter((r) => r.status === 'bajo_minimo');
  const slowMovingProducts = trackedRows.filter(
    (r) =>
      r.currentStock > 0 &&
      (r.status === 'baja_rotacion' || (r.turnoverRatio !== null && r.turnoverRatio < 0.5))
  );
  const fastMovingProducts = trackedRows
    .filter((r) => r.turnoverRatio !== null && r.turnoverRatio >= 1)
    .sort((a, b) => (b.turnoverRatio ?? 0) - (a.turnoverRatio ?? 0));

  const totalDamageLossUnits = trackedRows.reduce((s, r) => s + r.damageLossOut, 0);
  const totalDamageLossValue = trackedRows.reduce(
    (s, r) => s + r.damageLossOut * r.unitCost,
    0
  );

  return {
    hasTrackedProducts: trackedRows.length > 0,
    trackedCount: trackedRows.length,
    rows,
    totalInitialValue,
    totalCurrentValue,
    totalCostOfGoodsSold,
    averageInventoryValue,
    globalTurnoverRatio,
    outOfStockProducts,
    lowStockProducts,
    slowMovingProducts,
    fastMovingProducts,
    totalDamageLossUnits,
    totalDamageLossValue,
  };
}

/* ============================================================================
 * 3. FLUJO DE CAJA INTELIGENTE (MENSUAL Y ANUAL)
 * ============================================================================ */

export interface CashFlowMonthRow {
  month: string;
  monthLabel: string;
  isActualMonth: boolean;
  openingBalance: number;
  /** Ingresos reales efectivamente cobrados */
  realInflows: number;
  /** Cobros programados de CxC en este mes según fecha estimada/vencimiento */
  scheduledArInflows: number;
  /** Ingresos proyectados por ventas futuras (cuando aún no hay cierre real del mes) */
  projectedSalesInflows: number;
  totalInflows: number;
  /** Egresos reales efectivamente pagados */
  realOutflows: number;
  /** Obligaciones CxP programadas por categoría */
  scheduledApOutflows: number;
  scheduledPayablesByCategory: Record<OperationalObligationCategory, number>;
  /** Egresos operativos proyectados para meses futuros sin registro real */
  projectedOperativeOutflows: number;
  totalOutflows: number;
  netCashFlow: number;
  closingBalance: number;
  hasLiquidityDeficit: boolean;
  deficitReason?: string;
}

export interface CashFlowAnalysisResult {
  hasCashData: boolean;
  initialCashBalance: number;
  /** Efectivo real disponible hoy = saldo inicial + ingresos cobrados - egresos pagados (NUNCA incluye CxC pendientes) */
  currentAvailableCash: number;
  /** CxC abiertas vencidas o anteriores al mes actual pendientes de gestión */
  overdueReceivablesPending: number;
  /** CxP abiertas vencidas que exigen pago inmediato */
  overduePayablesPending: number;
  rows: CashFlowMonthRow[];
  annualTotalInflows: number;
  annualTotalOutflows: number;
  annualNetCashFlow: number;
  endingProjectedBalance: number;
  deficitMonths: CashFlowMonthRow[];
  lowestCashMonth: CashFlowMonthRow | null;
}

export function calculateCashFlowProjection(
  business: BusinessWorkspace,
  referenceDate: Date = new Date()
): CashFlowAnalysisResult {
  const projections = buildMonthlyProjections(business);
  const currentMonth = getCurrentYearMonth();
  const initialCashBalance = Number(business.initialCashBalance) || 0;
  const receivables = business.receivables ?? [];
  const payables = business.payables ?? [];

  // Calcular efectivo real disponible HOY considerando exclusivamente ingresos y egresos reales históricos/actuales
  let cumulativeRealIncome = 0;
  let cumulativeRealExpense = 0;
  let totalRealRecords = 0;

  for (const [monthKey, rec] of Object.entries(business.actuals ?? {})) {
    const summary = summarizeActualRecord(monthKey, rec);
    if (summary.hasData) {
      totalRealRecords += 1;
      cumulativeRealIncome += summary.income;
      cumulativeRealExpense += summary.totalExpense;
    }
  }

  const currentAvailableCash = initialCashBalance + cumulativeRealIncome - cumulativeRealExpense;

  // Mapear CxC pendientes por mes esperado de cobro (solo si saldo > 0)
  const arByMonth = new Map<string, number>();
  let overdueReceivablesPending = 0;

  for (const ar of receivables) {
    const pending = Math.max(0, (Number(ar.amount) || 0) - (Number(ar.paidAmount) || 0));
    if (pending <= 0.01) continue;
    const expectedDate = ar.expectedCollectionDate || ar.dueDate || '';
    const monthKey = expectedDate.slice(0, 7);
    if (!monthKey || monthKey < currentMonth) {
      overdueReceivablesPending += pending;
    } else {
      arByMonth.set(monthKey, (arByMonth.get(monthKey) ?? 0) + pending);
    }
  }

  // Mapear CxP pendientes por mes de vencimiento
  const apByMonth = new Map<string, number>();
  const apCatByMonth = new Map<string, Record<OperationalObligationCategory, number>>();
  let overduePayablesPending = 0;

  for (const ap of payables) {
    const pending = Math.max(0, (Number(ap.amount) || 0) - (Number(ap.paidAmount) || 0));
    if (pending <= 0.01) continue;
    const monthKey = (ap.dueDate || '').slice(0, 7);
    if (!monthKey || monthKey < currentMonth) {
      overduePayablesPending += pending;
    } else {
      apByMonth.set(monthKey, (apByMonth.get(monthKey) ?? 0) + pending);
      const bucket = apCatByMonth.get(monthKey) ?? {
        proveedores: 0,
        remuneraciones: 0,
        impuestos: 0,
        credito: 0,
        otros: 0,
      };
      bucket[ap.category] = (bucket[ap.category] ?? 0) + pending;
      apCatByMonth.set(monthKey, bucket);
    }
  }

  let runningBalance = initialCashBalance;
  const rows: CashFlowMonthRow[] = [];

  // Si existen registros reales anteriores al startMonth, ajustamos el saldo inicial del rango
  for (const [monthKey, rec] of Object.entries(business.actuals ?? {})) {
    if (projections.length > 0 && monthKey < projections[0].month) {
      const s = summarizeActualRecord(monthKey, rec);
      if (s.hasData) {
        runningBalance += s.income - s.totalExpense;
      }
    }
  }

  for (const proj of projections) {
    const actualSummary = summarizeActualRecord(proj.month, business.actuals?.[proj.month]);
    const isPastOrCurrent = proj.month <= currentMonth;
    const isActualMonth = actualSummary.hasData;

    const realInflows = actualSummary.income;
    const realOutflows = actualSummary.totalExpense;

    const scheduledArInflows = arByMonth.get(proj.month) ?? 0;
    const scheduledApOutflows = apByMonth.get(proj.month) ?? 0;
    const scheduledPayablesByCategory = apCatByMonth.get(proj.month) ?? {
      proveedores: 0,
      remuneraciones: 0,
      impuestos: 0,
      credito: 0,
      otros: 0,
    };

    // En meses futuros (o mes actual sin registros reales aún), consideramos proyección comercial
    const useProjectedCommerce = !isActualMonth && proj.month >= currentMonth;
    const projectedSalesInflows = useProjectedCommerce ? proj.projectedRevenue : 0;
    const projectedOperativeOutflows = useProjectedCommerce ? proj.projectedTotalCosts : 0;

    // En el mes actual con pagos pendientes vencidos anteriores, los descontamos como exigibles inmediatos en la verificación de liquidez
    const overdueImmediateAp = proj.month === currentMonth ? overduePayablesPending : 0;

    const totalInflows = realInflows + scheduledArInflows + projectedSalesInflows;
    const totalOutflows = realOutflows + scheduledApOutflows + projectedOperativeOutflows;
    const netCashFlow = totalInflows - totalOutflows;
    const openingBalance = runningBalance;
    const closingBalance = openingBalance + netCashFlow;
    runningBalance = closingBalance;

    const effectiveAvailableWithOverdue = closingBalance - overdueImmediateAp;
    const hasLiquidityDeficit =
      closingBalance < 0 ||
      (isPastOrCurrent && effectiveAvailableWithOverdue < 0) ||
      (scheduledApOutflows > 0 && openingBalance + realInflows + projectedSalesInflows < scheduledApOutflows);

    let deficitReason: string | undefined;
    if (closingBalance < 0) {
      deficitReason = 'El saldo proyectado final cae en negativo frente a egresos y compromisos.';
    } else if (isPastOrCurrent && effectiveAvailableWithOverdue < 0) {
      deficitReason =
        'El efectivo actual no alcanza a cubrir cuentas por pagar vencidas acumuladas.';
    } else if (
      scheduledApOutflows > 0 &&
      openingBalance + realInflows + projectedSalesInflows < scheduledApOutflows
    ) {
      deficitReason =
        'Las obligaciones por pagar programadas superan la caja antes de recaudar cuentas por cobrar.';
    }

    rows.push({
      month: proj.month,
      monthLabel: proj.monthLabel,
      isActualMonth,
      openingBalance,
      realInflows,
      scheduledArInflows,
      projectedSalesInflows,
      totalInflows,
      realOutflows,
      scheduledApOutflows,
      scheduledPayablesByCategory,
      projectedOperativeOutflows,
      totalOutflows,
      netCashFlow,
      closingBalance,
      hasLiquidityDeficit,
      deficitReason,
    });
  }

  const first12 = rows.slice(0, 12);
  const annualTotalInflows = first12.reduce((s, r) => s + r.totalInflows, 0);
  const annualTotalOutflows = first12.reduce((s, r) => s + r.totalOutflows, 0);
  const annualNetCashFlow = annualTotalInflows - annualTotalOutflows;
  const endingProjectedBalance =
    first12.length > 0 ? first12[first12.length - 1].closingBalance : currentAvailableCash;

  const deficitMonths = rows.filter((r) => r.hasLiquidityDeficit);
  const lowestCashMonth =
    rows.length > 0
      ? rows.reduce((min, r) => (r.closingBalance < min.closingBalance ? r : min), rows[0])
      : null;

  const hasCashData =
    Boolean(business.cashBalanceConfigured) ||
    initialCashBalance !== 0 ||
    totalRealRecords > 0 ||
    receivables.length > 0 ||
    payables.length > 0 ||
    business.products.length > 0 ||
    business.fixedCosts.length > 0;

  void referenceDate;

  return {
    hasCashData,
    initialCashBalance,
    currentAvailableCash,
    overdueReceivablesPending,
    overduePayablesPending,
    rows,
    annualTotalInflows,
    annualTotalOutflows,
    annualNetCashFlow,
    endingProjectedBalance,
    deficitMonths,
    lowestCashMonth,
  };
}

/* ============================================================================
 * 4. CAPITAL DE TRABAJO (ACTIVO CORRIENTE - PASIVO CORRIENTE)
 * ============================================================================ */

export interface WorkingCapitalMonthPoint {
  month: string;
  monthLabel: string;
  currentAssets: number;
  currentLiabilities: number;
  netWorkingCapital: number;
}

export interface WorkingCapitalResult {
  hasEnoughData: boolean;
  // Desglose Activo Corriente
  cashAndEquivalents: number;
  accountsReceivableNet: number;
  inventoryValue: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  // Desglose Pasivo Corriente
  accountsPayableSuppliersAndOps: number;
  pendingTaxes: number;
  pendingPayroll: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  // Neto y ratios
  netWorkingCapital: number;
  currentRatio: number | null;
  isNegative: boolean;
  evolution: WorkingCapitalMonthPoint[];
}

export function calculateWorkingCapital(
  business: BusinessWorkspace,
  cashFlow?: CashFlowAnalysisResult,
  arSummary?: ReceivablesSummary,
  apSummary?: PayablesSummary,
  inventorySummary?: InventorySummary
): WorkingCapitalResult {
  const cf = cashFlow ?? calculateCashFlowProjection(business);
  const ar = arSummary ?? calculateReceivablesSummary(business.receivables);
  const ap = apSummary ?? calculatePayablesSummary(business.payables);
  const inv = inventorySummary ?? calculateInventorySummary(business);

  const extras = business.workingCapitalExtras ?? {};
  const cashAndEquivalents = cf.currentAvailableCash;
  const accountsReceivableNet = ar.totalPending;
  const inventoryValue = inv.totalCurrentValue;
  const otherCurrentAssets = Math.max(0, Number(extras.otherCurrentAssets) || 0);

  const totalCurrentAssets =
    cashAndEquivalents + accountsReceivableNet + inventoryValue + otherCurrentAssets;

  const accountsPayableSuppliersAndOps = ap.totalPending;
  const pendingTaxes = Math.max(0, Number(extras.pendingTaxes) || 0);
  const pendingPayroll = Math.max(0, Number(extras.pendingPayroll) || 0);
  const shortTermDebt = Math.max(0, Number(extras.shortTermDebt) || 0);
  const otherCurrentLiabilities = Math.max(0, Number(extras.otherCurrentLiabilities) || 0);

  const totalCurrentLiabilities =
    accountsPayableSuppliersAndOps +
    pendingTaxes +
    pendingPayroll +
    shortTermDebt +
    otherCurrentLiabilities;

  const netWorkingCapital = totalCurrentAssets - totalCurrentLiabilities;
  const currentRatio =
    totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : null;

  const hasEnoughData =
    Boolean(business.cashBalanceConfigured) ||
    cf.initialCashBalance !== 0 ||
    Object.keys(business.actuals ?? {}).length > 0 ||
    accountsReceivableNet > 0 ||
    accountsPayableSuppliersAndOps > 0 ||
    inventoryValue > 0 ||
    otherCurrentAssets > 0 ||
    totalCurrentLiabilities > 0;

  // Evolución mensual usando proyección de caja + activos/pasivos corrientes no cobrados aún
  const staticExtrasLiabilities =
    pendingTaxes + pendingPayroll + shortTermDebt + otherCurrentLiabilities;
  const currentMonth = getCurrentYearMonth();

  const evolution: WorkingCapitalMonthPoint[] = cf.rows.slice(0, 12).map((row) => {
    // En meses futuros, a medida que cobran CxC y pagan CxP en meses previos, reflejamos la caja proyectada + inventario + saldo remanente
    let openArRemaining = 0;
    for (const item of ar.items) {
      if (item.pendingBalance <= 0.01) continue;
      const expMonth = (item.item.expectedCollectionDate || item.item.dueDate || '').slice(0, 7);
      if (expMonth > row.month || (row.month <= currentMonth && expMonth < currentMonth)) {
        openArRemaining += item.pendingBalance;
      }
    }

    let openApRemaining = 0;
    for (const item of ap.items) {
      if (item.pendingBalance <= 0.01) continue;
      const dueMonth = (item.item.dueDate || '').slice(0, 7);
      if (dueMonth > row.month || (row.month <= currentMonth && dueMonth < currentMonth)) {
        openApRemaining += item.pendingBalance;
      }
    }

    const ca = row.closingBalance + openArRemaining + inventoryValue + otherCurrentAssets;
    const cl = openApRemaining + staticExtrasLiabilities;
    return {
      month: row.month,
      monthLabel: row.monthLabel,
      currentAssets: ca,
      currentLiabilities: cl,
      netWorkingCapital: ca - cl,
    };
  });

  return {
    hasEnoughData,
    cashAndEquivalents,
    accountsReceivableNet,
    inventoryValue,
    otherCurrentAssets,
    totalCurrentAssets,
    accountsPayableSuppliersAndOps,
    pendingTaxes,
    pendingPayroll,
    shortTermDebt,
    otherCurrentLiabilities,
    totalCurrentLiabilities,
    netWorkingCapital,
    currentRatio,
    isNegative: netWorkingCapital < 0,
    evolution,
  };
}

/* ============================================================================
 * 5. ANALISTA FINANCIERO INTELIGENTE (SOLO DATOS REALES, SIN INVENTAR CIFRAS)
 * ============================================================================ */

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info';

export interface FinancialInsight {
  id: string;
  area:
    | 'ventas'
    | 'costos'
    | 'rentabilidad'
    | 'flujo_caja'
    | 'capital_trabajo'
    | 'cobrar'
    | 'pagar'
    | 'inventario'
    | 'endeudamiento'
    | 'presupuesto';
  areaLabel: string;
  severity: InsightSeverity;
  title: string;
  explanation: string;
  recommendation: string;
}

export interface FinancialAnalystReport {
  healthScore: number | null;
  healthLabel: string;
  insights: FinancialInsight[];
  missingDataHints: string[];
  realMonthsCount: number;
}

export function generateFinancialAnalystReport(
  business: BusinessWorkspace
): FinancialAnalystReport {
  const c = business.currency;
  const currentMonth = getCurrentYearMonth();
  const projections = buildMonthlyProjections(business);
  const comparisons = projections.map((proj) =>
    compareMonthActualVsProjected({
      projected: proj,
      actualRecord: business.actuals[proj.month],
      business,
    })
  );

  const realMonths = comparisons
    .filter((cmp) => cmp.actual.hasData)
    .sort((a, b) => a.month.localeCompare(b.month));

  const ar = calculateReceivablesSummary(business.receivables);
  const ap = calculatePayablesSummary(business.payables);
  const inv = calculateInventorySummary(business);
  const cf = calculateCashFlowProjection(business);
  const wc = calculateWorkingCapital(business, cf, ar, ap, inv);

  const fixedNow = getTotalFixedCostsForMonth(business.fixedCosts, currentMonth);
  const be = calculateBreakEvenAndTarget({
    fixedCosts: fixedNow,
    products: business.products,
    targetProfit: business.targetProfit,
    expectedUnits: business.expectedMonthlyUnits,
  });

  const insights: FinancialInsight[] = [];
  const missingDataHints: string[] = [];

  // Verificar datos faltantes reales
  if (business.products.length === 0) {
    missingDataHints.push('Registra al menos un producto o servicio en Costos y Catálogo.');
  }
  if (business.fixedCosts.length === 0) {
    missingDataHints.push('Agrega tus costos fijos mensuales (arriendo, sueldos, servicios).');
  }
  if (realMonths.length === 0) {
    missingDataHints.push(
      'Registra ingresos y egresos reales en "Resultados Reales" para analizar evolución y desvíos.'
    );
  }
  if (!business.cashBalanceConfigured && (business.initialCashBalance ?? 0) === 0) {
    missingDataHints.push(
      'Define tu saldo inicial de caja real en "Proyección 12M → Flujo de Caja" para medir liquidez exacta.'
    );
  }
  if (!inv.hasTrackedProducts && business.products.length > 0) {
    missingDataHints.push(
      'Activa el control de inventario en tus productos físicos para calcular rotación y stock mínimo.'
    );
  }

  // 1. Evolución de ventas y costos reales (requiere >= 2 meses reales)
  if (realMonths.length >= 2) {
    const prev = realMonths[realMonths.length - 2];
    const latest = realMonths[realMonths.length - 1];

    if (prev.actual.income > 0) {
      const salesDeltaPct = ((latest.actual.income - prev.actual.income) / prev.actual.income) * 100;
      if (salesDeltaPct <= -12) {
        insights.push({
          id: 'sales-drop',
          area: 'ventas',
          areaLabel: 'Ingresos y Ventas',
          severity: 'warning',
          title: `Tus ingresos reales bajaron ${Math.abs(salesDeltaPct).toFixed(1)}% en ${latest.monthLabel}`,
          explanation: `Pasaste de ${formatCurrency(prev.actual.income, c)} en ${prev.monthLabel} a ${formatCurrency(latest.actual.income, c)} en ${latest.monthLabel}.`,
          recommendation:
            'Revisa qué productos disminuyeron su volumen y evalúa campañas de reactivación o promociones sobre tus ítems de mayor margen.',
        });
      } else if (salesDeltaPct >= 10) {
        insights.push({
          id: 'sales-growth',
          area: 'ventas',
          areaLabel: 'Ingresos y Ventas',
          severity: 'positive',
          title: `Crecimiento de ventas del +${salesDeltaPct.toFixed(1)}%`,
          explanation: `Tus ingresos reales subieron de ${formatCurrency(prev.actual.income, c)} a ${formatCurrency(latest.actual.income, c)}.`,
          recommendation:
            'Asegura stock de los productos más demandados y verifica que el aumento no se haya quedado solo en ventas a crédito sin cobrar.',
        });
      }
    }

    if (prev.actual.totalExpense > 0) {
      const expDeltaPct =
        ((latest.actual.totalExpense - prev.actual.totalExpense) / prev.actual.totalExpense) * 100;
      if (expDeltaPct >= 15) {
        insights.push({
          id: 'expense-spike',
          area: 'costos',
          areaLabel: 'Costos y Gastos',
          severity: 'warning',
          title: `Alza relevante de gastos (+${expDeltaPct.toFixed(1)}%) en ${latest.monthLabel}`,
          explanation: `Tus egresos subieron de ${formatCurrency(prev.actual.totalExpense, c)} a ${formatCurrency(latest.actual.totalExpense, c)}.`,
          recommendation:
            'Revisa el detalle de transacciones del mes para identificar si fue reposición puntual de insumos o un alza permanente que requiere ajustar precios.',
        });
      }
    }
  }

  // 2. Presupuesto vs Resultados reales (último mes real)
  if (realMonths.length >= 1) {
    const latest = realMonths[realMonths.length - 1];
    const ratio =
      latest.projected.projectedRevenue > 0
        ? (latest.actual.income / latest.projected.projectedRevenue) * 100
        : 0;
    if (latest.projected.projectedRevenue > 0 && ratio < 85) {
      insights.push({
        id: 'budget-gap',
        area: 'presupuesto',
        areaLabel: 'Presupuesto vs. Real',
        severity: 'warning',
        title: `Ventas reales bajo lo presupuestado en ${latest.monthLabel}`,
        explanation: `Recibiste ${formatCurrency(latest.actual.income, c)} frente a ${formatCurrency(latest.projected.projectedRevenue, c)} proyectados (${ratio.toFixed(1)}% de cumplimiento).`,
        recommendation:
          'Ajusta las metas de unidades en tu proyección o enfoca esfuerzo comercial en los productos con mejor margen unitario.',
      });
    } else if (latest.projected.projectedRevenue > 0 && ratio >= 100 && latest.actual.profit > 0) {
      insights.push({
        id: 'budget-beat',
        area: 'presupuesto',
        areaLabel: 'Presupuesto vs. Real',
        severity: 'positive',
        title: `Cumpliste tu presupuesto de ventas en ${latest.monthLabel}`,
        explanation: `Superaste la proyección en un ${(ratio - 100).toFixed(1)}% con utilidad real de ${formatCurrency(latest.actual.profit, c)}.`,
        recommendation:
          'Reserva parte de esa utilidad como colchón de capital de trabajo para meses de menor demanda.',
      });
    }
  }

  // 3. Rentabilidad y suficiencia de márgenes
  const lowMarginProducts = business.products.filter((p) => {
    const pct = getProductMarginPercent(p);
    return p.price > 0 && pct < 20;
  });
  if (lowMarginProducts.length > 0) {
    const names = lowMarginProducts.slice(0, 3).map((p) => p.name).join(', ');
    insights.push({
      id: 'low-margins',
      area: 'rentabilidad',
      areaLabel: 'Rentabilidad y Precios',
      severity: lowMarginProducts.some((p) => getProductContributionMargin(p) <= 0)
        ? 'critical'
        : 'warning',
      title: `${lowMarginProducts.length} producto(s) con margen bajo (< 20%)`,
      explanation: `Productos como ${names} dejan poco margen tras restar insumos, comisiones, impuestos, envío y tiempo personal.`,
      recommendation:
        'Evalúa subir precios, renegociar costos de insumos o venderlos en packs para mejorar el aporte hacia tus costos fijos.',
    });
  } else if (business.products.length > 0 && !be.isViable) {
    insights.push({
      id: 'negative-margin',
      area: 'rentabilidad',
      areaLabel: 'Rentabilidad y Precios',
      severity: 'critical',
      title: 'Margen de contribución promedio negativo o cero',
      explanation: 'Actualmente los costos variables unitarios igualan o superan al precio promedio de venta.',
      recommendation: 'Corrige tus precios o estructura de costos en Catálogo antes de escalar ventas.',
    });
  }

  // 4. Flujo de caja y liquidez (diferencia ventas registradas vs dinero efectivamente recibido)
  if (cf.deficitMonths.length > 0) {
    const firstDeficit = cf.deficitMonths[0];
    insights.push({
      id: 'cashflow-deficit',
      area: 'flujo_caja',
      areaLabel: 'Flujo de Caja',
      severity: 'critical',
      title: `Riesgo de déficit de liquidez detectado en ${firstDeficit.monthLabel}`,
      explanation: `Tu saldo proyectado cae a ${formatCurrency(firstDeficit.closingBalance, c)}. ${firstDeficit.deficitReason ?? ''}`,
      recommendation:
        'Acelera el cobro de cuentas por cobrar, reprograma pagos no prioritarios o evita compras excesivas de inventario antes de ese mes.',
    });
  } else if (cf.lowestCashMonth && cf.hasCashData) {
    insights.push({
      id: 'cashflow-lowest',
      area: 'flujo_caja',
      areaLabel: 'Flujo de Caja',
      severity: 'info',
      title: `Mes de menor liquidez proyectada: ${cf.lowestCashMonth.monthLabel}`,
      explanation: `Aunque no presentas déficit negativo, ese mes registra el saldo proyectado más ajustado (${formatCurrency(cf.lowestCashMonth.closingBalance, c)}).`,
      recommendation:
        'Planifica con anticipación el pago de impuestos, remuneraciones o compras grandes de ese período.',
    });
  }

  // Ventas pendientes de cobro vs efectivo recibido
  const totalSalesIncome = realMonths.reduce((s, r) => s + r.actual.income, 0);
  if (ar.totalPending > 0 && (totalSalesIncome === 0 || ar.totalPending > totalSalesIncome * 0.35)) {
    insights.push({
      id: 'credit-vs-cash-gap',
      area: 'flujo_caja',
      areaLabel: 'Ventas vs. Dinero Recibido',
      severity: 'warning',
      title: 'Parte importante de tus ventas aún no entra a caja',
      explanation: `Tienes ${formatCurrency(ar.totalPending, c)} en cuentas por cobrar pendientes frente a ${formatCurrency(cf.currentAvailableCash, c)} de efectivo disponible real.`,
      recommendation:
        'Recuerda que una venta a crédito no es dinero disponible todavía. Acorta plazos de pago o solicita abono inicial.',
    });
  }

  // 5. Capital de trabajo
  if (wc.hasEnoughData) {
    if (wc.isNegative) {
      insights.push({
        id: 'wc-negative',
        area: 'capital_trabajo',
        areaLabel: 'Capital de Trabajo',
        severity: 'critical',
        title: `Capital de trabajo negativo (${formatCurrency(wc.netWorkingCapital, c)})`,
        explanation: `Tus pasivos corrientes (${formatCurrency(wc.totalCurrentLiabilities, c)}) superan tus activos corrientes (${formatCurrency(wc.totalCurrentAssets, c)}).`,
        recommendation:
          'Prioriza convertir inventario y cobranzas en caja líquida, y renegocia plazos de corto plazo para recuperar margen de maniobra.',
      });
    } else {
      insights.push({
        id: 'wc-positive',
        area: 'capital_trabajo',
        areaLabel: 'Capital de Trabajo',
        severity: 'positive',
        title: `Capital de trabajo positivo: ${formatCurrency(wc.netWorkingCapital, c)}`,
        explanation: `Tu activo corriente cubre ${wc.currentRatio ? `${wc.currentRatio.toFixed(2)}x` : 'holgadamente'} tus obligaciones de corto plazo.`,
        recommendation:
          'Mantén equilibrada la proporción entre caja líquida, cobranzas e inventario sin inmovilizar capital en exceso.',
      });
    }
  }

  // 6. Cuentas por cobrar
  if (ar.overdueCount > 0) {
    insights.push({
      id: 'ar-overdue',
      area: 'cobrar',
      areaLabel: 'Cuentas por Cobrar',
      severity: 'critical',
      title: `${ar.overdueCount} documento(s) vencido(s) por cobrar (${formatCurrency(ar.overdueAmount, c)})`,
      explanation:
        ar.lateClientAlerts.length > 0
          ? `Principal atraso con ${ar.lateClientAlerts[0].clientName} (hasta ${ar.lateClientAlerts[0].maxDaysOverdue} días de atraso).`
          : 'Existen facturas o ventas a crédito cuya fecha de vencimiento ya pasó.',
      recommendation:
        'Gestiona cobranza hoy mismo y considera pedir pago contra entrega a clientes con atrasos recurrentes.',
    });
  }

  // 7. Cuentas por pagar y endeudamiento
  const immediateObligations = ap.totalPending + wc.pendingTaxes + wc.pendingPayroll + wc.shortTermDebt;
  if (ap.overdueCount > 0 || (immediateObligations > 0 && immediateObligations > Math.max(0, cf.currentAvailableCash))) {
    insights.push({
      id: 'ap-pressure',
      area: 'pagar',
      areaLabel: 'Cuentas por Pagar y Deuda',
      severity: ap.overdueCount > 0 ? 'critical' : 'warning',
      title:
        ap.overdueCount > 0
          ? `${ap.overdueCount} pago(s) vencido(s) por ${formatCurrency(ap.overdueAmount, c)}`
          : 'Obligaciones pendientes superan la caja disponible actual',
      explanation: `Tus obligaciones de corto plazo suman ${formatCurrency(immediateObligations, c)} frente a ${formatCurrency(cf.currentAvailableCash, c)} disponibles en caja hoy.`,
      recommendation:
        'Prioriza impuestos, remuneraciones y proveedores críticos, y coordina fechas de pago con los cobros estimados.',
    });
  }

  if (wc.shortTermDebt > 0 && realMonths.length > 0) {
    const avgMonthlyRev =
      realMonths.reduce((s, r) => s + r.actual.income, 0) / realMonths.length;
    if (avgMonthlyRev > 0 && wc.shortTermDebt > avgMonthlyRev * 0.5) {
      insights.push({
        id: 'debt-load',
        area: 'endeudamiento',
        areaLabel: 'Endeudamiento',
        severity: 'warning',
        title: 'Carga financiera de corto plazo elevada respecto a tus ventas',
        explanation: `Tus cuotas/deudas de corto plazo (${formatCurrency(wc.shortTermDebt, c)}) equivalen a más del 50% de tu venta mensual real promedio.`,
        recommendation:
          'Evita tomar nueva deuda de corto plazo hasta estabilizar liquidez o refinanciar a menor cuota mensual.',
      });
    }
  }

  // 8. Inventario
  if (inv.hasTrackedProducts) {
    if (inv.outOfStockProducts.length > 0 || inv.lowStockProducts.length > 0) {
      const affected = [...inv.outOfStockProducts, ...inv.lowStockProducts]
        .slice(0, 3)
        .map((r) => r.product.name)
        .join(', ');
      insights.push({
        id: 'inv-reorder',
        area: 'inventario',
        areaLabel: 'Inventario',
        severity: inv.outOfStockProducts.length > 0 ? 'critical' : 'warning',
        title: `${inv.outOfStockProducts.length} agotado(s) y ${inv.lowStockProducts.length} bajo stock mínimo`,
        explanation: `Productos críticos para reposición: ${affected}.`,
        recommendation:
          'Planifica compra o reposición priorizando los artículos que más margen aportan y verificando disponibilidad en tu flujo de caja.',
      });
    }

    if (inv.slowMovingProducts.length > 0) {
      const immobilizedVal = inv.slowMovingProducts.reduce(
        (s, r) => s + r.currentInventoryValue,
        0
      );
      if (immobilizedVal > 0) {
        insights.push({
          id: 'inv-slow',
          area: 'inventario',
          areaLabel: 'Inventario',
          severity: 'info',
          title: `Capital inmovilizado en ${inv.slowMovingProducts.length} producto(s) de baja rotación`,
          explanation: `Tienes ${formatCurrency(immobilizedVal, c)} en stock con baja o nula salida registrada.`,
          recommendation:
            'Evalúa liquidaciones, combos o descuentos dirigidos para transformar ese inventario quieto en liquidez.',
        });
      }
    }
  }

  // Puntaje solo cuando hay datos suficientes
  let healthScore: number | null = null;
  let healthLabel = 'Faltan datos para calcular';

  if (realMonths.length > 0 || wc.hasEnoughData) {
    let score = 78;
    for (const ins of insights) {
      if (ins.severity === 'critical') score -= 18;
      else if (ins.severity === 'warning') score -= 9;
      else if (ins.severity === 'positive') score += 5;
    }
    healthScore = Math.max(10, Math.min(100, Math.round(score)));
    if (healthScore >= 80) healthLabel = 'Salud financiera sólida';
    else if (healthScore >= 60) healthLabel = 'Estable con alertas por atender';
    else if (healthScore >= 40) healthLabel = 'Liquidez o márgenes ajustados';
    else healthLabel = 'Requiere acción prioritaria';
  }

  const orderSeverity: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    positive: 2,
    info: 3,
  };
  insights.sort((a, b) => orderSeverity[a.severity] - orderSeverity[b.severity]);

  return {
    healthScore,
    healthLabel,
    insights,
    missingDataHints,
    realMonthsCount: realMonths.length,
  };
}

/* ============================================================================
 * 6. AUTOMATIZACIÓN E INTEGRACIÓN ENTRE MÓDULOS (SIN DUPLICACIONES)
 * ============================================================================ */

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Registra una venta a crédito:
 * - Crea la Cuenta por Cobrar (NO entra como efectivo disponible hasta cobrar)
 * - Si se asocia un producto y unidades, descuenta el stock mediante InventoryMovement(sale)
 */
export function buildCreditSalePatch(
  business: BusinessWorkspace,
  params: {
    clientName: string;
    documentRef: string;
    issueDate: string;
    dueDate: string;
    expectedCollectionDate?: string;
    amount: number;
    productId?: string;
    units?: number;
    notes?: string;
  }
): Partial<BusinessWorkspace> {
  const arId = makeId('ar');
  const nextReceivable: AccountReceivable = {
    id: arId,
    clientName: params.clientName.trim(),
    documentRef: params.documentRef.trim() || 'Venta a crédito',
    issueDate: params.issueDate,
    dueDate: params.dueDate,
    expectedCollectionDate: params.expectedCollectionDate || params.dueDate,
    amount: Math.max(0, params.amount),
    paidAmount: 0,
    payments: [],
    productId: params.productId || undefined,
    units: params.units && params.units > 0 ? Math.round(params.units) : undefined,
    notes: params.notes?.trim() || undefined,
  };

  let nextMovements = business.inventoryMovements ?? [];
  if (params.productId && params.units && params.units > 0) {
    const prod = business.products.find((p) => p.id === params.productId);
    if (prod) {
      const mov: InventoryMovement = {
        id: makeId('inv'),
        productId: prod.id,
        date: params.issueDate,
        type: 'sale',
        quantity: Math.round(params.units),
        unitCost: Math.max(0, Number(prod.variableCost) || 0),
        note: `Venta a crédito (${nextReceivable.documentRef})`,
        linkedReceivableId: arId,
      };
      nextMovements = [mov, ...nextMovements];
    }
  }

  return {
    receivables: [nextReceivable, ...(business.receivables ?? [])],
    inventoryMovements: nextMovements,
  };
}

/**
 * Registra un cobro real sobre una Cuenta por Cobrar:
 * - Reduce saldo pendiente de la CxC
 * - Agrega un movimiento real de ingreso efectivo en el mes del cobro (actualizando caja real)
 */
export function buildCollectReceivablePatch(
  business: BusinessWorkspace,
  params: {
    receivableId: string;
    paymentDate: string;
    amount: number;
    note?: string;
  }
): Partial<BusinessWorkspace> {
  const list = business.receivables ?? [];
  const target = list.find((r) => r.id === params.receivableId);
  if (!target) return {};

  const remaining = Math.max(0, target.amount - target.paidAmount);
  const cleanAmt = Math.min(remaining, Math.max(0, Number(params.amount) || 0));
  if (cleanAmt <= 0) return {};

  const txId = makeId('tx');
  const payId = makeId('pay');
  const monthKey = (params.paymentDate || toISODateLocal(new Date())).slice(0, 7);

  const nextReceivables = list.map((r) =>
    r.id === target.id
      ? {
          ...r,
          paidAmount: r.paidAmount + cleanAmt,
          payments: [
            ...(r.payments ?? []),
            {
              id: payId,
              date: params.paymentDate,
              amount: cleanAmt,
              note: params.note?.trim() || undefined,
              linkedTransactionId: txId,
            },
          ],
        }
      : r
  );

  const existingRecord = business.actuals[monthKey] ?? {
    month: monthKey,
    transactions: [],
  };
  const newTx: ActualTransaction = {
    id: txId,
    date: params.paymentDate,
    description: `Cobro ${target.clientName} (${target.documentRef})`,
    type: 'income',
    amount: cleanAmt,
    productId: target.productId,
    units: target.paidAmount === 0 && cleanAmt >= target.amount ? target.units : undefined,
    linkedAccountId: target.id,
  };

  return {
    receivables: nextReceivables,
    actuals: {
      ...business.actuals,
      [monthKey]: {
        ...existingRecord,
        month: monthKey,
        transactions: [newTx, ...(existingRecord.transactions ?? [])],
      },
    },
  };
}

/**
 * Registra una compra de inventario:
 * - Agrega movimiento de entrada de inventario
 * - Si es al contado, genera un egreso variable real en caja
 * - Si es a crédito proveedor, genera una Cuenta por Pagar (sin descontar caja todavía)
 */
export function buildInventoryPurchasePatch(
  business: BusinessWorkspace,
  params: {
    productId: string;
    date: string;
    quantity: number;
    unitCost: number;
    paymentMode: 'cash' | 'credit';
    supplierName?: string;
    documentRef?: string;
    dueDate?: string;
    note?: string;
  }
): Partial<BusinessWorkspace> {
  const prod = business.products.find((p) => p.id === params.productId);
  if (!prod) return {};

  const qty = Math.max(1, Math.round(params.quantity));
  const unitCost = Math.max(0, params.unitCost);
  const totalCost = qty * unitCost;
  const movId = makeId('inv');

  if (params.paymentMode === 'credit') {
    const apId = makeId('ap');
    const newAp: AccountPayable = {
      id: apId,
      supplierName: params.supplierName?.trim() || 'Proveedor insumos',
      documentRef: params.documentRef?.trim() || `Compra ${prod.name}`,
      category: 'proveedores',
      issueDate: params.date,
      dueDate: params.dueDate || params.date,
      amount: totalCost,
      paidAmount: 0,
      priority: 'alta',
      payments: [],
      notes: params.note?.trim() || `${qty} u. de ${prod.name}`,
    };

    const mov: InventoryMovement = {
      id: movId,
      productId: prod.id,
      date: params.date,
      type: 'purchase',
      quantity: qty,
      unitCost,
      note: params.note?.trim() || `Compra a crédito (${newAp.supplierName})`,
      linkedPayableId: apId,
    };

    return {
      products: business.products.map((p) =>
        p.id === prod.id ? { ...p, trackInventory: true } : p
      ),
      inventoryMovements: [mov, ...(business.inventoryMovements ?? [])],
      payables: [newAp, ...(business.payables ?? [])],
    };
  }

  // Compra pagada al contado -> registra egreso real inmediato
  const txId = makeId('tx');
  const monthKey = params.date.slice(0, 7);
  const existingRecord = business.actuals[monthKey] ?? {
    month: monthKey,
    transactions: [],
  };

  const mov: InventoryMovement = {
    id: movId,
    productId: prod.id,
    date: params.date,
    type: 'purchase',
    quantity: qty,
    unitCost,
    note: params.note?.trim() || 'Compra de inventario al contado',
    linkedTransactionId: txId,
  };

  const newTx: ActualTransaction = {
    id: txId,
    date: params.date,
    description: `Compra inventario: ${prod.name} (${qty} u.)`,
    type: 'variable_expense',
    amount: totalCost,
    productId: prod.id,
    units: qty,
    expenseCategory: 'proveedores',
    linkedInventoryMovementId: movId,
  };

  return {
    products: business.products.map((p) =>
      p.id === prod.id ? { ...p, trackInventory: true } : p
    ),
    inventoryMovements: [mov, ...(business.inventoryMovements ?? [])],
    actuals: {
      ...business.actuals,
      [monthKey]: {
        ...existingRecord,
        month: monthKey,
        transactions: [newTx, ...(existingRecord.transactions ?? [])],
      },
    },
  };
}

/**
 * Registra un pago real sobre una Cuenta por Pagar:
 * - Reduce saldo pendiente de la CxP
 * - Crea un movimiento real de egreso efectivo en caja en la fecha del pago
 */
export function buildPayPayablePatch(
  business: BusinessWorkspace,
  params: {
    payableId: string;
    paymentDate: string;
    amount: number;
    note?: string;
  }
): Partial<BusinessWorkspace> {
  const list = business.payables ?? [];
  const target = list.find((p) => p.id === params.payableId);
  if (!target) return {};

  const remaining = Math.max(0, target.amount - target.paidAmount);
  const cleanAmt = Math.min(remaining, Math.max(0, Number(params.amount) || 0));
  if (cleanAmt <= 0) return {};

  const txId = makeId('tx');
  const payId = makeId('pay');
  const monthKey = (params.paymentDate || toISODateLocal(new Date())).slice(0, 7);

  const nextPayables = list.map((p) =>
    p.id === target.id
      ? {
          ...p,
          paidAmount: p.paidAmount + cleanAmt,
          payments: [
            ...(p.payments ?? []),
            {
              id: payId,
              date: params.paymentDate,
              amount: cleanAmt,
              note: params.note?.trim() || undefined,
              linkedTransactionId: txId,
            },
          ],
        }
      : p
  );

  const existingRecord = business.actuals[monthKey] ?? {
    month: monthKey,
    transactions: [],
  };

  const txType =
    target.category === 'proveedores'
      ? 'variable_expense'
      : target.category === 'remuneraciones' || target.category === 'impuestos'
        ? 'fixed_expense'
        : 'other_expense';

  const newTx: ActualTransaction = {
    id: txId,
    date: params.paymentDate,
    description: `Pago ${target.supplierName} (${target.documentRef})`,
    type: txType,
    amount: cleanAmt,
    expenseCategory: target.category,
    linkedAccountId: target.id,
  };

  return {
    payables: nextPayables,
    actuals: {
      ...business.actuals,
      [monthKey]: {
        ...existingRecord,
        month: monthKey,
        transactions: [newTx, ...(existingRecord.transactions ?? [])],
      },
    },
  };
}

/* ============================================================================
 * 7. EXPLÍCAME TODO CON PERAS Y MANZANAS (NARRADOR SIMPLE DETERMINÍSTICO)
 * ============================================================================ */

export type SimpleTopicMood = 'good' | 'attention' | 'urgent' | 'missing';

export interface SimpleTopicCard {
  id: string;
  numberLabel: string;
  title: string;
  simpleQuestion: string;
  mood: SimpleTopicMood;
  moodLabel: string;
  highlightValue: string;
  highlightCaption: string;
  explanation: string;
  analogyOrTip: string;
  targetTab: ViewTab;
  targetSubTab?: string;
  actionLabel: string;
}

export interface SimpleActionStep {
  id: string;
  priorityLabel: string;
  title: string;
  reason: string;
  targetTab: ViewTab;
  targetSubTab?: string;
  buttonLabel: string;
}

export interface SimpleGlossaryEntry {
  term: string;
  plainMeaning: string;
  yourExample: string;
}

export interface SimpleExplanationStory {
  businessName: string;
  activeMonthLabel: string;
  overallMood: SimpleTopicMood;
  overallMoodLabel: string;
  analystGreeting: string;
  quickSnapshot: {
    availableCashText: string;
    breakEvenText: string;
    actualResultText: string;
  };
  cards: SimpleTopicCard[];
  actionSteps: SimpleActionStep[];
  glossary: SimpleGlossaryEntry[];
}

function mapAreaToNavigation(area: FinancialInsight['area']): {
  tab: ViewTab;
  subTab?: string;
  label: string;
} {
  switch (area) {
    case 'rentabilidad':
      return { tab: 'catalog', subTab: 'catalog', label: 'Revisar precios y costos' };
    case 'inventario':
      return { tab: 'catalog', subTab: 'inventory', label: 'Ver mi bodega' };
    case 'flujo_caja':
    case 'capital_trabajo':
    case 'endeudamiento':
      return { tab: 'projections', subTab: 'cashflow', label: 'Abrir flujo de caja' };
    case 'cobrar':
      return { tab: 'actuals', subTab: 'receivables', label: 'Ir a cobranzas' };
    case 'pagar':
      return { tab: 'actuals', subTab: 'payables', label: 'Ir a cuentas por pagar' };
    case 'ventas':
    case 'costos':
    case 'presupuesto':
      return { tab: 'actuals', subTab: 'cash', label: 'Ver movimientos reales' };
  }
}

export function buildSimpleApplesAndPearsStory(
  business: BusinessWorkspace
): SimpleExplanationStory {
  const c = business.currency;
  const currentMonth = getCurrentYearMonth();
  const projections = buildMonthlyProjections(business);
  const activeProj = projections.find((p) => p.month === currentMonth) ?? projections[0];
  const activeMonthKey = activeProj?.month ?? currentMonth;
  const activeMonthLabel = formatMonthLabel(activeMonthKey);

  const comparisons = projections.map((proj) =>
    compareMonthActualVsProjected({
      projected: proj,
      actualRecord: business.actuals[proj.month],
      business,
    })
  );
  const activeCmp = comparisons.find((cmp) => cmp.month === activeMonthKey) ?? comparisons[0];
  const latestRealCmp = comparisons
    .filter((cmp) => cmp.actual.hasData)
    .sort((a, b) => a.month.localeCompare(b.month))
    .at(-1);

  const fixedNow = getTotalFixedCostsForMonth(business.fixedCosts, activeMonthKey);
  const be = calculateBreakEvenAndTarget({
    fixedCosts: fixedNow,
    products: business.products,
    targetProfit: business.targetProfit,
    expectedUnits: business.expectedMonthlyUnits,
  });

  const ar = calculateReceivablesSummary(business.receivables);
  const ap = calculatePayablesSummary(business.payables);
  const inv = calculateInventorySummary(business);
  const cf = calculateCashFlowProjection(business);
  const wc = calculateWorkingCapital(business, cf, ar, ap, inv);
  const analyst = generateFinancialAnalystReport(business);

  // 1. Tu bolsillo hoy (Caja real vs. lo que viene)
  let cashCard: SimpleTopicCard;
  if (!cf.hasCashData) {
    cashCard = {
      id: 'cash',
      numberLabel: '01',
      title: 'Tu bolsillo hoy',
      simpleQuestion: '¿Cuánta plata real tengo disponible ahora mismo?',
      mood: 'missing',
      moodLabel: 'Falta tu saldo inicial',
      highlightValue: 'Sin definir',
      highlightCaption: 'Aún no anotas con cuánta plata partiste en caja o banco.',
      explanation:
        'Para decirte cuánta plata libre tienes hoy sin confundirla con ventas fiadas, primero necesitamos saber tu saldo inicial real.',
      analogyOrTip:
        'Piensa esto como mirar tu billetera antes de salir a comprar: si no cuentas los billetes reales, no sabes cuánto puedes gastar hoy.',
      targetTab: 'projections',
      targetSubTab: 'cashflow',
      actionLabel: 'Anotar mi saldo real',
    };
  } else {
    const hasDeficit = cf.deficitMonths.length > 0;
    const cashMood: SimpleTopicMood =
      cf.currentAvailableCash < 0 || hasDeficit
        ? 'urgent'
        : ar.totalPending > 0 && cf.currentAvailableCash < ap.totalPending
          ? 'attention'
          : 'good';
    const cashMoodLabel =
      cashMood === 'urgent'
        ? 'Ojo con la plata en caja'
        : cashMood === 'attention'
          ? 'Caja justa frente a deudas'
          : 'Bolsillo ordenado';

    const arMention =
      ar.totalPending > 0
        ? ` Aparte tienes ${formatCurrency(ar.totalPending, c)} que aún te deben clientes, pero esa plata NO la contamos hasta que te paguen.`
        : '';
    const deficitMention = hasDeficit
      ? ` Cuidado: en ${cf.deficitMonths[0].monthLabel} los gastos proyectados superan lo que habría en caja (${formatCurrency(cf.deficitMonths[0].closingBalance, c)}).`
      : ` En los próximos 12 meses no se ve ningún mes con la caja en rojo.`;

    cashCard = {
      id: 'cash',
      numberLabel: '01',
      title: 'Tu bolsillo hoy',
      simpleQuestion: '¿Cuánta plata real tengo disponible ahora mismo?',
      mood: cashMood,
      moodLabel: cashMoodLabel,
      highlightValue: formatCurrency(cf.currentAvailableCash, c),
      highlightCaption: 'Plata real en mano (no incluye lo que te deben)',
      explanation: `Hoy cuentas con ${formatCurrency(cf.currentAvailableCash, c)} reales tras sumar lo que realmente cobraste y restar lo que ya pagaste.${arMention}${deficitMention}`,
      analogyOrTip:
        'Regla de oro con peras y manzanas: una venta fiada es solo una promesa; solo cuenta como plata disponible cuando entra a tu cuenta o caja.',
      targetTab: 'projections',
      targetSubTab: 'cashflow',
      actionLabel: 'Ver flujo mes a mes',
    };
  }

  // 2. Equilibrio (¿Cuánto vender para no perder ni ganar?)
  let breakEvenCard: SimpleTopicCard;
  if (business.products.length === 0) {
    breakEvenCard = {
      id: 'breakeven',
      numberLabel: '02',
      title: 'El mínimo para no perder plata',
      simpleQuestion: '¿Cuánto necesito vender al mes para quedar en cero?',
      mood: 'missing',
      moodLabel: 'Faltan productos',
      highlightValue: 'Sin productos',
      highlightCaption: 'Agrega al menos 1 producto o servicio con precio y costo.',
      explanation:
        'Aún no sabemos a cuánto vendes ni cuánto te cuesta producir o comprar lo que ofreces.',
      analogyOrTip:
        'Si vendes manzanas a $1.000 y te cuestan $600, cada manzana te deja $400 libres para pagar tus cuentas del mes.',
      targetTab: 'catalog',
      targetSubTab: 'catalog',
      actionLabel: 'Cargar productos',
    };
  } else if (!be.isViable) {
    breakEvenCard = {
      id: 'breakeven',
      numberLabel: '02',
      title: 'El mínimo para no perder plata',
      simpleQuestion: '¿Cuánto necesito vender al mes para quedar en cero?',
      mood: 'urgent',
      moodLabel: 'Margen negativo o cero',
      highlightValue: 'Revisar precios',
      highlightCaption: 'Hoy lo que cobras no alcanza a cubrir el costo de cada venta.',
      explanation:
        'Tus productos o servicios cuestan casi lo mismo (o más) de lo que cobras por ellos. Vender más unidades así no te ayudará a cubrir los gastos fijos.',
      analogyOrTip:
        'Si cada empanada te cuesta $1.200 hacerla y la vendes a $1.000, mientras más empanadas vendes, más plata pierdes. Sube el precio o baja el costo primero.',
      targetTab: 'catalog',
      targetSubTab: 'catalog',
      actionLabel: 'Ajustar precios y costos',
    };
  } else {
    const breakEvenMood: SimpleTopicMood =
      be.expectedUnits > 0 && be.marginOfSafetyPercent < 10
        ? 'attention'
        : 'good';
    breakEvenCard = {
      id: 'breakeven',
      numberLabel: '02',
      title: 'El mínimo para no perder plata',
      simpleQuestion: '¿Cuánto necesito vender al mes para quedar en cero?',
      mood: breakEvenMood,
      moodLabel: breakEvenMood === 'good' ? 'Meta clara y viable' : 'Margen apretado',
      highlightValue: `${formatNumber(be.breakEvenUnits)} ventas/mes`,
      highlightCaption: `Equivale a vender ${formatCurrency(be.breakEvenRevenue, c)} al mes`,
      explanation: `Tus cuentas fijas del mes (como arriendo, sueldos o luz) suman ${formatCurrency(fixedNow, c)}. Con ${formatNumber(be.breakEvenUnits)} ventas cubres eso y quedas en $0; desde la venta ${formatNumber(be.breakEvenUnits + 1)} recién empiezas a ganar. Para lograr tu meta de ganar ${formatCurrency(business.targetProfit, c)}, necesitas ${formatNumber(be.targetTotalUnits)} ventas.`,
      analogyOrTip:
        'Imagina llenar un balde con gastos fijos en el fondo: las primeras ventas llenan ese fondo para no perder; todo lo que entra después es tu ganancia.',
      targetTab: 'calculator',
      actionLabel: 'Probar precios en calculadora',
    };
  }

  // 3. ¿Cómo va el mes frente a lo que imaginabas?
  let monthVsPlanCard: SimpleTopicCard;
  const cmpRef = activeCmp?.actual.hasData ? activeCmp : latestRealCmp;
  if (!cmpRef) {
    monthVsPlanCard = {
      id: 'month_vs_plan',
      numberLabel: '03',
      title: 'Cómo va tu mes real vs. tu plan',
      simpleQuestion: '¿Estoy ganando o perdiendo comparado con lo que planeé?',
      mood: 'missing',
      moodLabel: 'Sin movimientos reales aún',
      highlightValue: activeProj ? formatCurrency(activeProj.projectedProfit, c) : 'Sin registro',
      highlightCaption: activeProj
        ? `Ganancia que planeas en ${activeMonthLabel} (aún sin datos reales)`
        : 'Registra tus ventas y gastos reales del mes.',
      explanation:
        'Todavía no has anotado ventas ni gastos reales en "Resultados Reales", así que hoy solo vemos tu plan estimado en papel.',
      analogyOrTip:
        'Planear es dibujar el mapa del viaje; anotar tus ventas reales es mirar el velocímetro para saber si de verdad estás llegando.',
      targetTab: 'actuals',
      targetSubTab: 'cash',
      actionLabel: 'Anotar ventas y gastos reales',
    };
  } else {
    const mood: SimpleTopicMood =
      cmpRef.actual.profit < 0
        ? 'urgent'
        : cmpRef.status === 'good'
          ? 'good'
          : 'attention';
    const moodLabel =
      cmpRef.actual.profit < 0
        ? 'Mes con pérdida real'
        : cmpRef.status === 'good'
          ? 'Vas mejor o en meta'
          : 'Por debajo de tu meta';

    monthVsPlanCard = {
      id: 'month_vs_plan',
      numberLabel: '03',
      title: `Tu mes real (${cmpRef.monthLabel})`,
      simpleQuestion: '¿Estoy ganando o perdiendo comparado con lo que planeé?',
      mood,
      moodLabel,
      highlightValue: formatCurrency(cmpRef.actual.profit, c),
      highlightCaption: `Entraron ${formatCurrency(cmpRef.actual.income, c)} · Salieron ${formatCurrency(cmpRef.actual.totalExpense, c)}`,
      explanation: cmpRef.interpretation,
      analogyOrTip:
        cmpRef.actual.profit >= 0
          ? 'Que sobre plata al final del mes es buena señal; reserva un poquito para meses más flojos o emergencias.'
          : 'Cuando sale más plata de la que entra en el mes, revisa si subieron los insumos, faltaron ventas o pagaste compras grandes de una sola vez.',
      targetTab: 'actuals',
      targetSubTab: 'cash',
      actionLabel: 'Revisar detalle del mes',
    };
  }

  // 4. Plata que te deben y deudas que tienes (CxC y CxP)
  let arApCard: SimpleTopicCard;
  if (ar.items.length === 0 && ap.items.length === 0) {
    arApCard = {
      id: 'ar_ap',
      numberLabel: '04',
      title: 'Lo que te deben vs. lo que debes',
      simpleQuestion: '¿Quién me debe plata y a quién le tengo que pagar?',
      mood: 'missing',
      moodLabel: 'Sin fiados ni cuentas anotadas',
      highlightValue: `${formatCurrency(0, c)} / ${formatCurrency(0, c)}`,
      highlightCaption: 'No tienes facturas por cobrar ni por pagar registradas.',
      explanation:
        'Si vendes todo al contado y pagas todo al día, está perfecto. Si das crédito a clientes o debes facturas a proveedores, regístralas para que la app te avise antes de que venzan.',
      analogyOrTip:
        'Es como llevar dos libretas: una con los amigos que te quedaron debiendo y otra con los vecinos a los que tú les debes.',
      targetTab: 'actuals',
      targetSubTab: 'receivables',
      actionLabel: 'Registrar cobros o pagos',
    };
  } else {
    const mood: SimpleTopicMood =
      ar.overdueCount > 0 || ap.overdueCount > 0
        ? 'urgent'
        : ap.upcomingCount > 0 || ap.totalPending > ar.totalPending + Math.max(0, cf.currentAvailableCash)
          ? 'attention'
          : 'good';
    const moodLabel =
      mood === 'urgent'
        ? 'Hay documentos vencidos'
        : mood === 'attention'
          ? 'Pagos próximos por vigilar'
          : 'Cobros y pagos al día';

    const lateClientTxt =
      ar.lateClientAlerts.length > 0
        ? ` Ojo con ${ar.lateClientAlerts[0].clientName}, lleva ${ar.lateClientAlerts[0].maxDaysOverdue} días de atraso.`
        : '';
    const overdueApTxt =
      ap.overdueCount > 0
        ? ` Además tienes ${ap.overdueCount} deuda(s) vencida(s) por ${formatCurrency(ap.overdueAmount, c)}.`
        : ap.upcomingCount > 0
          ? ` Tienes ${ap.upcomingCount} pago(s) por vencer en los próximos 7 días.`
          : '';

    arApCard = {
      id: 'ar_ap',
      numberLabel: '04',
      title: 'Lo que te deben vs. lo que debes',
      simpleQuestion: '¿Quién me debe plata y a quién le tengo que pagar?',
      mood,
      moodLabel,
      highlightValue: `${formatCurrency(ar.totalPending, c)} por cobrar`,
      highlightCaption: `Y debes ${formatCurrency(ap.totalPending, c)} en cuentas por pagar`,
      explanation: `Te deben ${formatCurrency(ar.totalPending, c)} (${ar.overdueCount} vencida(s)) y tú debes ${formatCurrency(ap.totalPending, c)}.${lateClientTxt}${overdueApTxt}`,
      analogyOrTip:
        'Cobra primero lo atrasado antes de pedir prestado o atrasarte con tus proveedores: tu propia plata está en el bolsillo de quien aún no te paga.',
      targetTab: ar.overdueCount > 0 ? 'actuals' : 'actuals',
      targetSubTab: ar.overdueCount >= ap.overdueCount ? 'receivables' : 'payables',
      actionLabel: ar.overdueCount >= ap.overdueCount ? 'Ir a cobrar' : 'Ver deudas por pagar',
    };
  }

  // 5. Colchón para operar tranquilo (Capital de trabajo)
  let wcCard: SimpleTopicCard;
  if (!wc.hasEnoughData) {
    wcCard = {
      id: 'working_capital',
      numberLabel: '05',
      title: 'Tu colchón para operar tranquilo',
      simpleQuestion: '¿Me alcanza lo de corto plazo para pagar mis deudas cercanas?',
      mood: 'missing',
      moodLabel: 'Faltan datos de caja o deudas',
      highlightValue: 'Faltan datos',
      highlightCaption: 'Define tu caja inicial o registra deudas/inventario.',
      explanation:
        'Aún no hay suficientes datos de efectivo, cobros, stock o deudas cercanas para medir tu colchón operativo.',
      analogyOrTip:
        'El capital de trabajo es el aire que tienes bajo el agua para operar el mes sin ahogarte.',
      targetTab: 'projections',
      targetSubTab: 'cashflow',
      actionLabel: 'Completar datos de caja',
    };
  } else {
    const mood: SimpleTopicMood = wc.isNegative
      ? 'urgent'
      : wc.currentRatio !== null && wc.currentRatio < 1.2
        ? 'attention'
        : 'good';
    const moodLabel =
      mood === 'urgent'
        ? 'Colchón negativo (apretado)'
        : mood === 'attention'
          ? 'Colchón justo'
          : 'Buen respaldo de corto plazo';

    wcCard = {
      id: 'working_capital',
      numberLabel: '05',
      title: 'Tu colchón para operar tranquilo',
      simpleQuestion: '¿Me alcanza lo de corto plazo para pagar mis deudas cercanas?',
      mood,
      moodLabel,
      highlightValue: formatCurrency(wc.netWorkingCapital, c),
      highlightCaption: `A favor: ${formatCurrency(wc.totalCurrentAssets, c)} · Deudas cercanas: ${formatCurrency(wc.totalCurrentLiabilities, c)}`,
      explanation: wc.isNegative
        ? `Si juntaras hoy toda tu caja (${formatCurrency(wc.cashAndEquivalents, c)}), lo que te deben (${formatCurrency(wc.accountsReceivableNet, c)}) y tu mercadería (${formatCurrency(wc.inventoryValue, c)}), aún te faltarían ${formatCurrency(Math.abs(wc.netWorkingCapital), c)} para cubrir impuestos, sueldos y proveedores cercanos.`
        : `Sumando tu caja, lo que te deben y tu mercadería juntas ${formatCurrency(wc.totalCurrentAssets, c)}. Después de pagar todas tus deudas cercanas (${formatCurrency(wc.totalCurrentLiabilities, c)}), todavía te sobra un colchón de ${formatCurrency(wc.netWorkingCapital, c)}.`,
      analogyOrTip:
        'Con peras y manzanas: es saber si con lo que tienes a mano este mes puedes pagar las cuentas del mes y seguir comprando mercadería.',
      targetTab: 'projections',
      targetSubTab: 'cashflow',
      actionLabel: 'Ver detalle de capital',
    };
  }

  // 6. Mercadería en bodega (Inventario)
  let invCard: SimpleTopicCard;
  if (!inv.hasTrackedProducts) {
    invCard = {
      id: 'inventory',
      numberLabel: '06',
      title: 'Tu mercadería en bodega',
      simpleQuestion: '¿Cuánta plata tengo guardada en productos y qué falta reponer?',
      mood: 'missing',
      moodLabel: 'Control de stock apagado',
      highlightValue: 'Sin activar',
      highlightCaption: 'Actívalo en los productos físicos que guardas en bodega.',
      explanation:
        'Si vendes productos físicos, activa "Controlar inventario" en Costos y Catálogo para saber cuántas unidades quedan, cuánta plata tienes quieta en bodega y cuándo reponer.',
      analogyOrTip:
        'Cada producto guardado en la estantería es dinero en forma de mercadería. Si sabes cuántos quedan, no pierdes ventas por quedarte sin stock.',
      targetTab: 'catalog',
      targetSubTab: 'inventory',
      actionLabel: 'Activar mi inventario',
    };
  } else {
    const alertStockCount = inv.outOfStockProducts.length + inv.lowStockProducts.length;
    const mood: SimpleTopicMood =
      inv.outOfStockProducts.length > 0
        ? 'urgent'
        : alertStockCount > 0 || inv.slowMovingProducts.length > 0
          ? 'attention'
          : 'good';
    const moodLabel =
      inv.outOfStockProducts.length > 0
        ? `${inv.outOfStockProducts.length} producto(s) agotado(s)`
        : alertStockCount > 0
          ? `${alertStockCount} producto(s) por reponer`
          : inv.slowMovingProducts.length > 0
            ? 'Mercadería con salida lenta'
            : 'Bodega sana y en movimiento';

    const turnoverText =
      inv.globalTurnoverRatio !== null
        ? ` Tu mercadería se renovó ${inv.globalTurnoverRatio.toFixed(1)} veces en el período registrado.`
        : ' Aún faltan salidas o ventas registradas para calcular qué tan rápido rota tu stock.';
    const lossText =
      inv.totalDamageLossUnits > 0
        ? ` Se perdieron o dañaron ${formatNumber(inv.totalDamageLossUnits)} unidad(es) (${formatCurrency(inv.totalDamageLossValue, c)}).`
        : '';

    invCard = {
      id: 'inventory',
      numberLabel: '06',
      title: 'Tu mercadería en bodega',
      simpleQuestion: '¿Cuánta plata tengo guardada en productos y qué falta reponer?',
      mood,
      moodLabel,
      highlightValue: formatCurrency(inv.totalCurrentValue, c),
      highlightCaption: `${inv.trackedCount} producto(s) en control · ${inv.slowMovingProducts.length} con movimiento lento`,
      explanation: `Hoy tienes ${formatCurrency(inv.totalCurrentValue, c)} invertidos en mercadería lista para vender.${turnoverText}${lossText}`,
      analogyOrTip:
        'Un producto quieto en bodega es como tener billetes congelados en el refrigerador: si algo casi no se mueve, haz un combo o promoción para convertirlo en plata viva.',
      targetTab: 'catalog',
      targetSubTab: 'inventory',
      actionLabel: 'Revisar mi bodega',
    };
  }

  const cards: SimpleTopicCard[] = [
    cashCard,
    breakEvenCard,
    monthVsPlanCard,
    arApCard,
    wcCard,
    invCard,
  ];

  // Estado general + saludo humano del analista simulado
  const urgentCount = cards.filter((card) => card.mood === 'urgent').length;
  const attentionCount = cards.filter((card) => card.mood === 'attention').length;
  const missingCount = cards.filter((card) => card.mood === 'missing').length;

  let overallMood: SimpleTopicMood = 'good';
  let overallMoodLabel = 'Tu negocio va por buen camino';
  let analystGreeting =
    '¡Hola! Revisé todos tus números al día de hoy y las cuentas están claras y ordenadas. Aquí tienes tu resumen en palabras simples.';

  if (missingCount >= 4) {
    overallMood = 'missing';
    overallMoodLabel = 'Recién estamos armando la foto de tu negocio';
    analystGreeting =
      '¡Hola! Todavía nos faltan algunos datos clave (como tus productos, tu saldo inicial o tus ventas reales) para explicarte todo completo. Completa los puntos marcados y verás todo al instante.';
  } else if (urgentCount > 0) {
    overallMood = 'urgent';
    overallMoodLabel = `Hay ${urgentCount} tema(s) urgente(s) para cuidar tu plata`;
    analystGreeting =
      '¡Hola! Miré todos los números de tu negocio hoy y detecté alertas importantes de liquidez, deudas o stock que conviene atender primero. Te lo explico paso a paso y sin tecnicismos.';
  } else if (attentionCount > 0) {
    overallMood = 'attention';
    overallMoodLabel = 'El negocio funciona, pero hay detalles que vigilar';
    analystGreeting =
      '¡Hola! Tu negocio avanza bien en general, pero encontré algunos puntos donde conviene apretar un poco el control para que no te falte plata a fin de mes.';
  }

  // 3 pasos simples y concretos usando solo hallazgos/faltantes reales
  const actionSteps: SimpleActionStep[] = [];
  for (const ins of analyst.insights) {
    if (actionSteps.length >= 3) break;
    if (ins.severity !== 'critical' && ins.severity !== 'warning') continue;
    const dest = mapAreaToNavigation(ins.area);
    actionSteps.push({
      id: `step-${ins.id}`,
      priorityLabel: ins.severity === 'critical' ? 'Hacer primero' : 'Para mejorar',
      title: ins.title,
      reason: ins.recommendation,
      targetTab: dest.tab,
      targetSubTab: dest.subTab,
      buttonLabel: dest.label,
    });
  }

  if (actionSteps.length < 3) {
    for (const hint of analyst.missingDataHints) {
      if (actionSteps.length >= 3) break;
      const isCashHint = hint.toLowerCase().includes('saldo inicial');
      const isActualHint = hint.toLowerCase().includes('resultados reales');
      const isInvHint = hint.toLowerCase().includes('inventario');
      actionSteps.push({
        id: `hint-${actionSteps.length}`,
        priorityLabel: 'Completar dato',
        title: hint,
        reason: 'Mientras más datos reales anotes, más exactas serán tus alertas y consejos.',
        targetTab: isCashHint ? 'projections' : isActualHint ? 'actuals' : 'catalog',
        targetSubTab: isCashHint ? 'cashflow' : isActualHint ? 'cash' : isInvHint ? 'inventory' : 'catalog',
        buttonLabel: isCashHint
          ? 'Ir a Flujo de Caja'
          : isActualHint
            ? 'Ir a Resultados Reales'
            : 'Ir a Catálogo y Stock',
      });
    }
  }

  if (actionSteps.length === 0) {
    actionSteps.push({
      id: 'step-maintain',
      priorityLabel: 'Buen hábito',
      title: 'Mantén tus cobros, pagos y ventas al día cada semana',
      reason:
        'Hoy no tienes alertas rojas ni vencimientos críticos. Dedica 10 minutos a la semana para anotar tus boletas y seguir igual de ordenado.',
      targetTab: 'actuals',
      targetSubTab: 'cash',
      buttonLabel: 'Registrar movimientos',
    });
  }

  const glossary: SimpleGlossaryEntry[] = [
    {
      term: 'Punto de equilibrio',
      plainMeaning:
        'Es el mínimo exacto que debes vender en el mes para pagar todos tus gastos y quedar en $0 (ni ganas ni pierdes).',
      yourExample:
        business.products.length > 0 && be.isViable
          ? `Hoy en tu negocio necesitas ${formatNumber(be.breakEvenUnits)} ventas (${formatCurrency(be.breakEvenRevenue, c)}).`
          : 'Se calcula apenas agregues tus productos y gastos fijos.',
    },
    {
      term: 'Flujo de caja vs. Ventas',
      plainMeaning:
        'Vender es cerrar un trato o entregar una boleta; flujo de caja es cuándo entra y sale el dinero real por tu puerta o cuenta bancaria.',
      yourExample: cf.hasCashData
        ? `Hoy tienes ${formatCurrency(cf.currentAvailableCash, c)} en caja real y ${formatCurrency(ar.totalPending, c)} en ventas que aún no te pagan.`
        : 'Define tu saldo inicial para ver cuánta plata real tienes hoy.',
    },
    {
      term: 'Capital de trabajo',
      plainMeaning:
        'Es lo que tienes fácil de convertir en plata (caja + cobros + mercadería) menos lo que debes pagar pronto. Si da positivo, tienes oxígeno.',
      yourExample: wc.hasEnoughData
        ? `Tu capital de trabajo hoy es ${formatCurrency(wc.netWorkingCapital, c)}.`
        : 'Se calcula cuando tengas saldo inicial, cobros, deudas o stock.',
    },
    {
      term: 'Margen de contribución',
      plainMeaning:
        'Es lo que te sobra de cada venta después de pagar lo que cuesta producir, enviar y cobrar ese producto.',
      yourExample:
        business.products.length > 0
          ? `Por ejemplo, en "${business.products[0].name}" te quedan ${formatCurrency(getProductContributionMargin(business.products[0]), c)} libres por unidad (${getProductMarginPercent(business.products[0]).toFixed(0)}%).`
          : 'Agrega un producto para ver cuánto te deja libre cada venta.',
    },
    {
      term: 'Cuentas por cobrar / pagar',
      plainMeaning:
        'Por cobrar = plata que tus clientes todavía te deben. Por pagar = facturas, sueldos o impuestos que tú todavía debes.',
      yourExample: `Actualmente tienes ${formatCurrency(ar.totalPending, c)} por cobrar y ${formatCurrency(ap.totalPending, c)} por pagar.`,
    },
    {
      term: 'Rotación de inventario',
      plainMeaning:
        'Mide cuántas veces vendes y renuevas tu mercadería en un período. Mientras más rota, menos plata tienes atrapada en bodega.',
      yourExample:
        inv.hasTrackedProducts && inv.globalTurnoverRatio !== null
          ? `Tu stock rotó ${inv.globalTurnoverRatio.toFixed(1)} veces según tus ventas registradas.`
          : 'Activa inventario y registra compras/ventas para ver cuántas veces rota.',
    },
  ];

  const availableCashText = cf.hasCashData
    ? formatCurrency(cf.currentAvailableCash, c)
    : 'Sin definir';
  const breakEvenText =
    business.products.length > 0 && be.isViable
      ? `${formatNumber(be.breakEvenUnits)} ventas (${formatCurrency(be.breakEvenRevenue, c)})`
      : 'Por definir';
  const actualResultText = cmpRef
    ? `${formatCurrency(cmpRef.actual.profit, c)} (${cmpRef.monthLabel})`
    : 'Sin cierre real';

  return {
    businessName: business.name,
    activeMonthLabel,
    overallMood,
    overallMoodLabel,
    analystGreeting,
    quickSnapshot: {
      availableCashText,
      breakEvenText,
      actualResultText,
    },
    cards,
    actionSteps,
    glossary,
  };
}

