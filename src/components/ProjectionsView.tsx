import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, RotateCcw, Wallet } from 'lucide-react';
import {
  buildMonthlyProjections,
  formatCurrency,
  formatNumber,
  getWeightedMixEconomics,
} from '../finance/formulas';
import { calculateCashFlowProjection } from '../finance/smeIntelligence';
import type { BusinessWorkspace } from '../types/finance';
import { CashFlowAndWorkingCapitalPanel } from './CashFlowAndWorkingCapitalPanel';

export type ProjectionsSubTab = 'sales' | 'cashflow';

interface ProjectionsViewProps {
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
  initialSubTab?: ProjectionsSubTab;
}

export const ProjectionsView: React.FC<ProjectionsViewProps> = ({
  business,
  onUpdateBusiness,
  initialSubTab = 'sales',
}) => {
  const [subTab, setSubTab] = useState<ProjectionsSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const projections = useMemo(() => buildMonthlyProjections(business), [business]);
  const weighted = useMemo(() => getWeightedMixEconomics(business.products), [business.products]);
  const deficitCount = useMemo(
    () => calculateCashFlowProjection(business).deficitMonths.length,
    [business]
  );

  const totals = useMemo(
    () =>
      projections.reduce(
        (acc, row) => ({
          units: acc.units + row.totalUnits,
          revenue: acc.revenue + row.projectedRevenue,
          variable: acc.variable + row.projectedVariableCosts,
          fixed: acc.fixed + row.projectedFixedCosts,
          profit: acc.profit + row.projectedProfit,
        }),
        { units: 0, revenue: 0, variable: 0, fixed: 0, profit: 0 }
      ),
    [projections]
  );

  const handleManualUnitChange = (
    month: string,
    productId: string,
    newVal: number,
    currentRowUnits: Record<string, number>
  ) => {
    const cleanVal = Math.max(0, Math.round(Number(newVal) || 0));
    const existingOverride = business.projectionOverrides?.[month]?.unitsByProduct;
    const mergedUnits: Record<string, number> = {
      ...currentRowUnits,
      ...(existingOverride ?? {}),
      [productId]: cleanVal,
    };
    onUpdateBusiness({
      projectionOverrides: {
        ...business.projectionOverrides,
        [month]: {
          ...business.projectionOverrides?.[month],
          unitsByProduct: mergedUnits,
        },
      },
    });
  };

  const handleClearMonthOverride = (month: string) => {
    const next = { ...business.projectionOverrides };
    delete next[month];
    onUpdateBusiness({ projectionOverrides: next });
  };

  const handleBaseUnitChange = (productId: string, val: number) => {
    onUpdateBusiness({
      baseMonthlyUnitsByProduct: {
        ...business.baseMonthlyUnitsByProduct,
        [productId]: Math.max(0, Math.round(Number(val) || 0)),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Secciones de Proyección y Flujo de Caja"
        className="growy-tab-track"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'sales'}
          onClick={() => setSubTab('sales')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'sales'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CalendarRange className="w-4 h-4 text-[var(--accent-strong)]" />
          <span>Proyección de ventas</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'cashflow'}
          onClick={() => setSubTab('cashflow')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'cashflow'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Wallet className="w-4 h-4 text-[var(--pos-text)]" />
          <span>
            Flujo de caja y capital de trabajo
            {deficitCount > 0 ? ` · ${deficitCount} déficit` : ''}
          </span>
        </button>
      </div>

      {subTab === 'cashflow' ? (
        <CashFlowAndWorkingCapitalPanel business={business} onUpdateBusiness={onUpdateBusiness} />
      ) : (
        <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            Planificación a futuro · Mínimo 12 meses
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Proyección{' '}
            <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
              mensual
            </em>{' '}
            de ventas y utilidades
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Crecimiento mensual (%)
            <input
              type="number"
              min={-20}
              max={100}
              step={0.5}
              value={business.monthlyGrowthPercent}
              onChange={(e) =>
                onUpdateBusiness({ monthlyGrowthPercent: Number(e.target.value) || 0 })
              }
              className="boho-input ml-2 w-24 font-mono tabular-nums"
            />
          </label>

          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Horizonte
            <select
              value={business.projectionMonthsCount}
              onChange={(e) =>
                onUpdateBusiness({ projectionMonthsCount: Math.max(12, Number(e.target.value)) })
              }
              className="boho-input ml-2 font-semibold"
            >
              <option value={12}>12 meses</option>
              <option value={18}>18 meses</option>
              <option value={24}>24 meses</option>
            </select>
          </label>
        </div>
      </header>

      {/* Unidades base del primer mes */}
      {business.products.length > 0 && (
        <section className="boho-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Unidades base del mes inicial (a partir de aquí crece{' '}
              {business.monthlyGrowthPercent >= 0 ? '+' : ''}
              {business.monthlyGrowthPercent}% mensual)
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {weighted.items.map((item) => {
              const p = item.product;
              const fallback = Math.round(business.expectedMonthlyUnits * item.normalizedWeight);
              const val =
                business.baseMonthlyUnitsByProduct?.[p.id] !== undefined
                  ? business.baseMonthlyUnitsByProduct[p.id]
                  : fallback;
              return (
                <label
                  key={p.id}
                  className="p-3 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
                >
                  <span className="text-xs font-semibold truncate">{p.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={val}
                    onChange={(e) => handleBaseUnitChange(p.id, Number(e.target.value))}
                    className="boho-input w-20 text-right font-mono tabular-nums py-1 min-h-[38px]"
                  />
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* Tabla editable mes a mes */}
      <section className="boho-card p-4 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                <th className="py-3 pr-3 font-semibold">Mes</th>
                {business.products.map((p) => (
                  <th key={p.id} className="py-3 px-2 font-semibold text-right">
                    {p.name} (u.)
                  </th>
                ))}
                <th className="py-3 px-3 font-semibold text-right">Total u.</th>
                <th className="py-3 px-3 font-semibold text-right">Ingresos</th>
                <th className="py-3 px-3 font-semibold text-right">C. Variables</th>
                <th className="py-3 px-3 font-semibold text-right">C. Fijos</th>
                <th className="py-3 pl-3 font-semibold text-right">Utilidad proy.</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((row) => (
                <tr
                  key={row.month}
                  className="border-b border-[var(--border-hairline)] hover:bg-[var(--bg-soft-alt)]"
                >
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {row.monthLabel}
                      </span>
                      {row.isManualOverride && (
                        <button
                          type="button"
                          onClick={() => handleClearMonthOverride(row.month)}
                          title="Volver al cálculo automático"
                          className="text-[var(--accent-strong)] hover:opacity-80 cursor-pointer p-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {business.products.map((p) => (
                    <td key={p.id} className="py-2 px-2 text-right">
                      <input
                        type="number"
                        min={0}
                        aria-label={`Unidades de ${p.name} para ${row.monthLabel}`}
                        value={row.unitsByProduct[p.id] ?? 0}
                        onChange={(e) =>
                          handleManualUnitChange(
                            row.month,
                            p.id,
                            Number(e.target.value),
                            row.unitsByProduct
                          )
                        }
                        className={`w-20 text-right font-mono tabular-nums px-2 py-1.5 rounded-xl border text-xs ${
                          row.isManualOverride
                            ? 'border-[var(--warn-text)] bg-[var(--warn-soft)] text-[var(--text-primary)]'
                            : 'border-[var(--border-hairline)] bg-transparent'
                        }`}
                      />
                    </td>
                  ))}

                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                    {formatNumber(row.totalUnits)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {formatCurrency(row.projectedRevenue, business.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {formatCurrency(row.projectedVariableCosts, business.currency)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {formatCurrency(row.projectedFixedCosts, business.currency)}
                  </td>
                  <td
                    className={`py-2.5 pl-3 text-right font-mono tabular-nums font-bold ${
                      row.projectedProfit >= 0
                        ? 'text-[var(--pos-text)]'
                        : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {formatCurrency(row.projectedProfit, business.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border-hairline)] font-bold">
                <td className="py-3 pr-3">Total período</td>
                <td colSpan={business.products.length} className="py-3 px-2 text-right text-xs text-[var(--text-secondary)]">
                  {projections.length} meses
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatNumber(totals.units)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatCurrency(totals.revenue, business.currency)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatCurrency(totals.variable, business.currency)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">
                  {formatCurrency(totals.fixed, business.currency)}
                </td>
                <td className="py-3 pl-3 text-right font-mono tabular-nums text-[var(--pos-text)]">
                  {formatCurrency(totals.profit, business.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
        </div>
      )}
    </div>
  );
};
