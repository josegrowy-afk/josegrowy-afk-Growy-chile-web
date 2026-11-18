import React, { useState } from 'react';
import { ArrowRight, CalendarCheck, Check, KeyRound, LogOut, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import {
  ANNUAL_DISCOUNT_LABEL,
  ANNUAL_EQUIV_MONTHLY_CLP,
  ANNUAL_NORMAL_PRICE_CLP,
  ANNUAL_PRICE_CLP,
  ANNUAL_SAVINGS_CLP,
  BILLING_DAY_OPTIONS,
  computeAnnualDueDate,
  computeInitialNextDueDate,
  formatISODateSpanish,
  MONTHLY_PRICE_LABEL,
} from '../finance/subscription';
import {
  redeemAccessCode,
  setUserBillingDay,
  setUserPlanPreference,
} from '../firebase/services';
import type { AppConfig, BillingDay, PlanType, UserProfile } from '../types/finance';
import { EquilibrioProductIcon, GrowyLogoMark } from './GrowyMotifs';
import { GROWY_EASE } from './MotionPrimitives';
import { ProblemReportPanel } from './ProblemReportPanel';

interface PendingAccessViewProps {
  profile: UserProfile;
  config: AppConfig;
  isExpired?: boolean;
  mpVerificationNotice?: string | null;
  onSignOut: () => void;
}

export const PendingAccessView: React.FC<PendingAccessViewProps> = ({
  profile,
  config,
  isExpired = false,
  mpVerificationNotice = null,
  onSignOut,
}) => {
  const [planChoice, setPlanChoice] = useState<PlanType>(
    profile.planType === 'annual' ? 'annual' : 'monthly'
  );
  const [selectedDay, setSelectedDay] = useState<BillingDay | null>(profile.billingDay ?? null);
  const [savingDay, setSavingDay] = useState(false);
  const [dayFeedback, setDayFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editingDay, setEditingDay] = useState(!profile.billingDay);

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeFeedback, setCodeFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const isRevoked = profile.accessStatus === 'revoked';
  const wasAnnualPlan = profile.planType === 'annual';
  const hasSavedBillingDay =
    profile.billingDay === 5 || profile.billingDay === 15 || profile.billingDay === 30;
  const annualCheckoutUrl = config.annualPaymentUrl || config.paymentUrl;

  const handleSelectPlan = async (nextPlan: PlanType) => {
    setPlanChoice(nextPlan);
    setDayFeedback(null);
    if (!isRevoked) {
      try {
        await setUserPlanPreference({ profile, planType: nextPlan });
      } catch {
        // Silencioso: el usuario igual puede continuar con su flujo
      }
    }
  };

  const handleSaveBillingDay = async () => {
    if (!selectedDay) {
      setDayFeedback({ type: 'err', text: 'Elige el día 5, 15 o 30 de cada mes.' });
      return;
    }
    setSavingDay(true);
    setDayFeedback(null);
    try {
      await setUserBillingDay({ profile, billingDay: selectedDay });
      setEditingDay(false);
      setDayFeedback({
        type: 'ok',
        text: `Fecha de pago guardada: todos los días ${selectedDay} de cada mes.`,
      });
    } catch {
      setDayFeedback({
        type: 'err',
        text: 'No se pudo guardar tu fecha de pago. Intenta nuevamente.',
      });
    } finally {
      setSavingDay(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setCodeFeedback({ type: 'err', text: 'Ingresa tu código de acceso.' });
      return;
    }
    setRedeeming(true);
    setCodeFeedback(null);
    try {
      await redeemAccessCode({
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName,
        rawCode: code,
        planType: planChoice,
        billingDay: profile.billingDay ?? selectedDay ?? 5,
        currentDueAt: profile.nextPaymentDueAt,
      });
      setCodeFeedback({
        type: 'ok',
        text: 'Código validado. Activando tu espacio financiero...',
      });
    } catch (err) {
      setCodeFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo activar el código.',
      });
    } finally {
      setRedeeming(false);
    }
  };

  const previewMonthlyDue = selectedDay ? computeInitialNextDueDate(selectedDay) : null;
  const previewAnnualDue = computeAnnualDueDate(null);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: GROWY_EASE }}
        className="w-full max-w-2xl boho-card p-6 sm:p-9 space-y-6 my-6"
      >
        <div className="growy-hero-surface rounded-[24px] p-5 flex items-start justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <GrowyLogoMark size="sm" />
              <span className="text-[var(--sec-border)]" aria-hidden="true">·</span>
              <EquilibrioProductIcon size="xs" />
              <span className="font-display text-xs font-bold text-[var(--text-primary)]">
                Equilibrio
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                {profile.email}
              </p>
              <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold text-[var(--text-primary)] tracking-tight leading-tight mt-0.5">
                {isRevoked ? (
                  'Acceso suspendido'
                ) : isExpired ? (
                  wasAnnualPlan ? (
                    <>
                      Tus 12 meses de plan anual{' '}
                      <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                        finalizaron
                      </em>
                    </>
                  ) : (
                    <>
                      Tu suscripción mensual{' '}
                      <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                        venció
                      </em>
                    </>
                  )
                ) : (
                  <>
                    Activa tu suscripción a{' '}
                    <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                      Equilibrio
                    </em>
                  </>
                )}
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[42px] px-4 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>

        {mpVerificationNotice && (
          <p className="text-xs font-semibold p-3.5 rounded-2xl bg-[var(--sec-soft)] text-[var(--sec-text)] border border-[var(--sec-border)]">
            {mpVerificationNotice}
          </p>
        )}

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {isRevoked
            ? `Tu acceso fue suspendido por el administrador. Si crees que es un error, repórtalo abajo o escribe a ${config.contactEmail}.`
            : isExpired
              ? wasAnnualPlan
                ? `Tu período anual de 12 meses finalizó el ${formatISODateSpanish(profile.nextPaymentDueAt)}. Todas las funciones están pausadas hasta que renueves en modalidad mensual ($5.990/mes) o anual ($50.000 por 12 meses).`
                : `Llegó tu fecha de pago mensual (día ${profile.billingDay ?? 5} · venció el ${formatISODateSpanish(profile.nextPaymentDueAt)}). La página permanecerá pausada hasta que renueves con el plan mensual ($5.990) o cambies a la Oferta Anual ($50.000).`
              : config.welcomeMessage}
        </p>

        {!isRevoked && (
          <>
            {/* SELECTOR DE MODALIDAD: MENSUAL ($5.990) VS OFERTA ANUAL ($50.000) — VALORES POR LANZAMIENTO */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {isExpired ? 'Elige cómo deseas renovar tu acceso:' : 'Elige tu modalidad de pago:'}
                </p>
                <span className="text-[11px] font-bold text-[var(--accent-strong)]">
                  Valores por lanzamiento · luego tendrán otro valor
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectPlan('monthly')}
                  aria-pressed={planChoice === 'monthly'}
                  className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer space-y-1 ${
                    planChoice === 'monthly'
                      ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft-alt)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      PLAN MENSUAL · LANZAMIENTO
                    </span>
                    {planChoice === 'monthly' && (
                      <Check className="w-4 h-4 text-[var(--accent-strong)]" />
                    )}
                  </div>
                  <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)]">
                    $5.990 <span className="text-xs font-normal">/ mes</span>
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--accent-strong)]">
                    Precio por lanzamiento (después subirá).
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Eliges fecha de pago (día 5, 15 o 30 de cada mes).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPlan('annual')}
                  aria-pressed={planChoice === 'annual'}
                  className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer space-y-1 ${
                    planChoice === 'annual'
                      ? 'border-[var(--pos-text)] bg-[var(--pos-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft-alt)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-[var(--pos-text)]">
                      OFERTA ANUAL LANZAMIENTO · {ANNUAL_DISCOUNT_LABEL} DCTO
                    </span>
                    {planChoice === 'annual' && (
                      <Check className="w-4 h-4 text-[var(--pos-text)]" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)]">
                      ${ANNUAL_PRICE_CLP.toLocaleString('es-CL')}{' '}
                      <span className="text-xs font-normal">/ año</span>
                    </p>
                    <span className="text-xs font-mono line-through text-[var(--text-secondary)]">
                      ${ANNUAL_NORMAL_PRICE_CLP.toLocaleString('es-CL')}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[var(--pos-text)]">
                    Equivale a ${ANNUAL_EQUIV_MONTHLY_CLP.toLocaleString('es-CL')}/mes · ¡Ahorras $
                    {ANNUAL_SAVINGS_CLP.toLocaleString('es-CL')}!
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--accent-strong)]">
                    Tarifa por lanzamiento por tiempo limitado.
                  </p>
                </button>
              </div>
            </div>

            {planChoice === 'annual' ? (
              /* FLUJO OFERTA ANUAL ($50.000 PAGO ÚNICO 12 MESES, SIN COBRO MENSUAL) */
              <div className="p-5 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--pos-text)] shrink-0" />
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      OFERTA ANUAL POR LANZAMIENTO · ¡Paga el año completo y ahorra!
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[var(--pos-text)]">
                    {ANNUAL_DISCOUNT_LABEL} DE DESCUENTO
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">Pago único</span>
                    <strong className="font-mono text-sm text-[var(--text-primary)]">$50.000</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      Precio normal
                    </span>
                    <span className="font-mono text-sm line-through text-[var(--text-secondary)]">
                      $71.880
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">Equivale a</span>
                    <strong className="font-mono text-sm text-[var(--pos-text)]">
                      $4.167 / mes
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      ¡Ahorras!
                    </span>
                    <strong className="font-mono text-sm text-[var(--pos-text)]">$21.880</strong>
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Es un <strong>pago único por 12 meses</strong>: no se te realizará ningún cobro en
                  fechas mensuales (ni día 5, 15 o 30). Vigencia estimada activando hoy: hasta el{' '}
                  <strong className="text-[var(--text-primary)]">
                    {formatISODateSpanish(previewAnnualDue)}
                  </strong>
                  . Al cumplirse los 12 meses, la página se bloqueará hasta que elijas renovar
                  mensual o anual.
                </p>

                <a
                  href={annualCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors shadow-xs"
                >
                  <span>Pagar Oferta Anual ($50.000) en Mercado Pago</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ) : (
              /* FLUJO MENSUAL ($5.990/MES + DÍA 5, 15 O 30) */
              <>
                <div className="p-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="w-4 h-4 text-[var(--sec-text)] shrink-0" />
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        Paso 1 · Elige tu fecha de pago mensual
                      </p>
                    </div>
                    {hasSavedBillingDay && !editingDay && (
                      <button
                        type="button"
                        onClick={() => setEditingDay(true)}
                        className="text-xs font-semibold text-[var(--accent-strong)] hover:underline cursor-pointer"
                      >
                        Cambiar día
                      </button>
                    )}
                  </div>

                  {hasSavedBillingDay && !editingDay ? (
                    <div className="text-xs text-[var(--text-secondary)] space-y-1">
                      <p className="font-semibold text-[var(--text-primary)]">
                        Fecha elegida: Día {profile.billingDay} de cada mes
                      </p>
                      <p>
                        Al llegar esa fecha cada mes, la página se pausará hasta renovar los $5.990
                        con el link de Mercado Pago.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Selecciona qué día de cada mes quieres realizar tu pago de{' '}
                        <strong>$5.990</strong>. Te recordaremos antes de vencer y, si llega la
                        fecha sin pago, la página dejará de funcionar hasta que pagues.
                      </p>

                      <div className="grid grid-cols-3 gap-2.5">
                        {BILLING_DAY_OPTIONS.map((day) => {
                          const active = selectedDay === day;
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => {
                                setSelectedDay(day);
                                setDayFeedback(null);
                              }}
                              className={`min-h-[54px] p-3 rounded-2xl border text-center transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-sm'
                                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:bg-[var(--bg-soft)]'
                              }`}
                            >
                              <span className="block font-mono text-base font-bold">Día {day}</span>
                              <span className="block text-[10px] opacity-80">de cada mes</span>
                            </button>
                          );
                        })}
                      </div>

                      {previewMonthlyDue && (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Próximo vencimiento estimado si activas hoy:{' '}
                          <strong className="text-[var(--text-primary)]">
                            {formatISODateSpanish(previewMonthlyDue)}
                          </strong>
                        </p>
                      )}

                      {dayFeedback && (
                        <p
                          className={`text-xs font-semibold p-2.5 rounded-xl ${
                            dayFeedback.type === 'ok'
                              ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                              : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                          }`}
                        >
                          {dayFeedback.text}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={!selectedDay || savingDay}
                        onClick={handleSaveBillingDay}
                        className="min-h-[42px] px-5 rounded-full bg-[var(--text-primary)] text-[var(--bg-surface)] text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {savingDay ? 'Guardando fecha...' : 'Confirmar fecha de pago mensual'}
                        </span>
                      </button>
                    </>
                  )}
                </div>

                <div className="p-5 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {isExpired
                        ? `Renovar suscripción mensual (${config.priceLabel || MONTHLY_PRICE_LABEL})`
                        : `Paso 2 · Paga tu mensualidad (${config.priceLabel || MONTHLY_PRICE_LABEL})`}
                    </p>
                    <span className="text-xs font-semibold text-[var(--accent-strong)]">
                      {isExpired ? 'Vencida' : 'Mercado Pago activo'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Usa el link oficial siempre activo de Mercado Pago para pagar los $5.990 del
                    mes (<strong>tarifa promocional por lanzamiento</strong>; luego tendrá otro
                    valor). Tu comprobante quedará en tu historial y se enviará a{' '}
                    <strong>{profile.email}</strong>.
                  </p>
                  <a
                    href={config.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors shadow-xs"
                  >
                    <span>Aprovechar $5.990/mes en Mercado Pago</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </>
            )}

            {/* CÓDIGO DE ACCESO O RENOVACIÓN */}
            <form onSubmit={handleRedeem} className="space-y-3 pt-1">
              <label className="block text-sm font-semibold text-[var(--text-primary)]">
                {isExpired
                  ? '¿El administrador te envió un código de renovación?'
                  : '¿Tienes un código de activación?'}
              </label>

              {codeFeedback && (
                <p
                  className={`text-xs font-semibold p-3 rounded-xl ${
                    codeFeedback.type === 'ok'
                      ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                      : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                  }`}
                >
                  {codeFeedback.text}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  placeholder="Ej. GROWY-AB12-CD34"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="boho-input flex-1 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={redeeming}
                  className="min-h-[44px] px-6 rounded-full bg-[var(--text-primary)] text-[var(--bg-surface)] text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{redeeming ? 'Validando...' : 'Activar código'}</span>
                </button>
              </div>
            </form>
          </>
        )}

        {/* APARTADO INFERIOR VISIBLE: REPORTE DE PROBLEMAS CON ADJUNTOS */}
        <div className="pt-4 border-t border-[var(--border-hairline)]">
          <ProblemReportPanel
            profile={profile}
            contactEmail={config.contactEmail}
            defaultSubject={
              isExpired
                ? 'Ya pagué mi renovación en Mercado Pago y la página sigue vencida'
                : 'Ya pagué en Mercado Pago y necesito activar mi cuenta'
            }
            compact
          />
        </div>
      </motion.div>
    </div>
  );
};
