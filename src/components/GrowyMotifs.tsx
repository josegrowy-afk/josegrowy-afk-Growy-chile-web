import React from 'react';

export const GrowyLogoMark: React.FC<{
  showSlogan?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ showSlogan = false, className = '', size = 'md' }) => {
  const heightClass = showSlogan
    ? size === 'sm'
      ? 'h-9 w-auto'
      : size === 'lg'
        ? 'h-16 sm:h-20 w-auto'
        : 'h-11 sm:h-12 w-auto'
    : size === 'sm'
      ? 'h-6 w-auto'
      : size === 'lg'
        ? 'h-12 sm:h-14 w-auto'
        : 'h-7 sm:h-8 w-auto';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src={showSlogan ? '/assets/growy-logo-full.png' : '/assets/growy-logo-mark.png'}
        alt="GROWy. — Impulso el crecimiento de tu negocio"
        className={`${heightClass} max-w-full object-contain block dark:brightness-0 dark:invert`}
        draggable={false}
      />
    </div>
  );
};

/**
 * Ícono oficial del producto Equilibrio — incrustado TAL CUAL desde el archivo adjunto.
 */
export const EquilibrioProductIcon: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const sizeClass =
    size === 'xs'
      ? 'w-7 h-7'
      : size === 'sm'
        ? 'w-10 h-10'
        : size === 'lg'
          ? 'w-16 h-16'
          : 'w-12 h-12';

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none ${sizeClass} ${className}`}
    >
      <img
        src="/assets/aistudio/equilibrio-chispa-claro_8dfad465.svg"
        alt="Ícono del producto Equilibrio"
        className="w-full h-full object-contain drop-shadow-sm block"
        draggable={false}
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

/** Logo completo del producto Equilibrio (ícono oficial + nombre del producto) */
export const EquilibrioLogoMark: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  className?: string;
}> = ({ size = 'md', subtitle, className = '' }) => {
  const iconSize = size === 'sm' ? 'xs' : size === 'lg' ? 'lg' : 'sm';
  const titleClass =
    size === 'sm'
      ? 'text-sm font-bold'
      : size === 'lg'
        ? 'text-2xl font-bold'
        : 'text-base font-bold';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <EquilibrioProductIcon size={iconSize} />
      <div className="min-w-0 leading-tight">
        <span className={`font-display tracking-tight text-[var(--text-primary)] block ${titleClass}`}>
          Equilibrio
        </span>
        {subtitle && (
          <span className="text-[11px] font-medium text-[var(--sec-text)] block truncate">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

/** Ornamento fino: sol */
export const BohoSunMotif: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7 text-[var(--gold-motif)]',
}) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M7 24H29" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path
      d="M11 24C11 20.134 14.134 17 18 17C21.866 17 25 20.134 25 24"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <path
      d="M18 9V12.5M10.5 12.5L13 15M25.5 12.5L23 15M7 18.5L10 19.5M29 18.5L26 19.5"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
  </svg>
);

/** Ornamento fino: luna creciente */
export const BohoMoonMotif: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7 text-[var(--sec-text)]',
}) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M22.5 24.8C17.2 24.8 13 20.6 13 15.3C13 12.6 14.1 10.1 16 8.4C11.4 9.1 8 13 8 17.8C8 23.1 12.3 27.4 17.6 27.4C21.5 27.4 24.9 25 26.4 21.6C25.2 23.6 24 24.8 22.5 24.8Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M25.5 10V13.5M23.75 11.75H27.25"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinecap="round"
    />
  </svg>
);

/** Ornamento fino: hoja botánica */
export const BohoLeafMotif: React.FC<{ className?: string }> = ({
  className = 'w-7 h-7 text-[var(--pos-text)]',
}) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M18 28V11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path
      d="M18 11C18 11 25.5 11.5 26.5 18.5C27 22.2 22.5 25 18 24.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 14C18 14 10.5 14.5 9.5 21C9 24.5 13.5 26.8 18 26.2"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 18.5L22.5 16M18 21.5L13.5 19"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Personaje oficial de GROWy. — incrustado TAL CUAL desde el archivo adjunto,
 * sin redibujar ni alterar sus trazos o proporciones.
 */
export const GrowyCharacterArtwork: React.FC<{ className?: string }> = ({
  className = 'w-full max-w-[330px] mx-auto block select-none',
}) => (
  <img
    src="/assets/aistudio/image_18d9f62a.png"
    alt="Personaje oficial de GROWy.: criatura lila con brote de dos hojas en equilibrio sobre una moneda, sosteniendo una ampolleta de idea y monedas de crecimiento"
    className={className}
    draggable={false}
    referrerPolicy="no-referrer"
  />
);

/** Doodle estilo mascota (contorno oscuro grueso y colores planos): ampolleta creativa */
export const DoodleIdeaMotif: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <path
      d="M20 7C14.48 7 10 11.48 10 17C10 20.5 11.9 23.4 14.5 25.1V28.5C14.5 29.6 15.4 30.5 16.5 30.5H23.5C24.6 30.5 25.5 29.6 25.5 28.5V25.1C28.1 23.4 30 20.5 30 17C30 11.48 25.52 7 20 7Z"
      fill="#FBE48B"
      stroke="#1F1B2E"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <path d="M16 34H24" stroke="#1F1B2E" strokeWidth="2.2" strokeLinecap="round" />
    <path
      d="M17.5 17C18.3 15.6 21.7 15.6 22.5 17"
      stroke="#1F1B2E"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20 2V4.2M7 17H4.5M35.5 17H33M10.5 7.5L8.8 5.8M29.5 7.5L31.2 5.8"
      stroke="#1F1B2E"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/** Doodle estilo mascota: brote y cimientos estables */
export const DoodleSproutMotif: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => (
  <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
    <path d="M20 33V16" stroke="#1F1B2E" strokeWidth="2.2" strokeLinecap="round" />
    <path
      d="M20 18C20 11.5 26 8 32 9C32.5 15.5 27.5 20.5 20 18Z"
      fill="#6FAE8A"
      stroke="#1F1B2E"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <path
      d="M20 21C20 15.5 14 12.5 8 13.5C7.5 19.5 12.5 23.5 20 21Z"
      fill="#F6A59E"
      stroke="#1F1B2E"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
    <ellipse
      cx="20"
      cy="33"
      rx="10"
      ry="3.2"
      fill="#EDEAF8"
      stroke="#1F1B2E"
      strokeWidth="2.2"
    />
  </svg>
);

/** Doodle estilo mascota: destello dorado */
export const DoodleSparkleMotif: React.FC<{ className?: string }> = ({
  className = 'w-8 h-8',
}) => (
  <svg viewBox="0 0 36 36" fill="none" className={className} aria-hidden="true">
    <path
      d="M18 4L21.2 14.8L32 18L21.2 21.2L18 32L14.8 21.2L4 18L14.8 14.8L18 4Z"
      fill="#E9B949"
      stroke="#1F1B2E"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
);

export const BohoArchDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <GrowyDivider className={className} />
);

/**
 * Ilustración editorial original de GROWy:
 * personaje minimalista emergiendo tras una billetera/libreta financiera, señalando metas
 * con carrito de compras, moneda dorada, boleta, tarjetas y destellos de crecimiento.
 */
export const GrowyHeroIllustration: React.FC<{ className?: string }> = ({
  className = 'w-full max-w-[300px] mx-auto',
}) => (
  <svg
    viewBox="0 0 320 270"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="Ilustración editorial financiera de GROWy con personaje, billetera, tarjetas y metas de venta"
  >
    {/* Círculo pastel coral de fondo con respiración sutil */}
    <circle
      cx="170"
      cy="126"
      r="68"
      fill="#F7A8A8"
      fillOpacity="0.82"
      className="growy-breathe"
    />

    {/* Moneda dorada flotante superior */}
    <g className="growy-float-a">
      <circle
        cx="148"
        cy="34"
        r="13"
        fill="#F6D55C"
        stroke="currentColor"
        strokeWidth="1.6"
        className="text-[#1A1A1E] dark:text-[#F7F4F6]"
      />
      <text
        x="148"
        y="39"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="#1A1A1E"
        fontFamily="DM Sans, sans-serif"
      >
        $
      </text>
    </g>

    {/* Carrito de compras flotante arriba izquierda */}
    <g
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#1A1A1E] dark:text-[#F7F4F6] growy-float-b"
    >
      <path d="M28 48H37L43 72H72L77 54H40" />
      <circle cx="47" cy="80" r="3" />
      <circle cx="67" cy="80" r="3" />
    </g>

    {/* Boleta / recibo flotante arriba derecha */}
    <g className="growy-float-c">
      <g
        transform="translate(232 42) rotate(12)"
        className="text-[#1A1A1E] dark:text-[#F7F4F6]"
      >
        <path
          d="M0 4C0 1.8 1.8 0 4 0H32C34.2 0 36 1.8 36 4V42L30 38L24 42L18 38L12 42L6 38L0 42V4Z"
          fill="#FFFFFF"
          className="dark:fill-[#1D1B22]"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M8 11H28M8 18H24M8 25H20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </g>

    {/* Tarjetas flotantes izquierda */}
    <g className="growy-float-b">
      <g transform="translate(26 138) rotate(-14)">
        <rect
          x="0"
          y="0"
          width="46"
          height="30"
          rx="4"
          fill="#FFFFFF"
          className="dark:fill-[#1D1B22]"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <rect x="0" y="6" width="46" height="6" fill="currentColor" />
      </g>
      <g transform="translate(42 156) rotate(-6)">
        <rect
          x="0"
          y="0"
          width="48"
          height="31"
          rx="5"
          fill="#F6D55C"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="34" cy="11" r="3.5" stroke="#1A1A1E" strokeWidth="1.4" />
        <circle cx="39" cy="11" r="3.5" stroke="#1A1A1E" strokeWidth="1.4" />
        <path d="M8 21H24" stroke="#1A1A1E" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>

    {/* Ícono QR / cuadrícula flotante derecha */}
    <g className="growy-float-a">
      <g
        transform="translate(258 144)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[#1A1A1E] dark:text-[#F7F4F6]"
      >
        <rect x="0" y="0" width="9" height="9" rx="1.5" />
        <rect x="13" y="0" width="9" height="9" rx="1.5" />
        <rect x="0" y="13" width="9" height="9" rx="1.5" />
        <path d="M13 13H17V17H13Z" fill="currentColor" />
        <path d="M19 19H22V22" />
      </g>
    </g>

    {/* Destellos de crecimiento */}
    <path
      d="M236 122L239 128L245 131L239 134L236 140L233 134L227 131L233 128L236 122Z"
      fill="#F6D55C"
      stroke="currentColor"
      strokeWidth="1.2"
      className="text-[#1A1A1E] dark:text-[#F7F4F6] growy-twinkle"
    />
    <path
      d="M84 114L86 118L90 120L86 122L84 126L82 122L78 120L82 118L84 114Z"
      fill="#B8E2DC"
      stroke="currentColor"
      strokeWidth="1.2"
      className="text-[#1A1A1E] dark:text-[#F7F4F6] growy-twinkle"
      style={{ animationDelay: '1.8s' }}
    />

    {/* Personaje editorial en trazo limpio */}
    <g
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#1A1A1E] dark:text-[#F7F4F6]"
    >
      <path
        d="M126 145C108 134 95 117 89 96L76 94L70 84C69 81 73 79 75 82L80 87L82 77C83 74 87 74 87 78L87 86L95 90C106 106 119 116 138 121"
        fill="#FFFFFF"
        className="dark:fill-[#1D1B22]"
      />
      <path
        d="M124 148C124 120 144 102 174 102C202 102 222 118 224 145L226 172H122L124 148Z"
        fill="#FFFFFF"
        className="dark:fill-[#1D1B22]"
      />
      <path
        d="M174 103C174 96 175 91 177 88C169 86 167 74 176 70C185 66 196 71 196 81C196 90 190 94 185 95L185 103"
        fill="#FFFFFF"
        className="dark:fill-[#1D1B22]"
      />
      <path
        d="M180 70C188 66 198 70 198 79C198 83 195 85 192 84C191 80 187 78 183 78C181 78 179 74 180 70Z"
        fill="currentColor"
      />
      <path d="M171 78L165 82L171 84" />
      <path d="M175 87C177 88.5 180 88.5 182 87" strokeWidth="1.4" />

      <g transform="translate(106 162) rotate(-6)">
        <rect
          x="0"
          y="0"
          width="134"
          height="78"
          rx="12"
          fill="#FFFFFF"
          className="dark:fill-[#1D1B22]"
        />
        <rect
          x="6"
          y="6"
          width="122"
          height="66"
          rx="9"
          strokeDasharray="4 4"
          strokeWidth="1.2"
        />
        <rect
          x="-6"
          y="27"
          width="22"
          height="22"
          rx="6"
          fill="#FFFFFF"
          className="dark:fill-[#1D1B22]"
        />
        <circle cx="5" cy="38" r="2.5" fill="currentColor" />
        <path d="M62 34C66 30 72 30 76 34" strokeWidth="1.5" />
        <path d="M65 39C67.5 36.5 70.5 36.5 73 39" strokeWidth="1.5" />
        <circle cx="69" cy="43" r="1.5" fill="currentColor" />
      </g>

      <path
        d="M196 125C211 135 215 154 203 175L188 197L180 205C177 207 174 203 176 200L181 194L174 198C171 199 169 195 172 193L179 186L190 165C194 156 191 144 181 138"
        fill="#FFFFFF"
        className="dark:fill-[#1D1B22]"
      />
    </g>
  </svg>
);

export const GrowyEmptyStateIllustration: React.FC<{ className?: string }> = ({
  className = 'w-24 h-24 mx-auto',
}) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="60" cy="60" r="44" style={{ fill: 'var(--pos-soft)' }} className="growy-breathe" />
    <circle cx="76" cy="46" r="20" style={{ fill: 'var(--accent-btn)' }} fillOpacity="0.55" />
    <g
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--text-primary)]"
    >
      <rect
        x="30"
        y="46"
        width="60"
        height="40"
        rx="9"
        style={{ fill: 'var(--bg-surface)' }}
      />
      <path d="M40 72L52 60L62 67L78 52" />
      <path d="M71 52H78V59" />
      <circle cx="38" cy="30" r="7" style={{ fill: 'var(--gold-motif)' }} className="growy-float-a" />
    </g>
  </svg>
);

export const GrowyDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-4 py-1 ${className}`} aria-hidden="true">
    <div className="h-px flex-1 bg-[var(--border-hairline)]" />
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-bar)]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--sec-dot)]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--pos-dot)]" />
    </div>
    <div className="h-px flex-1 bg-[var(--border-hairline)]" />
  </div>
);
