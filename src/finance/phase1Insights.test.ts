import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SAFETY_MARGIN_GREEN_MIN_PERCENT,
  SAFETY_MARGIN_YELLOW_MIN_PERCENT,
  buildPhase1SimpleInsights,
  calculateMarginOfSafetyAnalysis,
  calculatePlanComparisonFromConfig,
  calculateProductProfitabilityRanking,
  calculatePublicBreakEven,
} from './phase1Insights.ts';
import type { BusinessWorkspace } from '../types/finance.ts';

test('Calculadora pública: caso normal y cálculo inmediato de unidades, ventas y margen', () => {
  const res = calculatePublicBreakEven({
    fixedCosts: 500000,
    variableCost: 4000,
    unitPrice: 10000,
  });

  assert.equal(res.isReady, true);
  assert.equal(res.isViable, true);
  assert.equal(res.unitContributionMargin, 6000);
  assert.equal(Math.round(res.contributionMarginPercent), 60);
  assert.equal(res.breakEvenUnits, 84); // 500.000 / 6.000 = 83.33 -> ceil 84
  assert.equal(res.breakEvenSalesClp, 840000);
  assert.ok(res.simpleExplanation.includes('84'));
});

test('Calculadora pública: maneja precio <= costo variable, vacíos, ceros y negativos', () => {
  const equalCost = calculatePublicBreakEven({
    fixedCosts: 300000,
    variableCost: 5000,
    unitPrice: 5000,
  });
  assert.equal(equalCost.isViable, false);
  assert.ok(equalCost.validationMessage?.includes('menor o igual'));

  const lowerPrice = calculatePublicBreakEven({
    fixedCosts: 300000,
    variableCost: 7000,
    unitPrice: 5000,
  });
  assert.equal(lowerPrice.isViable, false);
  assert.equal(lowerPrice.unitContributionMargin, -2000);

  const emptyInput = calculatePublicBreakEven({
    fixedCosts: '',
    variableCost: '',
    unitPrice: '',
  });
  assert.equal(emptyInput.isReady, false);
  assert.equal(emptyInput.isViable, false);

  const zeroFixed = calculatePublicBreakEven({
    fixedCosts: 0,
    variableCost: 2000,
    unitPrice: 5000,
  });
  assert.equal(zeroFixed.isViable, true);
  assert.equal(zeroFixed.breakEvenUnits, 0);

  const negativeInput = calculatePublicBreakEven({
    fixedCosts: -100000,
    variableCost: 2000,
    unitPrice: 5000,
  });
  assert.equal(negativeInput.hasNegativeInput, true);
  assert.equal(negativeInput.isViable, false);
});

test('Anclaje del plan anual calcula dinámicamente desde appConfig sin valores fijos en UI', () => {
  const launch = calculatePlanComparisonFromConfig({
    monthlyPriceClp: 5990,
    annualPriceClp: 50000,
    priceLabel: '$5.990 / mes',
  });
  assert.equal(launch.twelveMonthsTotalClp, 71880);
  assert.equal(launch.savingsClp, 21880);
  assert.equal(launch.savingsPercentRounded, 30);
  assert.equal(launch.equivalentMonthlyClp, 4167);
  assert.equal(launch.annualHighlightBadge, 'Más conveniente');

  const custom = calculatePlanComparisonFromConfig({
    monthlyPriceClp: 10000,
    annualPriceClp: 90000,
    priceLabel: '$10.000 / mes',
  });
  assert.equal(custom.twelveMonthsTotalClp, 120000);
  assert.equal(custom.savingsClp, 30000);
  assert.equal(custom.savingsPercentRounded, 25);
  assert.equal(custom.equivalentMonthlyClp, 7500);
});

test('Margen de seguridad evalúa semáforo verde, amarillo y rojo + división por cero', () => {
  // Verde (>= 25%)
  const green = calculateMarginOfSafetyAnalysis({
    fixedCosts: 400000,
    weightedUnitContribution: 5000,
    weightedMarginPercent: 50,
    currentOrProjectedSales: 1200000,
    breakEvenRevenue: 800000,
  });
  assert.equal(green.status, 'verde');
  assert.ok(green.marginOfSafetyPercent >= SAFETY_MARGIN_GREEN_MIN_PERCENT);

  // Amarillo (>= 10% y < 25%)
  const yellow = calculateMarginOfSafetyAnalysis({
    fixedCosts: 400000,
    weightedUnitContribution: 5000,
    weightedMarginPercent: 50,
    currentOrProjectedSales: 950000,
    breakEvenRevenue: 800000,
  });
  assert.equal(yellow.status, 'amarillo');
  assert.ok(yellow.marginOfSafetyPercent >= SAFETY_MARGIN_YELLOW_MIN_PERCENT);
  assert.ok(yellow.marginOfSafetyPercent < SAFETY_MARGIN_GREEN_MIN_PERCENT);

  // Rojo (< 10% o bajo equilibrio)
  const red = calculateMarginOfSafetyAnalysis({
    fixedCosts: 400000,
    weightedUnitContribution: 5000,
    weightedMarginPercent: 50,
    currentOrProjectedSales: 600000,
    breakEvenRevenue: 800000,
  });
  assert.equal(red.status, 'rojo');
  assert.ok(red.marginOfSafetyMoney < 0);

  // División por cero / ventas en $0
  const zeroSales = calculateMarginOfSafetyAnalysis({
    fixedCosts: 400000,
    weightedUnitContribution: 5000,
    weightedMarginPercent: 50,
    currentOrProjectedSales: 0,
    breakEvenRevenue: 800000,
  });
  assert.equal(zeroSales.marginOfSafetyPercent, 0);
  assert.equal(zeroSales.status, 'rojo');
});

test('Rentabilidad por producto: ordena ranking, Pareto 80/20, margen/hora y marca "vende harto pero deja poco"', () => {
  const biz: BusinessWorkspace = {
    id: 'biz-rank',
    name: 'Tostaduría Demo',
    currency: { code: 'CLP', symbol: '$', locale: 'es-CL', decimals: 0 },
    startMonth: '2026-06',
    targetProfit: 300000,
    expectedMonthlyUnits: 100,
    monthlyGrowthPercent: 0,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: { p1: 20, p2: 15, p3: 80 },
    fixedCosts: [{ id: 'f1', name: 'Arriendo', amount: 300000, category: 'arriendo' }],
    products: [
      {
        id: 'p1',
        name: 'Pack Regalo Premium',
        category: 'Regalos',
        price: 30000,
        variableCost: 10000, // MCU 20.000 (66.7%), 20u = 400.000 margen total
        personalTimeMinutes: 30, // 40.000 / hora
      },
      {
        id: 'p2',
        name: 'Café Grano Especial',
        category: 'Café',
        price: 15000,
        variableCost: 7000, // MCU 8.000 (53.3%), 15u = 120.000 margen total
      },
      {
        id: 'p3',
        name: 'Galleta Masiva',
        category: 'Snacks',
        price: 2000,
        variableCost: 1700, // MCU 300 (15% < 25%), 80u (> promedio 38.3u) = 24.000 margen total
        personalTimeMinutes: 10, // 1.800 / hora
      },
    ],
    projectionOverrides: {},
    actuals: {},
    updatedAt: '2026-06-01T00:00:00Z',
  };

  const ranking = calculateProductProfitabilityRanking(biz, '2026-06');
  assert.equal(ranking.rows.length, 3);
  assert.equal(ranking.rows[0].productId, 'p1');
  assert.equal(ranking.rows[0].marginPerHour, 40000);
  assert.equal(ranking.rows[1].productId, 'p2');
  assert.equal(ranking.rows[1].marginPerHour, null); // Sin personalTimeMinutes en producto legado
  assert.equal(ranking.rows[0].isParetoTop80, true);

  const p3Row = ranking.rows.find((r) => r.productId === 'p3');
  assert.ok(p3Row);
  assert.equal(p3Row.isHighVolumeLowMargin, true);
  assert.ok(ranking.highVolumeLowMarginCount === 1);

  const insights = buildPhase1SimpleInsights(biz, '2026-06');
  assert.equal(insights.glossary.length, 3);
});
