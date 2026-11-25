import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Apple,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Info,
  Lightbulb,
  MessageSquareText,
  ShieldAlert,
} from 'lucide-react';
import { buildPhase1SimpleInsights } from '../finance/phase1Insights';
import { buildPhase2SimpleInsights } from '../finance/phase2Insights';
import {
  buildSimpleApplesAndPearsStory,
  type SimpleTopicMood,
} from '../finance/smeIntelligence';
import type { BusinessWorkspace, ViewTab } from '../types/finance';
import {
  DoodleIdeaMotif,
  DoodleSproutMotif,
  GrowyCharacterArtwork,
} from './GrowyMotifs';
import { StaggerItem, StaggerSection } from './MotionPrimitives';
import { HeroBanner, SectionTitle, SolidCard } from './design-system';

interface SimpleExplanationViewProps {
  business: BusinessWorkspace;
  onNavigate: (tab: ViewTab, subTab?: string) => void;
}

type SimpleFilterMode = 'all' | 'actions' | 'glossary';

const MOOD_STYLES: Record<
  SimpleTopicMood,
  {
    bg: string;
    border: string;
    text: string;
    icon: React.ReactNode;
  }
> = {
  good: {
    bg: 'bg-[var(--pos-soft)]',
    border: 'border-[var(--pos-border)]',
    text: 'text-[var(--pos-text)]',
    icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
  },
  attention: {
    bg: 'bg-[var(--warn-soft)]',
    border: 'border-[var(--warn-border)]',
    text: 'text-[var(--warn-text)]',
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
  },
  urgent: {
    bg: 'bg-[var(--danger-soft)]',
    border: 'border-[var(--accent-soft-border)]',
    text: 'text-[var(--danger-text)]',
    icon: <ShieldAlert className="w-4 h-4 shrink-0" />,
  },
  missing: {
    bg: 'bg-[var(--sec-soft)]',
    border: 'border-[var(--sec-border)]',
    text: 'text-[var(--sec-text)]',
    icon: <Info className="w-4 h-4 shrink-0" />,
  },
};

export const SimpleExplanationView: React.FC<SimpleExplanationViewProps> = ({
  business,
  onNavigate,
}) => {
  const [filterMode, setFilterMode] = useState<SimpleFilterMode>('all');
  const story = useMemo(() => buildSimpleApplesAndPearsStory(business), [business]);
  const phase1Insights = useMemo(() => buildPhase1SimpleInsights(business), [business]);
  const phase2Insights = useMemo(() => buildPhase2SimpleInsights(business), [business]);

  const moodBadgeText =
    story.overallMood === 'good'
      ? 'Diagnóstico: Saludable'
      : story.overallMood === 'urgent'
        ? 'Diagnóstico: Atender hoy'
        : story.overallMood === 'attention'
          ? 'Diagnóstico: Con detalles'
          : 'Diagnóstico: Faltan datos';

  return (
    <StaggerSection className="space-y-6">
      {/* PRESENTACIÓN EN HERO CÁLIDO EDITORIAL */}
      <StaggerItem>
        <HeroBanner
          headlineSize="greeting"
          eyebrow={`Explícame todo con peras y manzanas · ${story.businessName} · ${story.activeMonthLabel}`}
          headline="Tu resumen con *peras y manzanas*"
          subtitle={story.overallMoodLabel}
          chips={[
            {
              id: 'back-dashboard',
              label: 'Volver al *Tablero*',
              onClick: () => onNavigate('dashboard', 'overview'),
              variant: 'navy',
            },
            {
              id: 'mood-status',
              label: moodBadgeText,
              onClick: () => setFilterMode('actions'),
              variant: story.overallMood === 'good' ? 'sage' : 'cream',
            },
          ]}
          rightSlot={<GrowyCharacterArtwork className="w-36 sm:w-44 h-auto" />}
          bottomSlot={
            <div className="space-y-4 pt-2">
              <div className="growy-editorial-strip p-4 sm:p-5 rounded-[24px] flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquareText className="w-4 h-4 text-[#F6A59E]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-[#CFC5EE]">
                    Tu analista financiero de bolsillo dice:
                  </p>
                  <p className="text-sm text-white/95 leading-relaxed font-medium">
                    {story.analystGreeting}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-[24px] bg-white/80 backdrop-blur-xs border border-white/90 text-[#1F1B2E]">
                  <p className="text-[11px] font-semibold text-[#5A5470]">
                    Plata real disponible hoy
                  </p>
                  <p className="font-mono tabular-nums text-xl font-bold mt-1">
                    {story.quickSnapshot.availableCashText}
                  </p>
                  <p className="text-[11px] text-[#5A5470] mt-0.5">
                    Sin contar fiados aún no cobrados
                  </p>
                </div>

                <div className="p-4 rounded-[24px] bg-white/80 backdrop-blur-xs border border-white/90 text-[#1F1B2E]">
                  <p className="text-[11px] font-semibold text-[#5A5470]">
                    Mínimo mensual para quedar en $0
                  </p>
                  <p className="font-mono tabular-nums text-xl font-bold mt-1">
                    {story.quickSnapshot.breakEvenText}
                  </p>
                  <p className="text-[11px] text-[#5A5470] mt-0.5">
                    Desde ahí en adelante empiezas a ganar
                  </p>
                </div>

                <div className="p-4 rounded-[24px] bg-white/80 backdrop-blur-xs border border-white/90 text-[#1F1B2E]">
                  <p className="text-[11px] font-semibold text-[#5A5470]">
                    Resultado real registrado
                  </p>
                  <p className="font-mono tabular-nums text-xl font-bold mt-1">
                    {story.quickSnapshot.actualResultText}
                  </p>
                  <p className="text-[11px] text-[#5A5470] mt-0.5">
                    Lo que de verdad entró menos lo que salió
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </StaggerItem>

      {/* FILTRO RÁPIDO PARA NO ABRUMAR */}
      <StaggerItem>
        <div
          role="tablist"
          aria-label="Secciones de explicación simple"
          className="growy-tab-track"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'all'}
            onClick={() => setFilterMode('all')}
            style={
              filterMode === 'all'
                ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                : undefined
            }
            className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Apple className={`w-3.5 h-3.5 ${filterMode === 'all' ? '' : 'text-[var(--accent-strong)]'}`} />
            <span>Ver explicación completa</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'actions'}
            onClick={() => setFilterMode('actions')}
            style={
              filterMode === 'actions'
                ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                : undefined
            }
            className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              filterMode === 'actions'
                ? 'shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ClipboardCheck className={`w-3.5 h-3.5 ${filterMode === 'actions' ? '' : 'text-[var(--pos-text)]'}`} />
            <span>Qué hacer ahora ({story.actionSteps.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'glossary'}
            onClick={() => setFilterMode('glossary')}
            style={
              filterMode === 'glossary'
                ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                : undefined
            }
            className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
              filterMode === 'glossary'
                ? 'shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BookOpen className={`w-3.5 h-3.5 ${filterMode === 'glossary' ? '' : 'text-[var(--sec-text)]'}`} />
            <span>Diccionario sin enredos</span>
          </button>
        </div>
      </StaggerItem>

      {/* 6 TARJETAS DE EXPLICACIÓN SIMPLE */}
      {filterMode === 'all' && (
        <StaggerItem>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {story.cards.map((card) => {
              const moodStyle = MOOD_STYLES[card.mood];
              return (
                <SolidCard
                  as="article"
                  interactive
                  key={card.id}
                  className="p-5 sm:p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--text-secondary)] inline-flex items-center gap-1.5">
                        <span className="font-mono text-[var(--accent-strong)]">
                          {card.numberLabel}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{card.title}</span>
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold ${moodStyle.text}`}
                      >
                        {moodStyle.icon}
                        <span>{card.moodLabel}</span>
                      </span>
                    </div>

                    <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      {card.simpleQuestion}
                    </h2>

                    <div className="p-3.5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                      <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)]">
                        {card.highlightValue}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {card.highlightCaption}
                      </p>
                    </div>

                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                      {card.explanation}
                    </p>

                    <div
                      className={`p-3.5 rounded-2xl border ${moodStyle.bg} ${moodStyle.border} flex items-start gap-2.5`}
                    >
                      <Lightbulb className={`w-4 h-4 shrink-0 mt-0.5 ${moodStyle.text}`} />
                      <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                        <strong>Con peras y manzanas:</strong> {card.analogyOrTip}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onNavigate(card.targetTab, card.targetSubTab)}
                      className="min-h-[40px] px-4 rounded-full bg-[var(--bg-soft-alt)] hover:bg-[var(--accent-soft)] border border-[var(--border-hairline)] text-xs font-bold text-[var(--accent-strong)] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{card.actionLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </SolidCard>
              );
            })}
          </div>
        </StaggerItem>
      )}

      {/* PLAN CONCRETO EN 3 PASOS SIMPLES */}
      {(filterMode === 'all' || filterMode === 'actions') && (
        <StaggerItem>
          <SolidCard as="section" className="p-6 sm:p-7 space-y-4">
            <div className="flex items-start gap-3">
              <DoodleSproutMotif className="w-9 h-9 shrink-0 hidden sm:block" />
              <div className="space-y-1">
                <SectionTitle
                  as="h2"
                  size="sm"
                  title="Si quieres mejorar tus números hoy, haz esto *en orden*"
                  subtitle="Pasos automáticos armados solo con la información real que registraste hasta ahora."
                />
              </div>
            </div>

            <div className="space-y-3">
              {story.actionSteps.map((step, index) => (
                <div
                  key={step.id}
                  className="p-4 sm:p-5 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <span className="font-mono text-sm font-bold text-[var(--accent-strong)] bg-[var(--accent-soft)] w-9 h-9 rounded-full flex items-center justify-center shrink-0">
                      0{index + 1}
                    </span>
                    <div className="space-y-1 min-w-0">
                      <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                        {step.priorityLabel}
                      </p>
                      <h3 className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)]">
                        {step.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {step.reason}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(step.targetTab, step.targetSubTab)}
                    style={{
                      backgroundColor: 'var(--btn-navy-bg)',
                      color: 'var(--btn-navy-text)',
                    }}
                    className="min-h-[42px] px-5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:opacity-92 transition-opacity cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
                  >
                    <span>{step.buttonLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SolidCard>
        </StaggerItem>
      )}

      {/* DICCIONARIO FINANCIERO SIN ENREDOS */}
      {(filterMode === 'all' || filterMode === 'glossary') && (
        <StaggerItem>
          <SolidCard as="section" className="p-6 sm:p-7 space-y-4">
            <div className="flex items-start gap-3">
              <DoodleIdeaMotif className="w-9 h-9 shrink-0 hidden sm:block" />
              <SectionTitle
                as="h2"
                size="sm"
                title="Diccionario *sin enredos*"
                subtitle="Cada término traducido a lenguaje cotidiano y conectado con un ejemplo de tu propio negocio."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {story.glossary.map((item) => (
                <div
                  key={item.term}
                  className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-2"
                >
                  <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                    {item.term}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {item.plainMeaning}
                  </p>
                  <p className="text-xs text-[var(--accent-strong)] font-medium leading-relaxed pt-1 border-t border-[var(--border-hairline)]">
                    <strong>En tu negocio hoy:</strong> {item.yourExample}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
              <p className="text-xs font-bold text-[var(--sec-text)]">
                Indicadores clave de rentabilidad y seguridad en simple
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {phase1Insights.glossary.map((entry) => (
                  <div
                    key={entry.term}
                    className="p-4 rounded-2xl bg-[var(--sec-soft)]/60 border border-[var(--sec-border)] space-y-2"
                  >
                    <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                      {entry.term}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {entry.meaning}
                    </p>
                    <p className="text-xs text-[var(--pos-text)] font-semibold leading-relaxed pt-1 border-t border-[var(--border-hairline)]">
                      {entry.liveExample}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
              <p className="text-xs font-bold text-[var(--accent-strong)]">
                Caja, razones financieras y realidad chilena en simple
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {phase2Insights.glossary.map((entry) => (
                  <div
                    key={entry.term}
                    className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
                        {entry.term}
                      </h3>
                      {entry.status && entry.status !== 'sin_datos' && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            entry.status === 'verde'
                              ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                              : entry.status === 'amarillo'
                                ? 'bg-[var(--warn-soft)] text-[var(--warn-text)]'
                                : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                          }`}
                        >
                          {entry.status === 'verde'
                            ? 'Verde'
                            : entry.status === 'amarillo'
                              ? 'Amarillo'
                              : 'Rojo'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {entry.meaning}
                    </p>
                    <p className="text-xs text-[var(--accent-strong)] font-semibold leading-relaxed pt-1 border-t border-[var(--border-hairline)]">
                      {entry.liveExample}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </SolidCard>
        </StaggerItem>
      )}
    </StaggerSection>
  );
};
