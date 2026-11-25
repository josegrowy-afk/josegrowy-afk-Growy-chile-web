import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_RATIO_GREEN_MIN,
  INVENTORY_DAYS_GREEN_MAX,
  IVA_DISCLAIMER_TEXT,
  QUICK_RATIO_GREEN_MIN,
  calculateArApAgingAndDurations,
  calculateCashAlertAndRunway,
  calculateFinancialRatiosWithStatus,
  calculateMonthlyIvaEstimate,
  calculateOwnerSalaryImpact,
  calculatePriceSensitivityTable,
  calculateSuggestedProductPrice,
} from './phase2Insights.ts';
import type { BusinessWorkspace } from '../types/finance.ts';

function makeSampleBusiness(overrides: Partial<BusinessWorkspace> = {}): BusinessWorkspace {
  return {
    id: 'biz-p2',
    name: 'Cafetería Flor de Lavanda',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: '2026-06',
    targetProfit: 300000,
    expectedMonthlyUnits: 200,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 200 },
    fixedCosts: [{ id: 'fc1', name: 'Arriendo taller', amount: 400000, category: 'arriendo' }],
    products: [
      {
        id: 'p1',
        name: 'Pack Café Artesanal',
        category: 'Café',
        price: 10000,
        variableCost: 4000,
        trackInventory: true,
        initialStock: 100,
      },
    ],
    projectionOverrides: {},
    actuals: {},
    initialCashBalance: 1500000,
    cashBalanceConfigured: true,
    receivables: [],
    payables: [],
    inventoryMovements: [],
    updatedAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

test('2.1 Alerta de caja y meses de caja disponible detecta déficit y calcula runway', () => {
  const refDate = new Date(2026, 5, 10);
  const tightBiz = makeSampleBusiness({
    initialCashBalance: 100000,
    expectedMonthlyUnits: 20,
    baseMonthlyUnitsByProduct: { p1: 20 }, // ingresos 200k vs costos 480k -> déficit inmediato
    payables: [
      {
        id: 'ap1',
        supplierName: 'Tostador Sur',
        documentRef: 'F-90',
        category: 'proveedores',
        issueDate: '2026-06-01',
        dueDate: '2026-06-20',
        amount: 350000,
        paidAmount: 0,
        priority: 'alta',
        payments: [],
      },
    ],
  });

  const alert = calculateCashAlertAndRunway(tightBiz, refDate);
  assert.equal(alert.status, 'rojo');
  assert.ok(alert.firstDeficitMonth !== null);
  assert.ok((alert.firstDeficitProjectedBalance ?? 0) < 0);
  assert.ok(alert.runwayMonths !== null && alert.runwayMonths < 1);

  const healthyBiz = makeSampleBusiness({
    initialCashBalance: 5500000, // ~3,4 meses frente a 1.600.000/mes de egresos
    expectedMonthlyUnits: 300,
    baseMonthlyUnitsByProduct: { p1: 300 },
  });
  const okAlert = calculateCashAlertAndRunway(healthyBiz, refDate);
  assert.equal(okAlert.firstDeficitMonth, null);
  assert.equal(okAlert.status, 'verde');
  assert.ok((okAlert.runwayMonths ?? 0) >= 3);

  const tightGreenAlert = calculateCashAlertAndRunway(
    makeSampleBusiness({
      initialCashBalance: 3200000, // ~2,0 meses -> amarillo (entre 1 y 3 meses)
      expectedMonthlyUnits: 300,
      baseMonthlyUnitsByProduct: { p1: 300 },
    }),
    refDate
  );
  assert.equal(tightGreenAlert.status, 'amarillo');

  // Caja en 0 o negativa no produce NaN ni infinito
  const negativeCash = calculateCashAlertAndRunway(
    makeSampleBusiness({ initialCashBalance: -50000 }),
    refDate
  );
  assert.equal(negativeCash.status, 'rojo');
  assert.equal(negativeCash.runwayMonths, 0);
});

test('2.2 Antigüedad de CxC y CxP clasifica en 0-30, 31-60, 61+ días y días promedio', () => {
  const refDate = new Date(2026, 6, 15); // 2026-07-15
  const biz = makeSampleBusiness({
    receivables: [
      {
        id: 'ar1',
        clientName: 'Cliente Reciente',
        documentRef: 'B-1',
        issueDate: '2026-07-05', // 10 días
        dueDate: '2026-07-20',
        amount: 100000,
        paidAmount: 0,
        payments: [],
      },
      {
        id: 'ar2',
        clientName: 'Cliente Medio',
        documentRef: 'F-2',
        issueDate: '2026-06-01', // 44 días
        dueDate: '2026-06-30',
        amount: 200000,
        paidAmount: 50000, // pendiente 150.000
        payments: [{ id: 'p1', date: '2026-06-15', amount: 50000 }],
      },
      {
        id: 'ar3',
        clientName: 'Cliente Antiguo',
        documentRef: 'F-3',
        issueDate: '2026-04-01', // 105 días
        dueDate: '2026-05-01',
        amount: 300000,
        paidAmount: 0,
        payments: [],
      },
      {
        id: 'ar4',
        clientName: 'Cliente Pagado',
        documentRef: 'F-4',
        issueDate: '2026-06-01',
        dueDate: '2026-06-30',
        amount: 80000,
        paidAmount: 80000,
        payments: [{ id: 'p2', date: '2026-06-21', amount: 80000 }], // 20 días
      },
    ],
    payables: [
      {
        id: 'ap1',
        supplierName: 'Proveedor Pagado',
        documentRef: 'FP-1',
        category: 'proveedores',
        issueDate: '2026-06-10',
        dueDate: '2026-06-25',
        amount: 90000,
        paidAmount: 90000,
        payments: [{ id: 'pp1', date: '2026-06-15', amount: 90000 }], // 5 días
        priority: 'alta',
      },
      {
        id: 'ap2',
        supplierName: 'Proveedor Antiguo',
        documentRef: 'FP-2',
        category: 'proveedores',
        issueDate: '2026-05-01', // 75 días
        dueDate: '2026-05-30',
        amount: 120000,
        paidAmount: 0,
        payments: [],
        priority: 'media',
      },
    ],
  });

  const aging = calculateArApAgingAndDurations(biz, refDate);
  assert.equal(aging.receivablesAging.totalPending, 550000);
  assert.equal(aging.receivablesAging.buckets[0].amount, 100000); // 0-30
  assert.equal(aging.receivablesAging.buckets[1].amount, 150000); // 31-60
  assert.equal(aging.receivablesAging.buckets[2].amount, 300000); // 61+
  assert.equal(aging.payablesAging.buckets[2].amount, 120000); // 61+
  assert.equal(aging.averageCollectionDays, 20);
  assert.equal(aging.averagePaymentDays, 5);
  assert.ok(aging.gapWarning !== null);
});

test('2.3 Razones financieras simples con semáforo: liquidez corriente, prueba ácida y días de inventario', () => {
  const biz = makeSampleBusiness({
    initialCashBalance: 1000000,
    products: [
      {
        id: 'p1',
        name: 'Pack Café',
        category: 'Café',
        price: 10000,
        variableCost: 4000,
        trackInventory: true,
        initialStock: 100, // 400.000
      },
    ],
    inventoryMovements: [
      {
        id: 'm1',
        productId: 'p1',
        date: '2026-06-15',
        type: 'sale',
        quantity: 60, // quedan 40u * 4000 = 160.000 inventario, COGS = 240.000/mes => 20 días!
        unitCost: 4000,
      },
    ],
    payables: [
      {
        id: 'ap1',
        supplierName: 'Arrendador',
        documentRef: 'R-1',
        category: 'otros',
        issueDate: '2026-06-01',
        dueDate: '2026-06-30',
        amount: 500000,
        paidAmount: 0,
        priority: 'alta',
        payments: [],
      },
    ],
  });

  const ratios = calculateFinancialRatiosWithStatus(biz);
  // Activos corrientes = 1.000.000 + 160.000 = 1.160.000 / 500.000 = 2.32x (verde >= 1.5)
  assert.ok((ratios.currentRatio.value ?? 0) >= CURRENT_RATIO_GREEN_MIN);
  assert.equal(ratios.currentRatio.status, 'verde');
  // Prueba ácida = 1.000.000 / 500.000 = 2.00x (verde >= 1.0)
  assert.ok((ratios.quickRatio.value ?? 0) >= QUICK_RATIO_GREEN_MIN);
  assert.equal(ratios.quickRatio.status, 'verde');
  // Días de inventario = (160.000 / 240.000) * 30 = 20 días (verde <= 45)
  assert.equal(ratios.inventoryDays.value, 20);
  assert.ok((ratios.inventoryDays.value ?? 999) <= INVENTORY_DAYS_GREEN_MAX);
  assert.equal(ratios.inventoryDays.status, 'verde');

  // División por cero en pasivo corriente = 0
  const debtFree = makeSampleBusiness({ payables: [], workingCapitalExtras: undefined });
  const debtFreeRatios = calculateFinancialRatiosWithStatus(debtFree);
  assert.equal(debtFreeRatios.currentRatio.value, null);
  assert.equal(debtFreeRatios.quickRatio.value, null);
});

test('2.4 Estimador de IVA mensual calcula débito vs crédito en modo IVA incluido y modo neto con disclaimer', () => {
  const actualsMonth = {
    '2026-06': {
      month: '2026-06',
      transactions: [
        {
          id: 't1',
          date: '2026-06-10',
          description: 'Ventas mes',
          type: 'income' as const,
          amount: 1190000,
        },
        {
          id: 't2',
          date: '2026-06-11',
          description: 'Compra insumos',
          type: 'variable_expense' as const,
          amount: 595000,
        },
      ],
    },
  };

  // Precios con IVA incluido: ventas 1.190.000 (IVA deb 190.000), compras 595.000 (IVA cred 95.000) => 95.000 a pagar
  const includedBiz = makeSampleBusiness({
    actuals: actualsMonth,
    ivaSettings: { enabled: true, pricesIncludeIva: true, f29Day: 20, ivaRatePercent: 19 },
  });
  const ivaIncl = calculateMonthlyIvaEstimate(includedBiz, '2026-06', new Date(2026, 5, 15));
  assert.equal(ivaIncl.ivaDebito, 190000);
  assert.equal(ivaIncl.ivaCredito, 95000);
  assert.equal(ivaIncl.ivaToPay, 95000);
  assert.equal(ivaIncl.declarationDueDateISO, '2026-07-20');
  assert.equal(ivaIncl.disclaimer, IVA_DISCLAIMER_TEXT);

  // Precios netos: ventas 1.000.000 neto, compras 1.500.000 neto => remanente a favor 95.000
  const netBiz = makeSampleBusiness({
    actuals: {
      '2026-06': {
        month: '2026-06',
        transactions: [
          { id: 't1', date: '2026-06-10', description: 'Ventas netas', type: 'income', amount: 1000000 },
          { id: 't2', date: '2026-06-12', description: 'Insumos netos', type: 'variable_expense', amount: 1500000 },
        ],
      },
    },
    ivaSettings: { enabled: true, pricesIncludeIva: false, f29Day: 12, ivaRatePercent: 19 },
  });
  const ivaNet = calculateMonthlyIvaEstimate(netBiz, '2026-06', new Date(2026, 5, 10));
  assert.equal(ivaNet.ivaDebito, 190000);
  assert.equal(ivaNet.ivaCredito, 285000);
  assert.equal(ivaNet.ivaToPay, 0);
  assert.equal(ivaNet.ivaFavorRemanente, 95000);
});

test('2.5 Sueldo del dueño alerta sobre utilidad ilusoria cuando falta y recalcula equilibrio cuando está activo', () => {
  const withoutSalary = makeSampleBusiness({ ownerSalary: { included: false, monthlyAmount: 600000 } });
  const impactOff = calculateOwnerSalaryImpact(withoutSalary, '2026-06');
  assert.equal(impactOff.hasIllusoryProfitRisk, true);
  assert.ok(impactOff.illusoryProfitWarning?.toLowerCase().includes('utilidad ilusoria'));
  assert.equal(impactOff.adjustedFixedCosts, 400000);

  const withSalary = makeSampleBusiness({ ownerSalary: { included: true, monthlyAmount: 600000 } });
  const impactOn = calculateOwnerSalaryImpact(withSalary, '2026-06');
  assert.equal(impactOn.hasIllusoryProfitRisk, false);
  assert.equal(impactOn.adjustedFixedCosts, 1000000);
  assert.equal(impactOn.baseBreakEvenUnits, 67); // 400k / 6k = 66.6 -> 67
  assert.equal(impactOn.adjustedBreakEvenUnits, 167); // 1M / 6k = 166.6 -> 167
  assert.equal(impactOn.extraBreakEvenUnits, 100);
});

test('2.6 Precio sugerido y tabla de sensibilidad -10%/-5%/+5%/+10% sin mutar datos', () => {
  const suggested = calculateSuggestedProductPrice({
    variableCost: 4000,
    shippingCost: 1000,
    cardFeePercent: 0,
    taxPercent: 0,
    targetMarginPercent: 50,
    decimals: 0,
  });
  assert.equal(suggested.isValid, true);
  assert.equal(suggested.suggestedPrice, 10000); // 5000 / (1 - 0.5) = 10000

  const impossible = calculateSuggestedProductPrice({
    variableCost: 4000,
    cardFeePercent: 10,
    taxPercent: 19,
    targetMarginPercent: 75, // 104% >= 100%
  });
  assert.equal(impossible.isValid, false);

  const products = makeSampleBusiness().products;
  const originalSnapshot = JSON.stringify(products);
  const rows = calculatePriceSensitivityTable({
    fixedCosts: 400000,
    products,
    targetProfit: 300000,
    expectedUnits: 120,
  });

  assert.equal(rows.length, 5);
  assert.equal(rows[2].isBaseline, true);
  assert.equal(rows[2].breakEvenUnits, 67); // actual: 400k / 6k = 67
  assert.ok(rows[4].breakEvenUnits < rows[2].breakEvenUnits); // subir +10% reduce unidades de equilibrio
  assert.ok(rows[0].breakEvenUnits > rows[2].breakEvenUnits); // bajar -10% aumenta unidades de equilibrio
  assert.equal(JSON.stringify(products), originalSnapshot); // cero mutación
});
