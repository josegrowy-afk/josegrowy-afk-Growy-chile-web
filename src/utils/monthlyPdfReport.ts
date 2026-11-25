import { jsPDF } from 'jspdf';
import {
  buildMonthlyProjections,
  calculateBreakEvenAndTarget,
  compareMonthActualVsProjected,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  formatPercent,
  getTotalFixedCostsForMonth,
} from '../finance/formulas';
import {
  calculateMarginOfSafetyAnalysis,
  calculateProductProfitabilityRanking,
} from '../finance/phase1Insights';
import {
  calculateCashFlowProjection,
  calculatePayablesSummary,
  calculateReceivablesSummary,
  generateFinancialAnalystReport,
} from '../finance/smeIntelligence';
import type { BusinessWorkspace } from '../types/finance';

async function loadLogoPngDataUrl(src: string): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo cargar logo'));
      img.src = src;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 160;
    canvas.height = img.naturalHeight || 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function downloadMonthlyFinancialReportPDF(
  business: BusinessWorkspace,
  selectedMonth: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = 276;

  const ensureSpace = (neededMm: number, currentY: number): number => {
    if (currentY + neededMm <= bottomLimit) return currentY;
    doc.addPage();
    return 18;
  };

  const monthLabel = formatMonthLabel(selectedMonth);
  const fixedNow = getTotalFixedCostsForMonth(business.fixedCosts, selectedMonth);
  const analysis = calculateBreakEvenAndTarget({
    fixedCosts: fixedNow,
    products: business.products,
    targetProfit: business.targetProfit,
    expectedUnits: business.expectedMonthlyUnits,
  });

  const projections = buildMonthlyProjections(business);
  const targetProjection =
    projections.find((p) => p.month === selectedMonth) ?? projections[0];
  const monthComparison = targetProjection
    ? compareMonthActualVsProjected({
        projected: targetProjection,
        actualRecord: business.actuals?.[selectedMonth],
        business,
      })
    : null;

  const isActualRef = Boolean(
    monthComparison?.actual.hasData && monthComparison.actual.income > 0
  );
  const refSales = isActualRef
    ? monthComparison?.actual.income ?? 0
    : targetProjection?.projectedRevenue ?? 0;

  const safetyAnalysis = calculateMarginOfSafetyAnalysis({
    fixedCosts: fixedNow,
    weightedUnitContribution: analysis.weightedEconomics.weightedUnitContribution,
    weightedMarginPercent: analysis.weightedEconomics.weightedMarginPercent,
    currentOrProjectedSales: refSales,
    breakEvenRevenue: analysis.breakEvenRevenue,
    isActualSales: isActualRef,
    currency: business.currency,
  });

  const cf = calculateCashFlowProjection(business);
  const ar = calculateReceivablesSummary(business.receivables);
  const ap = calculatePayablesSummary(business.payables);
  const ranking = calculateProductProfitabilityRanking(business, selectedMonth);
  const analyst = generateFinancialAnalystReport(business);
  const cashFlowRow =
    cf.rows.find((m) => m.month === selectedMonth) ?? cf.rows[0];

  // Encabezado oficial GROWy.
  doc.setFillColor(255, 247, 243); // #FFF7F3
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setDrawColor(233, 218, 224);
  doc.line(0, 36, pageWidth, 36);

  const logoDataUrl = await loadLogoPngDataUrl('/assets/growy-logo-mark.png');
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX, 7, 16, 16);
    } catch {
      // Continuar con marca tipográfica si la imagen falla
    }
  }

  const brandX = logoDataUrl ? marginX + 20 : marginX;
  doc.setTextColor(31, 27, 46); // #1F1B2E
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('GROWy.', brandX, 15);

  doc.setTextColor(180, 71, 74); // #B4474A
  doc.setFontSize(10.5);
  doc.text('Equilibrio · Informe Financiero Mensual', brandX, 21);

  doc.setTextColor(110, 109, 122);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(
    `${business.name} · Período: ${monthLabel} · Moneda: ${business.currency.code} · Emitido: ${new Date().toLocaleDateString('es-CL')}`,
    marginX,
    30
  );

  let y = 45;

  const drawSectionTitle = (title: string) => {
    y = ensureSpace(14, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(31, 27, 46);
    doc.text(title, marginX, y);
    y += 2;
    doc.setDrawColor(233, 218, 224);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 6;
  };

  // 1. Resumen ejecutivo e indicadores clave
  drawSectionTitle('1. Resumen ejecutivo e indicadores clave');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(45, 42, 58);

  const kpiLines = [
    `Punto de equilibrio mensual: ${formatNumber(analysis.breakEvenUnits)} unidades (${formatCurrency(analysis.breakEvenRevenue, business.currency)} en ventas).`,
    `Margen de contribución promedio: ${formatCurrency(analysis.weightedEconomics.weightedUnitContribution, business.currency)} por unidad (${formatPercent(analysis.weightedEconomics.weightedMarginPercent)}).`,
    `Margen de seguridad (${safetyAnalysis.isActualSales ? 'real' : 'proyectado'}): ${safetyAnalysis.hasSalesReference ? `${safetyAnalysis.marginOfSafetyPercent.toFixed(1)}% (${formatCurrency(safetyAnalysis.marginOfSafetyMoney, business.currency)})` : 'Sin ventas registradas/proyectadas'} · Estado: ${safetyAnalysis.status.toUpperCase()} (${safetyAnalysis.statusLabel}).`,
    `Costos fijos del mes: ${formatCurrency(fixedNow, business.currency)} · Meta de ganancia adicional: ${formatCurrency(business.targetProfit, business.currency)}.`,
  ];

  for (const line of kpiLines) {
    const wrapped = doc.splitTextToSize(`• ${line}`, contentWidth);
    y = ensureSpace(wrapped.length * 4.8 + 2, y);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.8 + 1;
  }

  // 2. Proyectado vs Real del mes
  y += 3;
  drawSectionTitle(`2. Proyectado vs. Real (${monthLabel})`);
  if (monthComparison) {
    doc.setFillColor(246, 242, 251);
    y = ensureSpace(18, y);
    doc.rect(marginX, y - 4, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Concepto', marginX + 2, y);
    doc.text('Proyectado', marginX + 76, y);
    doc.text('Real del mes', marginX + 116, y);
    doc.text('Diferencia', marginX + 154, y);
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    const compRows = [
      [
        'Ingresos',
        formatCurrency(monthComparison.projected.projectedRevenue, business.currency),
        monthComparison.actual.hasData
          ? formatCurrency(monthComparison.actual.income, business.currency)
          : 'Sin registro',
        monthComparison.actual.hasData
          ? `${monthComparison.revenueDiffMoney >= 0 ? '+' : ''}${formatCurrency(monthComparison.revenueDiffMoney, business.currency)}`
          : '—',
      ],
      [
        'Egresos totales',
        formatCurrency(monthComparison.projected.projectedTotalCosts, business.currency),
        monthComparison.actual.hasData
          ? formatCurrency(monthComparison.actual.totalExpense, business.currency)
          : 'Sin registro',
        monthComparison.actual.hasData
          ? `${monthComparison.expenseDiffMoney >= 0 ? '+' : ''}${formatCurrency(monthComparison.expenseDiffMoney, business.currency)}`
          : '—',
      ],
      [
        'Utilidad neta',
        formatCurrency(monthComparison.projected.projectedProfit, business.currency),
        monthComparison.actual.hasData
          ? formatCurrency(monthComparison.actual.profit, business.currency)
          : 'Sin registro',
        monthComparison.actual.hasData
          ? `${monthComparison.profitDiffMoney >= 0 ? '+' : ''}${formatCurrency(monthComparison.profitDiffMoney, business.currency)}`
          : '—',
      ],
    ];

    for (const [concept, projVal, actVal, diffVal] of compRows) {
      y = ensureSpace(6, y);
      doc.text(concept, marginX + 2, y);
      doc.text(projVal, marginX + 76, y);
      doc.text(actVal, marginX + 116, y);
      doc.text(diffVal, marginX + 154, y);
      y += 5.5;
    }

    const interpLines = doc.splitTextToSize(
      `Lectura del mes: ${monthComparison.interpretation} (${monthComparison.statusLabel}).`,
      contentWidth
    );
    y += 1.5;
    y = ensureSpace(interpLines.length * 4.6 + 2, y);
    doc.setTextColor(30, 122, 107);
    doc.setFont('helvetica', 'bold');
    doc.text(interpLines, marginX, y);
    doc.setTextColor(45, 42, 58);
    doc.setFont('helvetica', 'normal');
    y += interpLines.length * 4.6 + 2;
  }

  // 3. Flujo de caja y Cuentas por Cobrar / Pagar
  y += 2;
  drawSectionTitle('3. Flujo de caja, Cuentas por Cobrar (CxC) y por Pagar (CxP)');
  const cashLines = [
    `Caja disponible real hoy: ${cf.hasCashData ? formatCurrency(cf.currentAvailableCash, business.currency) : 'Sin saldo inicial configurado'} · Saldo proyectado al cierre 12M: ${formatCurrency(cf.endingProjectedBalance, business.currency)}.`,
    cashFlowRow
      ? `Flujo neto proyectado en ${monthLabel}: ${formatCurrency(cashFlowRow.netCashFlow, business.currency)} (saldo acumulado proyectado: ${formatCurrency(cashFlowRow.closingBalance, business.currency)}).`
      : 'Sin detalle de flujo para el mes seleccionado.',
    `Cuentas por cobrar (CxC): ${formatCurrency(ar.totalPending, business.currency)} pendientes (${ar.overdueCount} vencidas por ${formatCurrency(ar.overdueAmount, business.currency)}).`,
    `Cuentas por pagar (CxP): ${formatCurrency(ap.totalPending, business.currency)} pendientes (${ap.overdueCount} vencidas por ${formatCurrency(ap.overdueAmount, business.currency)}).`,
  ];

  for (const line of cashLines) {
    const wrapped = doc.splitTextToSize(`• ${line}`, contentWidth);
    y = ensureSpace(wrapped.length * 4.8 + 2, y);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.8 + 1;
  }

  // 4. Rentabilidad por producto (Pareto 80/20)
  if (ranking.rows.length > 0) {
    y += 3;
    drawSectionTitle('4. Rentabilidad por producto (Pareto 80/20)');
    doc.setFillColor(232, 244, 240);
    y = ensureSpace(16, y);
    doc.rect(marginX, y - 4, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Producto', marginX + 2, y);
    doc.text('Vol.', marginX + 74, y);
    doc.text('Margen Total', marginX + 94, y);
    doc.text('Aporte', marginX + 128, y);
    doc.text('Margen/h', marginX + 150, y);
    y += 6.5;

    doc.setFont('helvetica', 'normal');
    for (const row of ranking.rows.slice(0, 12)) {
      y = ensureSpace(6.5, y);
      const flags = [
        row.isParetoTop80 ? '80/20' : '',
        row.isHighVolumeLowMargin ? 'Bajo margen' : '',
      ]
        .filter(Boolean)
        .join(' · ');
      const titleText = flags
        ? `${row.rank}. ${row.productName} [${flags}]`
        : `${row.rank}. ${row.productName}`;
      doc.text(titleText.slice(0, 38), marginX + 2, y);
      doc.text(`${formatNumber(row.units)} u.`, marginX + 74, y);
      doc.text(formatCurrency(row.totalMargin, business.currency), marginX + 94, y);
      doc.text(`${row.profitSharePercent.toFixed(1)}%`, marginX + 128, y);
      doc.text(
        row.marginPerHour !== null
          ? `${formatCurrency(row.marginPerHour, business.currency)}/h`
          : '—',
        marginX + 150,
        y
      );
      y += 5.5;
    }
  }

  // 5. Alertas y puntos de atención
  y += 3;
  drawSectionTitle('5. Alertas y observaciones del período');
  const alertsToPrint = analyst.insights.filter(
    (ins) => ins.severity === 'critical' || ins.severity === 'warning'
  );
  if (alertsToPrint.length === 0) {
    y = ensureSpace(7, y);
    doc.text(
      '• Sin alertas críticas o advertencias activas para los datos ingresados.',
      marginX,
      y
    );
    y += 6;
  } else {
    for (const alert of alertsToPrint.slice(0, 6)) {
      const prefix = alert.severity === 'critical' ? '[Atención hoy]' : '[Revisar]';
      const wrapped = doc.splitTextToSize(
        `• ${prefix} ${alert.title}: ${alert.explanation}`,
        contentWidth
      );
      y = ensureSpace(wrapped.length * 4.6 + 2, y);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 4.6 + 1;
    }
  }

  // Pie de página en todas las hojas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(125, 120, 138);
    doc.text(
      'GROWy. · Equilibrio — Informe referencial para presentación financiera. No reemplaza la asesoría de tu contador.',
      marginX,
      288
    );
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX - 18, 288);
  }

  const slug = business.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-');
  doc.save(`growy-informe-${slug}-${selectedMonth}.pdf`);
}
