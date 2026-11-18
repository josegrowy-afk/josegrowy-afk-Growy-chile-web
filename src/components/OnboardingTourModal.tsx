import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Compass,
  LayoutDashboard,
  PackageCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ViewTab } from '../types/finance';
import { EquilibrioProductIcon } from './GrowyMotifs';
import { GROWY_EASE } from './MotionPrimitives';

interface OnboardingStep {
  id: string;
  targetId: string;
  tab: ViewTab;
  subTab?: string;
  sectionLabel: string;
  title: string;
  description: string;
  tips: string[];
  icon: React.ReactNode;
  tryNowLabel?: string;
}

const TOUR_STEPS: OnboardingStep[] = [
  {
    id: 'dashboard',
    targetId: 'dashboard-overview',
    tab: 'dashboard',
    subTab: 'overview',
    sectionLabel: 'Vista principal',
    title: 'Tu Dashboard financiero en vivo',
    description:
      'Aquí ves de un vistazo tu punto de equilibrio, el saldo real disponible en caja, tu capital de trabajo y las alertas prioritarias.',
    tips: [
      'Las ventas fiadas o por cobrar nunca se suman como dinero disponible hasta que realmente las cobras.',
      'Desde cada tarjeta puedes ir directo al detalle mensual o descargar reportes en CSV y PDF.',
    ],
    icon: <LayoutDashboard className="w-5 h-5 text-[var(--accent-strong)]" />,
  },
  {
    id: 'analyst',
    targetId: 'analyst-panel',
    tab: 'dashboard',
    subTab: 'analyst',
    sectionLabel: 'Diagnóstico inteligente',
    title: 'Analista Financiero PYME',
    description:
      'Evalúa tus márgenes, flujo de caja, cobranzas, deudas e inventario usando exclusivamente los datos reales que has registrado.',
    tips: [
      'Te explica qué indicador requiere atención hoy y te lleva directo a la sección donde corregirlo.',
      'Si prefieres cero tecnicismos, abre «Peras y manzanas» en el menú para leer todo en lenguaje cotidiano.',
    ],
    icon: <Compass className="w-5 h-5 text-[var(--sec-text)]" />,
  },
  {
    id: 'inventory',
    targetId: 'inventory-purchase-form',
    tab: 'catalog',
    subTab: 'inventory',
    sectionLabel: 'Costos, catálogo e inventario',
    title: 'Cómo registrar tu primer movimiento de inventario',
    description:
      'En Inventario inteligente controlas entradas por compra, salidas por venta, mermas y alertas de stock mínimo sin duplicar registros.',
    tips: [
      '1. Selecciona el producto y escribe la cantidad y costo unitario.',
      '2. Elige «Contado» (descuenta de caja real) o «Crédito» (crea la cuenta por pagar automáticamente).',
      '3. Pulsa «Registrar compra» para actualizar tu stock valorizado y rotación al instante.',
    ],
    icon: <Boxes className="w-5 h-5 text-[var(--pos-text)]" />,
    tryNowLabel: 'Quedarme aquí para registrar',
  },
  {
    id: 'actuals',
    targetId: 'nav-actuals',
    tab: 'actuals',
    subTab: 'cash',
    sectionLabel: 'Seguimiento diario',
    title: 'Todo conectado con tus Resultados Reales',
    description:
      'Cuando registres ventas, cobros de clientes o pagos a proveedores en Resultados Reales, GROWy actualizará tu flujo de caja e inventario automáticamente.',
    tips: [
      'Ahora mismo ves un negocio de ejemplo para explorar tranquilo; cuando quieras puedes borrarlo en Configuración o desde el aviso superior.',
      'Puedes volver a ver este tour guiado en cualquier momento desde Configuración.',
    ],
    icon: <PackageCheck className="w-5 h-5 text-[var(--accent-strong)]" />,
  },
];

interface TargetBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface OnboardingTourModalProps {
  open: boolean;
  userName?: string;
  onNavigate: (tab: ViewTab, subTab?: string) => void;
  onComplete: (options?: { stayOnCurrentTab?: boolean }) => void;
}

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  open,
  userName,
  onNavigate,
  onComplete,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });

  const currentStep = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const measureTarget = useCallback((targetId: string, shouldScroll: boolean) => {
    if (typeof window === 'undefined') return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });

    const candidates = Array.from(document.querySelectorAll(`[data-tour="${targetId}"]`));
    const visible = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    if (!visible) {
      setTargetBox(null);
      return;
    }

    if (shouldScroll) {
      const initialRect = visible.getBoundingClientRect();
      const outOfView = initialRect.top < 72 || initialRect.bottom > window.innerHeight - 110;
      if (outOfView) {
        visible.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    const rect = visible.getBoundingClientRect();
    const pad = 8;
    const top = Math.max(8, rect.top - pad);
    const left = Math.max(8, rect.left - pad);
    const maxW = Math.max(0, window.innerWidth - left - 8);
    const maxH = Math.max(0, window.innerHeight - top - 8);
    setTargetBox({
      top,
      left,
      width: Math.min(rect.width + pad * 2, maxW),
      height: Math.min(rect.height + pad * 2, maxH),
    });
  }, []);

  // Resetear al paso 0 al abrir el tour
  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  // Navegar a la pestaña/subpestaña correspondiente y medir el elemento destacado
  useEffect(() => {
    if (!open) return;

    onNavigate(currentStep.tab, currentStep.subTab);

    const t1 = window.setTimeout(() => measureTarget(currentStep.targetId, true), 90);
    const t2 = window.setTimeout(() => measureTarget(currentStep.targetId, false), 360);

    const handleSync = () => measureTarget(currentStep.targetId, false);
    window.addEventListener('resize', handleSync);
    window.addEventListener('scroll', handleSync, true);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', handleSync);
      window.removeEventListener('scroll', handleSync, true);
    };
  }, [open, currentStep.tab, currentStep.subTab, currentStep.targetId, measureTarget]);

  const handleFinish = useCallback(
    (stayOnCurrentTab: boolean) => {
      if (!stayOnCurrentTab) {
        onNavigate('dashboard', 'overview');
      }
      onComplete({ stayOnCurrentTab });
    },
    [onComplete, onNavigate]
  );

  // Atajos de teclado: Escape para saltar, flechas para navegar
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleFinish(true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isLast) {
          handleFinish(false);
        } else {
          setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
        }
      } else if (e.key === 'ArrowLeft' && !isFirst) {
        e.preventDefault();
        setStepIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isFirst, isLast, handleFinish]);

  if (!open) return null;

  const isMobile = viewport.width < 640;
  const cardWidth = Math.min(430, viewport.width - 32);
  const estimatedCardHeight = 320;

  let cardStyle: React.CSSProperties;
  if (isMobile) {
    cardStyle = {
      left: '12px',
      right: '12px',
      bottom: '16px',
    };
  } else if (targetBox) {
    const spaceBelow = viewport.height - (targetBox.top + targetBox.height);
    const spaceAbove = targetBox.top;
    const centeredLeft = Math.max(
      16,
      Math.min(
        targetBox.left + targetBox.width / 2 - cardWidth / 2,
        viewport.width - cardWidth - 16
      )
    );

    if (spaceBelow >= estimatedCardHeight + 18) {
      cardStyle = {
        width: `${cardWidth}px`,
        top: `${targetBox.top + targetBox.height + 14}px`,
        left: `${centeredLeft}px`,
      };
    } else if (spaceAbove >= estimatedCardHeight + 18) {
      cardStyle = {
        width: `${cardWidth}px`,
        bottom: `${viewport.height - targetBox.top + 14}px`,
        left: `${centeredLeft}px`,
      };
    } else {
      cardStyle = {
        width: `${cardWidth}px`,
        bottom: '24px',
        right: '24px',
      };
    }
  } else {
    cardStyle = {
      width: `${cardWidth}px`,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[70]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-tour-title"
      >
        {/* Fondo oscuro con recorte spotlight sobre la sección destacada */}
        {targetBox ? (
          <div
            aria-hidden="true"
            className="fixed pointer-events-none rounded-3xl transition-all duration-300"
            style={{
              top: `${targetBox.top}px`,
              left: `${targetBox.left}px`,
              width: `${targetBox.width}px`,
              height: `${targetBox.height}px`,
              boxShadow: '0 0 0 9999px rgba(18, 17, 24, 0.62)',
              border: '2px solid var(--accent-btn)',
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-[#121118]/62 pointer-events-none"
          />
        )}

        {/* Capa para capturar clics fuera sin interactuar accidentalmente debajo */}
        <div className="fixed inset-0" aria-hidden="true" />

        {/* Tarjeta flotante del tour guiado */}
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: GROWY_EASE }}
          style={cardStyle}
          className="fixed z-[75] boho-card p-5 sm:p-6 shadow-2xl border border-[var(--border-hairline)] space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl growy-hero-surface flex items-center justify-center shrink-0">
                {isFirst ? <EquilibrioProductIcon size="xs" /> : currentStep.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-secondary)] font-mono tabular-nums">
                  Paso {stepIndex + 1} de {TOUR_STEPS.length}
                  <span aria-hidden="true"> · </span>
                  <span className="font-sans">{currentStep.sectionLabel}</span>
                </p>
                <h2
                  id="onboarding-tour-title"
                  className="font-display text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] leading-snug mt-0.5"
                >
                  {isFirst && userName
                    ? `Bienvenido a GROWy, ${userName.split(' ')[0]}`
                    : currentStep.title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleFinish(true)}
              aria-label="Cerrar recorrido guiado"
              className="min-w-[40px] min-h-[40px] rounded-full hover:bg-[var(--bg-soft)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isFirst && userName && (
            <p className="text-xs font-bold text-[var(--accent-strong)]">{currentStep.title}</p>
          )}

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            {currentStep.description}
          </p>

          <ul className="space-y-1.5 text-xs text-[var(--text-primary)] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] rounded-2xl p-3.5">
            {currentStep.tips.map((tip) => (
              <li key={tip} className="leading-relaxed">
                {tip}
              </li>
            ))}
          </ul>

          {/* Indicador simple de progreso */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((st, idx) => (
              <span
                key={st.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  idx === stepIndex
                    ? 'w-6 bg-[var(--accent-btn)]'
                    : idx < stepIndex
                      ? 'w-2.5 bg-[var(--pos-text)]'
                      : 'w-2.5 bg-[var(--border-hairline)]'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleFinish(true)}
              className="min-h-[44px] px-4 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-soft)] cursor-pointer whitespace-nowrap"
            >
              Saltar tour
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] hover:bg-[var(--bg-soft)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>
              )}

              {currentStep.tryNowLabel && (
                <button
                  type="button"
                  onClick={() => handleFinish(true)}
                  className="min-h-[44px] px-4 rounded-full border border-[var(--pos-border)] bg-[var(--pos-soft)] text-[var(--pos-text)] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {currentStep.tryNowLabel}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isLast) {
                    handleFinish(false);
                  } else {
                    setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1));
                  }
                }}
                className="min-h-[44px] px-5 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap"
              >
                <span>{isLast ? 'Finalizar y empezar' : 'Siguiente'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
