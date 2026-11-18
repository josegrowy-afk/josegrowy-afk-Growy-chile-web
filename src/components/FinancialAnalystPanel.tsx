import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Info,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  generateFinancialAnalystReport,
  type InsightSeverity,
} from '../finance/smeIntelligence';
import type { BusinessWorkspace, ViewTab } from '../types/finance';

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

export const FinancialAnalystPanel: React.FC<FinancialAnalystPanelProps> = ({
  business,
  onNavigate,
}) => {
  const report = useMemo(() => generateFinancialAnalystReport(business), [business]);

  const badgeStyles: Record<InsightSeverity, { bg: string; text: string; label: string }> = {
    critical: {
      bg: 'bg-[var(--danger-soft)]',
      text: 'text-[var(--danger-text)]',
      label: 'Prioritario',
    },
    warning: {
      bg: 'bg-[var(--warn-soft)]',
      text: 'text-[var(--warn-text)]',
      label: 'Atención',
    },
    positive: {
      bg: 'bg-[var(--pos-soft)]',
      text: 'text-[var(--pos-text)]',
      label: 'Fortaleza',
    },
    info: {
      bg: 'bg-[var(--sec-soft)]',
      text: 'text-[var(--sec-text)]',
      label: 'Informativo',
    },
  };

  return (
    <div className="space-y-6">
      {/* RESUMEN GENERAL DEL ANALISTA */}
      <section
        data-tour="analyst-panel"
        className="boho-card growy-hero-surface p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5"
      >
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-bold text-[var(--sec-text)] inline-flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            <span>Analista Financiero PYME · Basado exclusivamente en datos registrados</span>
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {report.healthLabel}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Este diagnóstico evalúa ventas, costos, márgenes, flujo de caja, capital de trabajo,
            cuentas por cobrar/pagar, inventario y endeudamiento sin inventar cifras ni suponer
            movimientos no ingresados.
          </p>
        </div>

        <div className="growy-editorial-strip p-5 rounded-[26px] text-center min-w-[180px] shrink-0">
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
      </section>

      {/* HALLAZGOS Y RECOMENDACIONES */}
      {report.insights.length === 0 ? (
        <section className="boho-card p-8 text-center space-y-2">
          <Info className="w-7 h-7 text-[var(--sec-text)] mx-auto" />
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Aún no hay suficientes registros para generar recomendaciones
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-lg mx-auto">
            Completa los pasos sugeridos abajo para que el analista evalúe liquidez, rentabilidad,
            cobranzas e inventario con cifras verdaderas.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {report.insights.map((ins) => {
            const st = badgeStyles[ins.severity];
            const dest = getTargetDestinationForArea(ins.area);
            return (
              <article
                key={ins.id}
                className="boho-card p-5 flex flex-col justify-between gap-3.5"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                      {ins.areaLabel}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold ${st.bg} ${st.text}`}
                    >
                      {ins.severity === 'critical' ? (
                        <ShieldAlert className="w-3 h-3" />
                      ) : ins.severity === 'warning' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : ins.severity === 'positive' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Info className="w-3 h-3" />
                      )}
                      <span>{st.label}</span>
                    </span>
                  </div>

                  <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                    {ins.title}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {ins.explanation}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <p className="text-xs text-[var(--text-primary)] font-medium leading-relaxed">
                    <strong>Sugerencia:</strong> {ins.recommendation}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate(dest.tab, dest.subTab)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] text-xs font-bold text-[var(--accent-strong)] hover:opacity-90 whitespace-nowrap cursor-pointer shrink-0 self-start sm:self-center transition-opacity"
                  >
                    <span>Ir al módulo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* DATOS PENDIENTES POR REGISTRAR */}
      {report.missingDataHints.length > 0 && (
        <section className="boho-card p-6 space-y-3">
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
        </section>
      )}
    </div>
  );
};
