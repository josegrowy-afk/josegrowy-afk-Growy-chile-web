import React from 'react';
import { ChipLink, type ChipLinkProps } from './ChipLink';
import { EditorialText } from './SectionTitle';

export interface HeroBannerChip extends ChipLinkProps {
  id: string;
}

interface HeroBannerProps {
  headline: string;
  headlineSize?: 'greeting' | 'landing';
  eyebrow?: string;
  subtitle?: string;
  chips?: HeroBannerChip[];
  rightSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  className?: string;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  headline,
  headlineSize = 'greeting',
  eyebrow,
  subtitle,
  chips,
  rightSlot,
  bottomSlot,
  className = '',
}) => {
  const headlineSizeClass =
    headlineSize === 'greeting'
      ? 'text-[44px] sm:text-[62px] lg:text-[88px] xl:text-[94px] leading-[0.98]'
      : 'text-[38px] sm:text-[54px] lg:text-[66px] leading-[1.03]';

  return (
    <section
      className={`growy-banner-surface p-6 sm:p-10 lg:p-12 shadow-[var(--glass-shadow)] ${className}`}
    >
      {/* Grano sutil en CSS (desactivado en Formal) */}
      <div className="growy-banner-grain" aria-hidden="true" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
        <div
          className={`${
            rightSlot ? 'lg:col-span-8' : 'lg:col-span-12'
          } space-y-5 min-w-0`}
        >
          {eyebrow && (
            <p
              className="text-xs font-extrabold tracking-[0.06em] uppercase"
              style={{ color: 'var(--hero-sub-ink)' }}
            >
              {eyebrow}
            </p>
          )}

          <h1
            className={`font-display font-extrabold tracking-tight text-balance ${headlineSizeClass}`}
            style={{ color: 'var(--hero-ink)' }}
          >
            <EditorialText text={headline} />
          </h1>

          {subtitle && (
            <p
              className="text-base sm:text-lg max-w-2xl leading-relaxed font-medium"
              style={{ color: 'var(--hero-sub-ink)' }}
            >
              {subtitle}
            </p>
          )}

          {chips && chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {chips.map(({ id, ...chipProps }) => (
                <ChipLink key={id} {...chipProps} />
              ))}
            </div>
          )}

          {bottomSlot && <div className="pt-1">{bottomSlot}</div>}
        </div>

        {rightSlot && (
          <div className="lg:col-span-4 flex items-center justify-center lg:justify-end">
            {rightSlot}
          </div>
        )}
      </div>
    </section>
  );
};
