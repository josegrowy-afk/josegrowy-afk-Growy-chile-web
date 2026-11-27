import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMonthlyProjections,
  calculateBreakEvenAndTarget,
  compareMonthActualVsProjected,
  getFixedCostAmountForMonth,
  getProductContributionMargin,
  getProductCostBreakdown,
  getWeightedMixEconomics,
  simulateWhatIf,
} from './formulas.ts';
import type { BusinessWorkspace, FixedCost, ProductItem } from '../types/finance.ts';

test('Calcula margen promedio y punto de equilibrio correctamente', () => {
  const products: ProductItem[] = [
    { id: 'a', name: 'Producto A', category: 'Cat', price: 100, variableCost: 40 },
    { id: 'b', name: 'Producto B', category: 'Cat', price: 200, variableCost: 120 },
  ];
  // MCU_A = 60, MCU_B = 80 -> MCU promedio = 70, Precio promedio = 150
  const weighted = getWeightedMixEconomics(products);
  assert.equal(weighted.weightedUnitContribution, 70);
  assert.equal(weighted.weightedPrice, 150);

  // CF = 700 -> Equilibrio = 10 unidades, Ganancia objetivo = 350 -> 5 unidades adicionales = 15 unidades
  const res = calculateBreakEvenAndTarget({
    fixedCosts: 700,
    products,
    targetProfit: 350,
    expectedUnits: 20,
  });
  assert.equal(res.breakEvenUnits, 10);
  assert.equal(res.targetTotalUnits, 15);
  assert.equal(res.profitZoneUnits, 5);
  assert.equal(Math.round(res.breakEvenRevenue), 1500);
  // Con 20 unidades: MC total = 1400, Utilidad = 700, GAO = 1400 / 700 = 2
  assert.equal(res.expectedProfit, 700);
  assert.equal(res.operatingLeverage, 2);
});

test('Desglosa comisiones tarjeta %, impuestos %, envío y tiempo personal en costo unitario', () => {
  const product: ProductItem = {
    id: 'srv-1',
    name: 'Kit Artesanal',
    category: 'Pack',
    price: 1000,
    variableCost: 300,
    cardFeePercent: 3, // 30
    taxPercent: 19, // 190
    shippingCost: 80,
    personalTimeCost: 100,
  };

  const breakdown = getProductCostBreakdown(product);
  assert.equal(breakdown.baseVariableCost, 300);
  assert.equal(breakdown.cardFeeAmount, 30);
  assert.equal(breakdown.taxAmount, 190);
  assert.equal(breakdown.shippingCost, 80);
  assert.equal(breakdown.personalTimeCost, 100);
  assert.equal(breakdown.totalUnitVariableCost, 700);
  assert.equal(getProductContributionMargin(product), 300);

  const analysis = calculateBreakEvenAndTarget({
    fixedCosts: 3000,
    products: [product],
    targetProfit: 1500,
    expectedUnits: 20,
  });
  assert.equal(analysis.breakEvenUnits, 10);
  assert.equal(analysis.targetTotalUnits, 15);
  assert.equal(analysis.expectedVariableCosts, 14000);

  const biz: BusinessWorkspace = {
    id: 'b-cost',
    name: 'Test Costos',
    currency: { code: 'USD', symbol: 'US$', locale: 'en-US', decimals: 2 },
    startMonth: '2026-01',
    targetProfit: 1500,
    expectedMonthlyUnits: 10,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { 'srv-1': 10 },
    fixedCosts: [{ id: 'fc', name: 'Fijo', amount: 3000, category: 'otros' }],
    products: [product],
    projectionOverrides: {},
    actuals: {},
    updatedAt: '2026-01-01T00:00:00Z',
  };
  const proj = buildMonthlyProjections(biz);
  assert.equal(proj[0].projectedVariableCosts, 7000);
  assert.equal(proj[0].projectedProfit, 0);
});

test('Aplica cambio programado en costo fijo desde el mes indicado', () => {
  const cost: FixedCost = {
    id: 'fc-1',
    name: 'Arriendo',
    amount: 500,
    category: 'arriendo',
    scheduledChange: { effectiveFromMonth: '2026-04', newAmount: 650 },
  };
  assert.equal(getFixedCostAmountForMonth(cost, '2026-03'), 500);
  assert.equal(getFixedCostAmountForMonth(cost, '2026-04'), 650);
  assert.equal(getFixedCostAmountForMonth(cost, '2026-08'), 650);
});

test('Simulador ¿Y si...? recalcula sin mutar entradas originales', () => {
  const products: ProductItem[] = [
    { id: 'a', name: 'A', category: 'Cat', price: 100, variableCost: 50 },
  ];
  const sim = simulateWhatIf({
    fixedCosts: 1000,
    products,
    targetProfit: 500,
    expectedUnits: 30,
    priceDeltaPercent: 10, // Precio sube a 110 -> MCU = 60
    variableCostDeltaPercent: 0,
    fixedCostDeltaPercent: 0,
  });
  assert.equal(products[0].price, 100);
  assert.equal(sim.breakEvenUnits, Math.ceil(1000 / 60));
});

test('Comparación Proyectado vs Real clasifica estado e interpreta desvío', () => {
  const biz: BusinessWorkspace = {
    id: 'b1',
    name: 'Demo',
    currency: { code: 'USD', symbol: 'US$', locale: 'en-US', decimals: 2 },
    startMonth: '2026-01',
    targetProfit: 500,
    expectedMonthlyUnits: 20,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { a: 20 },
    fixedCosts: [{ id: 'f1', name: 'Fijo', amount: 500, category: 'otros' }],
    products: [{ id: 'a', name: 'A', category: 'C', price: 100, variableCost: 50 }],
    projectionOverrides: {},
    actuals: {},
    updatedAt: '2026-01-01T00:00:00Z',
  };
  const comp = compareMonthActualVsProjected({
    projected: {
      month: '2026-01',
      monthLabel: 'Ene 2026',
      monthIndex: 0,
      unitsByProduct: { a: 20 },
      totalUnits: 20,
      projectedRevenue: 2000,
      projectedVariableCosts: 1000,
      projectedFixedCosts: 500,
      projectedTotalCosts: 1500,
      projectedProfit: 500,
      breakEvenUnits: 10,
      breakEvenRevenue: 1000,
      isManualOverride: false,
    },
    actualRecord: {
      month: '2026-01',
      transactions: [
        { id: 't1', date: '2026-01-10', description: 'Ventas', type: 'income', amount: 2200 },
        { id: 't2', date: '2026-01-12', description: 'Gastos', type: 'fixed_expense', amount: 1400 },
      ],
    },
    business: biz,
  });
  assert.equal(comp.status, 'good');
  assert.equal(comp.actual.profit, 800);
  assert.ok(comp.interpretation.includes('superaste el punto de equilibrio'));
});

import {
  buildPaymentReminderNotification,
  buildReceiptNumber,
  computeAnnualDueDate,
  computeInitialNextDueDate,
  computeNextCycleDueDate,
  formatCLPAmount,
  getSubscriptionStatus,
} from './subscription.ts';
import {
  buildCollectReceivablePatch,
  buildCreditSalePatch,
  buildInventoryPurchasePatch,
  buildPayPayablePatch,
  buildSimpleApplesAndPearsStory,
  calculateCashFlowProjection,
  calculateInventorySummary,
  calculatePayablesSummary,
  calculateReceivablesSummary,
  calculateWorkingCapital,
  generateFinancialAnalystReport,
} from './smeIntelligence.ts';
import { getCurrentYearMonth } from './formulas.ts';
import type { UserProfile } from '../types/finance.ts';

test('Calcula fechas de pago mensual (5, 15, 30) y ajusta febrero correctamente', () => {
  // Si activa el 10 de febrero y elige día 30, al menos 15 días -> 28 de febrero (20 días >= 15)
  assert.equal(computeInitialNextDueDate(30, new Date(2026, 1, 10)), '2026-02-28');
  // Si activa el 20 de febrero y elige día 30 -> solo quedan 8 días en feb, pasa al 30 de marzo
  assert.equal(computeInitialNextDueDate(30, new Date(2026, 1, 20)), '2026-03-30');
  // Renovación desde 2026-01-30 para día 30 -> 2026-02-28
  assert.equal(computeNextCycleDueDate(30, '2026-01-30', new Date(2026, 0, 29)), '2026-02-28');
});

test('Detecta recordatorio (1 a 5 días) y bloqueo por vencimiento sin afectar al admin', () => {
  const client: UserProfile = {
    uid: 'u1',
    email: 'cliente@test.cl',
    displayName: 'Cliente',
    role: 'user',
    accessStatus: 'active',
    paymentStatus: 'paid',
    billingDay: 15,
    nextPaymentDueAt: '2026-05-15',
  };

  const statusReminder = getSubscriptionStatus(client, new Date(2026, 4, 12));
  assert.equal(statusReminder.daysUntilDue, 3);
  assert.equal(statusReminder.shouldShowReminder, true);
  assert.equal(statusReminder.isExpired, false);

  const statusExpired = getSubscriptionStatus(client, new Date(2026, 4, 15));
  assert.equal(statusExpired.daysUntilDue, 0);
  assert.equal(statusExpired.isExpired, true);

  const admin: UserProfile = {
    ...client,
    role: 'admin',
    email: 'jose.growy@gmail.com',
  };
  assert.equal(getSubscriptionStatus(admin, new Date(2026, 4, 20)).isExpired, false);

  const testClient: UserProfile = {
    ...client,
    role: 'user',
    email: 'matias.fonseca.luna@gmail.com',
    paymentStatus: 'manual_admin',
    nextPaymentDueAt: '2026-01-05',
  };
  const testStatus = getSubscriptionStatus(testClient, new Date(2026, 11, 20));
  assert.equal(testStatus.isExemptAdmin, false);
  assert.equal(testStatus.isComplimentary, true);
  assert.equal(testStatus.isExpired, false);
  assert.equal(testStatus.shouldShowReminder, false);
});

test('Plan anual ($49.990) omite cobro mensual, avisa a 15 días y bloquea al cumplir 12 meses', () => {
  const due = computeAnnualDueDate(null, new Date(2026, 3, 10));
  assert.equal(due, '2027-04-10');

  const annualUser: UserProfile = {
    uid: 'u-annual',
    email: 'anual@pyme.cl',
    displayName: 'Pyme Anual',
    role: 'user',
    accessStatus: 'active',
    paymentStatus: 'paid',
    planType: 'annual',
    nextPaymentDueAt: due,
  };

  // No exige elegir día mensual 5/15/30
  const midYear = getSubscriptionStatus(annualUser, new Date(2026, 9, 1));
  assert.equal(midYear.isAnnual, true);
  assert.equal(midYear.hasBillingDay, true);
  assert.equal(midYear.shouldShowReminder, false);
  assert.equal(midYear.isExpired, false);

  // Ventana de recordatorio de 15 días antes de vencer los 12 meses
  const nearEnd = getSubscriptionStatus(annualUser, new Date(2027, 3, 1));
  assert.equal(nearEnd.daysUntilDue, 9);
  assert.equal(nearEnd.shouldShowReminder, true);
  assert.equal(nearEnd.isExpired, false);

  // Al cumplirse los 12 meses exactos bloquea para renovar mensual o anual
  const expired = getSubscriptionStatus(annualUser, new Date(2027, 3, 10));
  assert.equal(expired.daysUntilDue, 0);
  assert.equal(expired.isExpired, true);
});

test('Flujo de caja excluye CxC pendientes del efectivo real y detecta déficit de liquidez', () => {
  const ym = getCurrentYearMonth();
  const baseBiz: BusinessWorkspace = {
    id: 'biz-cf',
    name: 'Comercializadora Sur',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: ym,
    targetProfit: 500000,
    expectedMonthlyUnits: 20,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 20 },
    fixedCosts: [{ id: 'f1', name: 'Arriendo', amount: 300000, category: 'arriendo' }],
    products: [{ id: 'p1', name: 'Caja Gourmet', category: 'Alimentos', price: 25000, variableCost: 10000 }],
    projectionOverrides: {},
    actuals: {
      [ym]: {
        month: ym,
        transactions: [
          { id: 'tx-1', date: `${ym}-05`, description: 'Venta contado', type: 'income', amount: 200000 },
          { id: 'tx-2', date: `${ym}-08`, description: 'Pago luz', type: 'fixed_expense', amount: 150000 },
        ],
      },
    },
    initialCashBalance: 100000,
    cashBalanceConfigured: true,
    receivables: [
      {
        id: 'ar-1',
        clientName: 'Restaurante A',
        documentRef: 'F-101',
        issueDate: `${ym}-02`,
        dueDate: `${ym}-25`,
        expectedCollectionDate: `${ym}-25`,
        amount: 600000,
        paidAmount: 0,
        payments: [],
      },
    ],
    payables: [
      {
        id: 'ap-1',
        supplierName: 'SII F29',
        documentRef: 'F29',
        category: 'impuestos',
        issueDate: `${ym}-01`,
        dueDate: `${ym}-18`,
        amount: 500000,
        paidAmount: 0,
        priority: 'alta',
        payments: [],
      },
    ],
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const cf = calculateCashFlowProjection(baseBiz);
  // Caja disponible hoy = 100.000 + 200.000 - 150.000 = 150.000 (NO suma los 600.000 de la CxC pendiente)
  assert.equal(cf.currentAvailableCash, 150000);
  // El mes actual detecta déficit porque la obligación CxP de 500.000 supera la caja antes de cobrar la CxC
  assert.ok(cf.deficitMonths.length >= 1);
  assert.equal(cf.rows[0].hasLiquidityDeficit, true);
});

test('Capital de trabajo = Activo Corriente - Pasivo Corriente y detecta valor negativo', () => {
  const ym = getCurrentYearMonth();
  const biz: BusinessWorkspace = {
    id: 'biz-wc',
    name: 'Taller WC',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: ym,
    targetProfit: 100000,
    expectedMonthlyUnits: 10,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 10 },
    fixedCosts: [],
    products: [
      { id: 'p1', name: 'Pieza', category: 'Taller', price: 10000, variableCost: 4000, trackInventory: true, initialStock: 10, minStock: 3 },
    ],
    projectionOverrides: {},
    actuals: {},
    initialCashBalance: 200000,
    cashBalanceConfigured: true,
    receivables: [
      {
        id: 'ar-wc',
        clientName: 'Cliente X',
        documentRef: 'F-1',
        issueDate: `${ym}-01`,
        dueDate: `${ym}-20`,
        amount: 100000,
        paidAmount: 0,
        payments: [],
      },
    ],
    payables: [
      {
        id: 'ap-wc',
        supplierName: 'Proveedor Y',
        documentRef: 'F-9',
        category: 'proveedores',
        issueDate: `${ym}-01`,
        dueDate: `${ym}-15`,
        amount: 450000,
        paidAmount: 0,
        priority: 'alta',
        payments: [],
      },
    ],
    workingCapitalExtras: {
      otherCurrentAssets: 20000,
      pendingTaxes: 50000,
      pendingPayroll: 0,
      shortTermDebt: 0,
      otherCurrentLiabilities: 0,
    },
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const wc = calculateWorkingCapital(biz);
  // Activo corriente = 200.000 (caja) + 100.000 (CxC) + 40.000 (10u * 4000) + 20.000 = 360.000
  assert.equal(wc.totalCurrentAssets, 360000);
  // Pasivo corriente = 450.000 (CxP) + 50.000 (impuestos) = 500.000
  assert.equal(wc.totalCurrentLiabilities, 500000);
  assert.equal(wc.netWorkingCapital, -140000);
  assert.equal(wc.isNegative, true);
});

test('Inventario calcula stock actual, valorización, mermas y rotación = Costo de ventas / Inventario promedio', () => {
  const ym = getCurrentYearMonth();
  const biz: BusinessWorkspace = {
    id: 'biz-inv',
    name: 'Tienda Inv',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: ym,
    targetProfit: 100000,
    expectedMonthlyUnits: 10,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 10 },
    fixedCosts: [],
    products: [
      {
        id: 'p1',
        name: 'Taza Cerámica',
        category: 'Hogar',
        price: 12000,
        variableCost: 5000,
        trackInventory: true,
        initialStock: 20, // valor inicial = 100.000
        minStock: 8,
      },
    ],
    inventoryMovements: [
      { id: 'm1', productId: 'p1', date: `${ym}-02`, type: 'purchase', quantity: 10, unitCost: 5000 },
      { id: 'm2', productId: 'p1', date: `${ym}-06`, type: 'sale', quantity: 20, unitCost: 5000 }, // COGS = 100.000
      { id: 'm3', productId: 'p1', date: `${ym}-07`, type: 'damage_loss', quantity: 4, unitCost: 5000 },
    ],
    projectionOverrides: {},
    actuals: {},
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const inv = calculateInventorySummary(biz);
  // Stock actual = 20 + 10 - 20 - 4 = 6 (<= minStock 8 -> bajo_minimo)
  assert.equal(inv.rows[0].currentStock, 6);
  assert.equal(inv.rows[0].status, 'bajo_minimo');
  assert.equal(inv.totalInitialValue, 100000);
  assert.equal(inv.totalCurrentValue, 30000);
  // Inventario promedio = (100.000 + 30.000) / 2 = 65.000 ; Rotación = 100.000 / 65.000
  assert.equal(inv.averageInventoryValue, 65000);
  assert.ok(Math.abs((inv.globalTurnoverRatio ?? 0) - 100000 / 65000) < 0.001);
});

test('Automatización entre módulos y Analista PYME operan sobre datos reales sin duplicar', () => {
  const ym = getCurrentYearMonth();
  let biz: BusinessWorkspace = {
    id: 'biz-auto',
    name: 'Café PYME',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: ym,
    targetProfit: 300000,
    expectedMonthlyUnits: 30,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 30 },
    fixedCosts: [{ id: 'f1', name: 'Arriendo', amount: 250000, category: 'arriendo' }],
    products: [
      { id: 'p1', name: 'Bolsa Café 500g', category: 'Café', price: 15000, variableCost: 6000, trackInventory: true, initialStock: 20, minStock: 5 },
    ],
    inventoryMovements: [],
    projectionOverrides: {},
    actuals: {},
    initialCashBalance: 100000,
    cashBalanceConfigured: true,
    receivables: [],
    payables: [],
    updatedAt: '2026-01-01T00:00:00Z',
  };

  // 1. Venta a crédito de 5 unidades por $75.000 -> crea CxC + descuenta stock, caja sigue en 100.000
  biz = {
    ...biz,
    ...buildCreditSalePatch(biz, {
      clientName: 'Hotel Lago',
      documentRef: 'F-500',
      issueDate: `${ym}-05`,
      dueDate: `${ym}-20`,
      amount: 75000,
      productId: 'p1',
      units: 5,
    }),
  };
  assert.equal(calculateCashFlowProjection(biz).currentAvailableCash, 100000);
  assert.equal(calculateInventorySummary(biz).rows[0].currentStock, 15);
  assert.equal(calculateReceivablesSummary(biz.receivables).totalPending, 75000);

  // 2. Compra a crédito de 10 unidades ($60.000) -> suma stock a 25 y crea CxP
  biz = {
    ...biz,
    ...buildInventoryPurchasePatch(biz, {
      productId: 'p1',
      date: `${ym}-06`,
      quantity: 10,
      unitCost: 6000,
      paymentMode: 'credit',
      supplierName: 'Tostaduría Central',
      documentRef: 'F-880',
      dueDate: `${ym}-25`,
    }),
  };
  assert.equal(calculateInventorySummary(biz).rows[0].currentStock, 25);
  assert.equal(calculatePayablesSummary(biz.payables).totalPending, 60000);

  // 3. Cobro real de la CxC -> baja CxC a 0 y sube caja real a 175.000
  const arId = biz.receivables![0].id;
  biz = {
    ...biz,
    ...buildCollectReceivablePatch(biz, {
      receivableId: arId,
      paymentDate: `${ym}-10`,
      amount: 75000,
    }),
  };
  assert.equal(calculateReceivablesSummary(biz.receivables).totalPending, 0);
  assert.equal(calculateCashFlowProjection(biz).currentAvailableCash, 175000);

  // 4. Pago real de la CxP -> baja CxP a 0 y caja real queda en 115.000
  const apId = biz.payables![0].id;
  biz = {
    ...biz,
    ...buildPayPayablePatch(biz, {
      payableId: apId,
      paymentDate: `${ym}-12`,
      amount: 60000,
    }),
  };
  assert.equal(calculatePayablesSummary(biz.payables).totalPending, 0);
  assert.equal(calculateCashFlowProjection(biz).currentAvailableCash, 115000);

  const report = generateFinancialAnalystReport(biz);
  assert.ok(report.healthScore !== null);
  assert.ok(report.insights.length > 0);
});

test('Explícame todo con peras y manzanas traduce datos reales y detecta datos faltantes sin inventar', () => {
  const ym = getCurrentYearMonth();
  const emptyBiz: BusinessWorkspace = {
    id: 'biz-empty',
    name: 'Emprendimiento Nuevo',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: ym,
    targetProfit: 0,
    expectedMonthlyUnits: 0,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: {},
    fixedCosts: [],
    products: [],
    projectionOverrides: {},
    actuals: {},
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const emptyStory = buildSimpleApplesAndPearsStory(emptyBiz);
  assert.equal(emptyStory.cards.length, 6);
  assert.equal(emptyStory.overallMood, 'missing');
  assert.equal(emptyStory.quickSnapshot.availableCashText, 'Sin definir');
  assert.ok(emptyStory.actionSteps.length > 0);

  const liveBiz: BusinessWorkspace = {
    ...emptyBiz,
    id: 'biz-live',
    name: 'Panadería Trigo Vivo',
    targetProfit: 300000,
    expectedMonthlyUnits: 100,
    baseMonthlyUnitsByProduct: { p1: 100 },
    fixedCosts: [{ id: 'f1', name: 'Arriendo', amount: 200000, category: 'arriendo' }],
    products: [
      {
        id: 'p1',
        name: 'Pan Masa Madre',
        category: 'Panadería',
        price: 5000,
        variableCost: 2000,
        trackInventory: true,
        initialStock: 30,
        minStock: 10,
      },
    ],
    initialCashBalance: 150000,
    cashBalanceConfigured: true,
    receivables: [
      {
        id: 'ar-1',
        clientName: 'Café Plaza',
        documentRef: 'B-12',
        issueDate: `${ym}-01`,
        dueDate: `${ym}-28`,
        amount: 90000,
        paidAmount: 0,
        payments: [],
      },
    ],
    actuals: {
      [ym]: {
        month: ym,
        transactions: [
          { id: 'tx-1', date: `${ym}-04`, description: 'Ventas mes', type: 'income', amount: 400000 },
          { id: 'tx-2', date: `${ym}-05`, description: 'Harina y arriendo', type: 'fixed_expense', amount: 220000 },
        ],
      },
    },
  };

  const liveStory = buildSimpleApplesAndPearsStory(liveBiz);
  assert.equal(liveStory.cards.length, 6);
  // Caja real = 150.000 + 400.000 - 220.000 = 330.000 (excluye los 90.000 fiados)
  assert.equal(liveStory.cards[0].highlightValue, '$330.000');
  assert.ok(liveStory.cards[0].explanation.includes('$90.000'));
  // Equilibrio = 200.000 / (5000 - 2000) = 67 ventas
  assert.ok(liveStory.cards[1].highlightValue.includes('67'));
  assert.equal(liveStory.glossary.length, 6);
});

test('Genera payload push antes del bloqueo mensual/anual y omite admin o cliente de prueba', () => {
  const monthlyClient: UserProfile = {
    uid: 'u-push-1',
    email: 'pyme@chile.cl',
    displayName: 'Pyme',
    role: 'user',
    accessStatus: 'active',
    paymentStatus: 'paid',
    planType: 'monthly',
    billingDay: 15,
    nextPaymentDueAt: '2026-05-15',
  };

  // Fuera de ventana (> 5 días antes) -> no envía push
  assert.equal(buildPaymentReminderNotification(monthlyClient, new Date(2026, 4, 1)), null);

  // Dentro de ventana (2 días antes) -> aviso antes del bloqueo con requireInteraction
  const dueSoon = buildPaymentReminderNotification(monthlyClient, new Date(2026, 4, 13));
  assert.ok(dueSoon);
  assert.equal(dueSoon.kind, 'reminder');
  assert.equal(dueSoon.daysUntilDue, 2);
  assert.equal(dueSoon.requireInteraction, true);
  assert.ok(dueSoon.body.includes('$5.990'));
  assert.ok(dueSoon.body.includes('bloqueada'));

  // Plan anual dentro de 15 días -> aviso anual $49.990
  const annualClient: UserProfile = {
    ...monthlyClient,
    planType: 'annual',
    nextPaymentDueAt: '2027-04-10',
  };
  const annualSoon = buildPaymentReminderNotification(annualClient, new Date(2027, 3, 1));
  assert.ok(annualSoon);
  assert.equal(annualSoon.kind, 'reminder');
  assert.equal(annualSoon.daysUntilDue, 9);
  assert.ok(annualSoon.body.includes('$49.990'));

  // Exentos: admin y cliente de prueba sin cobro nunca reciben avisos de bloqueo
  const admin: UserProfile = { ...monthlyClient, role: 'admin', email: 'jose.growy@gmail.com' };
  const testClient: UserProfile = {
    ...monthlyClient,
    email: 'matias.fonseca.luna@gmail.com',
  };
  assert.equal(buildPaymentReminderNotification(admin, new Date(2026, 4, 14)), null);
  assert.equal(buildPaymentReminderNotification(testClient, new Date(2026, 4, 14)), null);
});

test('Formatea montos CLP de lanzamiento y genera folio único de comprobante', () => {
  assert.equal(formatCLPAmount(5990), '$5.990');
  assert.equal(formatCLPAmount(49990), '$49.990');
  assert.equal(buildReceiptNumber('mp-12345678', '2026-11-14T10:00:00Z'), 'GRW-2026-12345678');
  assert.equal(buildReceiptNumber('ab', '2026-01-05'), 'GRW-2026-00AB');
});

