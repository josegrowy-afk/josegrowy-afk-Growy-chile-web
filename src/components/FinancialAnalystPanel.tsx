import React, { useMemo } from 'react';
import {
  ArrowRight,
  ClipboardList,
  Info,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '../finance/formulas';
import {
  calculateArApAgingAndDurations,
  calculateCashAlertAndRunway,
  calculateFinancialRatiosWithStatus,
} from '../finance/phase2Insights';
import {
  generateFinancialAnalystReport,
  type InsightSeverity,
} from '../finance/smeIntelligence';
import type { BusinessWorkspace, ViewTab } from '../types/finance';
import {
  AnalystMessage,
  EditorialText,
  GlassCard,
  SectionTitle,
  SolidCard,
} from './design-system';

interface FinancialAnalystPanelProps {
  business: BusinessWorkspace;
  onNavigate: (tab: ViewTab, subTab?: string) => void;
}

function getTargetDestinationForArea(area: string): { tab: ViewTab; subTab?: string } {
  switch (area) {
    case 'rentabilidad':
      return { tab: 'catalog', subTab: 'catalog' };
    case 'inventario':
      return { tab: 'catalog', subTab: 'inventory' };
    case 'flujo_caja':
    case 'capital_trabajo':
    case 'endeudamiento':
      return { tab: 'projections', subTab: 'cashflow' };
    case 'cobrar':
      return { tab: 'actuals', subTab: 'receivables' };
    case 'pagar':
      return { tab: 'actuals', subTab: 'payables' };
    case 'ventas':
    case 'costos':
    case 'presupuesto':
      return { tab: 'actuals', subTab: 'cash' };
    default:
      return { tab: 'dashboard', subTab: 'overview' };
  }
}

function getToneForSeverity(
  severity: InsightSeverity
): 'coral' | 'gold' | 'sage' | 'lilac' | 'navy' {
  switch (severity) {
    case 'critical':
      return 'coral';
    case 'warning':
      return 'gold';
    case 'positive':
      return 'sage';
    default:
      return 'lilac';
  }
}

export const FinancialAnalystPanel: React.FC<FinancialAnalystPanelProps> = ({
  business,
  onNavigate,
}) => {
  const report = useMemo(() => generateFinancialAnalystReport(business), [business]);
  const cashRunway = useMemo(() => calculateCashAlertAndRunway(business), [business]);
  const financialRatios = useMemo(() => calculateFinancialRatiosWithStatus(business), [business]);
  const agingSummary = useMemo(() => calculateArApAgingAndDurations(business), [business]);

  const badgeStyles: Record<InsightSeverity, { label: string }> = {
    critical: { label: 'Prioritario' },
    warning: { label: 'Atención' },
    positive: { label: 'Fortaleza' },
    info: { label: 'Informativo' },
  };

  return (
    <div className="space-y-6">
      {/* RESUMEN GENERAL DEL ANALISTA */}
      <div data-tour="analyst-panel">
        <GlassCard
          className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5"
        >
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-bold text-[var(--sec-text)] inline-flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span>Analista PYME · Basado exclusivamente en datos registrados</span>
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
              <EditorialText text={report.healthLabel} />
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Este diagnóstico evalúa ventas, costos, márgenes, flujo de caja, capital de trabajo,
              cuentas por cobrar/pagar, inventario y endeudamiento sin inventar cifras ni suponer
              movimientos no ingresados.
            </p>
          </div>

          <div className="growy-editorial-strip p-5 rounded-[28px] text-center min-w-[185px] shrink-0">
            <p className="text-[11px] font-semibold text-[#CFC5EE]">
              Índice de salud PYME
            </p>
            <p className="font-mono tabular-nums text-4xl font-bold text-white mt-1">
              {report.healthScore !== null ? `${report.healthScore}/100` : '—'}
            </p>
            <p className="text-[11px] text-[#F6A59E] font-medium mt-1">
              {report.realMonthsCount} mes(es) real(es)
            </p>
          </div>
        </GlassCard>
      </div>

      {/* 2.1 ALERTA DE CAJA Y MESES DE CAJA DISPONIBLE */}
      <SolidCard
        className={`p-5 sm:p-6 ${
          cashRunway.status === 'rojo'
            ? '!bg-[var(--danger-soft)] !border-[var(--accent-soft-border)]'
            : cashRunway.status === 'amarillo'
              ? '!bg-[var(--warn-soft)] !border-[var(--warn-border)]'
              : '!bg-[var(--pos-soft)] !border-[var(--pos-border)]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs font-bold text-[var(--text-primary)]">
                Meses de caja disponible:{' '}
                <span className="font-mono tabular-nums">
                  {cashRunway.runwayMonths !== null ? `${cashRunway.runwayMonths.toFixed(1)} m.` : 'N/A'}
                </span>
              </span>
              {cashRunway.firstDeficitMonthLabel && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--danger-soft)] text-[var(--danger-text)] text-xs font-bold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Cae bajo $0 en {cashRunway.firstDeficitMonthLabel}</span>
                </span>
              )}
            </div>
            <h3 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
              {cashRunway.headline}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {cashRunway.simpleExplanation}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('projections', 'cashflow')}
            style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
            className="min-h-[40px] px-5 rounded-full text-xs font-bold hover:opacity-92 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer self-start md:self-center transition-opacity"
          >
            <span>Revisar Flujo de Caja</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </SolidCard>

      {/* 2.3 RAZONES FINANCIERAS SIMPLES CON SEMÁFORO */}
      <SolidCard className="p-5 sm:p-6 space-y-4">
        <SectionTitle
          as="h3"
          size="sm"
          title="Razones *financieras* simples con semáforo"
          subtitle="Indicadores de respaldo a corto plazo y rotación de stock explicados en simple."
          rightSlot={
            <button
              type="button"
              onClick={() => onNavigate('simple')}
              className="text-xs font-bold text-[var(--sec-text)] hover:underline cursor-pointer"
            >
              Ver en Explícame simple →
            </button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {financialRatios.ratios.map((ratio) => (
            <div
              key={ratio.id}
              className="p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] flex flex-col justify-between gap-2"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{ratio.name}</span>
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
                    {ratio.statusLabel}
                  </span>
                </div>
                <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)]">
                  {ratio.formattedValue}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {ratio.simpleMeaning}
                </p>
              </div>
              <div className="pt-2 border-t border-[var(--border-hairline)] space-y-1">
                <p className="text-[11px] font-medium text-[var(--text-primary)]">
                  {ratio.liveExample}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {ratio.thresholdRuleText}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 2.2 RESUMEN ANTIGÜEDAD CxC / CxP */}
        <div className="pt-4 border-t border-[var(--border-hairline)] grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Antigüedad Cuentas por Cobrar
              </span>
              <button
                type="button"
                onClick={() => onNavigate('actuals', 'receivables')}
                className="text-[11px] font-bold text-[var(--accent-strong)] hover:underline cursor-pointer"
              >
                Abrir CxC →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {agingSummary.receivablesAging.buckets.map((b) => (
                <div key={b.key} className="p-2.5 rounded-[18px] bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-secondary)]">{b.label}</p>
                  <p className="font-mono font-bold text-[var(--text-primary)]">
                    {formatCurrency(b.amount, business.currency)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Días promedio de cobro:{' '}
              <strong className="font-mono text-[var(--text-primary)]">
                {agingSummary.averageCollectionDays !== null
                  ? `${agingSummary.averageCollectionDays} d.`
                  : 'Sin historial'}
              </strong>
            </p>
          </div>

          <div className="p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Antigüedad Cuentas por Pagar
              </span>
              <button
                type="button"
                onClick={() => onNavigate('actuals', 'payables')}
                className="text-[11px] font-bold text-[var(--accent-strong)] hover:underline cursor-pointer"
              >
                Abrir CxP →
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {agingSummary.payablesAging.buckets.map((b) => (
                <div key={b.key} className="p-2.5 rounded-[18px] bg-[var(--bg-surface)]">
                  <p className="text-[10px] text-[var(--text-secondary)]">{b.label}</p>
                  <p className="font-mono font-bold text-[var(--text-primary)]">
                    {formatCurrency(b.amount, business.currency)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Días promedio de pago:{' '}
              <strong className="font-mono text-[var(--text-primary)]">
                {agingSummary.averagePaymentDays !== null
                  ? `${agingSummary.averagePaymentDays} d.`
                  : 'Sin historial'}
              </strong>
            </p>
          </div>
        </div>
      </SolidCard>

      {/* HALLAZGOS Y RECOMENDACIONES EN FORMATO AnalystMessage */}
      <div className="space-y-3">
        <SectionTitle
          as="h3"
          size="sm"
          title="Hallazgos y *recomendaciones*"
          subtitle="Mensajes priorizados para actuar con calma y sin jerga financiera."
        />

        {report.insights.length === 0 ? (
          <SolidCard className="p-6 sm:p-8 text-center space-y-2">
            <Info className="w-7 h-7 text-[var(--sec-text)] mx-auto" />
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Aún no hay suficientes registros para generar recomendaciones
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-lg mx-auto">
              Completa los pasos sugeridos abajo para que el analista evalúe liquidez, rentabilidad,
              cobranzas e inventario con cifras verdaderas.
            </p>
          </SolidCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report.insights.map((ins) => {
              const st = badgeStyles[ins.severity];
              const dest = getTargetDestinationForArea(ins.area);
              return (
                <AnalystMessage
                  key={ins.id}
                  authorName="Analista PYME"
                  initials="AP"
                  timestamp={st.label}
                  category={ins.areaLabel}
                  tone={getToneForSeverity(ins.severity)}
                  message={`${ins.title}. ${ins.explanation} Sugerencia: ${ins.recommendation}`}
                  detailLabel="Ir al módulo"
                  onViewDetail={() => onNavigate(dest.tab, dest.subTab)}
                  onExplainSimple={() => onNavigate('simple')}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* DATOS PENDIENTES POR REGISTRAR */}
      {report.missingDataHints.length > 0 && (
        <SolidCard className="p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[var(--accent-strong)] shrink-0" />
            <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
              Información pendiente para un análisis aún más preciso
            </h3>
          </div>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
            {report.missingDataHints.map((hint) => (
              <li key={hint} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-strong)] mt-1.5 shrink-0" />
                <span>{hint}</span>
              </li>
            ))}
          </ul>
        </SolidCard>
      )}
    </div>
  );
};
