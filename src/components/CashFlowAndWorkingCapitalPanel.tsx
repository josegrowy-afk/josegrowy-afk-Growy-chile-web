import React, { useMemo } from 'react';
import { AlertTriangle, Banknote, Layers, ShieldAlert } from 'lucide-react';
import type { ChartConfiguration } from 'chart.js';
import { formatCurrency } from '../finance/formulas';
import {
  calculateCashFlowProjection,
  calculateWorkingCapital,
} from '../finance/smeIntelligence';
import type { BusinessWorkspace, WorkingCapitalExtras } from '../types/finance';
import { ChartCanvas } from './ChartCanvas';

interface CashFlowAndWorkingCapitalPanelProps {
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
}

export const CashFlowAndWorkingCapitalPanel: React.FC<
  CashFlowAndWorkingCapitalPanelProps
> = ({ business, onUpdateBusiness }) => {
  const cf = useMemo(() => calculateCashFlowProjection(business), [business]);
  const wc = useMemo(() => calculateWorkingCapital(business, cf), [business, cf]);

  const extras = business.workingCapitalExtras ?? {};

  const updateExtra = (key: keyof WorkingCapitalExtras, val: number) => {
    onUpdateBusiness({
      workingCapitalExtras: {
        ...extras,
        [key]: Math.max(0, Number(val) || 0),
      },
    });
  };

  const cashFlowChartConfig = useMemo<ChartConfiguration>(() => {
    const slice = cf.rows.slice(0, 12);
    return {
      type: 'bar',
      data: {
        labels: slice.map((r) => r.monthLabel),
        datasets: [
          {
            type: 'line',
            label: 'Saldo proyectado final',
            data: slice.map((r) => Math.round(r.closingBalance)),
            borderColor: '#625296',
            backgroundColor: 'rgba(98, 82, 150, 0.14)',
            borderWidth: 2.5,
            tension: 0.3,
            pointRadius: 3.5,
          },
          {
            type: 'bar',
            label: 'Entradas totales',
            data: slice.map((r) => Math.round(r.totalInflows)),
            backgroundColor: 'rgba(30, 122, 107, 0.78)',
            borderRadius: 6,
          },
          {
            type: 'bar',
            label: 'Salidas totales',
            data: slice.map((r) => Math.round(r.totalOutflows)),
            backgroundColor: 'rgba(229, 115, 121, 0.8)',
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: (v) => formatCurrency(Number(v), business.currency),
            },
          },
        },
      },
    };
  }, [cf.rows, business.currency]);

  const workingCapitalChartConfig = useMemo<ChartConfiguration>(() => {
    return {
      type: 'line',
      data: {
        labels: wc.evolution.map((e) => e.monthLabel),
        datasets: [
          {
            label: 'Capital de trabajo neto',
            data: wc.evolution.map((e) => Math.round(e.netWorkingCapital)),
            borderColor: '#1E7A6B',
            backgroundColor: 'rgba(30, 122, 107, 0.14)',
            fill: true,
            tension: 0.3,
            pointRadius: 3.5,
          },
          {
            label: 'Activo corriente',
            data: wc.evolution.map((e) => Math.round(e.currentAssets)),
            borderColor: '#625296',
            borderDash: [4, 4],
            borderWidth: 1.8,
            pointRadius: 2,
          },
          {
            label: 'Pasivo corriente',
            data: wc.evolution.map((e) => Math.round(e.currentLiabilities)),
            borderColor: '#E57379',
            borderDash: [4, 4],
            borderWidth: 1.8,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            ticks: {
              callback: (v) => formatCurrency(Number(v), business.currency),
            },
          },
        },
      },
    };
  }, [wc.evolution, business.currency]);

  return (
    <div className="space-y-8">
      {/* CONFIGURACIÓN DE SALDO INICIAL DE CAJA */}
      <section className="boho-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Banknote className="w-5 h-5 text-[var(--pos-text)] shrink-0" />
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Saldo inicial real de caja y equivalentes
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Define con cuánto efectivo real (bancos + caja) inicia este negocio antes de sumar
                tus cobros y restar pagos reales. Las ventas a crédito pendientes no se consideran
                dinero disponible.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Saldo inicial ({business.currency.code})
            </label>
            <input
              type="number"
              step="any"
              value={business.initialCashBalance ?? 0}
              onChange={(e) =>
                onUpdateBusiness({
                  initialCashBalance: Number(e.target.value) || 0,
                  cashBalanceConfigured: true,
                })
              }
              className="boho-input w-36 text-right font-mono tabular-nums font-bold"
            />
          </div>
        </div>

        {/* KPIs FLUJO DE CAJA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 pt-2">
          <div className="rounded-3xl p-4 bg-[var(--pos-soft)] border border-[var(--pos-border)]">
            <p className="text-xs font-semibold text-[var(--pos-muted)]">
              Saldo disponible real hoy
            </p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold mt-1.5 ${
                cf.currentAvailableCash >= 0
                  ? 'text-[var(--pos-text)]'
                  : 'text-[var(--danger-text)]'
              }`}
            >
              {formatCurrency(cf.currentAvailableCash, business.currency)}
            </p>
            <p className="text-[11px] text-[var(--pos-muted)] mt-1">
              Solo efectivo cobrado - pagado
            </p>
          </div>

          <div className="rounded-3xl p-4 bg-[var(--sec-soft)] border border-[var(--sec-border)]">
            <p className="text-xs font-semibold text-[var(--sec-muted)]">
              Flujo neto proyectado (12M)
            </p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold mt-1.5 ${
                cf.annualNetCashFlow >= 0
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--danger-text)]'
              }`}
            >
              {formatCurrency(cf.annualNetCashFlow, business.currency)}
            </p>
            <p className="text-[11px] text-[var(--sec-muted)] mt-1">
              Ingresos {formatCurrency(cf.annualTotalInflows, business.currency)}
            </p>
          </div>

          <div className="rounded-3xl p-4 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
            <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
              Saldo final proyectado (Mes 12)
            </p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold mt-1.5 ${
                cf.endingProjectedBalance >= 0
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--danger-text)]'
              }`}
            >
              {formatCurrency(cf.endingProjectedBalance, business.currency)}
            </p>
            <p className="text-[11px] text-[var(--accent-soft-muted)] mt-1">
              Egresos 12M: {formatCurrency(cf.annualTotalOutflows, business.currency)}
            </p>
          </div>

          <div className="rounded-3xl p-4 bg-[var(--warn-soft)] border border-[var(--warn-border)]">
            <p className="text-xs font-semibold text-[var(--warn-muted)]">
              Meses con déficit de liquidez
            </p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[var(--warn-text)] mt-1.5">
              {cf.deficitMonths.length}
            </p>
            <p className="text-[11px] text-[var(--warn-muted)] mt-1">
              {cf.lowestCashMonth
                ? `Menor saldo: ${cf.lowestCashMonth.monthLabel}`
                : 'Sin proyección'}
            </p>
          </div>
        </div>

        {/* ALERTA DE DÉFICIT DE LIQUIDEZ */}
        {cf.deficitMonths.length > 0 && (
          <div className="p-4 rounded-2xl bg-[var(--danger-soft)] border border-[var(--border-hairline)] flex items-start gap-3 text-xs">
            <ShieldAlert className="w-5 h-5 text-[var(--danger-text)] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-[var(--danger-text)]">
                Advertencia de déficit de liquidez proyectado
              </p>
              <p className="text-[var(--text-primary)] leading-relaxed">
                Los siguientes meses muestran saldo insuficiente para cubrir obligaciones y egresos:{' '}
                <strong>
                  {cf.deficitMonths
                    .slice(0, 4)
                    .map(
                      (m) =>
                        `${m.monthLabel} (${formatCurrency(m.closingBalance, business.currency)})`
                    )
                    .join(', ')}
                </strong>
                . {cf.deficitMonths[0].deficitReason}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* GRÁFICO Y TABLA FLUJO DE CAJA MENSUAL */}
      <section className="boho-card p-6 space-y-5">
        <div>
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Flujo de caja mensual y anual (Movimientos reales vs. proyectados)
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Diferencia ingresos/egresos reales ya ejecutados de cobros esperados (CxC), obligaciones
            programadas (CxP: proveedores, remuneraciones, impuestos, créditos) y ventas
            proyectadas.
          </p>
        </div>

        <ChartCanvas
          config={cashFlowChartConfig}
          heightClass="h-72"
          ariaLabel="Gráfico de flujo de caja mensual proyectado y real"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-[var(--text-secondary)]">
                <th className="py-2.5 pr-3">Mes</th>
                <th className="py-2.5 px-2">Tipo</th>
                <th className="py-2.5 px-2 text-right">Saldo Inicial</th>
                <th className="py-2.5 px-2 text-right">Ing. Reales</th>
                <th className="py-2.5 px-2 text-right">CxC Est.</th>
                <th className="py-2.5 px-2 text-right">Vta. Proy.</th>
                <th className="py-2.5 px-2 text-right">Egr. Reales</th>
                <th className="py-2.5 px-2 text-right">CxP Prog.</th>
                <th className="py-2.5 px-2 text-right">Egr. Proy.</th>
                <th className="py-2.5 px-2 text-right">Flujo Neto</th>
                <th className="py-2.5 pl-2 text-right">Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {cf.rows.map((r) => (
                <tr
                  key={r.month}
                  className={`border-b border-[var(--border-hairline)] last:border-0 ${
                    r.hasLiquidityDeficit ? 'bg-[var(--danger-soft)]/45' : ''
                  }`}
                >
                  <td className="py-2.5 pr-3 font-semibold whitespace-nowrap">{r.monthLabel}</td>
                  <td className="py-2.5 px-2">
                    <span
                      className={`font-semibold ${
                        r.isActualMonth ? 'text-[var(--pos-text)]' : 'text-[var(--sec-text)]'
                      }`}
                    >
                      {r.isActualMonth ? 'Real' : 'Proyectado'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                    {formatCurrency(r.openingBalance, business.currency)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--pos-text)]">
                    {r.realInflows > 0 ? formatCurrency(r.realInflows, business.currency) : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                    {r.scheduledArInflows > 0
                      ? formatCurrency(r.scheduledArInflows, business.currency)
                      : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {r.projectedSalesInflows > 0
                      ? formatCurrency(r.projectedSalesInflows, business.currency)
                      : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--danger-text)]">
                    {r.realOutflows > 0 ? formatCurrency(r.realOutflows, business.currency) : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                    {r.scheduledApOutflows > 0
                      ? formatCurrency(r.scheduledApOutflows, business.currency)
                      : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {r.projectedOperativeOutflows > 0
                      ? formatCurrency(r.projectedOperativeOutflows, business.currency)
                      : '—'}
                  </td>
                  <td
                    className={`py-2.5 px-2 text-right font-mono tabular-nums font-semibold ${
                      r.netCashFlow >= 0
                        ? 'text-[var(--pos-text)]'
                        : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {formatCurrency(r.netCashFlow, business.currency)}
                  </td>
                  <td
                    className={`py-2.5 pl-2 text-right font-mono tabular-nums font-bold ${
                      r.closingBalance >= 0
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {formatCurrency(r.closingBalance, business.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECCIÓN CAPITAL DE TRABAJO */}
      <section className="boho-card p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[var(--sec-text)] shrink-0" />
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
                Capital de Trabajo = Activo Corriente − Pasivo Corriente
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Calculado automáticamente desde tu caja real, cuentas por cobrar, inventario
                valorizado y cuentas por pagar sin duplicar movimientos.
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs text-[var(--text-secondary)]">Capital de trabajo neto</p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold ${
                wc.isNegative ? 'text-[var(--danger-text)]' : 'text-[var(--pos-text)]'
              }`}
            >
              {wc.hasEnoughData
                ? formatCurrency(wc.netWorkingCapital, business.currency)
                : 'Faltan datos'}
            </p>
            {wc.currentRatio !== null && (
              <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                Liquidez corriente: {wc.currentRatio.toFixed(2)}x
              </p>
            )}
          </div>
        </div>

        {wc.hasEnoughData && wc.isNegative && (
          <div className="p-4 rounded-2xl bg-[var(--danger-soft)] border border-[var(--border-hairline)] flex items-start gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 text-[var(--danger-text)] shrink-0 mt-0.5" />
            <p className="text-[var(--text-primary)] leading-relaxed">
              <strong>Alerta de capital de trabajo negativo:</strong> tus pasivos de corto plazo (
              {formatCurrency(wc.totalCurrentLiabilities, business.currency)}) superan a tus activos
              corrientes ({formatCurrency(wc.totalCurrentAssets, business.currency)}). Acelera
              cobranzas, liquida inventario inmovilizado o reprograma vencimientos.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ACTIVO CORRIENTE */}
          <div className="p-5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--pos-text)]">Activo Corriente Total</h3>
              <span className="font-mono text-base font-bold">
                {formatCurrency(wc.totalCurrentAssets, business.currency)}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Efectivo y equivalentes (caja real)</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(wc.cashAndEquivalents, business.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cuentas por cobrar pendientes</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(wc.accountsReceivableNet, business.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Inventarios valorizados</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(wc.inventoryValue, business.currency)}
                </span>
              </div>
              <label className="flex items-center justify-between gap-3 pt-1">
                <span>Otros activos corrientes (depósitos, IVA crédito)</span>
                <input
                  type="number"
                  min={0}
                  value={extras.otherCurrentAssets ?? 0}
                  onChange={(e) => updateExtra('otherCurrentAssets', Number(e.target.value))}
                  className="boho-input w-28 py-1 text-right font-mono text-xs"
                />
              </label>
            </div>
          </div>

          {/* PASIVO CORRIENTE */}
          <div className="p-5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--danger-text)]">
                Pasivo Corriente Total
              </h3>
              <span className="font-mono text-base font-bold">
                {formatCurrency(wc.totalCurrentLiabilities, business.currency)}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Cuentas por pagar registradas (CxP)</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(wc.accountsPayableSuppliersAndOps, business.currency)}
                </span>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span>Impuestos por pagar (no incluidos en CxP)</span>
                <input
                  type="number"
                  min={0}
                  value={extras.pendingTaxes ?? 0}
                  onChange={(e) => updateExtra('pendingTaxes', Number(e.target.value))}
                  className="boho-input w-28 py-1 text-right font-mono text-xs"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Remuneraciones / cotizaciones pendientes</span>
                <input
                  type="number"
                  min={0}
                  value={extras.pendingPayroll ?? 0}
                  onChange={(e) => updateExtra('pendingPayroll', Number(e.target.value))}
                  className="boho-input w-28 py-1 text-right font-mono text-xs"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Cuotas financieras de corto plazo (&lt; 12M)</span>
                <input
                  type="number"
                  min={0}
                  value={extras.shortTermDebt ?? 0}
                  onChange={(e) => updateExtra('shortTermDebt', Number(e.target.value))}
                  className="boho-input w-28 py-1 text-right font-mono text-xs"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Otros pasivos corrientes</span>
                <input
                  type="number"
                  min={0}
                  value={extras.otherCurrentLiabilities ?? 0}
                  onChange={(e) => updateExtra('otherCurrentLiabilities', Number(e.target.value))}
                  className="boho-input w-28 py-1 text-right font-mono text-xs"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Evolución mensual proyectada del Capital de Trabajo
          </h3>
          <ChartCanvas
            config={workingCapitalChartConfig}
            heightClass="h-64"
            ariaLabel="Evolución mensual de capital de trabajo"
          />
        </div>
      </section>
    </div>
  );
};
