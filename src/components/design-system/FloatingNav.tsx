import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { EquilibrioProductIcon, GrowyLogoMark } from '../GrowyMotifs';

export interface FloatingNavItem {
  id: string;
  label: string;
  shortLabel?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  active?: boolean;
  dataTour?: string;
}

interface FloatingNavProps {
  items: FloatingNavItem[];
  mobileItems?: FloatingNavItem[];
  logoHref?: string;
  onLogoClick?: () => void;
  /** Espacio reservado para un futuro selector de productos (oculto cuando solo existe Equilibrio). */
  productSlot?: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    avatarInitials?: string;
  };
  onCenterMobileClick?: () => void;
  centerMobileLabel?: string;
  centerMobileActive?: boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
  extraRightSlot?: React.ReactNode;
  /** En el showroom de desarrollo permite mostrar la barra en línea sin `position: fixed`. */
  inlinePreview?: boolean;
  maxWidthClass?: string;
  className?: string;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  items,
  mobileItems,
  logoHref,
  onLogoClick,
  productSlot,
  primaryAction,
  onCenterMobileClick,
  centerMobileLabel = 'Equilibrio',
  centerMobileActive = false,
  isDark = false,
  onToggleTheme,
  extraRightSlot,
  inlinePreview = false,
  maxWidthClass = 'max-w-6xl',
  className = '',
}) => {
  const mobileSource = mobileItems ?? items;
  const leftMobileItems = mobileSource.slice(0, 2);
  const rightMobileItems = mobileSource.slice(2, 4);

  const renderDesktopItem = (item: FloatingNavItem) => {
    const baseClass = `min-h-[40px] px-3.5 py-2 rounded-full text-xs sm:text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] cursor-pointer ${
      item.active
        ? 'bg-[var(--btn-navy-bg)] text-[var(--btn-navy-text)]'
        : 'text-[var(--text-primary)] hover:bg-[var(--bg-soft)]'
    }`;

    if (item.href) {
      return (
        <a
          key={item.id}
          href={item.href}
          onClick={item.onClick}
          data-tour={item.dataTour}
          className={baseClass}
        >
          {item.label}
        </a>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={item.onClick}
        data-tour={item.dataTour}
        className={baseClass}
      >
        {item.label}
      </button>
    );
  };

  const renderMobileItem = (item: FloatingNavItem) => {
    const baseClass = `min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-2 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] ${
      item.active ? 'text-[var(--accent-strong)]' : 'text-[var(--text-secondary)]'
    }`;

    const content = (
      <>
        {item.icon && <span className="shrink-0">{item.icon}</span>}
        <span className="truncate max-w-[66px]">{item.shortLabel || item.label}</span>
      </>
    );

    if (item.href) {
      return (
        <a
          key={item.id}
          href={item.href}
          onClick={item.onClick}
          data-tour={item.dataTour}
          className={baseClass}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={item.onClick}
        data-tour={item.dataTour}
        className={baseClass}
      >
        {content}
      </button>
    );
  };

  const primaryButtonClass =
    'min-h-[42px] px-4 sm:px-5 rounded-full text-xs font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-opacity hover:opacity-92 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]';

  const primaryButtonStyle: React.CSSProperties = {
    backgroundColor: 'var(--btn-navy-bg)',
    color: 'var(--btn-navy-text)',
  };

  return (
    <div className={className}>
      {/* Escritorio: Barra superior flotante en píldora */}
      <header
        className={`${
          inlinePreview ? '' : 'sticky top-3 z-40'
        } hidden md:block ${maxWidthClass} mx-auto px-4`}
      >
        <div className="growy-nav-pill rounded-full px-4 py-2 flex items-center justify-between gap-4">
          {/* Zona izquierda: Marca oficial + espacio preparado para futuros productos */}
          <div className="flex items-center gap-3 shrink-0">
            {logoHref ? (
              <a
                href={logoHref}
                onClick={onLogoClick}
                aria-label="GROWy. Inicio"
                className="inline-flex items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] rounded-full px-1"
              >
                <GrowyLogoMark size="sm" />
              </a>
            ) : (
              <button
                type="button"
                onClick={onLogoClick}
                aria-label="GROWy. Inicio"
                className="inline-flex items-center cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] rounded-full px-1"
              >
                <GrowyLogoMark size="sm" />
              </button>
            )}
            {productSlot && <div className="shrink-0">{productSlot}</div>}
          </div>

          {/* Zona central: enlaces / módulos en una sola línea */}
          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar"
          >
            {items.map(renderDesktopItem)}
          </nav>

          {/* Zona derecha: utilidad (tema) + acción principal / avatar */}
          <div className="flex items-center gap-2 shrink-0">
            {extraRightSlot}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                className="min-w-[40px] min-h-[40px] rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-center hover:bg-[var(--bg-soft)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-[var(--gold-motif)]" />
                ) : (
                  <Moon className="w-4 h-4 text-[var(--text-primary)]" />
                )}
              </button>
            )}

            {primaryAction &&
              (primaryAction.href ? (
                <a
                  href={primaryAction.href}
                  onClick={primaryAction.onClick}
                  style={primaryButtonStyle}
                  className={primaryButtonClass}
                >
                  {primaryAction.avatarInitials && (
                    <span className="w-6 h-6 rounded-full bg-[var(--accent-coral)] text-[var(--navy-ink)] text-[11px] font-extrabold inline-flex items-center justify-center">
                      {primaryAction.avatarInitials}
                    </span>
                  )}
                  <span>{primaryAction.label}</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  style={primaryButtonStyle}
                  className={primaryButtonClass}
                >
                  {primaryAction.avatarInitials && (
                    <span className="w-6 h-6 rounded-full bg-[var(--accent-coral)] text-[var(--navy-ink)] text-[11px] font-extrabold inline-flex items-center justify-center">
                      {primaryAction.avatarInitials}
                    </span>
                  )}
                  <span>{primaryAction.label}</span>
                </button>
              ))}
          </div>
        </div>
      </header>

      {/* Móvil: Top compacto + dock inferior flotante con botón central azul noche de Equilibrio */}
      <div className="md:hidden space-y-3">
        <div
          className={`${
            inlinePreview ? '' : 'sticky top-2 z-40'
          } px-3`}
        >
          <div className="growy-nav-pill rounded-full px-3.5 py-1.5 flex items-center justify-between gap-2">
            {logoHref ? (
              <a
                href={logoHref}
                onClick={onLogoClick}
                aria-label="GROWy. Inicio"
                className="inline-flex items-center min-h-[40px] px-1"
              >
                <GrowyLogoMark size="sm" />
              </a>
            ) : (
              <button
                type="button"
                onClick={onLogoClick}
                aria-label="GROWy. Inicio"
                className="inline-flex items-center min-h-[40px] px-1 cursor-pointer"
              >
                <GrowyLogoMark size="sm" />
              </button>
            )}
            <div className="flex items-center gap-1.5 shrink-0">
              {onToggleTheme && (
                <button
                  type="button"
                  onClick={onToggleTheme}
                  aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-[var(--bg-soft)] cursor-pointer"
                >
                  {isDark ? (
                    <Sun className="w-4 h-4 text-[var(--gold-motif)]" />
                  ) : (
                    <Moon className="w-4 h-4 text-[var(--text-primary)]" />
                  )}
                </button>
              )}
              {primaryAction && (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  style={primaryButtonStyle}
                  className="min-h-[40px] px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  {primaryAction.avatarInitials && (
                    <span className="w-5 h-5 rounded-full bg-[var(--accent-coral)] text-[var(--navy-ink)] text-[10px] font-extrabold inline-flex items-center justify-center">
                      {primaryAction.avatarInitials}
                    </span>
                  )}
                  <span>{primaryAction.label}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <nav
          aria-label="Navegación móvil"
          className={`${
            inlinePreview ? 'mx-3' : 'fixed bottom-3 left-3 right-3 z-40'
          }`}
        >
          <div className="growy-nav-pill rounded-full px-2 py-1.5 grid grid-cols-5 items-center gap-1">
            <div className="flex items-center justify-center">
              {leftMobileItems[0] && renderMobileItem(leftMobileItems[0])}
            </div>
            <div className="flex items-center justify-center">
              {leftMobileItems[1] && renderMobileItem(leftMobileItems[1])}
            </div>

            {/* Botón central azul noche con ícono oficial de Equilibrio */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={onCenterMobileClick}
                aria-label={centerMobileLabel}
                aria-pressed={centerMobileActive || undefined}
                style={primaryButtonStyle}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-md cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] ring-2 ring-[var(--bg-surface)]"
              >
                <EquilibrioProductIcon size="xs" />
              </button>
            </div>

            <div className="flex items-center justify-center">
              {rightMobileItems[0] && renderMobileItem(rightMobileItems[0])}
            </div>
            <div className="flex items-center justify-center">
              {rightMobileItems[1] && renderMobileItem(rightMobileItems[1])}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
};
