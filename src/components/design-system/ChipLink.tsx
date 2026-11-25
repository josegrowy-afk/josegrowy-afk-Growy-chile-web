import React from 'react';
import { EditorialText } from './SectionTitle';

export type ChipLinkVariant = 'cream' | 'lilac' | 'sage' | 'white' | 'navy';

export interface ChipLinkProps {
  label: string;
  variant?: ChipLinkVariant;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  showPrefix?: boolean;
  className?: string;
  ariaLabel?: string;
  target?: string;
  rel?: string;
}

const VARIANT_STYLE: Record<ChipLinkVariant, React.CSSProperties> = {
  cream: {
    backgroundColor: 'var(--chip-cream-bg)',
    color: 'var(--navy-ink)',
    borderColor: 'var(--chip-border)',
  },
  lilac: {
    backgroundColor: 'var(--chip-lilac-bg)',
    color: 'var(--navy-ink)',
    borderColor: 'var(--chip-border)',
  },
  sage: {
    backgroundColor: 'var(--chip-sage-bg)',
    color: 'var(--navy-ink)',
    borderColor: 'var(--chip-border)',
  },
  white: {
    backgroundColor: 'var(--chip-white-bg)',
    color: 'var(--navy-ink)',
    borderColor: 'var(--chip-border)',
  },
  navy: {
    backgroundColor: 'var(--chip-navy-bg)',
    color: 'var(--chip-navy-text)',
    borderColor: 'var(--chip-border)',
  },
};

export const ChipLink: React.FC<ChipLinkProps> = ({
  label,
  variant = 'cream',
  href,
  onClick,
  active = false,
  showPrefix = true,
  className = '',
  ariaLabel,
  target,
  rel,
}) => {
  const effectiveVariant: ChipLinkVariant = active ? 'navy' : variant;
  const isDarkVariantOnDarkCanvas =
    effectiveVariant === 'navy'
      ? 'dark:border-[rgba(255,247,243,0.38)]'
      : '';

  const baseClass = `inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full border-[1.5px] text-xs sm:text-[13px] font-bold tracking-tight whitespace-nowrap shrink-0 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--navy-ink)] dark:focus-visible:outline-[var(--accent-strong)] cursor-pointer select-none ${isDarkVariantOnDarkCanvas} ${className}`;

  const content = (
    <>
      {showPrefix && (
        <span aria-hidden="true" className="font-sans text-[13px] leading-none opacity-80">
          ↳
        </span>
      )}
      <span>
        <EditorialText text={label} italicClassName="font-semibold" />
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        target={target}
        rel={rel}
        aria-label={ariaLabel}
        style={VARIANT_STYLE[effectiveVariant]}
        className={baseClass}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active || undefined}
      style={VARIANT_STYLE[effectiveVariant]}
      className={baseClass}
    >
      {content}
    </button>
  );
};
