import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Apple,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  Compass,
  CreditCard,
  Download,
  FileText,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Leaf,
  Sun,
  TrendingUp,
} from 'lucide-react';
import type { ChartConfiguration } from 'chart.js';
import {
  buildBreakEvenChartSeries,
  buildMonthlyProjections,
  calculateBreakEvenAndTarget,
  compareMonthActualVsProjected,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  formatPercent,
  getCurrentYearMonth,
  getFixedCostsByCategory,
  getTotalFixedCostsForMonth,
} from '../finance/formulas';
import { calculateMarginOfSafetyAnalysis } from '../finance/phase1Insights';
import {
  calculateCashAlertAndRunway,
  calculateFinancialRatiosWithStatus,
  calculateOwnerSalaryImpact,
} from '../finance/phase2Insights';
import {
  calculateCashFlowProjection,
  calculateInventorySummary,
  calculatePayablesSummary,
  calculateReceivablesSummary,
  calculateWorkingCapital,
  generateFinancialAnalystReport,
} from '../finance/smeIntelligence';
import type { BusinessWorkspace, ColorTone, ViewTab } from '../types/finance';
import { exportBusinessToCSV, exportBusinessToPDF } from '../utils/exportReports';
import { FinancialAnalystPanel } from './FinancialAnalystPanel';
import {
  DoodleSproutMotif,
  EquilibrioProductIcon,
  GrowyCharacterArtwork,
  GrowyDivider,
  GrowyEmptyStateIllustration,
} from './GrowyMotifs';
import { ChartCanvas } from './ChartCanvas';
import {
  AnalystMessage,
  HeroBanner,
  IncomeVsExpenseBarChart,
  SectionTitle,
  SolidCard,
  StatRing,
} from './design-system';
import { AnimatedNumber, GROWY_EASE, StaggerItem, StaggerSection } from './MotionPrimitives';
import { motion } from 'motion/react';

export type DashboardSubTab = 'overview' | 'analyst';

interface DashboardViewProps {
  business: BusinessWorkspace;
  isDark: boolean;
  colorTone: ColorTone;
  userName?: string;
  onNavigate: (tab: ViewTab, subTab?: string) => void;
  initialSubTab?: DashboardSubTab;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  business,
  isDark,
  colorTone,
  userName,
  onNavigate,
  initialSubTab = 'overview',
}) => {
  const [subTab, setSubTab] = useState<DashboardSubTab>(initialSubTab);
  const [showSafetyTooltip, setShowSafetyTooltip] = useState(false);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const currentMonth = getCurrentYearMonth();
  const projections = useMemo(() => buildMonthlyProjections(business), [business]);

  const smeMetrics = useMemo(() => {
    const ar = calculateReceivablesSummary(business.receivables);
    const ap = calculatePayablesSummary(business.payables);
    const inv = calculateInventorySummary(business);
    const cf = calculateCashFlowProjection(business);
    const wc = calculateWorkingCapital(business, cf, ar, ap, inv);
    const analyst = generateFinancialAnalystReport(business);
    const cashRunway = calculateCashAlertAndRunway(business);
    const financialRatios = calculateFinancialRatiosWithStatus(business);
    return { ar, ap, inv, cf, wc, analyst, cashRunway, financialRatios };
  }, [business]);

  // Si el mes actual está dentro de la proyección úsalo, si no el primero disponible
  const activeProj = useMemo(
    () => projections.find((p) => p.month === currentMonth) ?? projections[0],
    [projections, currentMonth]
  );

  const comparisons = useMemo(
    () =>
      projections.map((proj) =>
        compareMonthActualVsProjected({
          projected: proj,
          actualRecord: business.actuals[proj.month],
          business,
        })
      ),
    [projections, business]
  );

  const activeComparison = useMemo(
    () => comparisons.find((c) => c.month === activeProj?.month) ?? comparisons[0],
    [comparisons, activeProj]
  );

  const fixedNow = useMemo(
    () => getTotalFixedCostsForMonth(business.fixedCosts, activeProj?.month ?? currentMonth),
    [business.fixedCosts, activeProj, currentMonth]
  );

  const analysis = useMemo(
    () =>
      calculateBreakEvenAndTarget({
        fixedCosts: fixedNow,
        products: business.products,
        targetProfit: business.targetProfit,
        expectedUnits: business.expectedMonthlyUnits,
      }),
    [fixedNow, business.products, business.targetProfit, business.expectedMonthlyUnits]
  );

  const ownerSalaryImpact = useMemo(
    () => calculateOwnerSalaryImpact(business, activeProj?.month ?? currentMonth),
    [business, activeProj, currentMonth]
  );

  const fixedByCategory = useMemo(
    () => getFixedCostsByCategory(business.fixedCosts, activeProj?.month ?? currentMonth),
    [business.fixedCosts, activeProj, currentMonth]
  );

  // Colores adaptados a modo claro/oscuro y tono visual ("Cálido editorial" / Ejecutivo)
  const palette = useMemo(() => {
    if (colorTone === 'formal') {
      return {
        text: isDark ? '#F1F5F9' : '#1F1B2E',
        muted: isDark ? '#94A3B8' : '#5A5470',
        grid: isDark ? 'rgba(241, 245, 249, 0.08)' : 'rgba(31, 27, 46, 0.06)',
        terracotta: isDark ? '#93C5FD' : '#1F1B2E',
        terracottaFill: isDark ? 'rgba(147, 197, 253, 0.8)' : 'rgba(31, 27, 46, 0.88)',
        sage: isDark ? '#6FAE8A' : '#3F7A5C',
        sageFill: isDark ? 'rgba(111, 174, 138, 0.85)' : 'rgba(63, 122, 92, 0.86)',
        sageArea: isDark ? 'rgba(111, 174, 138, 0.16)' : 'rgba(63, 122, 92, 0.12)',
        petrol: isDark ? '#CBD5E1' : '#5A5470',
        ochre: isDark ? '#F3D27A' : '#B45309',
        rose: isDark ? '#F6A59E' : '#B4474A',
        sand: isDark ? '#64748B' : '#CFC5EE',
      };
    }
    return {
      text: isDark ? '#FFF7F3' : '#1F1B2E',
      muted: isDark ? '#CFC5EE' : '#5A5470',
      grid: isDark ? 'rgba(255, 247, 243, 0.08)' : 'rgba(31, 27, 46, 0.06)',
      terracotta: isDark ? '#F6A59E' : '#1F1B2E',
      terracottaFill: isDark ? 'rgba(246, 165, 158, 0.82)' : 'rgba(31, 27, 46, 0.86)',
      sage: isDark ? '#6FAE8A' : '#3F7A5C',
      sageFill: isDark ? 'rgba(111, 174, 138, 0.84)' : 'rgba(63, 122, 92, 0.86)',
      sageArea: isDark ? 'rgba(111, 174, 138, 0.18)' : 'rgba(63, 122, 92, 0.14)',
      petrol: isDark ? '#CFC5EE' : '#CFC5EE',
      ochre: isDark ? '#F3D27A' : '#E9B949',
      rose: isDark ? '#F6A59E' : '#F6A59E',
      sand: isDark ? '#8C8594' : '#BFE0CC',
    };
  }, [isDark, colorTone]);

  // 1. Gráfico Ingresos vs Egresos por mes (proyectado + real si existe)
  const incomeVsExpenseConfig = useMemo<ChartConfiguration>(() => {
    const slice = comparisons.slice(0, 12);
    return {
      type: 'bar',
      data: {
        labels: slice.map((c) => c.projected.monthLabel),
        datasets: [
          {
            label: 'Ingresos proyectados',
            data: slice.map((c) => Math.round(c.projected.projectedRevenue)),
            backgroundColor: palette.sageFill,
            borderRadius: 8,
          },
          {
            label: 'Costos proyectados',
            data: slice.map((c) => Math.round(c.projected.projectedTotalCosts)),
            backgroundColor: palette.terracottaFill,
            borderRadius: 8,
          },
          {
            label: 'Ingresos reales',
            data: slice.map((c) => (c.actual.hasData ? Math.round(c.actual.income) : null)),
            backgroundColor: palette.petrol,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: palette.text, boxWidth: 12 } },
        },
        scales: {
          x: { ticks: { color: palette.muted }, grid: { display: false } },
          y: {
            ticks: {
              color: palette.muted,
              callback: (v) => formatCurrency(Number(v), business.currency),
            },
            grid: { color: palette.grid },
          },
        },
      },
    };
  }, [comparisons, palette, business.currency]);

  // 2. Evolución de la utilidad (proyectada vs real)
  const profitEvolutionConfig = useMemo<ChartConfiguration>(() => {
    const slice = comparisons.slice(0, 12);
    return {
      type: 'line',
      data: {
        labels: slice.map((c) => c.projected.monthLabel),
        datasets: [
          {
            label: 'Utilidad proyectada',
            data: slice.map((c) => Math.round(c.projected.projectedProfit)),
            borderColor: palette.sage,
            backgroundColor: palette.sageArea,
            fill: true,
            tension: 0.35,
            pointRadius: 3.5,
          },
          {
            label: 'Utilidad real',
            data: slice.map((c) => (c.actual.hasData ? Math.round(c.actual.profit) : null)),
            borderColor: palette.terracotta,
            backgroundColor: palette.terracotta,
            borderWidth: 2.5,
            tension: 0.25,
            pointRadius: 5,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: palette.text, boxWidth: 12 } },
        },
        scales: {
          x: { ticks: { color: palette.muted }, grid: { display: false } },
          y: {
            ticks: {
              color: palette.muted,
              callback: (v) => formatCurrency(Number(v), business.currency),
            },
            grid: { color: palette.grid },
          },
        },
      },
    };
  }, [comparisons, isDark, palette, business.currency]);

  // 3. Composición de costos del mes (Costos fijos por categoría + costo variable proyectado)
  const costCompositionConfig = useMemo<ChartConfiguration>(() => {
    const varCost = activeProj?.projectedVariableCosts ?? 0;
    const labels = [...fixedByCategory.map((c) => c.label), 'Costos variables (producción/envío)'];
    const values = [...fixedByCategory.map((c) => Math.round(c.amount)), Math.round(varCost)];
    const colors = [
      palette.sage,
      palette.petrol,
      palette.ochre,
      palette.terracotta,
      palette.sand,
      palette.rose,
      isDark ? '#8C8594' : '#6E6D7A',
    ];

    return {
      type: 'doughnut',
      data: {
        labels: values.some((v) => v > 0) ? labels : ['Sin costos registrados'],
        datasets: [
          {
            data: values.some((v) => v > 0) ? values : [1],
            backgroundColor: values.some((v) => v > 0)
              ? colors.slice(0, values.length)
              : [palette.grid],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: palette.text, boxWidth: 11, padding: 12 },
          },
        },
      },
    };
  }, [fixedByCategory, activeProj, palette, isDark]);

  // 4. Gráfico clásico del Punto de Equilibrio (cruce de Ingresos Totales vs Costos Totales)
  const breakEvenChartConfig = useMemo<ChartConfiguration>(() => {
    const series = buildBreakEvenChartSeries({
      fixedCosts: analysis.fixedCosts,
      weightedPrice: analysis.weightedEconomics.weightedPrice,
      weightedVariableCost: analysis.weightedEconomics.weightedVariableCost,
      breakEvenUnits: analysis.breakEvenUnits,
      targetUnits: analysis.targetTotalUnits,
      expectedUnits: business.expectedMonthlyUnits,
    });

    return {
      type: 'line',
      data: {
        labels: series.labels.map((u) => `${u} u.`),
        datasets: [
          {
            label: 'Ingresos totales',
            data: series.revenueLine,
            borderColor: palette.sage,
            backgroundColor: palette.sageArea,
            fill: false,
            borderWidth: 2.5,
            tension: 0,
            pointRadius: 3,
          },
          {
            label: 'Costos totales (Fijos + Variables)',
            data: series.totalCostLine,
            borderColor: palette.terracotta,
            backgroundColor: palette.terracottaFill,
            fill: false,
            borderWidth: 2.5,
            tension: 0,
            pointRadius: 3,
          },
          {
            label: 'Costos fijos',
            data: series.fixedCostLine,
            borderColor: palette.ochre,
            borderDash: [5, 5],
            borderWidth: 1.6,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: palette.text, boxWidth: 12 } },
        },
        scales: {
          x: { ticks: { color: palette.muted }, grid: { display: false } },
          y: {
            ticks: {
              color: palette.muted,
              callback: (v) => formatCurrency(Number(v), business.currency),
            },
            grid: { color: palette.grid },
          },
        },
      },
    };
  }, [analysis, business.expectedMonthlyUnits, business.currency, palette, isDark]);

  // Avance de ventas del mes activo respecto a la meta total (CF + Ganancia objetivo)
  const currentSalesMoney = activeComparison?.actual.hasData
    ? activeComparison.actual.income
    : activeProj?.projectedRevenue ?? 0;
  const salesReferenceLabel = activeComparison?.actual.hasData ? 'Ventas reales' : 'Ventas proyectadas';
  const breakEvenProgressPct =
    analysis.breakEvenRevenue > 0
      ? Math.min(100, (currentSalesMoney / analysis.breakEvenRevenue) * 100)
      : 0;
  const targetProgressPct =
    analysis.targetRevenue > 0
      ? Math.min(100, (currentSalesMoney / analysis.targetRevenue) * 100)
      : 0;

  const safetyAnalysis = useMemo(
    () =>
      calculateMarginOfSafetyAnalysis({
        fixedCosts: fixedNow,
        weightedUnitContribution: analysis.weightedEconomics.weightedUnitContribution,
        weightedMarginPercent: analysis.weightedEconomics.weightedMarginPercent,
        currentOrProjectedSales: currentSalesMoney,
        breakEvenRevenue: analysis.breakEvenRevenue,
        isActualSales: Boolean(activeComparison?.actual.hasData && activeComparison.actual.income > 0),
        currency: business.currency,
      }),
    [
      fixedNow,
      analysis.weightedEconomics.weightedUnitContribution,
      analysis.weightedEconomics.weightedMarginPercent,
      currentSalesMoney,
      analysis.breakEvenRevenue,
      activeComparison?.actual.hasData,
      activeComparison?.actual.income,
      business.currency,
    ]
  );

  const priorityAlerts = smeMetrics.analyst.insights
    .filter((i) => i.severity === 'critical' || i.severity === 'warning')
    .slice(0, 3);

  const firstName = useMemo(() => {
    const clean = (userName ?? '').trim();
    if (!clean) return 'Emprendedor';
    return clean.split(/\s+/)[0] || 'Emprendedor';
  }, [userName]);

  const subTabBar = (
    <div
      role="tablist"
      aria-label="Vistas del Tablero"
      className="growy-tab-track"
    >
      <button
        type="button"
        role="tab"
        aria-selected={subTab === 'overview'}
        onClick={() => setSubTab('overview')}
        style={
          subTab === 'overview'
            ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
            : undefined
        }
        className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
          subTab === 'overview'
            ? 'shadow-xs'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <LayoutDashboard className="w-4 h-4" />
        <span>Tablero ejecutivo</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={subTab === 'analyst'}
        onClick={() => setSubTab('analyst')}
        style={
          subTab === 'analyst'
            ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
            : undefined
        }
        className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
          subTab === 'analyst'
            ? 'shadow-xs'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Compass className="w-4 h-4" />
        <span>
          Analista financiero PYME
          {priorityAlerts.length > 0 ? ` · ${priorityAlerts.length} alerta${priorityAlerts.length === 1 ? '' : 's'}` : ''}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onNavigate('simple')}
        className="min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 text-[var(--accent-strong)] hover:bg-[var(--bg-surface)]"
      >
        <Apple className="w-4 h-4 shrink-0" />
        <span>Con peras y manzanas</span>
      </button>
    </div>
  );

  if (subTab === 'analyst') {
    return (
      <div className="space-y-6">
        {subTabBar}
        <FinancialAnalystPanel business={business} onNavigate={onNavigate} />
      </div>
    );
  }

  if (business.products.length === 0) {
    return (
      <div className="space-y-6">
        {subTabBar}
        <motion.div
          data-tour="dashboard-overview"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: GROWY_EASE }}
          className="max-w-2xl mx-auto mt-6"
        >
          <SolidCard className="p-6 sm:p-8 text-center">
            <div className="growy-banner-surface relative overflow-hidden rounded-[28px] p-5 max-w-xs mx-auto mb-5">
              <div className="growy-banner-grain" aria-hidden="true" />
              <GrowyEmptyStateIllustration className="relative z-10 w-28 h-28 mx-auto" />
            </div>
            <SectionTitle
              align="center"
              as="h2"
              size="md"
              title="Comencemos a *impulsar* tus números"
              subtitle="Agrega al menos un producto o servicio y tus costos fijos mensuales para calcular tu punto de equilibrio, proyecciones, flujo de caja y gráficos en vivo."
            />
            <button
              type="button"
              onClick={() => onNavigate('catalog', 'catalog')}
              style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
              className="mt-6 inline-flex items-center justify-center min-h-[46px] px-7 py-2.5 rounded-full text-sm font-bold hover:opacity-92 transition-opacity cursor-pointer shadow-sm"
            >
              Configurar costos y catálogo
            </button>
          </SolidCard>
        </motion.div>
      </div>
    );
  }

  return (
    <StaggerSection className="space-y-6">
      {subTabBar}
      {/* HeroBanner Cálido editorial con saludo, chips y barra de avance */}
      <StaggerItem>
        <div data-tour="dashboard-overview">
          <HeroBanner
            headlineSize="greeting"
            eyebrow={`${formatMonthLabel(activeProj?.month ?? currentMonth)} · ${business.name} · ${business.currency.code}`}
            headline={`Hola, *${firstName}*`}
            subtitle={
              analysis.isViable
                ? activeComparison?.actual.hasData
                  ? activeComparison.interpretation
                  : `Tu punto de equilibrio este mes es de ${formatNumber(analysis.breakEvenUnits)} ventas (${formatCurrency(analysis.breakEvenRevenue, business.currency)}). Con ${formatNumber(analysis.targetTotalUnits)} ventas cumples tu meta de ganancia.`
                : 'Revisa tus costos variables y precios en Catálogo para que cada venta deje margen positivo.'
            }
            chips={[
              {
                id: 'simple',
                label: 'Explícame *simple*',
                onClick: () => onNavigate('simple'),
                variant: 'lilac',
              },
              {
                id: 'cashflow',
                label: 'Flujo de *caja*',
                onClick: () => onNavigate('projections', 'cashflow'),
                variant: 'sage',
              },
              {
                id: 'csv',
                label: 'Exportar *CSV*',
                onClick: () => exportBusinessToCSV(business),
                variant: 'cream',
              },
              {
                id: 'pdf',
                label: 'Descargar *PDF*',
                onClick: () => exportBusinessToPDF(business),
                variant: 'navy',
              },
            ]}
            rightSlot={
              <div className="flex flex-col items-center gap-2.5">
                <GrowyCharacterArtwork className="w-40 sm:w-44 lg:w-52 mx-auto block select-none" />
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/75 border border-[var(--banner-ink)]/20 text-[11px] font-bold text-[#1F1B2E] shadow-xs">
                  <EquilibrioProductIcon size="xs" />
                  <span className="font-mono tabular-nums">
                    Equilibrio: {formatNumber(analysis.breakEvenUnits)} u.
                  </span>
                </div>
              </div>
            }
            bottomSlot={
              <div className="pt-4 border-t border-[var(--banner-ink)]/15 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                  <span className="text-[var(--banner-ink)]">
                    {salesReferenceLabel}:{' '}
                    <span className="font-mono tabular-nums font-bold">
                      {formatCurrency(currentSalesMoney, business.currency)}
                    </span>
                  </span>
                  <span className="text-[var(--banner-ink-muted)] font-mono tabular-nums">
                    Equilibrio: {formatCurrency(analysis.breakEvenRevenue, business.currency)} (
                    {breakEvenProgressPct.toFixed(0)}%) · Meta:{' '}
                    {formatCurrency(analysis.targetRevenue, business.currency)}
                  </span>
                </div>

                <div className="h-3.5 w-full rounded-full bg-white/60 overflow-hidden flex border border-[var(--banner-ink)]/15">
                  <motion.div
                    className="h-full bg-[#E9B949] origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.65, ease: GROWY_EASE }}
                    style={{
                      width: `${Math.min(
                        targetProgressPct,
                        analysis.targetRevenue > 0
                          ? (analysis.breakEvenRevenue / analysis.targetRevenue) * 100
                          : 0
                      )}%`,
                    }}
                    title="Cobertura de costos fijos"
                  />
                  {currentSalesMoney > analysis.breakEvenRevenue && analysis.targetRevenue > 0 && (
                    <motion.div
                      className="h-full bg-[#3F7A5C] origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.72, delay: 0.12, ease: GROWY_EASE }}
                      style={{
                        width: `${Math.max(
                          0,
                          targetProgressPct -
                            (analysis.breakEvenRevenue / analysis.targetRevenue) * 100
                        )}%`,
                      }}
                      title="Zona de ganancia neta"
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-[var(--banner-ink-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-[#7A5400]" />
                    Primer tramo: cubre costos fijos
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Leaf className="w-3.5 h-3.5 text-[#224A36]" />
                    Segundo tramo: utilidad después del equilibrio
                  </span>
                </div>
              </div>
            }
          />
        </div>
      </StaggerItem>

      {/* 4 KPIs principales en tarjetas sólidas editoriales */}
      <StaggerItem>
        <StaggerSection className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover transition-transform duration-200 h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Punto de equilibrio mensual
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                  Base
                </span>
              </div>
              <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2.5">
                <AnimatedNumber
                  value={analysis.breakEvenUnits}
                  format={(n) => `${formatNumber(Math.round(n))} u.`}
                />
              </p>
              <p className="text-xs text-[var(--accent-strong)] mt-1 font-mono tabular-nums font-semibold">
                <AnimatedNumber
                  value={analysis.breakEvenRevenue}
                  format={(n) => `${formatCurrency(n, business.currency)} en ventas`}
                />
              </p>
            </SolidCard>
          </StaggerItem>

          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover transition-transform duration-200 h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Meta ({formatCurrency(business.targetProfit, business.currency)})
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--sec-soft)] text-[var(--sec-text)]">
                  Meta
                </span>
              </div>
              <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2.5">
                <AnimatedNumber
                  value={analysis.targetTotalUnits}
                  format={(n) => `${formatNumber(Math.round(n))} u.`}
                />
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono tabular-nums">
                {formatNumber(analysis.profitZoneUnits)} u. sobre el equilibrio
              </p>
            </SolidCard>
          </StaggerItem>

          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover transition-transform duration-200 h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Utilidad proyectada ({activeProj?.monthLabel})
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--pos-soft)] text-[var(--pos-text)]">
                  Proy.
                </span>
              </div>
              <p className="font-mono tabular-nums text-2xl font-bold text-[var(--pos-text)] mt-2.5">
                <AnimatedNumber
                  value={activeProj?.projectedProfit ?? 0}
                  format={(n) => formatCurrency(n, business.currency)}
                />
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-mono tabular-nums">
                Costos fijos: {formatCurrency(fixedNow, business.currency)}
              </p>
            </SolidCard>
          </StaggerItem>

          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover transition-transform duration-200 h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">
                  Utilidad real vs. proyectada
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--warn-soft)] text-[var(--warn-text)]">
                  Real
                </span>
              </div>
              {activeComparison?.actual.hasData ? (
                <>
                  <p
                    className={`font-mono tabular-nums text-2xl font-bold mt-2.5 ${
                      activeComparison.actual.profit >= 0
                        ? 'text-[var(--pos-text)]'
                        : 'text-[var(--danger-text)]'
                    }`}
                  >
                    <AnimatedNumber
                      value={activeComparison.actual.profit}
                      format={(n) => formatCurrency(n, business.currency)}
                    />
                  </p>
                  <p className="text-xs mt-1 inline-flex items-center gap-1 font-medium text-[var(--text-secondary)]">
                    {activeComparison.profitDiffMoney >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--pos-text)]" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-[var(--danger-text)]" />
                    )}
                    <span className="font-mono tabular-nums">
                      {activeComparison.profitDiffMoney >= 0 ? '+' : ''}
                      {formatCurrency(activeComparison.profitDiffMoney, business.currency)}
                    </span>{' '}
                    vs. meta del mes
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-[var(--text-primary)] mt-2.5">
                    Sin registro real
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('actuals')}
                    className="text-xs font-bold text-[var(--accent-strong)] underline underline-offset-4 mt-1 cursor-pointer"
                  >
                    Registrar movimientos del mes
                  </button>
                </>
              )}
            </SolidCard>
          </StaggerItem>
        </StaggerSection>
      </StaggerItem>

      {/* MARGEN DE CONTRIBUCIÓN Y MARGEN DE SEGURIDAD (StatRing + SolidCard) */}
      <StaggerItem>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-4">
            <StatRing
              title="Margen de *seguridad*"
              percentage={
                safetyAnalysis.hasSalesReference
                  ? Math.max(0, Math.min(100, safetyAnalysis.marginOfSafetyPercent))
                  : 0
              }
              centerLabel={
                safetyAnalysis.hasSalesReference
                  ? `${safetyAnalysis.marginOfSafetyPercent.toFixed(1)}%`
                  : '—'
              }
              status={
                safetyAnalysis.status === 'verde'
                  ? 'green'
                  : safetyAnalysis.status === 'amarillo'
                    ? 'amber'
                    : 'red'
              }
              statusLabel={`${
                safetyAnalysis.status === 'verde'
                  ? 'Verde'
                  : safetyAnalysis.status === 'amarillo'
                    ? 'Amarillo'
                    : 'Rojo'
              } · ${safetyAnalysis.statusLabel}`}
              subtitle={
                safetyAnalysis.isActualSales
                  ? 'Calculado con ventas reales del mes'
                  : 'Calculado con ventas proyectadas'
              }
              metrics={[
                {
                  label: 'Colchón en ventas',
                  value: formatCurrency(safetyAnalysis.marginOfSafetyMoney, business.currency),
                },
                {
                  label: 'Umbral saludable',
                  value: '>= 25% verde',
                },
              ]}
              className="h-full"
            />
          </div>

          <SolidCard className="lg:col-span-8 p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <SectionTitle
                    as="h2"
                    size="sm"
                    title="Margen de *contribución* y colchón"
                    subtitle={`Cuánto queda libre por venta (${safetyAnalysis.isActualSales ? 'ventas reales' : 'ventas proyectadas'}).`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSafetyTooltip((prev) => !prev)}
                    aria-label="¿Qué significa el margen de seguridad?"
                    aria-expanded={showSafetyTooltip}
                    className="text-[var(--sec-text)] hover:opacity-80 cursor-pointer shrink-0"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('simple')}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-4 rounded-full border border-[var(--sec-border)] bg-[var(--bg-soft-alt)] hover:bg-[var(--sec-soft)] text-xs font-semibold text-[var(--sec-text)] cursor-pointer transition-colors"
              >
                <Apple className="w-3.5 h-3.5" />
                <span>Ver en Explícame simple</span>
              </button>
            </div>

            {showSafetyTooltip && (
              <div className="p-3.5 rounded-[22px] bg-[var(--sec-soft)] border border-[var(--sec-border)] text-xs text-[var(--text-primary)] leading-relaxed">
                {safetyAnalysis.tooltipText}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  Margen de contribución promedio
                </p>
                <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)] mt-1">
                  {formatCurrency(safetyAnalysis.weightedUnitContribution, business.currency)}{' '}
                  <span className="text-xs font-semibold text-[var(--pos-text)]">
                    ({formatPercent(safetyAnalysis.weightedMarginPercent)})
                  </span>
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Aporte libre promedio por cada unidad vendida
                </p>
              </div>

              <div className="p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  Margen de contribución total del mes
                </p>
                <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)] mt-1">
                  {formatCurrency(safetyAnalysis.totalContributionMargin, business.currency)}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Para cubrir {formatCurrency(fixedNow, business.currency)} de costos fijos
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              <strong className="text-[var(--text-primary)]">En simple:</strong>{' '}
              {safetyAnalysis.simpleExplanation}
            </p>
          </SolidCard>
        </div>
      </StaggerItem>

      {/* AVISOS DEL ANALISTA PYME (estilo publicación AnalystMessage) */}
      <StaggerItem>
        <div className="space-y-3">
          <SectionTitle
            as="h2"
            size="sm"
            title="Lo *más* reciente de tu Analista PYME"
            subtitle="Lectura directa sobre caja, liquidez y obligaciones basada solo en tus datos."
            rightSlot={
              <button
                type="button"
                onClick={() => setSubTab('analyst')}
                style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-4 py-2 min-h-[38px] hover:opacity-92 transition-opacity cursor-pointer"
              >
                <span>Abrir Analista PYME</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnalystMessage
              authorName="Analista PYME"
              initials="AP"
              timestamp={formatMonthLabel(activeProj?.month ?? currentMonth)}
              category={
                smeMetrics.cashRunway.runwayMonths !== null
                  ? `Caja · ${smeMetrics.cashRunway.runwayMonths.toFixed(1)} meses`
                  : 'Caja y liquidez'
              }
              tone={
                smeMetrics.cashRunway.status === 'rojo'
                  ? 'coral'
                  : smeMetrics.cashRunway.status === 'amarillo'
                    ? 'gold'
                    : 'sage'
              }
              message={`${smeMetrics.cashRunway.headline}. ${smeMetrics.cashRunway.simpleExplanation}`}
              detailLabel="Ver Flujo de Caja"
              onViewDetail={() => onNavigate('projections', 'cashflow')}
              onExplainSimple={() => onNavigate('simple')}
            />

            {priorityAlerts.length > 0 ? (
              <AnalystMessage
                authorName="Analista PYME"
                initials="AP"
                timestamp="Alerta prioritaria"
                category={priorityAlerts[0].areaLabel}
                tone={priorityAlerts[0].severity === 'critical' ? 'coral' : 'gold'}
                message={`${priorityAlerts[0].title}. ${priorityAlerts[0].recommendation}`}
                detailLabel="Ver detalle"
                onViewDetail={() => setSubTab('analyst')}
                onExplainSimple={() => onNavigate('simple')}
              />
            ) : (
              <AnalystMessage
                authorName="Analista PYME"
                initials="AP"
                timestamp="Al día"
                category="Salud general"
                tone="lilac"
                message={
                  ownerSalaryImpact.hasIllusoryProfitRisk
                    ? 'Aún no incluyes el sueldo del dueño como costo fijo: puedes estar viendo una utilidad ilusoria si no descuentas tus horas.'
                    : `Tu estructura considera ${formatCurrency(ownerSalaryImpact.activeSalaryApplied, business.currency)}/mes de sueldo del dueño y equilibrio de ${formatNumber(ownerSalaryImpact.adjustedBreakEvenUnits)} u.`
                }
                detailLabel={
                  ownerSalaryImpact.hasIllusoryProfitRisk ? 'Configurar sueldo' : 'Ajustar sueldo'
                }
                onViewDetail={() => onNavigate('settings')}
                onExplainSimple={() => onNavigate('simple')}
              />
            )}
          </div>
        </div>
      </StaggerItem>

      {/* RESUMEN TESORERÍA E INTELIGENCIA PYME CON ACCESO AL DETALLE */}
      <StaggerItem>
        <SolidCard className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <DoodleSproutMotif className="w-8 h-8 shrink-0 hidden sm:block" />
              <SectionTitle
                as="h2"
                size="sm"
                title="Liquidez, *cobros* y razones simples"
                subtitle="Haz clic en cualquier indicador para ir directo a su detalle operativo."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('projections', 'cashflow')}
              className="text-left p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-[var(--pos-text)]" />
                <span>Saldo disponible</span>
              </p>
              <p
                className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                  smeMetrics.cf.currentAvailableCash >= 0
                    ? 'text-[var(--pos-text)]'
                    : 'text-[var(--danger-text)]'
                }`}
              >
                {smeMetrics.cf.hasCashData
                  ? formatCurrency(smeMetrics.cf.currentAvailableCash, business.currency)
                  : 'Sin definir'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                Caja real (excluye CxC)
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('projections', 'cashflow')}
              className="text-left p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--sec-text)]" />
                <span>Flujo caja proy. 12M</span>
              </p>
              <p
                className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                  smeMetrics.cf.endingProjectedBalance >= 0
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--danger-text)]'
                }`}
              >
                {formatCurrency(smeMetrics.cf.endingProjectedBalance, business.currency)}
              </p>
              <p
                className={`text-[10px] mt-0.5 font-semibold ${
                  smeMetrics.cf.deficitMonths.length > 0
                    ? 'text-[var(--danger-text)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {smeMetrics.cf.deficitMonths.length > 0
                  ? `${smeMetrics.cf.deficitMonths.length} mes(es) con déficit`
                  : 'Sin déficit proyectado'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('projections', 'cashflow')}
              className="text-left p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[var(--sec-text)]" />
                <span>Capital de trabajo</span>
              </p>
              <p
                className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                  !smeMetrics.wc.hasEnoughData
                    ? 'text-[var(--text-secondary)]'
                    : smeMetrics.wc.isNegative
                      ? 'text-[var(--danger-text)]'
                      : 'text-[var(--pos-text)]'
                }`}
              >
                {smeMetrics.wc.hasEnoughData
                  ? formatCurrency(smeMetrics.wc.netWorkingCapital, business.currency)
                  : 'Faltan datos'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                {smeMetrics.wc.currentRatio !== null
                  ? `Razón corr.: ${smeMetrics.wc.currentRatio.toFixed(2)}x`
                  : 'Activo − Pasivo corr.'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('actuals', 'receivables')}
              className="text-left p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                Cuentas por cobrar
              </p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)] mt-1">
                {formatCurrency(smeMetrics.ar.totalPending, business.currency)}
              </p>
              <p
                className={`text-[10px] mt-0.5 font-semibold ${
                  smeMetrics.ar.overdueCount > 0
                    ? 'text-[var(--danger-text)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {smeMetrics.ar.overdueCount > 0
                  ? `${smeMetrics.ar.overdueCount} vencida(s)`
                  : 'Sin documentos vencidos'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('actuals', 'payables')}
              className="text-left p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-[var(--warn-text)]" />
                <span>Cuentas por pagar</span>
              </p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)] mt-1">
                {formatCurrency(smeMetrics.ap.totalPending, business.currency)}
              </p>
              <p
                className={`text-[10px] mt-0.5 font-semibold ${
                  smeMetrics.ap.overdueCount > 0
                    ? 'text-[var(--danger-text)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                {smeMetrics.ap.overdueCount > 0
                  ? `${smeMetrics.ap.overdueCount} vencida(s)`
                  : `${smeMetrics.ap.upcomingCount} próxima(s) a vencer`}
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('catalog', 'inventory')}
              className="text-left p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                <span>Inventario valorizado</span>
              </p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)] mt-1">
                {smeMetrics.inv.hasTrackedProducts
                  ? formatCurrency(smeMetrics.inv.totalCurrentValue, business.currency)
                  : 'Sin activar'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                {smeMetrics.inv.hasTrackedProducts
                  ? smeMetrics.inv.outOfStockProducts.length +
                      smeMetrics.inv.lowStockProducts.length >
                    0
                    ? `${
                        smeMetrics.inv.outOfStockProducts.length +
                        smeMetrics.inv.lowStockProducts.length
                      } alerta(s) de stock`
                    : `${smeMetrics.inv.trackedCount} producto(s) activo(s)`
                  : 'Activar control de stock'}
              </p>
            </button>
          </div>

          {/* 2.3 Razones financieras simples con semáforo */}
          <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                Razones financieras simples (liquidez y stock)
              </p>
              <button
                type="button"
                onClick={() => onNavigate('simple')}
                className="text-[11px] font-bold text-[var(--sec-text)] hover:underline cursor-pointer"
              >
                Ver explicación con peras y manzanas →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {smeMetrics.financialRatios.ratios.map((ratio) => (
                <div
                  key={ratio.id}
                  className="p-3.5 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {ratio.name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        ratio.status === 'verde'
                          ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                          : ratio.status === 'amarillo'
                            ? 'bg-[var(--warn-soft)] text-[var(--warn-text)]'
                            : ratio.status === 'rojo'
                              ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                              : 'bg-[var(--bg-soft)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-1.5 h-1.5 rounded-full ${
                          ratio.status === 'verde'
                            ? 'bg-[var(--pos-dot)]'
                            : ratio.status === 'amarillo'
                              ? 'bg-[var(--warn-text)]'
                              : ratio.status === 'rojo'
                                ? 'bg-[var(--danger-text)]'
                                : 'bg-[var(--text-secondary)]'
                        }`}
                      />
                      <span>{ratio.statusLabel}</span>
                    </span>
                  </div>
                  <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)]">
                    {ratio.formattedValue}
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {ratio.liveExample}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 2.5 Sueldo del dueño / aviso de utilidad ilusoria */}
          <div
            className={`px-4 py-3 rounded-[22px] border text-xs flex flex-wrap items-center justify-between gap-2 ${
              ownerSalaryImpact.hasIllusoryProfitRisk
                ? 'bg-[var(--warn-soft)] border-[var(--warn-border)] text-[var(--warn-text)]'
                : 'bg-[var(--sec-soft)] border-[var(--sec-border)] text-[var(--sec-text)]'
            }`}
          >
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {ownerSalaryImpact.hasIllusoryProfitRisk ? (
                  <>
                    <strong>Sueldo del dueño no incluido:</strong> puedes estar viendo una{' '}
                    <strong>utilidad ilusoria</strong> (parte de la ganancia paga tus propias horas).
                  </>
                ) : (
                  <>
                    <strong>Sueldo del dueño activo:</strong> considerando{' '}
                    <span className="font-mono font-bold">
                      {formatCurrency(ownerSalaryImpact.activeSalaryApplied, business.currency)}
                    </span>
                    /mes de referencia, tu equilibrio real sube a{' '}
                    <span className="font-mono font-bold">
                      {formatNumber(ownerSalaryImpact.adjustedBreakEvenUnits)} u.
                    </span>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="font-bold underline underline-offset-4 cursor-pointer shrink-0"
            >
              {ownerSalaryImpact.hasIllusoryProfitRisk ? 'Configurar mi sueldo' : 'Ajustar sueldo'}
            </button>
          </div>
        </SolidCard>
      </StaggerItem>

      <StaggerItem>
        <GrowyDivider />
      </StaggerItem>

      {/* 4 Gráficos requeridos */}
      <StaggerItem>
        <StaggerSection className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover h-full">
              <div className="flex items-center justify-between gap-2 mb-4">
                <SectionTitle
                  as="h2"
                  size="sm"
                  title="Gráfico de *punto de equilibrio*"
                  subtitle="Donde se cruzan ingresos totales y costos totales nace tu utilidad."
                />
                <TrendingUp className="w-5 h-5 text-[var(--accent-strong)] shrink-0" />
              </div>
              <ChartCanvas
                config={breakEvenChartConfig}
                heightClass="h-72"
                ariaLabel="Gráfico de líneas de punto de equilibrio"
              />
            </SolidCard>
          </StaggerItem>

          <StaggerItem>
            {business.currency.code === 'CLP' ? (
              <IncomeVsExpenseBarChart
                title="Ingresos *vs* egresos por mes"
                themeKey={`${colorTone}-${isDark}`}
                data={comparisons.slice(0, 12).map((c) => ({
                  label: c.projected.monthLabel,
                  income: Math.round(
                    c.actual.hasData ? c.actual.income : c.projected.projectedRevenue
                  ),
                  expense: Math.round(
                    c.actual.hasData ? c.actual.totalExpense : c.projected.projectedTotalCosts
                  ),
                }))}
                className="h-full"
              />
            ) : (
              <SolidCard className="p-5 sm:p-6 boho-card-hover h-full">
                <div className="mb-4">
                  <SectionTitle
                    as="h2"
                    size="sm"
                    title="Ingresos *vs* egresos por mes"
                    subtitle="Comparativa mensual de 12 meses frente a tus registros reales."
                  />
                </div>
                <ChartCanvas
                  config={incomeVsExpenseConfig}
                  heightClass="h-72"
                  ariaLabel="Gráfico de barras de ingresos versus egresos mensuales"
                />
              </SolidCard>
            )}
          </StaggerItem>

          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover h-full">
              <div className="mb-4">
                <SectionTitle
                  as="h2"
                  size="sm"
                  title="Evolución de la *utilidad*"
                  subtitle="Trayectoria de ganancia proyectada frente a resultados reales."
                />
              </div>
              <ChartCanvas
                config={profitEvolutionConfig}
                heightClass="h-72"
                ariaLabel="Gráfico de evolución de utilidad mensual"
              />
            </SolidCard>
          </StaggerItem>

          <StaggerItem>
            <SolidCard className="p-5 sm:p-6 boho-card-hover h-full">
              <div className="mb-4">
                <SectionTitle
                  as="h2"
                  size="sm"
                  title="Composición de *costos*"
                  subtitle="Distribución de costos fijos por categoría y costos variables del mes."
                />
              </div>
              <ChartCanvas
                config={costCompositionConfig}
                heightClass="h-72"
                ariaLabel="Gráfico circular de composición de costos"
              />
            </SolidCard>
          </StaggerItem>
        </StaggerSection>
      </StaggerItem>
    </StaggerSection>
  );
};
