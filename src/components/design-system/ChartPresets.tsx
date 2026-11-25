import React, { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../ChartCanvas';
import { GlassCard } from './GlassCard';

function readCssToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || !document?.documentElement) return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
}

function formatClpCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function formatClpFull(value: number): string {
  return `$${Math.round(value).toLocaleString('es-CL')}`;
}

export interface IncomeVsExpenseDatum {
  label: string;
  income: number;
  expense: number;
}

interface IncomeVsExpenseBarChartProps {
  title?: string;
  data: IncomeVsExpenseDatum[];
  themeKey: string;
  heightClass?: string;
  className?: string;
}

export const IncomeVsExpenseBarChart: React.FC<IncomeVsExpenseBarChartProps> = ({
  title = 'Ingresos vs gastos',
  data,
  themeKey,
  heightClass = 'h-64',
  className = '',
}) => {
  const palette = useMemo(
    () => ({
      income: readCssToken('--chart-income', '#1f1b2e'),
      expense: readCssToken('--chart-expense', '#cfc5ee'),
      grid: readCssToken('--chart-grid', 'rgba(31, 27, 46, 0.08)'),
      tick: readCssToken('--chart-tick', '#5a5470'),
    }),
    [themeKey]
  );

  const totals = useMemo(
    () =>
      data.reduce(
        (acc, d) => ({
          income: acc.income + d.income,
          expense: acc.expense + d.expense,
        }),
        { income: 0, expense: 0 }
      ),
    [data]
  );

  const config: ChartConfiguration = useMemo(
    () => ({
      type: 'bar',
      data: {
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: 'Ingresos',
            data: data.map((d) => d.income),
            backgroundColor: palette.income,
            borderRadius: 10,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.68,
          },
          {
            label: 'Gastos',
            data: data.map((d) => d.expense),
            backgroundColor: palette.expense,
            borderRadius: 10,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.68,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 12,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatClpFull(Number(ctx.parsed.y ?? 0))}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: palette.tick,
              font: { family: 'DM Sans, sans-serif', size: 12, weight: 600 },
            },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: palette.grid },
            ticks: {
              color: palette.tick,
              font: { family: 'IBM Plex Mono, monospace', size: 11 },
              callback: (value) => formatClpCompact(Number(value)),
            },
          },
        },
      },
    }),
    [data, palette]
  );

  return (
    <GlassCard className={`p-5 sm:p-6 space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="inline-flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: palette.income }}
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--text-secondary)]">Ingresos:</span>
            <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
              {formatClpFull(totals.income)}
            </span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: palette.expense }}
              aria-hidden="true"
            />
            <span className="font-semibold text-[var(--text-secondary)]">Gastos:</span>
            <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
              {formatClpFull(totals.expense)}
            </span>
          </div>
        </div>
      </div>

      <ChartCanvas
        config={config}
        heightClass={heightClass}
        ariaLabel={`${title}: ingresos totales ${formatClpFull(totals.income)} y gastos totales ${formatClpFull(totals.expense)}`}
      />
    </GlassCard>
  );
};

export interface ProductShareDatum {
  name: string;
  amount: number;
}

interface ProductProfitabilityDoughnutProps {
  title?: string;
  items: ProductShareDatum[];
  themeKey: string;
  className?: string;
}

export const ProductProfitabilityDoughnut: React.FC<ProductProfitabilityDoughnutProps> = ({
  title = 'Aporte al margen por producto',
  items,
  themeKey,
  className = '',
}) => {
  const colors = useMemo(
    () => [
      readCssToken('--chart-doughnut-1', '#1f1b2e'),
      readCssToken('--chart-doughnut-2', '#f6a59e'),
      readCssToken('--chart-doughnut-3', '#6fae8a'),
      readCssToken('--chart-doughnut-4', '#e9b949'),
      readCssToken('--chart-doughnut-5', '#cfc5ee'),
    ],
    [themeKey]
  );

  const safeItems = useMemo(() => items.filter((i) => i.amount > 0), [items]);
  const total = useMemo(
    () => safeItems.reduce((sum, i) => sum + i.amount, 0),
    [safeItems]
  );

  const config: ChartConfiguration = useMemo(
    () => ({
      type: 'doughnut',
      data: {
        labels: safeItems.map((i) => i.name),
        datasets: [
          {
            data: safeItems.map((i) => i.amount),
            backgroundColor: safeItems.map((_, idx) => colors[idx % colors.length]),
            borderWidth: 0,
            borderRadius: 6,
            spacing: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            padding: 10,
            cornerRadius: 12,
            callbacks: {
              label: (ctx) => {
                const val = Number(ctx.parsed ?? 0);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return `${ctx.label}: ${formatClpFull(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    }),
    [safeItems, colors, total]
  );

  return (
    <GlassCard className={`p-5 sm:p-6 space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
          {title}
        </h3>
        <span className="font-mono tabular-nums text-xs font-semibold text-[var(--text-secondary)]">
          Total {formatClpFull(total)}
        </span>
      </div>

      {safeItems.length === 0 ? (
        <p className="text-xs text-[var(--text-secondary)] py-6 text-center">
          Agrega productos con margen positivo para ver su aporte aquí.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
          <div className="sm:col-span-5 h-44 relative flex items-center justify-center">
            <ChartCanvas
              config={config}
              heightClass="h-44"
              ariaLabel={`${title}: total ${formatClpFull(total)}`}
            />
          </div>
          <ul className="sm:col-span-7 space-y-2.5" aria-label="Detalle por producto">
            {safeItems.map((item, idx) => {
              const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
              return (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-3 text-xs border-b border-[var(--border-hairline)] last:border-0 pb-1.5 last:pb-0"
                >
                  <span className="inline-flex items-center gap-2 min-w-0 font-semibold text-[var(--text-primary)]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: colors[idx % colors.length] }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-secondary)] shrink-0">
                    <strong className="text-[var(--text-primary)]">{formatClpFull(item.amount)}</strong>{' '}
                    · {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </GlassCard>
  );
};
