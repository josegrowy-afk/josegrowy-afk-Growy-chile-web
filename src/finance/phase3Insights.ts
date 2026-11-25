import {
  buildMonthlyProjections,
  compareMonthActualVsProjected,
  formatCurrency,
  formatMonthLabel,
  formatPercent,
  getCurrentYearMonth,
  getWeightedMixEconomics,
} from './formulas.ts';
import {
  calculateCashFlowProjection,
  calculatePayablesSummary,
  calculateReceivablesSummary,
} from './smeIntelligence.ts';
import { parseISODateLocal, toISODateLocal } from './subscription.ts';
import type {
  ActualTransaction,
  BusinessWorkspace,
  CashFlowScenarioConfig,
  MonthlyCloseChecklist,
} from '../types/finance';

/**
 * ============================================================================
 * GROWy Equilibrio — Lógica financiera y retención Fase 3
 * Módulo independiente para no alterar las fórmulas base en src/finance/formulas.ts.
 * ============================================================================
 */

/* ============================================================================
 * 3.1 CIERRE DE MES GUIADO
 * ============================================================================ */

export interface GuidedCloseStep {
  id: 'actualsChecked' | 'receivablesPayablesChecked' | 'comparedVsProjected' | 'deviationsReviewed';
  title: string;
  description: string;
  completed: boolean;
  autoHint: string;
  actionRequiredLabel?: string;
}

export interface GuidedMonthCloseSummary {
  month: string;
  monthLabel: string;
  checklist: MonthlyCloseChecklist;
  steps: GuidedCloseStep[];
  completedCount: number;
  totalSteps: number;
  completionPercent: number;
  isClosed: boolean;
  closedAt: string | null;
  hasActualData: boolean;
  actualIncome: number;
  actualExpenses: number;
  actualProfit: number;
  projectedIncome: number;
  projectedExpenses: number;
  projectedProfit: number;
  revenueDiffMoney: number;
  revenueDiffPercent: number;
  expenseDiffMoney: number;
  profitDiffMoney: number;
  overdueReceivablesCount: number;
  overdueReceivablesAmount: number;
  overduePayablesCount: number;
  overduePayablesAmount: number;
  deviationExplanations: string[];
}

export function buildGuidedMonthCloseSummary(
  business: BusinessWorkspace,
  month: string = getCurrentYearMonth(),
  referenceDate: Date = new Date()
): GuidedMonthCloseSummary {
  const projections = buildMonthlyProjections(business);
  const projected =
    projections.find((p) => p.month === month) ??
    projections[0] ?? {
      month,
      monthLabel: formatMonthLabel(month),
      unitsByProduct: {},
      totalUnits: 0,
      projectedRevenue: 0,
      projectedVariableCosts: 0,
      projectedFixedCosts: 0,
      projectedTotalCosts: 0,
      projectedProfit: 0,
      cumulativeProfit: 0,
    };

  const actualRecord = business.actuals?.[month];
  const comp = compareMonthActualVsProjected({
    projected,
    actualRecord,
    business,
  });

  const ar = calculateReceivablesSummary(business.receivables, referenceDate);
  const ap = calculatePayablesSummary(business.payables, referenceDate);
  const saved: MonthlyCloseChecklist = business.monthlyCloseChecklists?.[month] ?? { month };

  const actualExpenses = comp.actual.totalExpense;
  const projectedExpenses = projected.projectedTotalCosts;
  const expenseDiffMoney = actualExpenses - projectedExpenses;

  const actualChecked = Boolean(saved.actualsChecked);
  const receivablesPayablesChecked = Boolean(saved.receivablesPayablesChecked);
  const comparedVsProjected = Boolean(saved.comparedVsProjected);
  const deviationsReviewed = Boolean(saved.deviationsReviewed);

  const c = business.currency;
  const deviationExplanations: string[] = [];

  if (!comp.actual.hasData) {
    deviationExplanations.push(
      `Aún no registras movimientos reales en ${projected.monthLabel}. Anota tus ventas y pagos del mes para comparar contra lo proyectado.`
    );
  } else {
    if (comp.revenueDiffMoney >= 0) {
      deviationExplanations.push(
        `Ventas por encima de la meta: vendiste ${formatCurrency(comp.revenueDiffMoney, c)} más (${formatPercent(comp.revenueDiffPercent)}) que lo proyectado.`
      );
    } else {
      deviationExplanations.push(
        `Ventas bajo lo proyectado: faltaron ${formatCurrency(Math.abs(comp.revenueDiffMoney), c)} (${formatPercent(Math.abs(comp.revenueDiffPercent))}) para alcanzar la meta del mes.`
      );
    }

    if (expenseDiffMoney > 0) {
      deviationExplanations.push(
        `Gastos reales más altos: pagaste ${formatCurrency(expenseDiffMoney, c)} por sobre lo presupuestado (revisa insumos, envíos o gastos imprevistos).`
      );
    } else if (expenseDiffMoney < 0) {
      deviationExplanations.push(
        `Ahorro en costos del mes: gastaste ${formatCurrency(Math.abs(expenseDiffMoney), c)} menos que lo proyectado.`
      );
    } else {
      deviationExplanations.push('Tus gastos reales calzaron exacto con lo que habías proyectado.');
    }

    if (comp.actual.profit >= projected.projectedProfit) {
      deviationExplanations.push(
        `Resultado neto del mes (${formatCurrency(comp.actual.profit, c)}) superó tu utilidad proyectada por ${formatCurrency(comp.profitDiffMoney, c)}.`
      );
    } else {
      deviationExplanations.push(
        `El resultado neto (${formatCurrency(comp.actual.profit, c)}) quedó ${formatCurrency(Math.abs(comp.profitDiffMoney), c)} por debajo de tu proyección.`
      );
    }
  }

  if (ar.overdueCount > 0 || ap.overdueCount > 0) {
    deviationExplanations.push(
      `Ojo con la caja pendiente: tienes ${ar.overdueCount} cobro(s) vencido(s) (${formatCurrency(ar.overdueAmount, c)}) y ${ap.overdueCount} pago(s) vencido(s) (${formatCurrency(ap.overdueAmount, c)}).`
    );
  }

  const steps: GuidedCloseStep[] = [
    {
      id: 'actualsChecked',
      title: '1. Registrar ingresos y gastos reales del mes',
      description: 'Asegúrate de haber anotado tus boletas, facturas, compras de insumos y pagos fijos.',
      completed: actualChecked,
      autoHint: comp.actual.hasData
        ? `${comp.actual.transactionCount} movimiento(s) · Ingresos ${formatCurrency(comp.actual.income, c)}`
        : 'Sin movimientos reales registrados aún',
    },
    {
      id: 'receivablesPayablesChecked',
      title: '2. Revisar Cuentas por Cobrar y por Pagar',
      description: 'Confirma qué ventas a crédito ya te pagaron y qué facturas a proveedores vencen pronto.',
      completed: receivablesPayablesChecked,
      autoHint:
        ar.overdueCount + ap.overdueCount > 0
          ? `${ar.overdueCount} CxC vencida(s) · ${ap.overdueCount} CxP vencida(s)`
          : `${ar.pendingCount} CxC pendiente(s) · ${ap.items.filter((i) => i.pendingBalance > 0).length} CxP pendiente(s)`,
    },
    {
      id: 'comparedVsProjected',
      title: '3. Comparar real vs. proyectado',
      description: 'Revisa si tus ventas y costos reales estuvieron sobre o bajo la meta del mes.',
      completed: comparedVsProjected,
      autoHint: comp.actual.hasData
        ? `${comp.statusLabel} (${formatCurrency(comp.actual.profit, c)} real vs ${formatCurrency(projected.projectedProfit, c)} proy.)`
        : 'Registra al menos un movimiento para comparar',
    },
    {
      id: 'deviationsReviewed',
      title: '4. Leer las desviaciones explicadas y cerrar',
      description: 'Entiende por qué subió o bajó el resultado antes de pasar al mes siguiente.',
      completed: deviationsReviewed,
      autoHint: `${deviationExplanations.length} conclusión(es) lista(s) para revisar`,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const completionPercent = Math.round((completedCount / totalSteps) * 100);

  return {
    month,
    monthLabel: projected.monthLabel,
    checklist: {
      month,
      actualsChecked: actualChecked,
      receivablesPayablesChecked,
      comparedVsProjected,
      deviationsReviewed,
      closedAt: saved.closedAt,
      notes: saved.notes,
    },
    steps,
    completedCount,
    totalSteps,
    completionPercent,
    isClosed: Boolean(saved.closedAt) && completedCount === totalSteps,
    closedAt: saved.closedAt ?? null,
    hasActualData: comp.actual.hasData,
    actualIncome: comp.actual.income,
    actualExpenses,
    actualProfit: comp.actual.profit,
    projectedIncome: projected.projectedRevenue,
    projectedExpenses,
    projectedProfit: projected.projectedProfit,
    revenueDiffMoney: comp.revenueDiffMoney,
    revenueDiffPercent: comp.revenueDiffPercent,
    expenseDiffMoney,
    profitDiffMoney: comp.profitDiffMoney,
    overdueReceivablesCount: ar.overdueCount,
    overdueReceivablesAmount: ar.overdueAmount,
    overduePayablesCount: ap.overdueCount,
    overduePayablesAmount: ap.overdueAmount,
    deviationExplanations,
  };
}

/* ============================================================================
 * 3.2 ESCENARIOS BASE, OPTIMISTA Y PESIMISTA EN FLUJO DE CAJA
 * ============================================================================ */

export const DEFAULT_SCENARIO_CONFIG: Required<CashFlowScenarioConfig> = {
  optimisticInflowPct: 15,
  optimisticOutflowPct: -5,
  pessimisticInflowPct: -15,
  pessimisticOutflowPct: 10,
};

export interface CashFlowScenarioMonthRow {
  month: string;
  monthLabel: string;
  baseClosing: number;
  optimisticClosing: number;
  pessimisticClosing: number;
  baseNet: number;
  optimisticNet: number;
  pessimisticNet: number;
}

export interface CashFlowScenarioSummary {
  id: 'base' | 'optimistic' | 'pessimistic';
  label: string;
  inflowDeltaPct: number;
  outflowDeltaPct: number;
  endingBalance12M: number;
  lowestBalance12M: number;
  firstDeficitMonthLabel: string | null;
  deficitMonthsCount: number;
}

export interface CashFlowScenariosResult {
  config: Required<CashFlowScenarioConfig>;
  rows: CashFlowScenarioMonthRow[];
  scenarios: {
    base: CashFlowScenarioSummary;
    optimistic: CashFlowScenarioSummary;
    pessimistic: CashFlowScenarioSummary;
  };
}

function clampPct(value: number | undefined, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(-80, Math.min(200, Math.round(n * 10) / 10));
}

export function calculateCashFlowScenarios(
  business: BusinessWorkspace,
  overrideConfig?: CashFlowScenarioConfig,
  referenceDate: Date = new Date()
): CashFlowScenariosResult {
  const mergedInput = overrideConfig ?? business.cashFlowScenarioConfig ?? {};
  const config: Required<CashFlowScenarioConfig> = {
    optimisticInflowPct: clampPct(
      mergedInput.optimisticInflowPct,
      DEFAULT_SCENARIO_CONFIG.optimisticInflowPct
    ),
    optimisticOutflowPct: clampPct(
      mergedInput.optimisticOutflowPct,
      DEFAULT_SCENARIO_CONFIG.optimisticOutflowPct
    ),
    pessimisticInflowPct: clampPct(
      mergedInput.pessimisticInflowPct,
      DEFAULT_SCENARIO_CONFIG.pessimisticInflowPct
    ),
    pessimisticOutflowPct: clampPct(
      mergedInput.pessimisticOutflowPct,
      DEFAULT_SCENARIO_CONFIG.pessimisticOutflowPct
    ),
  };

  const baseCf = calculateCashFlowProjection(business, referenceDate);
  const baseRows = baseCf.rows.slice(0, 12);

  const optInFactor = Math.max(0, 1 + config.optimisticInflowPct / 100);
  const optOutFactor = Math.max(0, 1 + config.optimisticOutflowPct / 100);
  const pesInFactor = Math.max(0, 1 + config.pessimisticInflowPct / 100);
  const pesOutFactor = Math.max(0, 1 + config.pessimisticOutflowPct / 100);

  let optBalance = baseRows.length > 0 ? baseRows[0].openingBalance : baseCf.currentAvailableCash;
  let pesBalance = optBalance;

  const rows: CashFlowScenarioMonthRow[] = baseRows.map((r) => {
    const optIn = r.totalInflows * optInFactor;
    const optOut = r.totalOutflows * optOutFactor;
    const optNet = optIn - optOut;
    optBalance += optNet;

    const pesIn = r.totalInflows * pesInFactor;
    const pesOut = r.totalOutflows * pesOutFactor;
    const pesNet = pesIn - pesOut;
    pesBalance += pesNet;

    return {
      month: r.month,
      monthLabel: r.monthLabel,
      baseClosing: Math.round(r.closingBalance),
      optimisticClosing: Math.round(optBalance),
      pessimisticClosing: Math.round(pesBalance),
      baseNet: Math.round(r.netCashFlow),
      optimisticNet: Math.round(optNet),
      pessimisticNet: Math.round(pesNet),
    };
  });

  const summarize = (
    id: 'base' | 'optimistic' | 'pessimistic',
    label: string,
    inflowDeltaPct: number,
    outflowDeltaPct: number,
    getter: (row: CashFlowScenarioMonthRow) => number
  ): CashFlowScenarioSummary => {
    if (rows.length === 0) {
      return {
        id,
        label,
        inflowDeltaPct,
        outflowDeltaPct,
        endingBalance12M: baseCf.currentAvailableCash,
        lowestBalance12M: baseCf.currentAvailableCash,
        firstDeficitMonthLabel: null,
        deficitMonthsCount: 0,
      };
    }
    const balances = rows.map(getter);
    const firstDeficit = rows.find((r) => getter(r) < 0) ?? null;
    const deficitMonthsCount = rows.filter((r) => getter(r) < 0).length;
    return {
      id,
      label,
      inflowDeltaPct,
      outflowDeltaPct,
      endingBalance12M: balances[balances.length - 1],
      lowestBalance12M: Math.min(...balances),
      firstDeficitMonthLabel: firstDeficit ? firstDeficit.monthLabel : null,
      deficitMonthsCount,
    };
  };

  return {
    config,
    rows,
    scenarios: {
      base: summarize('base', 'Escenario Base', 0, 0, (r) => r.baseClosing),
      optimistic: summarize(
        'optimistic',
        'Escenario Optimista',
        config.optimisticInflowPct,
        config.optimisticOutflowPct,
        (r) => r.optimisticClosing
      ),
      pessimistic: summarize(
        'pessimistic',
        'Escenario Pesimista',
        config.pessimisticInflowPct,
        config.pessimisticOutflowPct,
        (r) => r.pessimisticClosing
      ),
    },
  };
}

/* ============================================================================
 * 3.3 EXPORTACIÓN EXCEL / CSV E IMPORTACIÓN DE VENTAS CON VISTA PREVIA
 * ============================================================================ */

function neutralizeSpreadsheetFormula(value: string): string {
  const trimmed = value.replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

export function escapeCsvCell(raw: string | number | undefined | null, delimiter = ';'): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? String(raw) : '0';
  }
  const safe = neutralizeSpreadsheetFormula(String(raw));
  if (safe.includes(delimiter) || safe.includes('"') || safe.includes('\n')) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildActualsTransactionsCsv(business: BusinessWorkspace, month?: string): string {
  const delimiter = ';';
  const rows: string[] = [
    ['Mes', 'Fecha', 'Tipo', 'Descripción', 'Monto', 'Unidades', 'Producto', 'Categoría']
      .map((h) => escapeCsvCell(h, delimiter))
      .join(delimiter),
  ];

  const productMap = new Map(business.products.map((p) => [p.id, p.name]));
  const targetMonths = month
    ? [month]
    : Object.keys(business.actuals ?? {}).sort();

  const typeLabels: Record<ActualTransaction['type'], string> = {
    income: 'Ingreso por ventas',
    fixed_expense: 'Egreso fijo',
    variable_expense: 'Egreso variable',
    other_expense: 'Otro egreso',
  };

  for (const m of targetMonths) {
    const rec = business.actuals?.[m];
    if (!rec) continue;
    for (const tx of rec.transactions ?? []) {
      rows.push(
        [
          m,
          tx.date,
          typeLabels[tx.type] ?? tx.type,
          tx.description,
          Math.round(Number(tx.amount) || 0),
          tx.units ?? '',
          tx.productId ? (productMap.get(tx.productId) ?? tx.productId) : '',
          tx.expenseCategory ?? '',
        ]
          .map((cell) => escapeCsvCell(cell, delimiter))
          .join(delimiter)
      );
    }
  }

  // UTF-8 BOM para que Excel en español abra tildes y ñ sin problemas
  return `\uFEFF${rows.join('\r\n')}`;
}

function escapeXml(value: string | number | undefined | null): string {
  const safe = neutralizeSpreadsheetFormula(String(value ?? ''));
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Genera un libro Excel (.xls SpreadsheetML) multi-hoja nativo con Resumen Mensual y Movimientos Reales
 * sin requerir librerías externas pesadas.
 */
export function buildMonthlyExcelWorkbookXml(business: BusinessWorkspace): string {
  const projections = buildMonthlyProjections(business);
  const comparisonRows = projections.map((proj) => {
    const comp = compareMonthActualVsProjected({
      projected: proj,
      actualRecord: business.actuals?.[proj.month],
      business,
    });
    return { proj, comp };
  });

  const summarySheetRows = [
    `<Row>
      <Cell><Data ss:Type="String">Mes</Data></Cell>
      <Cell><Data ss:Type="String">Unidades Proy.</Data></Cell>
      <Cell><Data ss:Type="String">Ingresos Proy.</Data></Cell>
      <Cell><Data ss:Type="String">Costos Proy.</Data></Cell>
      <Cell><Data ss:Type="String">Utilidad Proy.</Data></Cell>
      <Cell><Data ss:Type="String">Ingresos Reales</Data></Cell>
      <Cell><Data ss:Type="String">Gastos Reales</Data></Cell>
      <Cell><Data ss:Type="String">Resultado Real</Data></Cell>
      <Cell><Data ss:Type="String">Estado</Data></Cell>
    </Row>`,
    ...comparisonRows.map(({ proj, comp }) => `<Row>
      <Cell><Data ss:Type="String">${escapeXml(proj.monthLabel)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(proj.totalUnits)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(proj.projectedRevenue)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(proj.projectedTotalCosts)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(proj.projectedProfit)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(comp.actual.income)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(comp.actual.totalExpense)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(comp.actual.profit)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(comp.statusLabel)}</Data></Cell>
    </Row>`),
  ].join('\n');

  const productMap = new Map(business.products.map((p) => [p.id, p.name]));
  const allTxRows: string[] = [
    `<Row>
      <Cell><Data ss:Type="String">Mes</Data></Cell>
      <Cell><Data ss:Type="String">Fecha</Data></Cell>
      <Cell><Data ss:Type="String">Tipo</Data></Cell>
      <Cell><Data ss:Type="String">Descripción</Data></Cell>
      <Cell><Data ss:Type="String">Monto</Data></Cell>
      <Cell><Data ss:Type="String">Unidades</Data></Cell>
      <Cell><Data ss:Type="String">Producto</Data></Cell>
    </Row>`,
  ];

  for (const month of Object.keys(business.actuals ?? {}).sort()) {
    const rec = business.actuals[month];
    for (const tx of rec?.transactions ?? []) {
      allTxRows.push(`<Row>
      <Cell><Data ss:Type="String">${escapeXml(month)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(tx.date)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(tx.type)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(tx.description)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(Number(tx.amount) || 0)}</Data></Cell>
      <Cell><Data ss:Type="Number">${Math.round(Number(tx.units) || 0)}</Data></Cell>
      <Cell><Data ss:Type="String">${escapeXml(tx.productId ? (productMap.get(tx.productId) ?? '') : '')}</Data></Cell>
    </Row>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Resumen_Mensual">
  <Table>
   ${summarySheetRows}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Movimientos_Reales">
  <Table>
   ${allTxRows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
}

export interface ParsedCsvSaleRow {
  lineNumber: number;
  date: string;
  month: string;
  description: string;
  amount: number;
  units?: number;
  productId?: string;
  productName?: string;
  valid: boolean;
  error?: string;
}

export interface CsvSalesImportPreview {
  delimiter: ',' | ';';
  totalRows: number;
  validRows: ParsedCsvSaleRow[];
  invalidRows: ParsedCsvSaleRow[];
  allRows: ParsedCsvSaleRow[];
  totalValidAmount: number;
  totalValidUnits: number;
}

function splitCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeCsvDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return s;
    }
    return null;
  }
  const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (slashMatch) {
    const d = Number(slashMatch[1]);
    const m = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseMonetaryAmount(raw: string): number {
  let cleaned = raw.trim().replace(/\$/g, '').replace(/CLP/gi, '').replace(/\s+/g, '');
  if (!cleaned) return NaN;
  // Formato chileno "$12.500" (punto como separador de miles, sin coma decimal o con coma decimal)
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/,/g, '');
  }
  return Number(cleaned);
}

export const SALES_CSV_TEMPLATE =
  'fecha;descripcion;monto;unidades;producto\r\n2026-06-15;Ventas boleta mostrador;89500;5;Taza Gres Terracota\r\n2026-06-18;Pedido tienda online;44700;3;Vela Soya & Lavanda\r\n';

export function parseAndValidateSalesCsv(
  csvText: string,
  business: BusinessWorkspace,
  fallbackMonth: string = getCurrentYearMonth()
): CsvSalesImportPreview {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return {
      delimiter: ';',
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      allRows: [],
      totalValidAmount: 0,
      totalValidUnits: 0,
    };
  }

  const rawLines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const firstLine = rawLines[0] ?? '';
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delimiter: ',' | ';' = semiCount >= commaCount ? ';' : ',';

  const headerCells = splitCsvLine(firstLine, delimiter).map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );

  const findCol = (aliases: string[]): number =>
    headerCells.findIndex((cell) => aliases.some((a) => cell.includes(a)));

  const hasExplicitHeader =
    findCol(['fecha', 'date']) !== -1 ||
    findCol(['monto', 'amount', 'total', 'ingreso']) !== -1 ||
    findCol(['descripcion', 'detalle', 'description']) !== -1;

  const colDate = hasExplicitHeader ? findCol(['fecha', 'date']) : 0;
  const colDesc = hasExplicitHeader
    ? findCol(['descripcion', 'detalle', 'concepto', 'description'])
    : 1;
  const colAmount = hasExplicitHeader ? findCol(['monto', 'amount', 'total', 'ingreso', 'venta']) : 2;
  const colUnits = hasExplicitHeader ? findCol(['unidad', 'cant', 'units', 'qty']) : 3;
  const colProduct = hasExplicitHeader ? findCol(['producto', 'product', 'item']) : 4;

  const dataStartIndex = hasExplicitHeader ? 1 : 0;
  const MAX_ROWS = 500;

  const allRows: ParsedCsvSaleRow[] = [];
  for (let i = dataStartIndex; i < rawLines.length && allRows.length < MAX_ROWS; i++) {
    const lineNumber = i + 1;
    const cells = splitCsvLine(rawLines[i], delimiter);

    const rawDate = colDate >= 0 ? (cells[colDate] ?? '') : '';
    const rawDesc = colDesc >= 0 ? (cells[colDesc] ?? '') : '';
    const rawAmount = colAmount >= 0 ? (cells[colAmount] ?? '') : '';
    const rawUnits = colUnits >= 0 ? (cells[colUnits] ?? '') : '';
    const rawProduct = colProduct >= 0 ? (cells[colProduct] ?? '') : '';

    const normalizedDate = rawDate ? normalizeCsvDate(rawDate) : `${fallbackMonth}-15`;
    const amount = parseMonetaryAmount(rawAmount);
    const parsedUnits = rawUnits.trim() ? Number(rawUnits.replace(',', '.')) : undefined;

    const errors: string[] = [];
    if (!normalizedDate) {
      errors.push('Fecha inválida (usa AAAA-MM-DD o DD/MM/AAAA)');
    }
    if (!rawDesc || rawDesc.trim().length < 2) {
      errors.push('Falta descripción');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push('Monto debe ser mayor a 0');
    }
    if (
      parsedUnits !== undefined &&
      (!Number.isFinite(parsedUnits) || parsedUnits < 0)
    ) {
      errors.push('Unidades inválidas');
    }

    let matchedProductId: string | undefined;
    let matchedProductName: string | undefined;
    if (rawProduct.trim()) {
      const needle = rawProduct.trim().toLowerCase();
      const found = business.products.find(
        (p) => p.id.toLowerCase() === needle || p.name.trim().toLowerCase() === needle
      );
      if (found) {
        matchedProductId = found.id;
        matchedProductName = found.name;
      } else {
        matchedProductName = `${rawProduct.trim()} (sin coincidencia)`;
      }
    }

    const safeDate = normalizedDate ?? `${fallbackMonth}-15`;
    allRows.push({
      lineNumber,
      date: safeDate,
      month: safeDate.slice(0, 7),
      description: rawDesc.trim().slice(0, 140),
      amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0,
      units:
        parsedUnits !== undefined && Number.isFinite(parsedUnits) && parsedUnits > 0
          ? Math.round(parsedUnits)
          : undefined,
      productId: matchedProductId,
      productName: matchedProductName,
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join(' · ') : undefined,
    });
  }

  const validRows = allRows.filter((r) => r.valid);
  const invalidRows = allRows.filter((r) => !r.valid);

  return {
    delimiter,
    totalRows: allRows.length,
    validRows,
    invalidRows,
    allRows,
    totalValidAmount: validRows.reduce((s, r) => s + r.amount, 0),
    totalValidUnits: validRows.reduce((s, r) => s + (r.units ?? 0), 0),
  };
}

export function buildSalesCsvImportPatch(
  business: BusinessWorkspace,
  validRows: ParsedCsvSaleRow[]
): Partial<BusinessWorkspace> {
  const nextActuals = { ...(business.actuals ?? {}) };
  const rows = validRows.filter((r) => r.valid && r.amount > 0);

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const existingRec = nextActuals[row.month] ?? {
      month: row.month,
      transactions: [],
    };
    const newTx: ActualTransaction = {
      id: `tx-csv-${Date.now()}-${idx}`,
      date: row.date,
      description: row.description,
      type: 'income',
      amount: row.amount,
      ...(row.units ? { units: row.units } : {}),
      ...(row.productId ? { productId: row.productId } : {}),
    };
    nextActuals[row.month] = {
      ...existingRec,
      transactions: [...(existingRec.transactions ?? []), newTx],
    };
  }

  return { actuals: nextActuals };
}

/* ============================================================================
 * 3.4 PAYLOAD PARA RESUMEN MENSUAL POR CORREO ("ASÍ TE FUE EN ESTE MES")
 * ============================================================================ */

export interface MonthlySummaryEmailPayload {
  businessName: string;
  month: string;
  monthLabel: string;
  incomeFormatted: string;
  expensesFormatted: string;
  profitFormatted: string;
  projectedIncomeFormatted: string;
  breakEvenUnitsLabel: string;
  statusLabel: string;
  highlights: string[];
}

export function buildMonthlySummaryEmailPayload(
  business: BusinessWorkspace,
  month: string = getCurrentYearMonth()
): MonthlySummaryEmailPayload {
  const close = buildGuidedMonthCloseSummary(business, month);
  const weighted = getWeightedMixEconomics(business.products);
  const c = business.currency;

  const monthlyFixedCosts = business.fixedCosts.reduce((s, fc) => s + (Number(fc.amount) || 0), 0);
  const breakEvenUnits =
    weighted.weightedUnitContribution > 0
      ? Math.ceil(monthlyFixedCosts / weighted.weightedUnitContribution)
      : null;

  const statusLabel = !close.hasActualData
    ? 'Aún sin movimientos reales registrados en este mes'
    : close.actualProfit >= close.projectedProfit
      ? 'Sobre tu meta proyectada del mes'
      : close.actualProfit >= 0
        ? 'Mes con saldo positivo'
        : 'Mes bajo el punto de equilibrio';

  return {
    businessName: business.name,
    month: close.month,
    monthLabel: close.monthLabel,
    incomeFormatted: formatCurrency(close.actualIncome, c),
    expensesFormatted: formatCurrency(close.actualExpenses, c),
    profitFormatted: formatCurrency(close.actualProfit, c),
    projectedIncomeFormatted: formatCurrency(close.projectedIncome, c),
    breakEvenUnitsLabel: breakEvenUnits !== null ? `${breakEvenUnits} unidades/mes` : 'Por definir',
    statusLabel,
    highlights: close.deviationExplanations.slice(0, 4),
  };
}

/* ============================================================================
 * 3.6 REFERIDOS: REGLAS Y CÁLCULO DE +1 MES GRATIS PARA AMBAS PYMES
 * ============================================================================ */

export const REFERRAL_BONUS_DAYS = 30;

export const REFERRAL_PROGRAM_RULES: string[] = [
  'Cada pyme activa puede generar códigos de invitación únicos (REF-...) para compartir con otra pyme o emprendimiento.',
  'Cuando la pyme invitada canjea el código al activar o renovar su cuenta, recibe automáticamente 1 mes completo (+30 días) de acceso en Equilibrio.',
  'Una vez canjeado el código por una pyme distinta, la pyme anfitriona gana +1 mes (+30 días) adicionales en su vigencia actual (acreditados desde el Panel Administrador o al confirmar el referido).',
  'Cada código de referido es de un solo uso y no puede ser canjeado por la misma cuenta que lo creó.',
];

/**
 * Suma `bonusDays` (por defecto 30 = 1 mes) a partir del mayor entre hoy o `currentDueISO`.
 */
export function computeReferralBonusDueDate(
  currentDueISO?: string | null,
  bonusDays: number = REFERRAL_BONUS_DAYS,
  referenceDate: Date = new Date()
): string {
  const safeDays = Math.max(1, Math.min(365, Math.round(bonusDays)));
  const todayISO = toISODateLocal(referenceDate);
  const todayDate = parseISODateLocal(todayISO) ?? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  let baseDate = todayDate;
  if (currentDueISO && /^\d{4}-\d{2}-\d{2}$/.test(currentDueISO)) {
    const parsedDue = parseISODateLocal(currentDueISO);
    if (parsedDue && parsedDue.getTime() > todayDate.getTime()) {
      baseDate = parsedDue;
    }
  }

  const next = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + safeDays);
  return toISODateLocal(next);
}

export function buildReferralInviteCodeString(uid: string): string {
  const prefix = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'PYME';
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REF-${prefix}-${rand}`;
}
