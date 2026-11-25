import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { GlassCard } from './GlassCard';

export type StatRingStatus = 'green' | 'amber' | 'red';

export interface StatRingMetric {
  label: string;
  value: string;
}

interface StatRingProps {
  title: string;
  percentage: number;
  status: StatRingStatus;
  statusLabel: string;
  subtitle?: string;
  centerLabel?: string;
  metrics?: StatRingMetric[];
  className?: string;
}

const STATUS_STYLE: Record<
  StatRingStatus,
  {
    stroke: string;
    track: string;
    text: string;
    bg: string;
    border: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  green: {
    stroke: 'var(--pos-dot)',
    track: 'var(--pos-soft)',
    text: 'var(--pos-text)',
    bg: 'var(--pos-soft)',
    border: 'var(--pos-border)',
    Icon: CheckCircle2,
  },
  amber: {
    stroke: 'var(--warn-bar)',
    track: 'var(--warn-soft)',
    text: 'var(--warn-text)',
    bg: 'var(--warn-soft)',
    border: 'var(--warn-border)',
    Icon: AlertTriangle,
  },
  red: {
    stroke: 'var(--danger-text)',
    track: 'var(--danger-soft)',
    text: 'var(--danger-text)',
    bg: 'var(--danger-soft)',
    border: 'var(--accent-soft-border)',
    Icon: ShieldAlert,
  },
};

export const StatRing: React.FC<StatRingProps> = ({
  title,
  percentage,
  status,
  statusLabel,
  subtitle,
  centerLabel = 'Margen',
  metrics,
  className = '',
}) => {
  const clamped = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const styleMeta = STATUS_STYLE[status];
  const StatusIcon = styleMeta.Icon;

  return (
    <GlassCard className={`p-5 sm:p-6 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Anillo de progreso */}
        <div className="relative w-32 h-32 shrink-0 mx-auto sm:mx-0 flex items-center justify-center">
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full -rotate-90"
            role="img"
            aria-label={`${title}: ${clamped.toFixed(0)}% (${statusLabel})`}
          >
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={styleMeta.track}
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={styleMeta.stroke}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono tabular-nums text-2xl font-semibold text-[var(--text-primary)] leading-none">
              {Math.round(clamped)}%
            </span>
            <span className="text-[11px] font-medium text-[var(--text-secondary)] mt-1">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Estado explícito + cifras */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
                {title}
              </h3>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: styleMeta.bg,
                  color: styleMeta.text,
                  borderColor: styleMeta.border,
                }}
              >
                <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{statusLabel}</span>
              </span>
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {metrics && metrics.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[var(--border-hairline)]">
              {metrics.map((m) => (
                <div key={m.label} className="min-w-0">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                    {m.label}
                  </p>
                  <p className="font-mono tabular-nums text-sm font-semibold text-[var(--text-primary)] mt-0.5">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
};
