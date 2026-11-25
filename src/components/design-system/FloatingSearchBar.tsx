import React, { useId } from 'react';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';

interface FloatingSearchBarProps {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  label?: string;
  onFilterClick?: () => void;
  filterActive?: boolean;
  filterLabel?: string;
  onAddClick?: () => void;
  addLabel?: string;
  className?: string;
}

export const FloatingSearchBar: React.FC<FloatingSearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Buscar producto, cliente o costo...',
  label = 'Buscar en tu negocio',
  onFilterClick,
  filterActive = false,
  filterLabel = 'Filtrar resultados',
  onAddClick,
  addLabel = 'Agregar nuevo registro',
  className = '',
}) => {
  const inputId = useId();

  return (
    <div
      className={`growy-nav-pill rounded-full p-1.5 pl-4 flex items-center gap-2 max-w-2xl w-full ${className}`}
    >
      <Search
        className="w-4 h-4 text-[var(--text-secondary)] shrink-0"
        aria-hidden="true"
      />

      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none min-h-[40px]"
      />

      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {onFilterClick && (
        <button
          type="button"
          onClick={onFilterClick}
          aria-label={filterLabel}
          aria-pressed={filterActive}
          className={`min-w-[44px] min-h-[44px] px-3 rounded-full border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)] ${
            filterActive
              ? 'bg-[var(--sec-soft)] border-[var(--sec-border)] text-[var(--sec-text)]'
              : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-soft)]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Filtrar</span>
        </button>
      )}

      {onAddClick && (
        <button
          type="button"
          onClick={onAddClick}
          aria-label={addLabel}
          title={addLabel}
          style={{
            backgroundColor: 'var(--btn-navy-bg)',
            color: 'var(--btn-navy-text)',
          }}
          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full flex items-center justify-center shadow-xs hover:opacity-92 transition-opacity cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-primary)]"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
