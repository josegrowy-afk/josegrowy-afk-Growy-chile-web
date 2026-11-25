import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarRange,
  Compass,
  LayoutDashboard,
  Moon,
  Sun,
} from 'lucide-react';
import type { ColorTone } from '../types/finance';
import { GrowyCharacterArtwork } from './GrowyMotifs';
import {
  AnalystMessage,
  BackdropBlobs,
  ChipLink,
  FloatingNav,
  FloatingSearchBar,
  GlassCard,
  HeroBanner,
  IncomeVsExpenseBarChart,
  ProductProfitabilityDoughnut,
  SectionTitle,
  SolidCard,
  StatRing,
  type StatRingStatus,
} from './design-system';

interface DesignSystemShowcaseProps {
  theme: 'light' | 'dark';
  colorTone: ColorTone;
  onChangeTheme: (theme: 'light' | 'dark') => void;
  onChangeTone: (tone: ColorTone) => void;
  onExit: () => void;
}

const SAMPLE_BAR_DATA = [
  { label: 'Jul', income: 1850000, expense: 1320000 },
  { label: 'Ago', income: 2120000, expense: 1480000 },
  { label: 'Sep', income: 2390000, expense: 1510000 },
  { label: 'Oct', income: 2680000, expense: 1620000 },
];

const SAMPLE_PRODUCT_SHARES = [
  { name: 'Torta de zanahoria (muestra)', amount: 740000 },
  { name: 'Café de especialidad (muestra)', amount: 520000 },
  { name: 'Box desayuno (muestra)', amount: 410000 },
  { name: 'Galletas artesanales (muestra)', amount: 230000 },
];

export const DesignSystemShowcase: React.FC<DesignSystemShowcaseProps> = ({
  theme,
  colorTone,
  onChangeTheme,
  onChangeTone,
  onExit,
}) => {
  const [activeChip, setActiveChip] = useState<'all' | 'cash' | 'margin'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState(false);
  const [ringStatus, setRingStatus] = useState<StatRingStatus>('green');
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);
  const [activeNavTab, setActiveNavTab] = useState('dashboard');

  const isDark = theme === 'dark';
  const themeKey = `${theme}-${colorTone}`;

  const ringSpec = useMemo(() => {
    if (ringStatus === 'red') {
      return {
        pct: 12,
        statusLabel: 'Bajo equilibrio',
        subtitle: 'Ejemplo visual de alerta roja cuando las ventas no cubren los costos fijos.',
      };
    }
    if (ringStatus === 'amber') {
      return {
        pct: 48,
        statusLabel: 'Margen ajustado',
        subtitle: 'Ejemplo visual de zona amarilla: cubres costos, pero conviene cuidar gastos.',
      };
    }
    return {
      pct: 76,
      statusLabel: 'Zona segura',
      subtitle: 'Ejemplo visual de holgura verde sobre el punto de equilibrio.',
    };
  }, [ringStatus]);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Resumen',
      shortLabel: 'Resumen',
      icon: <LayoutDashboard className="w-4 h-4" />,
      active: activeNavTab === 'dashboard',
      onClick: () => setActiveNavTab('dashboard'),
    },
    {
      id: 'calculator',
      label: 'Equilibrio',
      shortLabel: 'Equilibrio',
      icon: <Compass className="w-4 h-4" />,
      active: activeNavTab === 'calculator',
      onClick: () => setActiveNavTab('calculator'),
    },
    {
      id: 'projections',
      label: 'Proyección',
      shortLabel: 'Proyección',
      icon: <CalendarRange className="w-4 h-4" />,
      active: activeNavTab === 'projections',
      onClick: () => setActiveNavTab('projections'),
    },
    {
      id: 'actuals',
      label: 'Reales',
      shortLabel: 'Reales',
      icon: <BookOpen className="w-4 h-4" />,
      active: activeNavTab === 'actuals',
      onClick: () => setActiveNavTab('actuals'),
    },
  ];

  const notify = (msg: string) => {
    setInteractionNotice(msg);
  };

  return (
    <div className="relative min-h-screen pb-16">
      <BackdropBlobs />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-5 space-y-10">
        {/* Barra superior de control de los 4 modos (solo desarrollo) */}
        <SolidCard className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.06em] text-[var(--sec-text)]">
              Vista interna de desarrollo · Sistema Cálido Editorial
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Prueba en vivo los 4 modos (Claro/Oscuro × Pastel/Formal) antes de migrar vistas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { t: 'light', tone: 'pastel', label: 'Claro · Pastel' },
                { t: 'dark', tone: 'pastel', label: 'Oscuro · Pastel' },
                { t: 'light', tone: 'formal', label: 'Claro · Formal' },
                { t: 'dark', tone: 'formal', label: 'Oscuro · Formal' },
              ] as const
            ).map((preset) => {
              const selected = theme === preset.t && colorTone === preset.tone;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChangeTheme(preset.t);
                    onChangeTone(preset.tone);
                  }}
                  aria-pressed={selected}
                  className={`min-h-[40px] px-3.5 rounded-full border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[var(--btn-navy-bg)] text-[var(--btn-navy-text)] border-transparent'
                      : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:bg-[var(--bg-soft)]'
                  }`}
                >
                  {preset.t === 'dark' ? (
                    <Moon className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Sun className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{preset.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={onExit}
              className="min-h-[40px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la app</span>
            </button>
          </div>
        </SolidCard>

        {interactionNotice && (
          <SolidCard className="px-5 py-3 flex items-center justify-between gap-3 text-xs font-semibold">
            <span>{interactionNotice}</span>
            <button
              type="button"
              onClick={() => setInteractionNotice(null)}
              className="underline cursor-pointer"
            >
              Cerrar
            </button>
          </SolidCard>
        )}

        {/* 1. FloatingNav (vista en línea desktop y dock móvil) */}
        <section className="space-y-4">
          <SectionTitle
            eyebrow="01 · Navegación flotante"
            title="Barra en píldora y *dock* móvil"
            subtitle="Sin selector de producto todavía; el espacio izquierdo queda listo para cuando exista un segundo producto junto a Equilibrio."
          />
          <FloatingNav
            inlinePreview
            items={navItems}
            isDark={isDark}
            onToggleTheme={() => onChangeTheme(isDark ? 'light' : 'dark')}
            onLogoClick={() => notify('Click en logo oficial GROWy.')}
            onCenterMobileClick={() => setActiveNavTab('calculator')}
            centerMobileActive={activeNavTab === 'calculator'}
            primaryAction={{
              label: 'José',
              avatarInitials: 'J',
              onClick: () => notify('Click en acción principal / avatar de usuario'),
            }}
          />
        </section>

        {/* 2. HeroBanner + Mascota oficial */}
        <section className="space-y-4">
          <SectionTitle
            eyebrow="02 · Banner editorial"
            title="Hero con degradado, grano y *personaje* oficial"
            subtitle="En Pastel usa degradado cálido + grano CSS y tinta azul noche; en Formal reduce a superficie sobria sin grano ni cursivas."
          />
          <HeroBanner
            eyebrow="Equilibrio · Vista previa de sistema"
            headline="Hola, *José*"
            headlineSize="greeting"
            subtitle="Tu negocio de muestra hoy está 24% sobre su punto de equilibrio. Revisa tus cifras con calma."
            rightSlot={<GrowyCharacterArtwork className="w-full max-w-[260px] mx-auto block select-none" />}
            chips={[
              {
                id: 'c-cash',
                label: 'Flujo de *caja*',
                variant: 'cream',
                onClick: () => notify('Navegación a Flujo de caja'),
              },
              {
                id: 'c-cxc',
                label: 'Cuentas por *cobrar*',
                variant: 'lilac',
                onClick: () => notify('Navegación a Cuentas por cobrar'),
              },
              {
                id: 'c-margin',
                label: 'Margen *real*',
                variant: 'sage',
                onClick: () => notify('Navegación a Margen por producto'),
              },
              {
                id: 'c-iva',
                label: 'IVA del *mes*',
                variant: 'white',
                onClick: () => notify('Navegación a Estimador IVA'),
              },
              {
                id: 'c-close',
                label: 'Cierre *guiado*',
                variant: 'navy',
                onClick: () => notify('Navegación a Cierre de mes'),
              },
            ]}
          />
        </section>

        {/* 3. ChipLink variantes + GlassCard + SolidCard + FloatingSearchBar */}
        <section className="space-y-5">
          <SectionTitle
            eyebrow="03 · Superficies, chips y búsqueda"
            title="Vidrio *esmerilado*, tarjetas sólidas y filtros"
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <GlassCard radius="lg" className="lg:col-span-7 p-6 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--sec-text)]">
                  GlassCard (radio 36px + fallback sólido)
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Usa <code className="font-mono text-xs">backdrop-filter: blur(20px)</code> sobre
                  manchas difuminadas en Pastel, y pasa a superficie nítida en Formal.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <ChipLink
                  label="Todos los *movimientos*"
                  variant="cream"
                  active={activeChip === 'all'}
                  onClick={() => setActiveChip('all')}
                />
                <ChipLink
                  label="Solo *caja*"
                  variant="lilac"
                  active={activeChip === 'cash'}
                  onClick={() => setActiveChip('cash')}
                />
                <ChipLink
                  label="Mejor *margen*"
                  variant="sage"
                  active={activeChip === 'margin'}
                  onClick={() => setActiveChip('margin')}
                />
              </div>
              <p className="font-mono tabular-nums text-xs text-[var(--text-secondary)]">
                Filtro activo: <strong className="text-[var(--text-primary)]">{activeChip}</strong> ·
                Ejemplo cifra: <strong className="text-[var(--text-primary)]">$1.450.000 CLP</strong>
              </p>
            </GlassCard>

            <SolidCard className="lg:col-span-5 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--accent-strong)]">
                  SolidCard
                </p>
                <h3 className="font-display text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                  Superficie sólida de alto énfasis
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                  Pensada para mensajes clave, alertas y acciones primarias que necesitan máxima
                  legibilidad en cualquier dispositivo.
                </p>
              </div>
              <FloatingSearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                filterActive={filterActive}
                onFilterClick={() => setFilterActive((p) => !p)}
                onAddClick={() => notify('Click en botón + azul noche para agregar registro')}
              />
            </SolidCard>
          </div>
        </section>

        {/* 4. StatRing + AnalystMessage */}
        <section className="space-y-5">
          <SectionTitle
            eyebrow="04 · Indicadores y Analista PYME"
            title="Semáforo *accesible* y mensajes claros"
            rightSlot={
              <div className="flex items-center gap-2">
                {(['green', 'amber', 'red'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setRingStatus(st)}
                    className={`min-h-[38px] px-3 rounded-full border text-xs font-bold cursor-pointer ${
                      ringStatus === st
                        ? 'bg-[var(--btn-navy-bg)] text-[var(--btn-navy-text)] border-transparent'
                        : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-primary)]'
                    }`}
                  >
                    {st === 'green' ? 'Verde' : st === 'amber' ? 'Amarillo' : 'Rojo'}
                  </button>
                ))}
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <StatRing
              className="lg:col-span-7"
              title="Margen de seguridad (muestra)"
              percentage={ringSpec.pct}
              status={ringStatus}
              statusLabel={ringSpec.statusLabel}
              subtitle={ringSpec.subtitle}
              metrics={[
                { label: 'Ventas del mes', value: '$2.680.000' },
                { label: 'Equilibrio', value: '$1.920.000' },
                { label: 'Utilidad est.', value: '$460.000' },
              ]}
            />

            <AnalystMessage
              className="lg:col-span-5"
              timestamp="Hoy · 09:40"
              category="Caja"
              tone="sage"
              message="Tu colchón proyectado alcanza para 4,2 meses de costos fijos. Mantener el precio actual en tu box desayuno protege tu meta mensual."
              onViewDetail={() => notify('Abriendo detalle de Flujo de caja')}
              onExplainSimple={() => notify('Abriendo explicación en Peras y manzanas')}
            />
          </div>
        </section>

        {/* 5. Gráficos Chart.js */}
        <section className="space-y-5">
          <SectionTitle
            eyebrow="05 · Visualización financiera"
            title="Ingresos *vs* gastos y rentabilidad"
            subtitle="Barras redondeadas sin cuadrícula pesada y dona con leyenda accesible en IBM Plex Mono."
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <IncomeVsExpenseBarChart
              className="lg:col-span-7"
              data={SAMPLE_BAR_DATA}
              themeKey={themeKey}
            />
            <ProductProfitabilityDoughnut
              className="lg:col-span-5"
              items={SAMPLE_PRODUCT_SHARES}
              themeKey={themeKey}
            />
          </div>
        </section>
      </div>
    </div>
  );
};
