import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  CalendarCheck,
  Check,
  Copy,
  Download,
  Eraser,
  FolderPlus,
  Gift,
  Mail,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { CURRENCY_PRESETS, formatCurrency, formatNumber, getCurrentYearMonth } from '../finance/formulas';
import {
  IVA_DISCLAIMER_TEXT,
  calculateOwnerSalaryImpact,
} from '../finance/phase2Insights';
import { REFERRAL_PROGRAM_RULES } from '../finance/phase3Insights';
import {
  formatISODateSpanish,
  getSubscriptionStatus,
  LAUNCH_PRICING_BADGE,
  MONTHLY_PRICE_LABEL,
} from '../finance/subscription';
import {
  createMercadoPagoRecurringCheckout,
  createReferralInviteCode,
  sendMonthlySummaryEmail,
  subscribeUserReferralCodes,
  updateUserMonthlySummaryEmailPref,
} from '../firebase/services';
import { exportBackupJSON, parseAndValidateBackup } from '../storage/db';
import type {
  AccessCode,
  AppConfig,
  AppStorageState,
  BusinessWorkspace,
  ColorTone,
  CurrencyCode,
  PaymentHistoryEntry,
  UserProfile,
} from '../types/finance';
import type { PushNotificationsState } from '../hooks/usePushNotifications';
import { GrowyDivider } from './GrowyMotifs';
import { PaymentHistorySection } from './PaymentHistorySection';
import { PWAInstallButton } from './PWAControls';
import { SectionTitle, SolidCard } from './design-system';

interface BusinessSettingsViewProps {
  state: AppStorageState;
  activeBusiness: BusinessWorkspace;
  profile?: UserProfile;
  appConfig?: AppConfig;
  paymentHistory?: PaymentHistoryEntry[];
  pushNotifications?: PushNotificationsState;
  colorTone: ColorTone;
  isDark: boolean;
  onChangeColorTone: (tone: ColorTone) => void;
  onToggleTheme: () => void;
  onUpdateActiveBusiness: (patch: Partial<BusinessWorkspace>) => void;
  onSelectBusiness: (id: string) => void;
  onCreateBusiness: (name: string) => void;
  onDuplicateBusiness: () => void;
  onDeleteBusiness: (id: string) => void;
  onClearDemoData: () => void;
  onRestoreDemoData: () => void;
  onImportState: (nextState: AppStorageState) => void;
  onReplayOnboardingTour?: () => void;
}

const TONE_OPTIONS: Array<{
  id: ColorTone;
  title: string;
  description: string;
  swatches: string[];
}> = [
  {
    id: 'pastel',
    title: 'Tono Colorido (Cálido editorial)',
    description: 'Paleta cálida editorial con crema, coral, azul noche y lila suave.',
    swatches: ['#FFF7F3', '#F6A59E', '#1F1B2E', '#CFC5EE'],
  },
  {
    id: 'formal',
    title: 'Tono Formal (Ejecutivo)',
    description: 'Paleta sobria e institucional en azul marino, gris pizarra y verde esmeralda.',
    swatches: ['#1E3A5F', '#475569', '#0F766E'],
  },
];

export const BusinessSettingsView: React.FC<BusinessSettingsViewProps> = ({
  state,
  activeBusiness,
  profile,
  appConfig,
  paymentHistory = [],
  pushNotifications,
  colorTone,
  isDark,
  onChangeColorTone,
  onToggleTheme,
  onUpdateActiveBusiness,
  onSelectBusiness,
  onCreateBusiness,
  onDuplicateBusiness,
  onDeleteBusiness,
  onClearDemoData,
  onRestoreDemoData,
  onImportState,
  onReplayOnboardingTour,
}) => {
  const [newBusinessName, setNewBusinessName] = useState('');
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const subStatus = profile ? getSubscriptionStatus(profile) : null;
  const ownerSalaryImpact = calculateOwnerSalaryImpact(activeBusiness);
  const ivaEnabled = activeBusiness.ivaSettings?.enabled ?? true;
  const pricesIncludeIva = activeBusiness.ivaSettings?.pricesIncludeIva ?? true;
  const f29Day = Math.max(1, Math.min(28, Math.round(Number(activeBusiness.ivaSettings?.f29Day) || 12)));
  const ivaRatePercent = activeBusiness.ivaSettings?.ivaRatePercent ?? 19;

  // 3.4 Resumen mensual por correo
  const [savingEmailPref, setSavingEmailPref] = useState(false);
  const [sendingMonthlyEmail, setSendingMonthlyEmail] = useState(false);
  const [monthlyEmailFeedback, setMonthlyEmailFeedback] = useState<string | null>(null);

  // 3.6 Referidos
  const [referralCodes, setReferralCodes] = useState<AccessCode[]>([]);
  const [creatingReferral, setCreatingReferral] = useState(false);
  const [copiedRefCode, setCopiedRefCode] = useState<string | null>(null);

  // 3.7 Débito automático Mercado Pago
  const [mpAutoBusy, setMpAutoBusy] = useState(false);
  const [mpAutoNotice, setMpAutoNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.uid) {
      setReferralCodes([]);
      return;
    }
    return subscribeUserReferralCodes(profile.uid, setReferralCodes);
  }, [profile?.uid]);

  const handleToggleMonthlyEmail = async (enabled: boolean) => {
    if (!profile) return;
    setSavingEmailPref(true);
    setMonthlyEmailFeedback(null);
    try {
      await updateUserMonthlySummaryEmailPref(profile.uid, enabled);
      setMonthlyEmailFeedback(
        enabled
          ? 'Activamos el resumen mensual «Así te fue en este mes» en tu correo.'
          : 'Desactivamos el envío de resúmenes mensuales por correo.'
      );
    } finally {
      setSavingEmailPref(false);
    }
  };

  const handleSendCurrentMonthEmail = async () => {
    if (!profile) return;
    setSendingMonthlyEmail(true);
    setMonthlyEmailFeedback(null);
    try {
      const res = await sendMonthlySummaryEmail({
        profile,
        business: activeBusiness,
        month: getCurrentYearMonth(),
      });
      setMonthlyEmailFeedback(res.message);
    } finally {
      setSendingMonthlyEmail(false);
    }
  };

  const handleCreateReferralCode = async () => {
    if (!profile) return;
    setCreatingReferral(true);
    try {
      const code = await createReferralInviteCode({ profile });
      await navigator.clipboard?.writeText(code).catch(() => {});
      setCopiedRefCode(code);
      setTimeout(() => setCopiedRefCode(null), 2500);
    } finally {
      setCreatingReferral(false);
    }
  };

  const handleStartRecurringMp = async (planType: 'monthly' | 'annual') => {
    if (!profile || !appConfig) return;
    setMpAutoBusy(true);
    setMpAutoNotice(null);
    try {
      const res = await createMercadoPagoRecurringCheckout({
        profile,
        planType,
        appConfig,
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

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newBusinessName.trim();
    if (!clean) return;
    onCreateBusiness(clean);
    setNewBusinessName('');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const validated = parseAndValidateBackup(text);
      onImportState(validated);
      setBackupMessage({
        type: 'ok',
        text: `Respaldo restaurado correctamente (${validated.businesses.length} negocios).`,
      });
    } catch (err) {
      setBackupMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'No se pudo leer el archivo de respaldo.',
      });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        as="h1"
        eyebrow="Suscripción · Apariencia · Negocios · Respaldo"
        title="Configuración y *negocios*"
      />

      {/* SUSCRIPCIÓN MENSUAL O ANUAL MERCADO PAGO */}
      {profile && profile.role !== 'admin' && appConfig && (
        <SolidCard as="section" className="p-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--sec-soft)] flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 text-[var(--sec-text)]" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  {subStatus?.isComplimentary
                    ? 'Cuenta cliente de prueba (sin cobro)'
                    : subStatus?.isAnnual
                      ? 'Plan Anual GROWy ($50.000 / año · 12 meses)'
                      : `Plan mensual GROWy (${appConfig.priceLabel || MONTHLY_PRICE_LABEL})`}
                </h2>
                {!subStatus?.isComplimentary && (
                  <p className="text-[11px] font-bold text-[var(--pos-text)] mt-0.5">
                    {LAUNCH_PRICING_BADGE} · Aprovechas esta tarifa antes de que pase a su valor
                    regular
                  </p>
                )}
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {!subStatus?.isComplimentary && subStatus?.isAnnual ? (
                    <>
                      Modalidad:{' '}
                      <strong className="text-[var(--pos-text)]">
                        Pago único 12 meses (sin cobro mensual)
                      </strong>
                    </>
                  ) : (
                    <>
                      Fecha de pago elegida:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {subStatus?.billingDay
                          ? `Día ${subStatus.billingDay} de cada mes`
                          : 'Pendiente de elegir'}
                      </strong>
                    </>
                  )}
                  {!subStatus?.isComplimentary && subStatus?.nextDueISO && (
                    <>
                      {' · '}Próximo vencimiento:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {formatISODateSpanish(subStatus.nextDueISO)}
                      </strong>
                      {subStatus.daysUntilDue !== null && subStatus.daysUntilDue > 0
                        ? ` (en ${subStatus.daysUntilDue} día${subStatus.daysUntilDue === 1 ? '' : 's'})`
                        : ''}
                    </>
                  )}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                  {subStatus?.isComplimentary
                    ? 'Este correo está autorizado como cliente de prueba para visualizar la plataforma sin cobro ni bloqueo por vencimiento.'
                    : subStatus?.isAnnual
                      ? 'Tu plan anual ($50.000, ahorras $21.880) no tiene cobros mensuales. Al cumplir 12 meses podrás renovar mensual o anual.'
                      : 'Al llegar esa fecha cada mes, el acceso se pausa hasta renovar ($5.990/mes) o cambiar a Oferta Anual ($50.000/año, 30,44% dcto).'}
                </p>
              </div>
            </div>

            {!subStatus?.isComplimentary && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {appConfig.mpRecurringEnabled !== false && (
                  <button
                    type="button"
                    disabled={mpAutoBusy}
                    onClick={() =>
                      void handleStartRecurringMp(subStatus?.isAnnual ? 'annual' : 'monthly')
                    }
                    className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-full border border-[var(--sec-border)] bg-[var(--sec-soft)] text-[var(--sec-text)] text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>
                      {mpAutoBusy
                        ? 'Conectando...'
                        : profile.mpSubscriptionStatus === 'authorized'
                          ? 'Débito automático activo'
                          : 'Activar débito automático MP'}
                    </span>
                  </button>
                )}
                <a
                  href={appConfig.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-[var(--text-primary)] text-xs font-bold transition-colors"
                >
                  <span>Mensual $5.990</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href={appConfig.annualPaymentUrl || appConfig.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 rounded-full text-xs font-bold shadow-sm hover:opacity-92 transition-opacity"
                >
                  <span>Oferta Anual $50.000</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {mpAutoNotice && (
            <p className="text-xs font-semibold p-3 rounded-2xl bg-[var(--sec-soft)] text-[var(--sec-text)]">
              {mpAutoNotice}
            </p>
          )}

          {/* 3.4 RESUMEN MENSUAL POR CORREO ("ASÍ TE FUE EN ESTE MES") */}
          <div className="pt-4 border-t border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[var(--pos-soft)] flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-[var(--pos-text)]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-[var(--text-primary)]">
                  Resumen mensual por correo («Así te fue en este mes»)
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Recibe un correo claro con tus ventas, gastos, utilidad y punto de equilibrio en{' '}
                  <strong>{profile.email}</strong>. Puedes desactivarlo cuando quieras.
                </p>
                {monthlyEmailFeedback && (
                  <p className="text-[11px] font-semibold text-[var(--pos-text)]">
                    {monthlyEmailFeedback}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  disabled={savingEmailPref}
                  checked={profile.monthlySummaryEmailEnabled !== false}
                  onChange={(e) => void handleToggleMonthlyEmail(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>Recibir resumen</span>
              </label>
              <button
                type="button"
                disabled={sendingMonthlyEmail || profile.monthlySummaryEmailEnabled === false}
                onClick={() => void handleSendCurrentMonthEmail()}
                className="min-h-[36px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {sendingMonthlyEmail ? 'Enviando...' : 'Enviar resumen ahora'}
              </button>
            </div>
          </div>

          {/* RECORDATORIOS PUSH ANTES DE BLOQUEO POR VENCIMIENTO */}
          {!subStatus?.isComplimentary && pushNotifications && (
            <div className="pt-4 border-t border-[var(--border-hairline)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                  {pushNotifications.isSubscribed ? (
                    <BellRing className="w-4 h-4 text-[var(--pos-text)]" />
                  ) : pushNotifications.permission === 'denied' ? (
                    <BellOff className="w-4 h-4 text-[var(--danger-text)]" />
                  ) : (
                    <Bell className="w-4 h-4 text-[var(--accent-strong)]" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      Recordatorios push antes del vencimiento
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        pushNotifications.isSubscribed
                          ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                          : pushNotifications.permission === 'denied'
                            ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                            : 'bg-[var(--bg-soft)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {!pushNotifications.supported
                        ? 'No compatible'
                        : pushNotifications.isSubscribed
                          ? 'Activadas en este dispositivo'
                          : pushNotifications.permission === 'denied'
                            ? 'Bloqueadas en el navegador'
                            : 'Desactivadas'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {pushNotifications.permission === 'denied'
                      ? 'Las notificaciones están bloqueadas en este navegador. Ábrelo desde el candado de la barra de direcciones → Permisos → Notificaciones → Permitir.'
                      : subStatus?.isAnnual
                        ? 'Recibe un aviso push 15 días antes de que finalicen tus 12 meses para renovar sin interrupciones ni bloqueo.'
                        : 'Recibe un aviso push hasta 5 días antes de tu fecha de pago para renovar a tiempo y evitar que la cuenta quede bloqueada.'}
                  </p>
                  {pushNotifications.statusMessage && (
                    <p
                      className={`text-[11px] font-semibold ${
                        pushNotifications.statusMessage.type === 'ok'
                          ? 'text-[var(--pos-text)]'
                          : 'text-[var(--danger-text)]'
                      }`}
                    >
                      {pushNotifications.statusMessage.text}
                    </p>
                  )}
                </div>
              </div>

              {pushNotifications.supported && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {pushNotifications.isSubscribed ? (
                    <>
                      <button
                        type="button"
                        disabled={pushNotifications.busy}
                        onClick={() => void pushNotifications.sendTestPush()}
                        className="min-h-[38px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
                      >
                        Probar aviso
                      </button>
                      <button
                        type="button"
                        disabled={pushNotifications.busy}
                        onClick={() => void pushNotifications.disablePush()}
                        className="min-h-[38px] px-4 rounded-full border border-[var(--accent-soft-border)] text-xs font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer disabled:opacity-50"
                      >
                        Desactivar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={pushNotifications.busy || pushNotifications.permission === 'denied'}
                      onClick={() => void pushNotifications.enablePush()}
                      style={{
                        backgroundColor: 'var(--btn-navy-bg)',
                        color: 'var(--btn-navy-text)',
                      }}
                      className="min-h-[40px] px-5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 hover:opacity-92 transition-opacity"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>
                        {pushNotifications.busy ? 'Activando...' : 'Activar avisos push'}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </SolidCard>
      )}

      {/* HISTORIAL DE PAGOS Y COMPROBANTES */}
      {profile && profile.role !== 'admin' && !subStatus?.isComplimentary && (
        <PaymentHistorySection profile={profile} entries={paymentHistory} />
      )}

      {/* 3.6 PROGRAMA DE REFERIDOS ("INVITA A OTRA PYME Y AMBOS GANAN UN MES") */}
      {profile && profile.accessStatus === 'active' && (
        <SolidCard as="section" className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-[var(--accent-strong)]" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Invita a otra pyme y ambos ganan un mes gratis
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Comparte tu código único <span className="font-mono">REF-...</span>. Meses
                  ganados acreditados:{' '}
                  <strong className="font-mono text-[var(--pos-text)]">
                    {profile.referralMonthsEarned ?? 0}
                  </strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={creatingReferral}
              onClick={() => void handleCreateReferralCode()}
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="min-h-[42px] px-5 rounded-full text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 shrink-0 shadow-xs hover:opacity-92 transition-opacity"
            >
              <Gift className="w-4 h-4" />
              <span>{creatingReferral ? 'Creando...' : 'Generar código de invitación'}</span>
            </button>
          </div>

          <ul className="text-[11px] text-[var(--text-secondary)] space-y-1 list-disc pl-5 bg-[var(--bg-soft-alt)] p-3.5 rounded-2xl border border-[var(--border-hairline)]">
            {REFERRAL_PROGRAM_RULES.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ul>

          {referralCodes.length > 0 && (
            <div className="divide-y divide-[var(--border-hairline)]">
              {referralCodes.map((rc) => (
                <div key={rc.code} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-mono font-bold text-[var(--text-primary)]">{rc.code}</span>
                    <span className="ml-2 text-[var(--text-secondary)]">
                      {rc.status === 'unused'
                        ? 'Disponible para compartir'
                        : rc.referrerRewardApplied
                          ? `Canjeado por ${rc.usedByEmail || 'otra pyme'} · +1 mes acreditado`
                          : `Canjeado por ${rc.usedByEmail || 'otra pyme'} · Bono +1 mes en revisión`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(rc.code);
                      setCopiedRefCode(rc.code);
                      setTimeout(() => setCopiedRefCode(null), 2000);
                    }}
                    className="min-h-[34px] px-3 rounded-full border border-[var(--border-hairline)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-soft)]"
                  >
                    {copiedRefCode === rc.code ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[var(--pos-text)]" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </SolidCard>
      )}

      {/* APARIENCIA Y PALETA DE COLORES */}
      <SolidCard as="section" className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
              <Palette className="w-5 h-5 text-[var(--accent-strong)]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Tono visual de la aplicación
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Elige entre el estilo colorido original o una paleta formal ejecutiva. Se guarda
                automáticamente para tus próximas sesiones.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer shrink-0 self-start sm:self-auto"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-[#F4A974]" />
                <span>Cambiar a Modo día</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-[var(--text-primary)]" />
                <span>Cambiar a Modo noche</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TONE_OPTIONS.map((opt) => {
            const isSelected = colorTone === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChangeColorTone(opt.id)}
                className={`p-5 rounded-[24px] border text-left transition-colors cursor-pointer flex items-start justify-between gap-4 ${
                  isSelected
                    ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft-alt)]'
                }`}
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm sm:text-base font-bold text-[var(--text-primary)]">
                      {opt.title}
                    </span>
                    {isSelected && (
                      <span className="text-[11px] font-bold text-[var(--accent-strong)] inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pt-0.5" aria-hidden="true">
                  {opt.swatches.map((hex) => (
                    <span
                      key={hex}
                      className="w-5 h-5 rounded-full border border-black/10"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </SolidCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuración del negocio activo */}
        <SolidCard as="section" className="lg:col-span-6 p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Ajustes de "{activeBusiness.name}"
          </h2>

          <div>
            <label className="block text-xs font-semibold mb-1">Nombre del negocio o escenario</label>
            <input
              type="text"
              value={activeBusiness.name}
              onChange={(e) => onUpdateActiveBusiness({ name: e.target.value })}
              className="boho-input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Descripción breve (opcional)</label>
            <input
              type="text"
              value={activeBusiness.tagline ?? ''}
              onChange={(e) => onUpdateActiveBusiness({ tagline: e.target.value })}
              className="boho-input w-full"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Moneda</label>
              <select
                value={activeBusiness.currency.code}
                onChange={(e) => {
                  const preset = CURRENCY_PRESETS[e.target.value as CurrencyCode];
                  if (preset) onUpdateActiveBusiness({ currency: preset });
                }}
                className="boho-input w-full font-semibold"
              >
                <option value="CLP">CLP ($) — Peso chileno</option>
                <option value="MXN">MXN ($) — Peso mexicano</option>
                <option value="USD">USD (US$) — Dólar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="ARS">ARS ($) — Peso argentino</option>
                <option value="COP">COP ($) — Peso colombiano</option>
                <option value="PEN">PEN (S/) — Sol peruano</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Mes de inicio de proyección</label>
              <input
                type="month"
                value={activeBusiness.startMonth}
                onChange={(e) => onUpdateActiveBusiness({ startMonth: e.target.value })}
                className="boho-input w-full font-mono text-sm"
              />
            </div>
          </div>

          {/* 2.5 Sueldo del dueño como costo fijo opcional */}
          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Sueldo del dueño (costo fijo opcional)
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Incluye tu remuneración mensual sin alterar tus costos fijos históricos.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(activeBusiness.ownerSalary?.included)}
                  onChange={(e) =>
                    onUpdateActiveBusiness({
                      ownerSalary: {
                        included: e.target.checked,
                        monthlyAmount: activeBusiness.ownerSalary?.monthlyAmount ?? 0,
                      },
                    })
                  }
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>Incluir sueldo</span>
              </label>
            </div>

            {activeBusiness.ownerSalary?.included && (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Sueldo mensual del dueño ({activeBusiness.currency.code})
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  placeholder="Ej. 650000"
                  value={activeBusiness.ownerSalary?.monthlyAmount ?? 0}
                  onChange={(e) =>
                    onUpdateActiveBusiness({
                      ownerSalary: {
                        included: true,
                        monthlyAmount: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                  className="boho-input w-full font-mono tabular-nums"
                />
              </div>
            )}

            {ownerSalaryImpact.hasIllusoryProfitRisk ? (
              <div className="p-3 rounded-2xl bg-[var(--warn-soft)] border border-[var(--warn-border)] text-xs text-[var(--warn-text)] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{ownerSalaryImpact.illusoryProfitWarning}</p>
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] text-xs text-[var(--pos-text)]">
                Incluyendo{' '}
                <strong className="font-mono">
                  {formatCurrency(ownerSalaryImpact.activeSalaryApplied, activeBusiness.currency)}
                </strong>
                /mes para ti, tu punto de equilibrio real pasa de{' '}
                <strong className="font-mono">
                  {formatNumber(ownerSalaryImpact.baseBreakEvenUnits)} u.
                </strong>{' '}
                a{' '}
                <strong className="font-mono">
                  {formatNumber(ownerSalaryImpact.adjustedBreakEvenUnits)} u.
                </strong>
              </div>
            )}
          </div>

          {/* 2.4 Configuración tributaria referencial (IVA y F29) */}
          <div className="pt-4 border-t border-[var(--border-hairline)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Estimador de IVA y recordatorio F29
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {IVA_DISCLAIMER_TEXT}. No altera tus montos ya guardados.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={ivaEnabled}
                  onChange={(e) =>
                    onUpdateActiveBusiness({
                      ivaSettings: {
                        enabled: e.target.checked,
                        pricesIncludeIva,
                        f29Day,
                        ivaRatePercent,
                      },
                    })
                  }
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>Activo</span>
              </label>
            </div>

            {ivaEnabled && (
              <div className="space-y-3">
                <div>
                  <span className="block text-xs font-semibold mb-1.5">
                    ¿Cómo ingresas tus precios y montos?
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateActiveBusiness({
                          ivaSettings: {
                            enabled: true,
                            pricesIncludeIva: true,
                            f29Day,
                            ivaRatePercent,
                          },
                        })
                      }
                      style={
                        pricesIncludeIva
                          ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                          : undefined
                      }
                      className={`min-h-[38px] px-3 rounded-full border text-xs font-bold cursor-pointer ${
                        pricesIncludeIva
                          ? 'border-transparent'
                          : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Precios con IVA incluido
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateActiveBusiness({
                          ivaSettings: {
                            enabled: true,
                            pricesIncludeIva: false,
                            f29Day,
                            ivaRatePercent,
                          },
                        })
                      }
                      style={
                        !pricesIncludeIva
                          ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                          : undefined
                      }
                      className={`min-h-[38px] px-3 rounded-full border text-xs font-bold cursor-pointer ${
                        !pricesIncludeIva
                          ? 'border-transparent'
                          : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Precios netos (+ IVA)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Día de vencimiento F29 (1–28)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={f29Day}
                      onChange={(e) =>
                        onUpdateActiveBusiness({
                          ivaSettings: {
                            enabled: true,
                            pricesIncludeIva,
                            f29Day: Math.max(1, Math.min(28, Math.round(Number(e.target.value) || 12))),
                            ivaRatePercent,
                          },
                        })
                      }
                      className="boho-input w-full font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Tasa IVA (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step="0.5"
                      value={ivaRatePercent}
                      onChange={(e) =>
                        onUpdateActiveBusiness({
                          ivaSettings: {
                            enabled: true,
                            pricesIncludeIva,
                            f29Day,
                            ivaRatePercent: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                          },
                        })
                      }
                      className="boho-input w-full font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </SolidCard>

        {/* Gestión de negocios / escenarios */}
        <SolidCard as="section" className="lg:col-span-6 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Tus negocios y escenarios ({state.businesses.length})
            </h2>
            <button
              type="button"
              onClick={onDuplicateBusiness}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-1.5 rounded-full border border-[var(--border-hairline)] text-xs font-semibold hover:bg-[var(--bg-soft-alt)] cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicar actual</span>
            </button>
          </div>

          <div className="space-y-2">
            {state.businesses.map((biz) => {
              const isActive = biz.id === activeBusiness.id;
              return (
                <div
                  key={biz.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                    isActive
                      ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]'
                      : 'border-[var(--border-hairline)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectBusiness(biz.id)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <p className="text-sm font-semibold truncate text-[var(--text-primary)]">
                      {biz.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      <span>{biz.currency.code}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{biz.products.length} productos</span>
                      {biz.isDemo ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>Ejemplo</span>
                        </>
                      ) : null}
                    </p>
                  </button>

                  {state.businesses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteBusiness(biz.id)}
                      aria-label={`Eliminar ${biz.name}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl hover:bg-[var(--danger-soft)] text-[var(--danger-text)] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCreateSubmit} className="flex gap-2 pt-2">
            <input
              type="text"
              placeholder="Nombre del nuevo negocio o escenario"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              className="boho-input flex-1"
            />
            <button
              type="submit"
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="min-h-[44px] px-5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm hover:opacity-92 transition-opacity"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Crear</span>
            </button>
          </form>
        </SolidCard>
      </div>

      <GrowyDivider />

      {/* Datos de ejemplo, Respaldo JSON e Instalación PWA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SolidCard as="section" className="p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Respaldo local en JSON y datos de ejemplo
          </h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Todos tus números se guardan automáticamente en tu dispositivo (IndexedDB). Descarga un
            respaldo en JSON cuando quieras mover tus datos o empezar en blanco borrando los datos de
            ejemplo.
          </p>

          {backupMessage && (
            <p
              className={`text-xs font-semibold p-3 rounded-2xl ${
                backupMessage.type === 'ok'
                  ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                  : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
              }`}
            >
              {backupMessage.text}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => exportBackupJSON(state)}
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-full text-xs font-bold cursor-pointer shadow-sm hover:opacity-92 transition-opacity"
            >
              <Download className="w-4 h-4" />
              <span>Exportar respaldo JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border border-[var(--border-hairline)] text-xs font-semibold hover:bg-[var(--bg-soft-alt)] cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Importar respaldo JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          <div className="pt-4 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-3">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border border-[var(--accent-soft-border)] text-[var(--danger-text)] text-xs font-semibold hover:bg-[var(--danger-soft)] cursor-pointer"
              >
                <Eraser className="w-4 h-4" />
                <span>Borrar datos de ejemplo</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold">¿Crear espacio limpio desde cero?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearDemoData();
                    setConfirmClear(false);
                  }}
                  className="min-h-[40px] px-4 rounded-full bg-[var(--danger-text)] text-white text-xs font-semibold cursor-pointer"
                >
                  Sí, limpiar todo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="min-h-[40px] px-4 rounded-full border border-[var(--border-hairline)] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onRestoreDemoData}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-soft-alt)] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Cargar negocio de ejemplo</span>
            </button>
          </div>
        </SolidCard>

        <SolidCard as="section" className="p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Aplicación sin conexión (PWA)
          </h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            GROWy funciona incluso sin internet gracias a su Service Worker y almacenamiento local.
            Puedes instalarla como aplicación nativa en tu teléfono o computador.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-3">
            <PWAInstallButton />
            {onReplayOnboardingTour && (
              <button
                type="button"
                onClick={onReplayOnboardingTour}
                className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[var(--accent-strong)]" />
                <span>Ver tour guiado nuevamente</span>
              </button>
            )}
          </div>
        </SolidCard>
      </div>
    </div>
  );
};
