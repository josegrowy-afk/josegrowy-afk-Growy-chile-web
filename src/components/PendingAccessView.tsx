import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  KeyRound,
  LogOut,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { motion } from 'motion/react';
import { calculatePlanComparisonFromConfig } from '../finance/phase1Insights';
import {
  BILLING_DAY_OPTIONS,
  computeAnnualDueDate,
  computeInitialNextDueDate,
  formatISODateSpanish,
} from '../finance/subscription';
import {
  createEquilibrioCheckoutSession,
  createMercadoPagoRecurringCheckout,
  redeemAccessCode,
  setUserBillingDay,
  setUserPlanPreference,
  trackFunnelStepOncePerSession,
} from '../firebase/services';
import type { AppConfig, BillingDay, PlanType, UserProfile } from '../types/finance';
import { EquilibrioProductIcon, GrowyLogoMark } from './GrowyMotifs';
import { GROWY_EASE } from './MotionPrimitives';
import { ProblemReportPanel } from './ProblemReportPanel';
import { BackdropBlobs, EditorialText, SolidCard } from './design-system';

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
  const [planChoice, setPlanChoice] = useState<PlanType>(() => {
    try {
      const pending = sessionStorage.getItem('growy_pending_checkout_plan');
      if (pending === 'annual' || pending === 'monthly') {
        sessionStorage.removeItem('growy_pending_checkout_plan');
        return pending;
      }
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
    return profile.planType === 'annual' ? 'annual' : 'monthly';
  });
  const [selectedDay, setSelectedDay] = useState<BillingDay | null>(profile.billingDay ?? null);
  const [savingDay, setSavingDay] = useState(false);
  const [dayFeedback, setDayFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editingDay, setEditingDay] = useState(!profile.billingDay);

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [codeFeedback, setCodeFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [mpAutoBusy, setMpAutoBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState<PlanType | null>(null);
  const [mpAutoNotice, setMpAutoNotice] = useState<string | null>(null);

  const isRevoked = profile.accessStatus === 'revoked';
  const wasAnnualPlan = profile.planType === 'annual';
  const hasSavedBillingDay =
    profile.billingDay === 5 || profile.billingDay === 15 || profile.billingDay === 30;
  const planSummary = useMemo(() => calculatePlanComparisonFromConfig(config), [config]);

  const handleCheckoutPlan = async (targetPlan: PlanType) => {
    void trackFunnelStepOncePerSession('payment', {
      source: 'payment_view',
      planType: targetPlan,
    });
    setCheckoutBusy(targetPlan);
    setMpAutoNotice(null);
    try {
      const res = await createEquilibrioCheckoutSession({
        profile,
        planType: targetPlan,
        appConfig: config,
      });
      setMpAutoNotice(res.message);
      if (res.checkoutUrl && typeof window !== 'undefined') {
        window.location.assign(res.checkoutUrl);
      }
    } finally {
      setCheckoutBusy(null);
    }
  };

  const handleRecurringCheckout = async (targetPlan: PlanType) => {
    void trackFunnelStepOncePerSession('payment', {
      source: 'payment_view',
      planType: targetPlan,
    });
    setMpAutoBusy(true);
    setMpAutoNotice(null);
    try {
      const res = await createMercadoPagoRecurringCheckout({
        profile,
        planType: targetPlan,
        appConfig: config,
        backUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      setMpAutoNotice(res.message);
      if (res.checkoutUrl && typeof window !== 'undefined') {
        window.location.assign(res.checkoutUrl);
      }
    } finally {
      setMpAutoBusy(false);
    }
  };

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
      void trackFunnelStepOncePerSession('payment', {
        source: 'payment_view',
        planType: planChoice,
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
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <BackdropBlobs />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: GROWY_EASE }}
        className="relative z-10 w-full max-w-2xl my-6"
      >
        <SolidCard radius="lg" className="p-6 sm:p-9 space-y-6">
          <div className="growy-banner-surface rounded-[28px] p-5 sm:p-6 flex items-start justify-between gap-4">
            <div className="growy-banner-grain" aria-hidden="true" />
            <div className="relative z-10 space-y-2.5 min-w-0">
              <div className="flex items-center gap-2.5">
                <GrowyLogoMark size="sm" />
                <span style={{ color: 'var(--hero-sub-ink)' }} aria-hidden="true">·</span>
                <EquilibrioProductIcon size="xs" />
                <span
                  className="font-display text-xs font-extrabold tracking-tight"
                  style={{ color: 'var(--hero-ink)' }}
                >
                  Equilibrio
                </span>
              </div>
              <div>
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: 'var(--hero-sub-ink)' }}
                >
                  {profile.email}
                </p>
                <h1
                  className="font-display text-2xl sm:text-[1.85rem] font-extrabold tracking-tight leading-tight mt-0.5 text-balance"
                  style={{ color: 'var(--hero-ink)' }}
                >
                  {isRevoked ? (
                    'Acceso suspendido'
                  ) : isExpired ? (
                    wasAnnualPlan ? (
                      <EditorialText text="Tus 12 meses de plan anual *finalizaron*" />
                    ) : (
                      <EditorialText text="Tu suscripción mensual *venció*" />
                    )
                  ) : (
                    <EditorialText text="Activa tu suscripción a *Equilibrio*" />
                  )}
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="relative z-10 min-h-[42px] px-4 rounded-full border border-[var(--hero-ink)]/20 bg-[var(--bg-surface)]/90 text-[var(--text-primary)] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--bg-surface)] cursor-pointer shrink-0 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Salir</span>
            </button>
          </div>

          {mpVerificationNotice && (
            <p className="text-xs font-semibold p-3.5 rounded-[20px] bg-[var(--sec-soft)] text-[var(--sec-text)] border border-[var(--sec-border)]">
              {mpVerificationNotice}
            </p>
          )}

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {isRevoked
            ? `Tu acceso fue suspendido por el administrador. Si crees que es un error, repórtalo abajo o escribe a ${config.contactEmail}.`
            : isExpired
              ? wasAnnualPlan
                ? `Tu período anual de 12 meses finalizó el ${formatISODateSpanish(profile.nextPaymentDueAt)}. Todas las funciones están pausadas hasta que renueves en modalidad mensual (${planSummary.monthlyPriceFormatted}/mes) o anual (${planSummary.annualPriceFormatted} por 12 meses).`
                : `Llegó tu fecha de pago mensual (día ${profile.billingDay ?? 5} · venció el ${formatISODateSpanish(profile.nextPaymentDueAt)}). La página permanecerá pausada hasta que renueves con el plan mensual (${planSummary.monthlyPriceFormatted}) o cambies al Plan Anual (${planSummary.annualPriceFormatted}).`
              : config.welcomeMessage}
        </p>

        {!isRevoked && (
          <>
            {/* SELECTOR DE MODALIDAD: MENSUAL VS ANUAL DESDE APPCONFIG */}
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
                  className={`p-4 rounded-[24px] border text-left transition-colors cursor-pointer space-y-1 ${
                    planChoice === 'monthly'
                      ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft-alt)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Plan mensual · lanzamiento
                    </span>
                    {planChoice === 'monthly' && (
                      <Check className="w-4 h-4 text-[var(--accent-strong)]" />
                    )}
                  </div>
                  <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)]">
                    {planSummary.monthlyPriceFormatted}{' '}
                    <span className="text-xs font-normal">/ mes</span>
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--accent-strong)]">
                    {planSummary.monthlyAnchorLine}.
                  </p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Eliges fecha de pago (día 5, 15 o 30 de cada mes).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPlan('annual')}
                  aria-pressed={planChoice === 'annual'}
                  className={`p-4 rounded-[24px] border text-left transition-colors cursor-pointer space-y-1.5 ${
                    planChoice === 'annual'
                      ? 'border-[var(--pos-text)] bg-[var(--pos-soft)]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft-alt)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] text-[10px] font-bold text-[var(--accent-strong)]">
                      {planSummary.annualHighlightBadge}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-[var(--pos-text)] font-mono tabular-nums">
                        ~{planSummary.savingsPercentRounded}% dcto
                      </span>
                      {planChoice === 'annual' && (
                        <Check className="w-4 h-4 text-[var(--pos-text)]" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="font-mono tabular-nums text-xl font-bold text-[var(--text-primary)]">
                      {planSummary.annualPriceFormatted}{' '}
                      <span className="text-xs font-normal">/ año</span>
                    </p>
                    {planSummary.savingsClp > 0 && (
                      <span className="text-xs font-mono tabular-nums line-through text-[var(--text-secondary)]">
                        {planSummary.twelveMonthsTotalFormatted}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-[var(--pos-text)]">
                    Equivale a ~{planSummary.equivalentMonthlyFormatted}/mes ·{' '}
                    {planSummary.savingsClp > 0
                      ? `Ahorras ${planSummary.savingsFormatted}`
                      : '12 meses continuos'}
                  </p>
                  <p className="text-[11px] font-semibold text-[var(--accent-strong)]">
                    Tarifa por lanzamiento por tiempo limitado.
                  </p>
                </button>
              </div>
            </div>

            {planChoice === 'annual' ? (
              /* FLUJO OFERTA ANUAL (PAGO ÚNICO 12 MESES, SIN COBRO MENSUAL) */
              <div className="p-5 rounded-[24px] bg-[var(--pos-soft)] border border-[var(--pos-border)] space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--pos-text)] shrink-0" />
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      Plan anual · Paga los 12 meses y ahorra
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] text-[11px] font-bold text-[var(--accent-strong)]">
                    {planSummary.annualHighlightBadge} · ~{planSummary.savingsPercentRounded}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-3 rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">Plan anual</span>
                    <strong className="font-mono tabular-nums text-sm text-[var(--text-primary)]">
                      {planSummary.annualPriceFormatted}
                    </strong>
                  </div>
                  <div className="p-3 rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      12 × {planSummary.monthlyPriceFormatted}
                    </span>
                    <span className="font-mono tabular-nums text-sm line-through text-[var(--text-secondary)]">
                      {planSummary.twelveMonthsTotalFormatted}
                    </span>
                  </div>
                  <div className="p-3 rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">Equivale a</span>
                    <strong className="font-mono tabular-nums text-sm text-[var(--pos-text)]">
                      ~{planSummary.equivalentMonthlyFormatted} / mes
                    </strong>
                  </div>
                  <div className="p-3 rounded-[18px] bg-[var(--bg-surface)] border border-[var(--border-hairline)]">
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      Ahorras (~{planSummary.savingsPercentRounded}%)
                    </span>
                    <strong className="font-mono tabular-nums text-sm text-[var(--pos-text)]">
                      {planSummary.savingsFormatted}
                    </strong>
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

                <div className="flex flex-col sm:flex-row gap-2.5">
                  {config.mpRecurringEnabled !== false && (
                    <button
                      type="button"
                      disabled={mpAutoBusy}
                      onClick={() => void handleRecurringCheckout('annual')}
                      className="flex-1 min-h-[48px] px-5 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--pos-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-[var(--text-primary)] text-xs font-bold cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 text-[var(--pos-text)]" />
                      <span>{mpAutoBusy ? 'Abriendo...' : 'Suscripción automática MP'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={checkoutBusy !== null || mpAutoBusy}
                    onClick={() => void handleCheckoutPlan('annual')}
                    style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                    className="flex-1 min-h-[48px] px-5 inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold transition-opacity hover:opacity-92 shadow-xs cursor-pointer disabled:opacity-60"
                  >
                    <span>
                      {checkoutBusy === 'annual'
                        ? 'Abriendo pago...'
                        : `Pagar Plan Anual (${planSummary.annualPriceFormatted})`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {mpAutoNotice && (
                  <p className="text-xs font-semibold text-[var(--sec-text)]">{mpAutoNotice}</p>
                )}
              </div>
            ) : (
              /* FLUJO MENSUAL ($5.990/MES + DÍA 5, 15 O 30) */
              <>
                <div className="p-5 rounded-[24px] border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-3.5">
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
                        Al llegar esa fecha cada mes, la página se pausará hasta renovar los {planSummary.monthlyPriceFormatted}{' '}
                        con el link de Mercado Pago.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        Selecciona qué día de cada mes quieres realizar tu pago de{' '}
                        <strong>{planSummary.monthlyPriceFormatted}</strong>. Te recordaremos antes de vencer y, si llega la
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
                              style={
                                active
                                  ? {
                                      backgroundColor: 'var(--btn-navy-bg)',
                                      color: 'var(--btn-navy-text)',
                                    }
                                  : undefined
                              }
                              className={`min-h-[54px] p-3 rounded-[20px] border text-center transition-colors cursor-pointer ${
                                active
                                  ? 'border-transparent shadow-sm'
                                  : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:bg-[var(--bg-soft)]'
                              }`}
                            >
                              <span className="block font-mono tabular-nums text-base font-bold">
                                Día {day}
                              </span>
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
                          className={`text-xs font-semibold p-2.5 rounded-[18px] ${
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
                        style={{
                          backgroundColor: 'var(--btn-navy-bg)',
                          color: 'var(--btn-navy-text)',
                        }}
                        className="min-h-[42px] px-5 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:opacity-92 transition-opacity"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          {savingDay ? 'Guardando fecha...' : 'Confirmar fecha de pago mensual'}
                        </span>
                      </button>
                    </>
                  )}
                </div>

                <div className="p-5 rounded-[24px] bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      {isExpired
                        ? `Renovar suscripción mensual (${planSummary.monthlyPriceFormatted} / mes)`
                        : `Paso 2 · Paga tu mensualidad (${planSummary.monthlyPriceFormatted} / mes)`}
                    </p>
                    <span className="text-xs font-semibold text-[var(--accent-strong)]">
                      {isExpired ? 'Vencida' : 'Mercado Pago activo'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Usa el link oficial siempre activo de Mercado Pago para pagar los {planSummary.monthlyPriceFormatted} del
                    mes (<strong>{planSummary.anchorComparisonText}</strong>). Tu comprobante quedará en tu historial y se enviará a{' '}
                    <strong>{profile.email}</strong>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {config.mpRecurringEnabled !== false && (
                      <button
                        type="button"
                        disabled={mpAutoBusy}
                        onClick={() => void handleRecurringCheckout('monthly')}
                        className="flex-1 min-h-[48px] px-5 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-[var(--sec-text)] text-xs font-bold cursor-pointer disabled:opacity-60 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>
                          {mpAutoBusy ? 'Abriendo...' : 'Activar débito automático MP'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={checkoutBusy !== null || mpAutoBusy}
                      onClick={() => void handleCheckoutPlan('monthly')}
                      style={{
                        backgroundColor: 'var(--btn-navy-bg)',
                        color: 'var(--btn-navy-text)',
                      }}
                      className="flex-1 min-h-[48px] px-5 inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold transition-opacity hover:opacity-92 shadow-xs cursor-pointer disabled:opacity-60"
                    >
                      <span>
                        {checkoutBusy === 'monthly'
                          ? 'Abriendo pago...'
                          : `Pagar Plan Mensual (${planSummary.monthlyPriceFormatted}/mes)`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {mpAutoNotice && (
                    <p className="text-xs font-semibold text-[var(--sec-text)]">{mpAutoNotice}</p>
                  )}
                </div>
              </>
            )}

            {/* CÓDIGO DE ACCESO O RENOVACIÓN */}
            <form onSubmit={handleRedeem} className="space-y-3 pt-1">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-primary)]">
                  {isExpired
                    ? '¿Tienes un código de renovación?'
                    : '¿Tienes un código de activación?'}
                </label>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Si recibiste un código oficial de activación, ingrésalo aquí para habilitar tu cuenta.
                </p>
              </div>

              {codeFeedback && (
                <p
                  className={`text-xs font-semibold p-3 rounded-[18px] ${
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
                  className="boho-input flex-1 font-mono uppercase !rounded-full"
                />
                <button
                  type="submit"
                  disabled={redeeming}
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="min-h-[44px] px-6 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60 hover:opacity-92 transition-opacity"
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
        </SolidCard>
      </motion.div>
    </div>
  );
};
