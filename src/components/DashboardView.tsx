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
  GrowyDivider,
  GrowyEmptyStateIllustration,
} from './GrowyMotifs';
import { ChartCanvas } from './ChartCanvas';
import { AnimatedNumber, GROWY_EASE, StaggerItem, StaggerSection } from './MotionPrimitives';
import { motion } from 'motion/react';

export type DashboardSubTab = 'overview' | 'analyst';

interface DashboardViewProps {
  business: BusinessWorkspace;
  isDark: boolean;
  colorTone: ColorTone;
  onNavigate: (tab: ViewTab, subTab?: string) => void;
  initialSubTab?: DashboardSubTab;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  business,
  isDark,
  colorTone,
  onNavigate,
  initialSubTab = 'overview',
}) => {
  const [subTab, setSubTab] = useState<DashboardSubTab>(initialSubTab);

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
    return { ar, ap, inv, cf, wc, analyst };
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

  const fixedByCategory = useMemo(
    () => getFixedCostsByCategory(business.fixedCosts, activeProj?.month ?? currentMonth),
    [business.fixedCosts, activeProj, currentMonth]
  );

  // Colores adaptados a modo claro/oscuro y tono visual para Chart.js
  const palette = useMemo(() => {
    if (colorTone === 'formal') {
      return {
        text: isDark ? '#F1F5F9' : '#0F172A',
        muted: isDark ? '#94A3B8' : '#475569',
        grid: isDark ? 'rgba(241, 245, 249, 0.08)' : 'rgba(15, 23, 42, 0.06)',
        terracotta: isDark ? '#60A5FA' : '#1E3A5F',
        terracottaFill: isDark ? 'rgba(96, 165, 250, 0.78)' : 'rgba(30, 58, 95, 0.85)',
        sage: isDark ? '#34D399' : '#0F766E',
        sageFill: isDark ? 'rgba(52, 211, 153, 0.8)' : 'rgba(15, 118, 110, 0.84)',
        sageArea: isDark ? 'rgba(52, 211, 153, 0.16)' : 'rgba(15, 118, 110, 0.12)',
        petrol: isDark ? '#CBD5E1' : '#475569',
        ochre: isDark ? '#FBBF24' : '#B45309',
        rose: isDark ? '#93C5FD' : '#2563EB',
        sand: isDark ? '#64748B' : '#94A3B8',
      };
    }
    return {
      text: isDark ? '#F7F4F6' : '#1A1A1E',
      muted: isDark ? '#B0AAB8' : '#6E6D7A',
      grid: isDark ? 'rgba(247, 244, 246, 0.08)' : 'rgba(26, 26, 30, 0.06)',
      terracotta: isDark ? '#F29EA0' : '#E57379',
      terracottaFill: isDark ? 'rgba(242, 158, 160, 0.78)' : 'rgba(229, 115, 121, 0.82)',
      sage: isDark ? '#5CC4B3' : '#1E7A6B',
      sageFill: isDark ? 'rgba(92, 196, 179, 0.8)' : 'rgba(30, 122, 107, 0.82)',
      sageArea: isDark ? 'rgba(92, 196, 179, 0.16)' : 'rgba(30, 122, 107, 0.12)',
      petrol: isDark ? '#B1A3DC' : '#625296',
      ochre: isDark ? '#F4A974' : '#E0864B',
      rose: isDark ? '#D48C9C' : '#F2999B',
      sand: isDark ? '#8C8594' : '#A9A2B0',
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

  const priorityAlerts = smeMetrics.analyst.insights
    .filter((i) => i.severity === 'critical' || i.severity === 'warning')
    .slice(0, 3);

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
        className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
          subTab === 'overview'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <LayoutDashboard className="w-4 h-4 text-[var(--accent-strong)]" />
        <span>Tablero ejecutivo</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={subTab === 'analyst'}
        onClick={() => setSubTab('analyst')}
        className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
          subTab === 'analyst'
            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <Compass className="w-4 h-4 text-[var(--sec-text)]" />
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
          className="boho-card p-6 sm:p-8 text-center max-w-2xl mx-auto mt-6"
        >
          <div className="growy-hero-surface rounded-[24px] p-5 max-w-xs mx-auto mb-5">
            <GrowyEmptyStateIllustration className="w-28 h-28 mx-auto" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Comencemos a{' '}
            <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
              impulsar tus números
            </em>
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mt-2.5 leading-relaxed max-w-lg mx-auto">
            Agrega al menos un producto o servicio y tus costos fijos mensuales para calcular tu punto
            de equilibrio, proyecciones, flujo de caja y gráficos en vivo.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('catalog', 'catalog')}
            className="mt-6 inline-flex items-center justify-center min-h-[46px] px-7 py-2.5 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors cursor-pointer shadow-sm"
          >
            Configurar costos y catálogo
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <StaggerSection className="space-y-6">
      {subTabBar}
      {/* Encabezado limpio GROWy con acciones de exportación */}
      <StaggerItem>
        <section data-tour="dashboard-overview" className="boho-card growy-hero-surface relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 -top-14 w-56 h-56 rounded-full bg-[var(--accent-soft)] opacity-80 growy-breathe"
          />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5">
              <EquilibrioProductIcon size="xs" />
              <p className="text-xs font-semibold text-[var(--text-secondary)] flex flex-wrap items-center gap-2">
                <span>{formatMonthLabel(activeProj?.month ?? currentMonth)}</span>
                <span aria-hidden="true">·</span>
                <span>{business.name}</span>
                <span aria-hidden="true">·</span>
                <span>Moneda {business.currency.code}</span>
              </p>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-2.5 text-balance">
              {analysis.isViable ? (
                <>
                  Tu{' '}
                  <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                    punto de equilibrio
                  </em>{' '}
                  se alcanza con {formatNumber(analysis.breakEvenUnits)} ventas
                </>
              ) : (
                <>
                  Revisa tus márgenes para alcanzar{' '}
                  <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                    el equilibrio
                  </em>
                </>
              )}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-2.5 leading-relaxed">
              {activeComparison?.actual.hasData
                ? activeComparison.interpretation
                : `Necesitas ${formatCurrency(analysis.breakEvenRevenue, business.currency)} al mes para cubrir costos fijos, y ${formatNumber(analysis.targetTotalUnits)} ventas para lograr tu meta de ${formatCurrency(business.targetProfit, business.currency)} de ganancia.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('simple')}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-xs sm:text-sm font-bold text-[var(--accent-strong)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Apple className="w-4 h-4 shrink-0" />
              <span>Explícame en simple</span>
            </button>
            <button
              type="button"
              onClick={() => exportBusinessToCSV(business)}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--accent-soft)] text-sm font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[var(--accent-strong)]" />
              <span>Exportar CSV</span>
            </button>
            <button
              type="button"
              onClick={() => exportBusinessToPDF(business)}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>

        {/* Barra de avance visual: zona equilibrio vs zona ganancia */}
        <div className="relative mt-6 pt-5 border-t border-[var(--border-hairline)]">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold mb-2">
            <span className="text-[var(--text-primary)]">
              {salesReferenceLabel}:{' '}
              <span className="font-mono tabular-nums">
                {formatCurrency(currentSalesMoney, business.currency)}
              </span>
            </span>
            <span className="text-[var(--text-secondary)] font-mono tabular-nums">
              Equilibrio: {formatCurrency(analysis.breakEvenRevenue, business.currency)} (
              {breakEvenProgressPct.toFixed(0)}%) · Meta total:{' '}
              {formatCurrency(analysis.targetRevenue, business.currency)}
            </span>
          </div>

          <div className="h-3.5 w-full rounded-full bg-[var(--bg-track)] overflow-hidden flex">
            <motion.div
              className="h-full bg-[var(--warn-bar)] origin-left"
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
                className="h-full bg-[var(--pos-text)] origin-left"
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
          <div className="flex flex-wrap items-center gap-5 mt-2.5 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[var(--warn-text)]" />
              Primer tramo: cubre costos fijos
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-[var(--pos-text)]" />
              Segundo tramo: utilidad después del equilibrio
            </span>
          </div>
        </div>
        </section>
      </StaggerItem>

      {/* 4 KPIs principales */}
      <StaggerItem>
        <StaggerSection className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StaggerItem>
            <div className="rounded-[28px] p-5 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] boho-card-hover transition-transform duration-200 h-full">
              <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
                Punto de equilibrio mensual
              </p>
              <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2">
                <AnimatedNumber
                  value={analysis.breakEvenUnits}
                  format={(n) => `${formatNumber(Math.round(n))} u.`}
                />
              </p>
              <p className="text-xs text-[var(--accent-strong)] mt-1 font-mono tabular-nums font-medium">
                <AnimatedNumber
                  value={analysis.breakEvenRevenue}
                  format={(n) => `${formatCurrency(n, business.currency)} en ventas`}
                />
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="rounded-[28px] p-5 bg-[var(--sec-soft)] border border-[var(--sec-border)] boho-card-hover transition-transform duration-200 h-full">
              <p className="text-xs font-semibold text-[var(--sec-muted)]">
                Meta para ganar {formatCurrency(business.targetProfit, business.currency)}
              </p>
              <p className="font-mono tabular-nums text-2xl font-bold text-[var(--sec-text)] mt-2">
                <AnimatedNumber
                  value={analysis.targetTotalUnits}
                  format={(n) => `${formatNumber(Math.round(n))} u.`}
                />
              </p>
              <p className="text-xs text-[var(--sec-muted)] mt-1 font-mono tabular-nums">
                {formatNumber(analysis.profitZoneUnits)} u. sobre el equilibrio
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="rounded-[28px] p-5 bg-[var(--pos-soft)] border border-[var(--pos-border)] boho-card-hover transition-transform duration-200 h-full">
              <p className="text-xs font-semibold text-[var(--pos-muted)]">
                Utilidad proyectada ({activeProj?.monthLabel})
              </p>
              <p className="font-mono tabular-nums text-2xl font-bold text-[var(--pos-text)] mt-2">
                <AnimatedNumber
                  value={activeProj?.projectedProfit ?? 0}
                  format={(n) => formatCurrency(n, business.currency)}
                />
              </p>
              <p className="text-xs text-[var(--pos-muted)] mt-1 font-mono tabular-nums">
                Costos fijos: {formatCurrency(fixedNow, business.currency)}
              </p>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="rounded-[28px] p-5 bg-[var(--warn-soft)] border border-[var(--warn-border)] boho-card-hover transition-transform duration-200 h-full">
              <p className="text-xs font-semibold text-[var(--warn-muted)]">
                Utilidad real vs. proyectada
              </p>
              {activeComparison?.actual.hasData ? (
                <>
                  <p
                    className={`font-mono tabular-nums text-2xl font-bold mt-2 ${
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
                  <p className="text-xs mt-1 inline-flex items-center gap-1 font-medium text-[var(--warn-muted)]">
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
                  <p className="text-lg font-bold text-[var(--warn-text)] mt-2">
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
            </div>
          </StaggerItem>
        </StaggerSection>
      </StaggerItem>

      {/* RESUMEN TESORERÍA E INTELIGENCIA PYME CON ACCESO AL DETALLE */}
      <StaggerItem>
        <section className="boho-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <DoodleSproutMotif className="w-8 h-8 shrink-0 hidden sm:block" />
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text-primary)]">
                  Salud financiera PYME · Liquidez y obligaciones
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Haz clic en cualquier indicador para ir directo a su detalle operativo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('analyst')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)] bg-[var(--accent-soft)] hover:opacity-90 border border-[var(--accent-soft-border)] rounded-full px-4 py-2 transition-opacity cursor-pointer min-h-[38px]"
            >
              <span>Abrir Analista Financiero PYME</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => onNavigate('projections', 'cashflow')}
              className="text-left p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
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
              className="text-left p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
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
              className="text-left p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
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
              className="text-left p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
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
              className="text-left p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
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
              className="text-left p-4 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] hover:border-[var(--accent-strong)] transition-colors cursor-pointer"
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

          {priorityAlerts.length > 0 && (
            <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-col gap-2">
              {priorityAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`px-3.5 py-2.5 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 ${
                    alert.severity === 'critical'
                      ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                      : 'bg-[var(--warn-soft)] text-[var(--warn-text)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{alert.title}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubTab('analyst')}
                    className="font-bold underline underline-offset-4 cursor-pointer"
                  >
                    Ver recomendación
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </StaggerItem>

      <StaggerItem>
        <GrowyDivider />
      </StaggerItem>

      {/* 4 Gráficos requeridos */}
      <StaggerItem>
        <StaggerSection className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StaggerItem>
            <div className="boho-card boho-card-hover p-6 h-full">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                    Gráfico de Punto de Equilibrio
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Donde se cruzan ingresos totales y costos totales nace tu utilidad
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-[var(--accent-strong)] shrink-0" />
              </div>
              <ChartCanvas
                config={breakEvenChartConfig}
                heightClass="h-72"
                ariaLabel="Gráfico de líneas de punto de equilibrio"
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="boho-card boho-card-hover p-6 h-full">
              <div className="mb-4">
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Ingresos vs. Egresos por mes
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Comparativa mensual de 12 meses frente a tus registros reales
                </p>
              </div>
              <ChartCanvas
                config={incomeVsExpenseConfig}
                heightClass="h-72"
                ariaLabel="Gráfico de barras de ingresos versus egresos mensuales"
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="boho-card boho-card-hover p-6 h-full">
              <div className="mb-4">
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Evolución de la Utilidad
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Trayectoria de ganancia proyectada frente a resultados reales
                </p>
              </div>
              <ChartCanvas
                config={profitEvolutionConfig}
                heightClass="h-72"
                ariaLabel="Gráfico de evolución de utilidad mensual"
              />
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="boho-card boho-card-hover p-6 h-full">
              <div className="mb-4">
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Composición de Costos
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Distribución de costos fijos por categoría y costos variables del mes
                </p>
              </div>
              <ChartCanvas
                config={costCompositionConfig}
                heightClass="h-72"
                ariaLabel="Gráfico circular de composición de costos"
              />
            </div>
          </StaggerItem>
        </StaggerSection>
      </StaggerItem>
    </StaggerSection>
  );
};
