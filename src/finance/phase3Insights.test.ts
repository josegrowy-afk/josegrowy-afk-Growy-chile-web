import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildActualsTransactionsCsv,
  buildGuidedMonthCloseSummary,
  buildMonthlyExcelWorkbookXml,
  buildMonthlySummaryEmailPayload,
  buildReferralInviteCodeString,
  buildSalesCsvImportPatch,
  computeReferralBonusDueDate,
  calculateCashFlowScenarios,
  parseAndValidateSalesCsv,
  REFERRAL_BONUS_DAYS,
} from './phase3Insights.ts';
import type { BusinessWorkspace } from '../types/finance.ts';

function makePhase3Business(overrides: Partial<BusinessWorkspace> = {}): BusinessWorkspace {
  return {
    id: 'biz-p3',
    name: 'Café & Repostería Canela',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: '2026-06',
    targetProfit: 400000,
    expectedMonthlyUnits: 100,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 100 },
    fixedCosts: [{ id: 'fc1', name: 'Arriendo local', amount: 300000, category: 'arriendo' }],
    products: [
      {
        id: 'p1',
        name: 'Roll de Canela',
        category: 'Repostería',
        price: 5000,
        variableCost: 1500,
      },
    ],
    projectionOverrides: {},
    actuals: {
      '2026-06': {
        month: '2026-06',
        transactions: [
          {
            id: 'tx1',
            date: '2026-06-10',
            description: 'Ventas semana 1',
            type: 'income',
            amount: 620000,
            units: 124,
            productId: 'p1',
          },
          {
            id: 'tx2',
            date: '2026-06-05',
            description: 'Arriendo y servicios',
            type: 'fixed_expense',
            amount: 300000,
          },
          {
            id: 'tx3',
            date: '2026-06-14',
            description: 'Harina y mantequilla',
            type: 'variable_expense',
            amount: 180000,
          },
        ],
      },
    },
    initialCashBalance: 1000000,
    cashBalanceConfigured: true,
    receivables: [
      {
        id: 'ar1',
        clientName: 'Evento Empresa',
        documentRef: 'F-12',
        issueDate: '2026-05-01',
        dueDate: '2026-06-01',
        amount: 120000,
        paidAmount: 0,
        payments: [],
      },
    ],
    payables: [],
    inventoryMovements: [],
    updatedAt: '2026-06-15T00:00:00Z',
    ...overrides,
  };
}

test('3.1 Cierre de mes guiado calcula porcentaje de avance y explica desviaciones', () => {
  const refDate = new Date(2026, 5, 20); // 2026-06-20
  const biz = makePhase3Business({
    monthlyCloseChecklists: {
      '2026-06': {
        month: '2026-06',
        actualsChecked: true,
        receivablesPayablesChecked: true,
        comparedVsProjected: false,
        deviationsReviewed: false,
      },
    },
  });

  const summary = buildGuidedMonthCloseSummary(biz, '2026-06', refDate);
  assert.equal(summary.hasActualData, true);
  assert.equal(summary.actualIncome, 620000);
  assert.equal(summary.projectedIncome, 500000);
  assert.equal(summary.revenueDiffMoney, 120000);
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.completionPercent, 50);
  assert.equal(summary.isClosed, false);
  assert.equal(summary.overdueReceivablesCount, 1);
  assert.ok(summary.deviationExplanations.some((line) => line.includes('Ventas por encima')));

  // Mes vacío sin reales no produce NaN
  const emptySummary = buildGuidedMonthCloseSummary(biz, '2026-08', refDate);
  assert.equal(emptySummary.hasActualData, false);
  assert.equal(emptySummary.actualIncome, 0);
  assert.ok(emptySummary.deviationExplanations[0].includes('Aún no registras'));
});

test('3.2 Escenarios Base, Optimista y Pesimista proyectan saldos diferenciados sin mutar el negocio', () => {
  const refDate = new Date(2026, 5, 10);
  const biz = makePhase3Business();
  const snapshotBefore = JSON.stringify(biz);

  const result = calculateCashFlowScenarios(
    biz,
    {
      optimisticInflowPct: 20,
      optimisticOutflowPct: -10,
      pessimisticInflowPct: -20,
      pessimisticOutflowPct: 15,
    },
    refDate
  );

  assert.equal(JSON.stringify(biz), snapshotBefore);
  assert.equal(result.rows.length, 12);
  assert.ok(result.scenarios.optimistic.endingBalance12M > result.scenarios.base.endingBalance12M);
  assert.ok(result.scenarios.base.endingBalance12M > result.scenarios.pessimistic.endingBalance12M);
});

test('3.3 Exportación CSV/Excel neutraliza fórmulas e importación CSV valida filas antes de guardar', () => {
  const biz = makePhase3Business({
    actuals: {
      '2026-06': {
        month: '2026-06',
        transactions: [
          {
            id: 'tx-sec',
            date: '2026-06-11',
            description: '=HYPERLINK("http://evil")',
            type: 'income',
            amount: 25000,
          },
        ],
      },
    },
  });

  const csv = buildActualsTransactionsCsv(biz, '2026-06');
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes("'=HYPERLINK"));

  const xls = buildMonthlyExcelWorkbookXml(biz);
  assert.ok(xls.includes('<Workbook'));
  assert.ok(xls.includes('Resumen_Mensual'));
  assert.ok(xls.includes('Movimientos_Reales'));

  const sampleImportCsv = [
    'fecha;descripcion;monto;unidades;producto',
    '2026-06-15;Venta mostrador;$50.000;10;Roll de Canela',
    '18/06/2026;Pedido web;25000;5;',
    'fecha-mala;;-100;abc;',
  ].join('\n');

  const preview = parseAndValidateSalesCsv(sampleImportCsv, biz, '2026-06');
  assert.equal(preview.totalRows, 3);
  assert.equal(preview.validRows.length, 2);
  assert.equal(preview.invalidRows.length, 1);
  assert.equal(preview.totalValidAmount, 75000);
  assert.equal(preview.validRows[0].productId, 'p1');
  assert.equal(preview.validRows[1].date, '2026-06-18');

  const patch = buildSalesCsvImportPatch(biz, preview.validRows);
  assert.equal(patch.actuals?.['2026-06'].transactions.length, 3);
});

test('3.4 Resumen mensual para correo arma indicadores reales del mes', () => {
  const biz = makePhase3Business();
  const payload = buildMonthlySummaryEmailPayload(biz, '2026-06');
  assert.equal(payload.businessName, 'Café & Repostería Canela');
  assert.equal(payload.month, '2026-06');
  assert.ok(payload.incomeFormatted.includes('620.000'));
  assert.ok(payload.highlights.length > 0);
});

test('3.6 Referidos suma +30 días al vencimiento vigente o desde hoy si estaba vencido', () => {
  const refDate = new Date(2026, 5, 10); // 2026-06-10
  // Si vence en el futuro (2026-06-25), suma 30 días desde 2026-06-25 -> 2026-07-25
  assert.equal(
    computeReferralBonusDueDate('2026-06-25', REFERRAL_BONUS_DAYS, refDate),
    '2026-07-25'
  );
  // Si ya venció (2026-05-01), suma 30 días desde hoy (2026-06-10) -> 2026-07-10
  assert.equal(
    computeReferralBonusDueDate('2026-05-01', REFERRAL_BONUS_DAYS, refDate),
    '2026-07-10'
  );

  const code = buildReferralInviteCodeString('abc12345');
  assert.match(code, /^REF-[A-Z0-9]{1,4}-[A-Z0-9]{4}$/);
});
