import { jsPDF } from 'jspdf';
import {
  buildMonthlyProjections,
  calculateBreakEvenAndTarget,
  compareMonthActualVsProjected,
  formatCurrency,
  formatNumber,
  formatPercent,
  getCurrentYearMonth,
  getTotalFixedCostsForMonth,
} from '../finance/formulas';
import type { BusinessWorkspace } from '../types/finance';

function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportBusinessToCSV(business: BusinessWorkspace): void {
  const projections = buildMonthlyProjections(business);
  const comparisons = projections.map((proj) =>
    compareMonthActualVsProjected({
      projected: proj,
      actualRecord: business.actuals[proj.month],
      business,
    })
  );

  const headers = [
    'Mes',
    'Unidades Proyectadas',
    'Ingresos Proyectados',
    'Costos Variables Proyectados',
    'Costos Fijos Proyectados',
    'Utilidad Proyectada',
    'Punto de Equilibrio (Unidades)',
    'Punto de Equilibrio (Dinero)',
    'Ingresos Reales',
    'Egresos Reales Totales',
    'Utilidad Real',
    'Diferencia Ingresos',
    'Estado',
    'Interpretación',
  ];

  const rows = comparisons.map((c) => [
    c.monthLabel,
    c.projected.totalUnits,
    Math.round(c.projected.projectedRevenue),
    Math.round(c.projected.projectedVariableCosts),
    Math.round(c.projected.projectedFixedCosts),
    Math.round(c.projected.projectedProfit),
    c.projected.breakEvenUnits,
    Math.round(c.projected.breakEvenRevenue),
    c.actual.hasData ? Math.round(c.actual.income) : '',
    c.actual.hasData ? Math.round(c.actual.totalExpense) : '',
    c.actual.hasData ? Math.round(c.actual.profit) : '',
    c.actual.hasData ? Math.round(c.revenueDiffMoney) : '',
    c.statusLabel,
    c.interpretation,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join(
      '\n'
    );

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = business.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  a.href = url;
  a.download = `growy-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportBusinessToPDF(business: BusinessWorkspace): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const currentMonth = getCurrentYearMonth();
  const fixedNow = getTotalFixedCostsForMonth(business.fixedCosts, currentMonth);
  const analysis = calculateBreakEvenAndTarget({
    fixedCosts: fixedNow,
    products: business.products,
    targetProfit: business.targetProfit,
    expectedUnits: business.expectedMonthlyUnits,
  });
  const projections = buildMonthlyProjections(business);

  let y = 18;
  // Encabezado pastel GROWy
  doc.setFillColor(253, 244, 245);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(26, 26, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`GROWy. — ${business.name}`, 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 92, 74);
  doc.text(
    `Reporte financiero · Moneda: ${business.currency.code} · Generado: ${new Date().toLocaleDateString('es-ES')}`,
    14,
    y
  );

  y = 44;
  doc.setTextColor(61, 43, 31);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Resumen de Punto de Equilibrio y Meta de Ganancia', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const summaryLines = [
    `Costos fijos mensuales actuales: ${formatCurrency(fixedNow, business.currency)}`,
    `Margen de contribución promedio: ${formatCurrency(analysis.weightedEconomics.weightedUnitContribution, business.currency)} (${formatPercent(analysis.weightedEconomics.weightedMarginPercent)})`,
    `Punto de equilibrio: ${formatNumber(analysis.breakEvenUnits)} unidades · ${formatCurrency(analysis.breakEvenRevenue, business.currency)} en ventas`,
    `Meta de ganancia (después del equilibrio): ${formatCurrency(business.targetProfit, business.currency)}`,
    `Ventas necesarias para meta total: ${formatNumber(analysis.targetTotalUnits)} unidades · ${formatCurrency(analysis.targetRevenue, business.currency)}`,
    `Margen de seguridad (con ${formatNumber(business.expectedMonthlyUnits)} u. esperadas): ${formatCurrency(analysis.marginOfSafetyMoney, business.currency)} (${formatPercent(analysis.marginOfSafetyPercent)})`,
  ];

  summaryLines.forEach((line) => {
    doc.text(`• ${line}`, 16, y);
    y += 5.5;
  });

  if (analysis.perProduct.length > 0) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('2. Análisis Individual por Producto o Servicio', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    analysis.perProduct.forEach((p) => {
      doc.text(
        p.unitContributionMargin > 0
          ? `• ${p.productName} (Margen ${formatPercent(p.contributionMarginPercent, 1)}): Equilibrio ${p.standaloneBreakEvenUnits} u. | Para meta ${p.standaloneTargetUnits} u.`
          : `• ${p.productName}: Margen no positivo`,
        16,
        y
      );
      y += 5.2;
    });
  }

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('3. Proyección Mensual y Comparación Real', 14, y);
  y += 7;

  // Cabecera tabla
  doc.setFillColor(232, 220, 200);
  doc.rect(14, y - 4, 182, 7, 'F');
  doc.setFontSize(8.5);
  doc.text('Mes', 16, y);
  doc.text('Uds.', 48, y);
  doc.text('Ing. Proy.', 66, y);
  doc.text('Costos Proy.', 98, y);
  doc.text('Util. Proy.', 130, y);
  doc.text('Util. Real', 162, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  projections.forEach((proj) => {
    if (y > 272) {
      doc.addPage();
      y = 20;
    }
    const comp = compareMonthActualVsProjected({
      projected: proj,
      actualRecord: business.actuals[proj.month],
      business,
    });
    doc.text(proj.monthLabel, 16, y);
    doc.text(String(proj.totalUnits), 48, y);
    doc.text(formatCurrency(proj.projectedRevenue, business.currency), 66, y);
    doc.text(formatCurrency(proj.projectedTotalCosts, business.currency), 98, y);
    doc.text(formatCurrency(proj.projectedProfit, business.currency), 130, y);
    doc.text(
      comp.actual.hasData ? formatCurrency(comp.actual.profit, business.currency) : '—',
      162,
      y
    );
    y += 5.5;
  });

  const slug = business.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  doc.save(`growy-reporte-${slug}.pdf`);
}
