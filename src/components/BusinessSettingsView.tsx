import React, { useRef, useState } from 'react';
import {
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
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { CURRENCY_PRESETS } from '../finance/formulas';
import {
  formatISODateSpanish,
  getSubscriptionStatus,
  LAUNCH_PRICING_BADGE,
  MONTHLY_PRICE_LABEL,
} from '../finance/subscription';
import { exportBackupJSON, parseAndValidateBackup } from '../storage/db';
import type {
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
  swatches: [string, string, string];
}> = [
  {
    id: 'pastel',
    title: 'Tono Colorido (Pastel)',
    description: 'Conserva la paleta cálida actual con acentos coral, lavanda y menta.',
    swatches: ['#F7A8A8', '#B1A3DC', '#5CC4B3'],
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
      <header>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">
          Suscripción · Apariencia · Negocios · Respaldo
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Configuración y{' '}
          <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
            negocios
          </em>
        </h1>
      </header>

      {/* SUSCRIPCIÓN MENSUAL O ANUAL MERCADO PAGO */}
      {profile && profile.role !== 'admin' && appConfig && (
        <section className="boho-card p-6 space-y-4">
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
                  className="inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold shadow-sm transition-colors"
                >
                  <span>Oferta Anual $50.000</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
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
                      className="min-h-[40px] px-5 rounded-full bg-[var(--text-primary)] text-[var(--bg-surface)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
        </section>
      )}

      {/* HISTORIAL DE PAGOS Y COMPROBANTES */}
      {profile && profile.role !== 'admin' && !subStatus?.isComplimentary && (
        <PaymentHistorySection profile={profile} entries={paymentHistory} />
      )}

      {/* APARIENCIA Y PALETA DE COLORES */}
      <section className="boho-card p-6 space-y-4">
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
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuración del negocio activo */}
        <section className="lg:col-span-6 boho-card p-6 space-y-4">
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
        </section>

        {/* Gestión de negocios / escenarios */}
        <section className="lg:col-span-6 boho-card p-6 space-y-4">
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
              className="min-h-[44px] px-5 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Crear</span>
            </button>
          </form>
        </section>
      </div>

      <GrowyDivider />

      {/* Datos de ejemplo, Respaldo JSON e Instalación PWA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="boho-card p-6 space-y-4">
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
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold cursor-pointer shadow-sm"
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
        </section>

        <section className="boho-card p-6 space-y-4">
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
        </section>
      </div>
    </div>
  );
};
