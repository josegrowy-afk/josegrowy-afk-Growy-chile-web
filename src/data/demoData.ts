import { addMonths, CURRENCY_PRESETS, getCurrentYearMonth } from '../finance/formulas';
import type { AppStorageState, BusinessWorkspace } from '../types/finance';

export function createDemoBusinesses(): BusinessWorkspace[] {
  const currentMonth = getCurrentYearMonth();
  // Comenzamos 2 meses atrás para mostrar 3 meses con resultados reales (2 pasados + actual) y 12 meses totales
  const startMonth = addMonths(currentMonth, -2);
  const m1 = addMonths(startMonth, 0);
  const m2 = addMonths(startMonth, 1);
  const m3 = addMonths(startMonth, 2); // mes actual
  const m4 = addMonths(startMonth, 3); // mes donde cambia un costo fijo programado

  const mainWorkshop: BusinessWorkspace = {
    id: 'demo-tierra-salvia',
    name: 'Taller Tierra & Salvia',
    tagline: 'Cerámica artesanal, velas de soya y textiles botánicos',
    currency: CURRENCY_PRESETS.CLP,
    startMonth,
    targetProfit: 850000,
    expectedMonthlyUnits: 120,
    monthlyGrowthPercent: 5,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: {
      'prod-taza': 46,
      'prod-vela': 34,
      'prod-jabon': 24,
      'prod-delantal': 16,
    },
    fixedCosts: [
      {
        id: 'fc-taller',
        name: 'Arriendo taller y showroom',
        amount: 420000,
        category: 'arriendo',
        notes: 'Incluye gastos comunes. Reajuste pactado desde el 4to mes.',
        scheduledChange: {
          effectiveFromMonth: m4,
          newAmount: 460000,
        },
      },
      {
        id: 'fc-ayudante',
        name: 'Apoyo medio tiempo empaque y envíos',
        amount: 310000,
        category: 'sueldos',
        notes: 'Jornada de 20 horas semanales.',
      },
      {
        id: 'fc-servicios',
        name: 'Electricidad horno, agua e internet',
        amount: 95000,
        category: 'servicios_basicos',
        notes: 'Consumo promedio del horno cerámico.',
      },
      {
        id: 'fc-mkt',
        name: 'Ferias locales y pauta orgánica',
        amount: 85000,
        category: 'marketing',
        notes: 'Stand mensual y difusión en redes.',
      },
      {
        id: 'fc-soft',
        name: 'Tienda online y facturación',
        amount: 38000,
        category: 'software',
        notes: 'Plataforma e-commerce y sistema de boletas.',
      },
    ],
    products: [
      {
        id: 'prod-taza',
        name: 'Taza Gres Terracota',
        category: 'Cerámica',
        price: 18500,
        variableCost: 6200,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 800,
        personalTimeCost: 1500,
      },
      {
        id: 'prod-vela',
        name: 'Vela Soya & Lavanda',
        category: 'Aromas',
        price: 14900,
        variableCost: 4800,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 700,
        personalTimeCost: 1200,
      },
      {
        id: 'prod-jabon',
        name: 'Set Jabón Salvia & Avena',
        category: 'Botánica',
        price: 11500,
        variableCost: 3900,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 600,
        personalTimeCost: 900,
      },
      {
        id: 'prod-delantal',
        name: 'Delantal Lino Crudo',
        category: 'Textil',
        price: 34000,
        variableCost: 14500,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 1200,
        personalTimeCost: 2800,
      },
    ],
    projectionOverrides: {},
    actuals: {
      [m1]: {
        month: m1,
        actualUnitsSold: 118,
        notes: 'Mes de lanzamiento en feria de diseño local.',
        transactions: [
          {
            id: 'tx-m1-1',
            date: `${m1}-12`,
            description: 'Ventas tienda online y showroom',
            type: 'income',
            amount: 1480000,
            units: 82,
          },
          {
            id: 'tx-m1-2',
            date: `${m1}-24`,
            description: 'Feria botánica fin de semana',
            type: 'income',
            amount: 695000,
            units: 36,
          },
          {
            id: 'tx-m1-3',
            date: `${m1}-05`,
            description: 'Costos fijos pagados del mes',
            type: 'fixed_expense',
            amount: 948000,
          },
          {
            id: 'tx-m1-4',
            date: `${m1}-18`,
            description: 'Arcilla, cera de soya, esencias y cajas',
            type: 'variable_expense',
            amount: 710000,
          },
        ],
      },
      [m2]: {
        month: m2,
        actualUnitsSold: 96,
        notes: 'Mes más lento por lluvias y envío demorado de insumos.',
        transactions: [
          {
            id: 'tx-m2-1',
            date: `${m2}-15`,
            description: 'Ventas mes tienda y pedidos personalizados',
            type: 'income',
            amount: 1580000,
            units: 96,
          },
          {
            id: 'tx-m2-2',
            date: `${m2}-05`,
            description: 'Costos fijos completos',
            type: 'fixed_expense',
            amount: 948000,
          },
          {
            id: 'tx-m2-3',
            date: `${m2}-20`,
            description: 'Materiales y comisiones de envío',
            type: 'variable_expense',
            amount: 615000,
          },
          {
            id: 'tx-m2-4',
            date: `${m2}-27`,
            description: 'Reparación menor de torno',
            type: 'other_expense',
            amount: 55000,
          },
        ],
      },
      [m3]: {
        month: m3,
        actualUnitsSold: 132,
        notes: 'Mes actual con buena recepción de sets de regalo.',
        transactions: [
          {
            id: 'tx-m3-1',
            date: `${m3}-09`,
            description: 'Pedidos corporativos conscientes',
            type: 'income',
            amount: 1290000,
            units: 70,
          },
          {
            id: 'tx-m3-2',
            date: `${m3}-19`,
            description: 'Ventas directas showroom y web',
            type: 'income',
            amount: 1185000,
            units: 62,
          },
          {
            id: 'tx-m3-3',
            date: `${m3}-03`,
            description: 'Costos fijos del mes',
            type: 'fixed_expense',
            amount: 948000,
          },
          {
            id: 'tx-m3-4',
            date: `${m3}-16`,
            description: 'Reposición de materias primas y empaques',
            type: 'variable_expense',
            amount: 812000,
          },
        ],
      },
    },
    isDemo: true,
    updatedAt: new Date().toISOString(),
  };

  const expansionScenario: BusinessWorkspace = {
    ...JSON.parse(JSON.stringify(mainWorkshop)),
    id: 'demo-escenario-ferias',
    name: 'Escenario Temporada Ferias',
    tagline: 'Simulación con +15% en precios y mayor peso textil',
    targetProfit: 1350000,
    expectedMonthlyUnits: 150,
    monthlyGrowthPercent: 7,
    products: [
      {
        id: 'prod-taza',
        name: 'Taza Gres Terracota',
        category: 'Cerámica',
        price: 21000,
        variableCost: 6200,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 800,
        personalTimeCost: 1500,
      },
      {
        id: 'prod-vela',
        name: 'Vela Soya & Lavanda',
        category: 'Aromas',
        price: 16500,
        variableCost: 4800,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 700,
        personalTimeCost: 1200,
      },
      {
        id: 'prod-jabon',
        name: 'Set Jabón Salvia & Avena',
        category: 'Botánica',
        price: 12900,
        variableCost: 3900,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 600,
        personalTimeCost: 900,
      },
      {
        id: 'prod-delantal',
        name: 'Delantal Lino Crudo',
        category: 'Textil',
        price: 38000,
        variableCost: 14500,
        cardFeePercent: 2.9,
        taxPercent: 19,
        shippingCost: 1200,
        personalTimeCost: 2800,
      },
    ],
    actuals: {},
    isDemo: true,
    updatedAt: new Date().toISOString(),
  };

  return [mainWorkshop, expansionScenario];
}

export function createEmptyBusiness(name = 'Mi Emprendimiento'): BusinessWorkspace {
  return {
    id: `biz-${Date.now()}`,
    name,
    tagline: 'Planificación mensual y punto de equilibrio',
    currency: CURRENCY_PRESETS.CLP,
    startMonth: getCurrentYearMonth(),
    targetProfit: 500000,
    expectedMonthlyUnits: 50,
    monthlyGrowthPercent: 5,
    projectionMonthsCount: 12,
    baseMonthlyUnitsByProduct: {},
    fixedCosts: [],
    products: [],
    projectionOverrides: {},
    actuals: {},
    isDemo: false,
    updatedAt: new Date().toISOString(),
  };
}

export function createInitialAppState(): AppStorageState {
  const businesses = createDemoBusinesses();
  return {
    version: 1,
    activeBusinessId: businesses[0].id,
    businesses,
    theme: 'light',
  };
}
