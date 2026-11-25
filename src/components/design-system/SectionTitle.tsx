import React from 'react';

/**
 * Renderiza texto mezclando DM Sans con palabras clave entre asteriscos (*palabra*)
 * en Fraunces cursiva (automáticamente pasa a sans en modo Formal mediante CSS).
 */
export const EditorialText: React.FC<{
  text: string;
  italicClassName?: string;
}> = ({ text, italicClassName = '' }) => {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return (
            <em key={idx} className={`growy-editorial-phrase ${italicClassName}`}>
              {part.slice(1, -1)}
            </em>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
};

interface SectionTitleProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  as?: 'h1' | 'h2' | 'h3';
  align?: 'left' | 'center';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  rightSlot?: React.ReactNode;
}

export const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  eyebrow,
  subtitle,
  as = 'h2',
  align = 'left',
  size = 'md',
  className = '',
  rightSlot,
}) => {
  const HeadingTag = as;
  const headingSizeClass =
    size === 'lg'
      ? 'text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.06]'
      : size === 'sm'
        ? 'text-xl sm:text-2xl leading-[1.14]'
        : 'text-2xl sm:text-3xl lg:text-[2.15rem] leading-[1.1]';

  const alignClass = align === 'center' ? 'text-center mx-auto' : 'text-left';

  return (
    <div
      className={`flex flex-col md:flex-row md:items-end justify-between gap-4 ${className}`}
    >
      <div className={`space-y-2 max-w-2xl ${alignClass}`}>
        {eyebrow && (
          <p className="text-xs font-bold tracking-[0.06em] uppercase text-[var(--sec-text)]">
            {eyebrow}
          </p>
        )}
        <HeadingTag
          className={`font-display font-extrabold tracking-tight text-balance text-[var(--text-primary)] ${headingSizeClass}`}
        >
          <EditorialText text={title} />
        </HeadingTag>
        {subtitle && (
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
};
