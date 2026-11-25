import React, { useState } from 'react';
import { ArrowRight, Check, Laptop, ShieldCheck, Smartphone } from 'lucide-react';
import { GlassCard } from './design-system/GlassCard';
import { EditorialText } from './design-system/SectionTitle';
import { EquilibrioProductIcon } from './GrowyMotifs';

export interface ProductShowcaseCardProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  features: string[];
  priceLabel: string;
  priceNote: string;
  ctaLabel: string;
  paymentUrl: string;
  annualPriceLabel?: string;
  annualPriceNote?: string;
  annualCtaLabel?: string;
  annualPaymentUrl?: string;
  annualBadgeLabel?: string;
  priceComparisonText?: string;
  refundGuaranteeText?: string;
  trustNote: string;
  onPaymentCtaClick?: (planType: 'monthly' | 'annual') => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  iconSrc?: string;
  icon?: React.ReactNode;
  mockupSlot: React.ReactNode;
}

export const ProductShowcaseCard: React.FC<ProductShowcaseCardProps> = ({
  eyebrow,
  title,
  subtitle,
  features,
  priceLabel,
  priceNote,
  ctaLabel,
  paymentUrl,
  annualPriceLabel,
  annualPriceNote,
  annualCtaLabel,
  annualPaymentUrl,
  annualBadgeLabel,
  priceComparisonText,
  refundGuaranteeText,
  trustNote,
  onPaymentCtaClick,
  secondaryAction,
  iconSrc,
  icon,
  mockupSlot,
}) => {
  const hasExternalUrl =
    Boolean(paymentUrl) &&
    (paymentUrl.startsWith('http://') || paymentUrl.startsWith('https://'));
  const resolvedAnnualUrl = annualPaymentUrl || paymentUrl;
  const hasAnnualExternalUrl =
    Boolean(resolvedAnnualUrl) &&
    (resolvedAnnualUrl.startsWith('http://') || resolvedAnnualUrl.startsWith('https://'));

  return (
    <GlassCard
      as="article"
      radius="lg"
      className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center"
    >
      {/* Columna izquierda: información del producto, beneficios y compra */}
      <div className="lg:col-span-6 space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3.5">
            {icon ? (
              <div className="shrink-0">{icon}</div>
            ) : iconSrc ? (
              <div className="w-16 h-16 inline-flex items-center justify-center shrink-0">
                <img
                  src={iconSrc}
                  alt={`Ícono de ${title}`}
                  className="w-full h-full object-contain drop-shadow-sm block"
                  draggable={false}
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
            <div>
              <p className="text-xs font-bold tracking-[0.06em] uppercase text-[var(--sec-text)]">
                {eyebrow}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight">
                <EditorialText text={`*${title}*`} />
              </h2>
            </div>
          </div>

          <p className="text-base text-[var(--text-secondary)] leading-relaxed">{subtitle}</p>
        </div>

        <ul className="space-y-3 text-sm text-[var(--text-primary)]">
          {features.map((feat) => (
            <li key={feat} className="flex items-start gap-3 leading-relaxed">
              <span className="w-5 h-5 rounded-full bg-[var(--pos-soft)] border border-[var(--pos-border)] flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-[var(--pos-text)]" strokeWidth={2.5} />
              </span>
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        {/* Bloque de planes (Mensual y Anual dinámicos desde appConfig) + CTA */}
        <div className="p-5 sm:p-6 rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-4">
          {priceComparisonText && (
            <p className="text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] rounded-2xl px-4 py-2.5 leading-relaxed">
              {priceComparisonText}
            </p>
          )}

          {annualPriceLabel ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Plan Mensual */}
              <div className="p-4 rounded-[24px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] flex flex-col justify-between gap-3.5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--sec-text)]">
                    Plan Mensual
                  </p>
                  <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-1">
                    {priceLabel}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">
                    Eliges fecha de pago: día 5, 15 o 30 de cada mes.
                  </p>
                </div>
                <a
                  href={hasExternalUrl ? paymentUrl : '#contacto'}
                  target={hasExternalUrl ? '_blank' : undefined}
                  rel={hasExternalUrl ? 'noopener noreferrer' : undefined}
                  onClick={() => onPaymentCtaClick?.('monthly')}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-[var(--text-primary)] text-xs font-bold transition-colors whitespace-nowrap"
                >
                  <span>{ctaLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Plan Anual (destacado con etiqueta coral) */}
              <div className="p-4 rounded-[24px] bg-[var(--pos-soft)] border-2 border-[var(--pos-border)] flex flex-col justify-between gap-3.5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--pos-text)]">
                      Plan Anual · 12 meses
                    </p>
                    {annualBadgeLabel && (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--accent-coral)',
                          color: 'var(--navy-ink)',
                        }}
                      >
                        {annualBadgeLabel}
                      </span>
                    )}
                  </div>
                  <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-1">
                    {annualPriceLabel}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">
                    {annualPriceNote || '12 meses completos · al vencer renuevas mensual o anual.'}
                  </p>
                </div>
                <a
                  href={hasAnnualExternalUrl ? resolvedAnnualUrl : '#contacto'}
                  target={hasAnnualExternalUrl ? '_blank' : undefined}
                  rel={hasAnnualExternalUrl ? 'noopener noreferrer' : undefined}
                  onClick={() => onPaymentCtaClick?.('annual')}
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-full hover:opacity-92 text-xs font-bold transition-opacity whitespace-nowrap shadow-xs"
                >
                  <span>{annualCtaLabel || `Elegir ${annualPriceLabel}`}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--sec-text)]">
                  Acceso completo a {title}
                </p>
                <p className="font-mono tabular-nums text-3xl sm:text-4xl font-bold text-[var(--text-primary)] mt-1">
                  {priceLabel}
                </p>
              </div>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs leading-snug">
                {priceNote}
              </p>
            </div>
          )}

          {!annualPriceLabel && (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={hasExternalUrl ? paymentUrl : '#contacto'}
                target={hasExternalUrl ? '_blank' : undefined}
                rel={hasExternalUrl ? 'noopener noreferrer' : undefined}
                onClick={() => onPaymentCtaClick?.('monthly')}
                style={{
                  backgroundColor: 'var(--btn-navy-bg)',
                  color: 'var(--btn-navy-text)',
                }}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-full hover:opacity-92 text-sm font-bold transition-opacity whitespace-nowrap shadow-xs"
              >
                <span>{ctaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}

          {secondaryAction && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-secondary)] leading-snug">{priceNote}</p>
              <button
                type="button"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                className="inline-flex items-center justify-center min-h-[42px] px-5 py-2.5 rounded-full border border-[var(--sec-border)] bg-[var(--bg-soft-alt)] hover:bg-[var(--sec-soft)] text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                {secondaryAction.label}
              </button>
            </div>
          )}

          {refundGuaranteeText && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] text-xs text-[var(--text-primary)] leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-[var(--pos-text)] shrink-0 mt-0.5" />
              <p className="font-medium">{refundGuaranteeText}</p>
            </div>
          )}

          <div className="flex items-start gap-2.5 pt-2 border-t border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-[var(--pos-text)] shrink-0 mt-0.5" />
            <p>{trustNote}</p>
          </div>
        </div>
      </div>

      {/* Columna derecha: capturas / mockups */}
      <div className="lg:col-span-6">{mockupSlot}</div>
    </GlassCard>
  );
};

export const EquilibrioProductMockup: React.FC = () => {
  const [view, setView] = useState<'equilibrio' | 'proyeccion' | 'dispositivos'>('equilibrio');

  return (
    <div className="rounded-[28px] border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <EquilibrioProductIcon size="xs" />
          <span>Vista previa del panel · Equilibrio</span>
        </span>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs">
          {(
            [
              { id: 'equilibrio', label: 'Equilibrio' },
              { id: 'proyeccion', label: 'Proyección' },
              { id: 'dispositivos', label: 'Móvil y PC' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-medium transition-colors cursor-pointer ${
                view === tab.id
                  ? 'bg-[var(--btn-navy-bg)] text-[var(--btn-navy-text)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'equilibrio' && (
        <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Resumen mensual</p>
              <p className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                Tu base de <em className="growy-editorial-phrase">tranquilidad</em>
              </p>
            </div>
            <p className="font-mono tabular-nums text-xs font-semibold text-[var(--pos-text)]">
              Meta cubierta al 100%
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
              <p className="text-[11px] text-[var(--text-secondary)]">Punto de equilibrio</p>
              <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)] mt-1">
                50 unidades
              </p>
              <p className="text-[11px] text-[var(--pos-text)] mt-0.5">
                Cubres el 100% de tus costos
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)]">
              <p className="text-[11px] text-[var(--sec-text)]">Para tu meta de ganancia</p>
              <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)] mt-1">
                84 unidades
              </p>
              <p className="text-[11px] text-[var(--sec-text)] mt-0.5">
                Meta: <span className="font-mono">+$204.000</span> libres al mes
              </p>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span>Avance real de ventas este mes</span>
              <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                62 / 84 u.
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-[var(--bg-track)] overflow-hidden flex">
              <div className="h-full bg-[var(--gold-motif)]" style={{ width: '60%' }} />
              <div className="h-full bg-[var(--pos-dot)]" style={{ width: '14%' }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
              <span>50 u. cubriendo costos</span>
              <span className="text-[var(--pos-text)] font-medium">12 u. ya en ganancia</span>
            </div>
          </div>
        </div>
      )}

      {view === 'proyeccion' && (
        <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Proyección mes a mes</p>
              <p className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                Lo proyectado <em className="growy-editorial-phrase">frente</em> a lo real
              </p>
            </div>
            <span className="font-mono text-xs text-[var(--sec-text)]">CLP</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { mes: 'Mes 1', meta: '$540.000', real: '$558.000', diff: '+$18.000', positive: true },
              { mes: 'Mes 2', meta: '$630.000', real: '$612.000', diff: '-$18.000', positive: false },
              { mes: 'Mes 3', meta: '$720.000', real: '$756.000', diff: '+$36.000', positive: true },
            ].map((row) => (
              <div
                key={row.mes}
                className="grid grid-cols-4 items-center gap-2 p-2.5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]"
              >
                <span className="font-medium text-[var(--text-primary)]">{row.mes}</span>
                <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                  Meta {row.meta}
                </span>
                <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                  {row.real}
                </span>
                <span
                  className={`font-mono tabular-nums text-right font-semibold ${
                    row.positive ? 'text-[var(--pos-text)]' : 'text-[var(--accent-strong)]'
                  }`}
                >
                  {row.diff}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Registra tus ingresos y egresos reales en segundos para ajustar el próximo mes sin perder el rumbo.
          </p>
        </div>
      )}

      {view === 'dispositivos' && (
        <div className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] space-y-2">
              <Laptop className="w-5 h-5 text-[var(--pos-text)]" />
              <p className="font-display text-base font-bold text-[var(--text-primary)]">
                Computador
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Trabaja cómodo desde tu navegador o instálala como aplicación de escritorio con respaldo en la nube.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)] space-y-2">
              <Smartphone className="w-5 h-5 text-[var(--sec-text)]" />
              <p className="font-display text-base font-bold text-[var(--text-primary)]">
                Celular
              </p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Revisa tus costos, precios o ventas del día desde Android o iPhone incluso cuando estés sin señal.
              </p>
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Tus cifras se guardan en tu cuenta personal para que todo esté al día en ambos dispositivos.
          </p>
        </div>
      )}
    </div>
  );
};
