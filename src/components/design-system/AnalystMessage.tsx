import React from 'react';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { SolidCard } from './GlassCard';

export type AnalystCategoryTone = 'sage' | 'coral' | 'lilac' | 'gold' | 'navy';

interface AnalystMessageProps {
  authorName?: string;
  initials?: string;
  timestamp: string;
  category: string;
  tone?: AnalystCategoryTone;
  message: string;
  detailLabel?: string;
  simpleLabel?: string;
  onViewDetail?: () => void;
  onExplainSimple?: () => void;
  className?: string;
}

const TONE_BADGE_STYLE: Record<AnalystCategoryTone, React.CSSProperties> = {
  sage: {
    backgroundColor: 'var(--pos-soft)',
    color: 'var(--pos-text)',
    borderColor: 'var(--pos-border)',
  },
  coral: {
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--accent-strong)',
    borderColor: 'var(--accent-soft-border)',
  },
  lilac: {
    backgroundColor: 'var(--sec-soft)',
    color: 'var(--sec-text)',
    borderColor: 'var(--sec-border)',
  },
  gold: {
    backgroundColor: 'var(--warn-soft)',
    color: 'var(--warn-text)',
    borderColor: 'var(--warn-border)',
  },
  navy: {
    backgroundColor: 'var(--btn-navy-bg)',
    color: 'var(--btn-navy-text)',
    borderColor: 'var(--btn-navy-bg)',
  },
};

export const AnalystMessage: React.FC<AnalystMessageProps> = ({
  authorName = 'Analista PYME',
  initials = 'AP',
  timestamp,
  category,
  tone = 'lilac',
  message,
  detailLabel = 'Ver detalle',
  simpleLabel = 'Explícame simple',
  onViewDetail,
  onExplainSimple,
  className = '',
}) => {
  return (
    <SolidCard as="article" className={`p-5 sm:p-6 space-y-3.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
            style={{
              backgroundColor: 'var(--sec-soft)',
              color: 'var(--sec-text)',
              border: '1px solid var(--sec-border)',
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-bold text-[var(--text-primary)] truncate">{authorName}</p>
            <p className="text-xs text-[var(--text-secondary)]">{timestamp}</p>
          </div>
        </div>

        <span
          className="inline-flex items-center px-3 py-1 rounded-full border text-xs font-bold whitespace-nowrap"
          style={TONE_BADGE_STYLE[tone]}
        >
          {category}
        </span>
      </div>

      <p className="text-sm text-[var(--text-primary)] leading-relaxed">{message}</p>

      {(onViewDetail || onExplainSimple) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onViewDetail && (
            <button
              type="button"
              onClick={onViewDetail}
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="min-h-[40px] px-4 rounded-full text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-92 transition-opacity cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
            >
              <span>{detailLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {onExplainSimple && (
            <button
              type="button"
              onClick={onExplainSimple}
              className="min-h-[40px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[var(--sec-text)]" aria-hidden="true" />
              <span>{simpleLabel}</span>
            </button>
          )}
        </div>
      )}
    </SolidCard>
  );
};
