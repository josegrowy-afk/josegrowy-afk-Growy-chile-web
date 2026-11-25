import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  radius?: 'md' | 'lg';
  interactive?: boolean;
  as?: 'div' | 'section' | 'article';
  id?: string;
}

export const GlassCard: React.FC<CardProps> = ({
  children,
  className = '',
  radius = 'md',
  interactive = false,
  as = 'div',
  id,
}) => {
  const Tag = as;
  const radiusClass = radius === 'lg' ? 'growy-glass-lg' : '';
  const hoverClass = interactive ? 'hover:-translate-y-0.5' : '';
  return (
    <Tag id={id} className={`growy-glass ${radiusClass} ${hoverClass} ${className}`}>
      {children}
    </Tag>
  );
};

export const SolidCard: React.FC<CardProps> = ({
  children,
  className = '',
  radius = 'md',
  interactive = false,
  as = 'div',
  id,
}) => {
  const Tag = as;
  const radiusClass = radius === 'lg' ? 'growy-glass-lg' : '';
  const hoverClass = interactive ? 'hover:-translate-y-0.5' : '';
  return (
    <Tag id={id} className={`growy-solid ${radiusClass} ${hoverClass} ${className}`}>
      {children}
    </Tag>
  );
};
