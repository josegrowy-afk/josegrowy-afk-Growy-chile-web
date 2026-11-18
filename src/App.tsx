import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  AlertTriangle,
  Apple,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarRange,
  Check,
  Compass,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Moon,
  Package,
  Settings2,
  Shield,
  Sun,
  X,
} from 'lucide-react';
import { ActualsView, type ActualsSubTab } from './components/ActualsView';
import { AdminView } from './components/AdminView';
import { BusinessSettingsView } from './components/BusinessSettingsView';
import { EquilibrioProductIcon, GrowyLogoMark } from './components/GrowyMotifs';
import { CalculatorView } from './components/CalculatorView';
import { CatalogAndCostsView, type CatalogSubTab } from './components/CatalogAndCostsView';
import { DashboardView, type DashboardSubTab } from './components/DashboardView';
import { FaqAndSupportView } from './components/FaqAndSupportView';
import { LandingPage } from './components/LandingPage';
import { OnboardingTourModal } from './components/OnboardingTourModal';
import { PendingAccessView } from './components/PendingAccessView';
import { ProblemReportPanel } from './components/ProblemReportPanel';
import { OfflineIndicator, PWAInstallButton } from './components/PWAControls';
import { ProjectionsView, type ProjectionsSubTab } from './components/ProjectionsView';
import { SimpleExplanationView } from './components/SimpleExplanationView';
import { GROWY_EASE, GrowyMotionRoot, ViewTransition } from './components/MotionPrimitives';
import { AnimatePresence, motion } from 'motion/react';
import { createEmptyBusiness } from './data/demoData';
import {
  ANNUAL_DISCOUNT_LABEL,
  ANNUAL_PRICE_CLP,
  ANNUAL_PRICE_LABEL,
  BILLING_DAY_OPTIONS,
  computeAnnualDueDate,
  computeInitialNextDueDate,
  formatISODateSpanish,
  getSubscriptionStatus,
  MONTHLY_PRICE_CLP,
  MONTHLY_PRICE_LABEL,
} from './finance/subscription';
import { usePushNotifications } from './hooks/usePushNotifications';
import { auth, googleProvider } from './firebase/client';
import {
  DEFAULT_APP_CONFIG,
  DEFAULT_FAQS,
  deleteUserBusiness,
  ensureUserProfile,
  markUserOnboardingCompleted,
  recordPaymentAndSendReceipt,
  saveUserBusiness,
  seedDemoBusinessesForUser,
  setUserBillingDay,
  setUserPlanPreference,
  subscribeAllTicketsAdmin,
  subscribeAppConfig,
  subscribePublishedFaqs,
  subscribeUserBusinesses,
  subscribeUserPaymentHistory,
  subscribeUserProfile,
  verifyMercadoPagoPayment,
} from './firebase/services';
import type {
  AppConfig,
  AppStorageState,
  BillingDay,
  BusinessWorkspace,
  ColorTone,
  FaqItem,
  PaymentHistoryEntry,
  UserProfile,
  ViewTab,
} from './types/finance';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('luna_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [colorTone, setColorTone] = useState<ColorTone>(() => {
    try {
      return localStorage.getItem('growy_color_tone') === 'formal' ? 'formal' : 'pastel';
    } catch {
      return 'pastel';
    }
  });

  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [faqs, setFaqs] = useState<FaqItem[]>(DEFAULT_FAQS);

  const [authReady, setAuthReady] = useState(false);
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryEntry[]>([]);

  const [businesses, setBusinesses] = useState<BusinessWorkspace[]>([]);
  const [businessesLoaded, setBusinessesLoaded] = useState(false);
  const [activeBusinessId, setActiveBusinessId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ViewTab>('dashboard');
  const [dashboardSubTab, setDashboardSubTab] = useState<DashboardSubTab>('overview');
  const [projectionsSubTab, setProjectionsSubTab] = useState<ProjectionsSubTab>('sales');
  const [actualsSubTab, setActualsSubTab] = useState<ActualsSubTab>('cash');
  const [catalogSubTab, setCatalogSubTab] = useState<CatalogSubTab>('catalog');
  const [showLandingExplicit, setShowLandingExplicit] = useState(false);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [mpVerificationNotice, setMpVerificationNotice] = useState<string | null>(null);
  const [checkedMpPaymentId, setCheckedMpPaymentId] = useState<string | null>(null);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [billingDayPick, setBillingDayPick] = useState<BillingDay | null>(null);
  const [savingBillingDay, setSavingBillingDay] = useState(false);
  const [billingDayError, setBillingDayError] = useState<string | null>(null);

  const handleNavigate = (tab: ViewTab, subTab?: string) => {
    setActiveTab(tab);
    if (!subTab) return;
    if (tab === 'dashboard' && (subTab === 'overview' || subTab === 'analyst')) {
      setDashboardSubTab(subTab);
    } else if (tab === 'projections' && (subTab === 'sales' || subTab === 'cashflow')) {
      setProjectionsSubTab(subTab);
    } else if (
      tab === 'actuals' &&
      (subTab === 'cash' || subTab === 'receivables' || subTab === 'payables')
    ) {
      setActualsSubTab(subTab);
    } else if (tab === 'catalog' && (subTab === 'catalog' || subTab === 'inventory')) {
      setCatalogSubTab(subTab);
    }
  };

  const subStatus = getSubscriptionStatus(profile);
  const pushNotifications = usePushNotifications(profile);
  const isFormalActive = Boolean(
    authUid &&
      profile?.accessStatus === 'active' &&
      !subStatus.isExpired &&
      !showLandingExplicit &&
      colorTone === 'formal'
  );

  // Aplicar tema claro/oscuro y tono de color en <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('tone-formal', isFormalActive);

    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      const metaColor = isFormalActive
        ? theme === 'dark'
          ? '#0D121B'
          : '#F4F6F9'
        : theme === 'dark'
          ? '#161320'
          : '#FFF7F3';
      themeMeta.setAttribute('content', metaColor);
    }
    try {
      localStorage.setItem('luna_theme', theme);
      localStorage.setItem('growy_color_tone', colorTone);
    } catch {
      // Ignorar
    }
  }, [theme, colorTone, isFormalActive]);

  // Suscripción a configuración pública y FAQs
  useEffect(() => {
    const unsubConfig = subscribeAppConfig(setAppConfig);
    const unsubFaqs = subscribePublishedFaqs(setFaqs);
    return () => {
      unsubConfig();
      unsubFaqs();
    };
  }, []);

  // Listener de Firebase Auth
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAuthUid(null);
        setProfile(null);
        setBusinesses([]);
        setBusinessesLoaded(false);
        setAuthReady(true);
        return;
      }

      setAuthUid(fbUser.uid);
      try {
        await ensureUserProfile({
          uid: fbUser.uid,
          email: fbUser.email ?? '',
          displayName: fbUser.displayName ?? 'Emprendedor',
        });
      } catch (err) {
        console.error('Error asegurando perfil:', err);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsubAuth();
  }, []);

  // Suscripción al perfil y al historial transparente de pagos en Firestore cuando hay usuario autenticado
  useEffect(() => {
    if (!authUid) {
      setPaymentHistory([]);
      return;
    }
    const unsubProfile = subscribeUserProfile(authUid, (nextProfile) => {
      setProfile(nextProfile);
    });
    const unsubPayments = subscribeUserPaymentHistory(authUid, (entries) => {
      setPaymentHistory(entries);
    });
    return () => {
      unsubProfile();
      unsubPayments();
    };
  }, [authUid]);

  // Verificación automática al volver de Mercado Pago con payment_id / collection_id
  useEffect(() => {
    if (!authUid || !profile) return;
    const params = new URLSearchParams(window.location.search);
    const mpId = params.get('payment_id') || params.get('collection_id');
    const mpStatus = params.get('status') || params.get('collection_status');
    if (!mpId || checkedMpPaymentId === mpId) return;

    setCheckedMpPaymentId(mpId);
    if (mpStatus && mpStatus !== 'approved' && mpStatus !== 'accredited') {
      setMpVerificationNotice(
        `Mercado Pago informó estado "${mpStatus}". Si completaste el pago ($5.990 mensual o $50.000 anual) y no se habilita, adjunta tu comprobante abajo.`
      );
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      return;
    }

    verifyMercadoPagoPayment({
      paymentId: mpId,
      uid: profile.uid,
      email: profile.email,
      planType: profile.planType,
      billingDay: profile.billingDay,
    }).then(async (res) => {
      if (res.verified) {
        const resolvedPlan = res.planType === 'annual' || profile.planType === 'annual' ? 'annual' : 'monthly';
        const periodEnd =
          resolvedPlan === 'annual'
            ? computeAnnualDueDate(profile.nextPaymentDueAt)
            : computeInitialNextDueDate(profile.billingDay ?? 5);
        try {
          await recordPaymentAndSendReceipt({
            id: `mp_${mpId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80)}`,
            uid: profile.uid,
            email: profile.email,
            displayName: profile.displayName,
            planType: resolvedPlan,
            amountClp: resolvedPlan === 'annual' ? ANNUAL_PRICE_CLP : MONTHLY_PRICE_CLP,
            transactionId: mpId,
            paymentMethod: 'mercadopago',
            periodCoveredEnd: periodEnd,
            notes: 'Pago verificado desde retorno de Mercado Pago (tarifa por lanzamiento)',
          });
        } catch {
          // Silencioso si el usuario aún está pendiente o sin conexión
        }
      }
      setMpVerificationNotice(res.message);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    });
  }, [authUid, profile?.uid, profile?.email, profile?.displayName, profile?.planType, profile?.billingDay, profile?.nextPaymentDueAt, checkedMpPaymentId]);

  // Suscripción a los negocios del usuario cuando el acceso está activo y vigente
  useEffect(() => {
    const expiredNow = getSubscriptionStatus(profile).isExpired;
    if (!authUid || !profile || profile.accessStatus !== 'active' || expiredNow) {
      setBusinesses([]);
      setBusinessesLoaded(false);
      return;
    }

    let seededOnce = false;
    return subscribeUserBusinesses(authUid, async (list) => {
      if (list.length === 0 && !seededOnce) {
        seededOnce = true;
        const seeded = await seedDemoBusinessesForUser(authUid);
        setBusinesses(seeded);
        setActiveBusinessId(seeded[0]?.id ?? '');
        setBusinessesLoaded(true);
        return;
      }
      setBusinesses(list);
      setActiveBusinessId((prev) =>
        list.some((b) => b.id === prev) ? prev : list[0]?.id ?? ''
      );
      setBusinessesLoaded(true);
    });
  }, [authUid, profile?.accessStatus, profile?.nextPaymentDueAt, profile?.role]);

  // Activar tour guiado automáticamente solo para usuarios nuevos (onboardingCompleted === false)
  useEffect(() => {
    const expiredNow = getSubscriptionStatus(profile).isExpired;
    const readyForTour =
      Boolean(authUid) &&
      Boolean(profile) &&
      profile?.onboardingCompleted === false &&
      profile?.accessStatus === 'active' &&
      !expiredNow &&
      subStatus.hasBillingDay &&
      !showLandingExplicit &&
      businessesLoaded &&
      businesses.length > 0;

    if (!readyForTour || !profile) return;

    try {
      if (localStorage.getItem(`growy_onboarding_done_${profile.uid}`) === '1') {
        return;
      }
    } catch {
      // Ignorar
    }

    const timer = window.setTimeout(() => {
      setShowOnboardingTour(true);
    }, 380);
    return () => window.clearTimeout(timer);
  }, [
    authUid,
    profile?.uid,
    profile?.onboardingCompleted,
    profile?.accessStatus,
    subStatus.hasBillingDay,
    showLandingExplicit,
    businessesLoaded,
    businesses.length,
  ]);

  // Contador de dudas y sugerencias nuevas para el administrador
  useEffect(() => {
    if (!authUid || profile?.role !== 'admin' || profile?.accessStatus !== 'active') {
      setOpenTicketsCount(0);
      return;
    }
    return subscribeAllTicketsAdmin((tickets) => {
      setOpenTicketsCount(tickets.filter((t) => t.status === 'nuevo').length);
    });
  }, [authUid, profile?.role, profile?.accessStatus]);

  const handleGoogleSignIn = async () => {
    if (authUid) {
      setShowLandingExplicit(false);
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setShowLandingExplicit(false);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Tu navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes e intenta nuevamente.'
        );
      } else {
        setAuthError(
          'No pudimos completar el acceso con Google. Intenta nuevamente en unos segundos.'
        );
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveTab('dashboard');
    setShowLandingExplicit(false);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Estado inicial de carga Auth
  if (!authReady) {
    return (
      <GrowyMotionRoot>
        <div className="min-h-screen flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: GROWY_EASE }}
            className="text-center space-y-3"
          >
            <GrowyLogoMark size="lg" showSlogan className="mx-auto items-center" />
            <p className="text-sm text-[#6E6D7A] dark:text-[#B0AAB8]">
              Preparando tu espacio financiero...
            </p>
          </motion.div>
        </div>
      </GrowyMotionRoot>
    );
  }

  // 1. Landing pública de venta (sin login o si eligió volver a ver la landing)
  if (!authUid || showLandingExplicit) {
    return (
      <GrowyMotionRoot>
        <LandingPage
          config={appConfig}
          faqs={faqs}
          isDark={theme === 'dark'}
          isSignedIn={Boolean(authUid)}
          onToggleTheme={handleToggleTheme}
          onLoginClick={handleGoogleSignIn}
          authLoading={authLoading}
          authError={authError}
        />
        <OfflineIndicator />
      </GrowyMotionRoot>
    );
  }

  // Cargando perfil
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <GrowyLogoMark size="lg" showSlogan className="mx-auto items-center" />
          <p className="text-sm text-[#6E6D7A] dark:text-[#B0AAB8]">Verificando tu acceso...</p>
        </div>
      </div>
    );
  }

  // 2. Pantalla de acceso pendiente, vencido o suspendido
  if (profile.accessStatus !== 'active' || subStatus.isExpired) {
    return (
      <GrowyMotionRoot>
        <PendingAccessView
          profile={profile}
          config={appConfig}
          isExpired={subStatus.isExpired}
          mpVerificationNotice={mpVerificationNotice}
          onSignOut={handleSignOut}
        />
        <OfflineIndicator />
      </GrowyMotionRoot>
    );
  }

  // 3. Elección obligatoria de día de pago mensual (5, 15 o 30) al iniciar sesión por primera vez
  if (!subStatus.isExemptAdmin && !subStatus.hasBillingDay) {
    const previewDue = billingDayPick ? computeInitialNextDueDate(billingDayPick) : null;
    const handleConfirmBillingDay = async () => {
      if (!billingDayPick) {
        setBillingDayError('Selecciona el día 5, 15 o 30 de cada mes.');
        return;
      }
      setSavingBillingDay(true);
      setBillingDayError(null);
      try {
        await setUserBillingDay({ profile, billingDay: billingDayPick });
      } catch {
        setBillingDayError('No se pudo guardar tu fecha de pago. Intenta nuevamente.');
      } finally {
        setSavingBillingDay(false);
      }
    };

    return (
      <GrowyMotionRoot>
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: GROWY_EASE }}
            className="w-full max-w-xl boho-card p-6 sm:p-8 space-y-5"
          >
            <div className="growy-hero-surface rounded-[24px] p-5 flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <GrowyLogoMark size="sm" />
                  <span className="text-[var(--sec-border)]" aria-hidden="true">·</span>
                  <EquilibrioProductIcon size="xs" />
                  <span className="font-display text-xs font-bold text-[var(--text-primary)]">
                    Equilibrio
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-[1.75rem] font-bold text-[var(--text-primary)] tracking-tight leading-tight">
                  Elige tu{' '}
                  <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                    fecha de pago
                  </em>{' '}
                  mensual
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Cuenta: <strong>{profile.email}</strong> · Plan {MONTHLY_PRICE_LABEL} (Precio por lanzamiento)
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] px-4 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir</span>
              </button>
            </div>

            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              ¿Qué día de cada mes prefieres pagar tu suscripción de <strong>$5.990</strong>? Te
              recordaremos antes de esa fecha; al llegar tu día de vencimiento sin pago, la página
              dejará de funcionar hasta que pagues con el link de Mercado Pago.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {BILLING_DAY_OPTIONS.map((day) => {
                const selected = billingDayPick === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setBillingDayPick(day);
                      setBillingDayError(null);
                    }}
                    className={`min-h-[68px] p-3 rounded-[22px] border text-center transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-xs'
                        : 'bg-[var(--bg-soft-alt)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:bg-[var(--bg-soft)]'
                    }`}
                  >
                    <span className="block font-mono text-lg font-bold">Día {day}</span>
                    <span className="block text-[11px] opacity-80">de cada mes</span>
                  </button>
                );
              })}
            </div>

            {previewDue && (
              <div className="p-3.5 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)] text-xs text-[var(--sec-text)] flex items-center gap-2.5">
                <CalendarCheck className="w-4 h-4 shrink-0" />
                <span>
                  Tu primer vencimiento quedará fijado para el{' '}
                  <strong>{formatISODateSpanish(previewDue)}</strong>.
                </span>
              </div>
            )}

            {billingDayError && (
              <p className="text-xs font-semibold p-3 rounded-2xl bg-[var(--danger-soft)] text-[var(--danger-text)]">
                {billingDayError}
              </p>
            )}

            <button
              type="button"
              disabled={!billingDayPick || savingBillingDay}
              onClick={handleConfirmBillingDay}
              className="w-full min-h-[48px] rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>{savingBillingDay ? 'Guardando...' : 'Guardar fecha y entrar a Equilibrio'}</span>
            </button>

            <button
              type="button"
              disabled={savingBillingDay}
              onClick={async () => {
                setSavingBillingDay(true);
                setBillingDayError(null);
                try {
                  await setUserPlanPreference({ profile, planType: 'annual' });
                } catch {
                  setBillingDayError('No se pudo cambiar a Oferta Anual. Intenta nuevamente.');
                } finally {
                  setSavingBillingDay(false);
                }
              }}
              className="w-full min-h-[44px] px-5 rounded-full border border-[var(--pos-border)] bg-[var(--pos-soft)] text-xs font-bold text-[var(--pos-text)] cursor-pointer hover:opacity-90 transition-opacity"
            >
              ¿Pagaste la Oferta Anual ({ANNUAL_PRICE_LABEL} · {ANNUAL_DISCOUNT_LABEL} dcto)? Omitir cobro mensual
            </button>

            <div className="pt-4 border-t border-[var(--border-hairline)]">
              <ProblemReportPanel
                profile={profile}
                contactEmail={appConfig.contactEmail}
                compact
              />
            </div>
          </motion.div>
        </div>
        <OfflineIndicator />
      </GrowyMotionRoot>
    );
  }

  // Cargando espacios de trabajo
  if (!businessesLoaded || businesses.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <GrowyLogoMark size="lg" showSlogan className="mx-auto items-center" />
          <p className="text-sm text-[#6E6D7A] dark:text-[#B0AAB8]">
            Sincronizando tus negocios...
          </p>
        </div>
      </div>
    );
  }

  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) ?? businesses[0];
  const isDark = theme === 'dark';

  const appStateSnapshot: AppStorageState = {
    version: 2,
    activeBusinessId: activeBusiness.id,
    businesses,
    theme,
    colorTone,
  };

  const updateActiveBusiness = (patch: Partial<BusinessWorkspace>) => {
    const updated: BusinessWorkspace = {
      ...activeBusiness,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    saveUserBusiness(profile.uid, updated, false);
  };

  const handleCreateBusiness = async (name: string) => {
    const fresh = { ...createEmptyBusiness(name), ownerUid: profile.uid };
    setBusinesses((prev) => [...prev, fresh]);
    setActiveBusinessId(fresh.id);
    await saveUserBusiness(profile.uid, fresh, true);
  };

  const handleDuplicateBusiness = async () => {
    const copy: BusinessWorkspace = {
      ...JSON.parse(JSON.stringify(activeBusiness)),
      id: `biz-${Date.now()}`,
      ownerUid: profile.uid,
      name: `${activeBusiness.name} (Copia)`,
      isDemo: false,
      updatedAt: new Date().toISOString(),
    };
    setBusinesses((prev) => [...prev, copy]);
    setActiveBusinessId(copy.id);
    await saveUserBusiness(profile.uid, copy, true);
  };

  const handleDeleteBusiness = async (id: string) => {
    if (businesses.length <= 1) return;
    const remaining = businesses.filter((b) => b.id !== id);
    setBusinesses(remaining);
    if (activeBusinessId === id) {
      setActiveBusinessId(remaining[0].id);
    }
    await deleteUserBusiness(profile.uid, id);
  };

  const handleClearDemoData = async () => {
    const blank = { ...createEmptyBusiness('Mi Negocio'), ownerUid: profile.uid };
    for (const old of businesses) {
      await deleteUserBusiness(profile.uid, old.id);
    }
    await saveUserBusiness(profile.uid, blank, true);
    setBusinesses([blank]);
    setActiveBusinessId(blank.id);
    setActiveTab('catalog');
  };

  const handleRestoreDemoData = async () => {
    const demos = await seedDemoBusinessesForUser(profile.uid);
    setBusinesses(demos);
    setActiveBusinessId(demos[0].id);
    setActiveTab('dashboard');
  };

  const handleImportState = async (imported: AppStorageState) => {
    for (const biz of imported.businesses) {
      await saveUserBusiness(profile.uid, { ...biz, ownerUid: profile.uid }, false);
    }
    setActiveBusinessId(imported.activeBusinessId);
  };

  const NAV_ITEMS: Array<{
    id: ViewTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      label: 'Resumen',
      shortLabel: 'Resumen',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'calculator',
      label: 'Equilibrio y Meta',
      shortLabel: 'Equilibrio',
      icon: <Compass className="w-5 h-5" />,
    },
    {
      id: 'projections',
      label: 'Proyección 12M',
      shortLabel: 'Proyección',
      icon: <CalendarRange className="w-5 h-5" />,
    },
    {
      id: 'actuals',
      label: 'Resultados Reales',
      shortLabel: 'Reales',
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: 'catalog',
      label: 'Costos y Catálogo',
      shortLabel: 'Catálogo',
      icon: <Package className="w-5 h-5" />,
    },
    {
      id: 'simple',
      label: 'Peras y manzanas',
      shortLabel: 'En simple',
      icon: <Apple className="w-5 h-5" />,
    },
    {
      id: 'faq',
      label: 'Ayuda y FAQ',
      shortLabel: 'Ayuda',
      icon: <HelpCircle className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: 'Configuración',
      shortLabel: 'Config.',
      icon: <Settings2 className="w-5 h-5" />,
    },
    ...(profile.role === 'admin'
      ? [
          {
            id: 'admin' as ViewTab,
            label: openTicketsCount > 0 ? `Administrador (${openTicketsCount})` : 'Administrador',
            shortLabel: 'Admin',
            icon: <Shield className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  return (
    <GrowyMotionRoot>
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* BARRA LATERAL EN ESCRITORIO */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-[var(--border-hairline)] bg-[var(--bg-sidebar)] backdrop-blur-sm p-5 justify-between z-30 overflow-y-auto">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="px-1 flex items-center justify-between gap-2">
                <GrowyLogoMark size="sm" />
                <button
                  type="button"
                  onClick={() => setShowLandingExplicit(true)}
                  className="text-[11px] font-semibold text-[var(--sec-text)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >
                  Inicio
                </button>
              </div>
              <div className="growy-hero-surface flex items-center gap-2.5 p-3 rounded-[22px]">
                <EquilibrioProductIcon size="sm" />
                <div className="min-w-0 leading-tight">
                  <p className="font-display text-sm font-bold text-[var(--text-primary)] tracking-tight">
                    Equilibrio
                  </p>
                  <p className="text-[11px] font-medium text-[var(--pos-text)] truncate">
                    01 · Producto activo
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="desktop-business-select"
                className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5 px-1"
              >
                Negocio / escenario activo
              </label>
              <select
                id="desktop-business-select"
                value={activeBusiness.id}
                onChange={(e) => setActiveBusinessId(e.target.value)}
                className="boho-input w-full text-xs font-semibold"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <nav className="space-y-1.5" aria-label="Navegación principal">
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-tour={`nav-${item.id}`}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full min-h-[42px] flex items-center gap-3 px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'text-[var(--accent-btn-text)]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-soft)]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="desktop-nav-active"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-[var(--accent-btn)] -z-10 shadow-xs"
                      />
                    )}
                    <span className="shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

        <div className="space-y-2.5 pt-4 border-t border-[var(--border-hairline)]">
          {!subStatus.isExemptAdmin &&
            (subStatus.isAnnual || subStatus.billingDay || subStatus.isComplimentary) && (
            <div className="px-3.5 py-3 rounded-[22px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2 font-semibold text-[var(--text-primary)]">
                <span>
                  {subStatus.isComplimentary
                    ? 'Cliente de prueba'
                    : subStatus.isAnnual
                      ? 'Plan Anual (12M)'
                      : 'Plan $5.990/mes'}
                </span>
                {subStatus.isAnnual ? (
                  <span className="font-mono text-[var(--pos-text)]">Sin cobro mes</span>
                ) : (
                  subStatus.billingDay && (
                    <span className="font-mono">Día {subStatus.billingDay}</span>
                  )
                )}
              </div>
              {subStatus.isComplimentary ? (
                <p className="text-[var(--pos-text)] font-medium">Acceso sin cobro activo</p>
              ) : (
                <>
                  {subStatus.nextDueISO && (
                    <p className="text-[var(--text-secondary)]">
                      Vence: {formatISODateSpanish(subStatus.nextDueISO)}
                    </p>
                  )}
                  <a
                    href={
                      subStatus.isAnnual
                        ? appConfig.annualPaymentUrl || appConfig.paymentUrl
                        : appConfig.paymentUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[var(--accent-strong)] hover:underline pt-0.5"
                  >
                    <span>
                      {subStatus.isAnnual
                        ? 'Renovar en Mercado Pago'
                        : 'Pagar en Mercado Pago'}
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          )}

          <PWAInstallButton />

          <button
            type="button"
            onClick={handleToggleTheme}
            className="w-full min-h-[42px] flex items-center justify-between px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--bg-soft)] cursor-pointer transition-colors"
          >
            <span>
              {isDark
                ? colorTone === 'formal'
                  ? 'Modo día (Ejecutivo)'
                  : 'Modo día (Pastel)'
                : 'Modo noche'}
            </span>
            {isDark ? (
              <Sun className="w-4 h-4 text-[var(--gold-motif)]" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--text-primary)]" />
            )}
          </button>

          <div className="flex items-center justify-between gap-2 px-2 pt-1 text-xs text-[var(--text-secondary)]">
            <span className="truncate">{profile.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* HEADER MÓVIL COMPACTO (<= 56px) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas-alpha)] backdrop-blur-md">
        <div className="min-w-0 flex items-center gap-2">
          <GrowyLogoMark size="sm" />
          <span className="text-[var(--border-hairline)]">|</span>
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <EquilibrioProductIcon size="xs" />
            <span className="font-display text-xs font-bold text-[var(--text-primary)] truncate">
              Equilibrio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <PWAInstallButton compact />
          {profile.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              aria-label="Panel Administrador"
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full cursor-pointer ${
                activeTab === 'admin' ? 'text-[var(--accent-strong)]' : ''
              }`}
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('simple')}
            aria-label="Explícame con peras y manzanas"
            title="Explícame todo con peras y manzanas"
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full cursor-pointer ${
              activeTab === 'simple' ? 'text-[var(--accent-strong)]' : ''
            }`}
          >
            <Apple className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            aria-label="Ayuda y FAQ"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            aria-label="Configuración y apariencia"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleToggleTheme}
            aria-label="Cambiar tema"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-[#F4A974]" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--text-primary)]" />
            )}
          </button>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 lg:pl-64 pb-24 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Aviso tras retorno de Mercado Pago */}
          {mpVerificationNotice && (
            <div className="mb-5 px-5 py-3.5 rounded-[24px] border border-[var(--sec-border)] bg-[var(--sec-soft)] flex items-center justify-between gap-3 text-xs font-medium text-[var(--sec-text)]">
              <span>{mpVerificationNotice}</span>
              <button
                type="button"
                onClick={() => setMpVerificationNotice(null)}
                aria-label="Cerrar aviso"
                className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-black/5 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Recordatorio de vencimiento mensual ($5.990) o fin de 12 meses anual ($50.000) */}
          {subStatus.shouldShowReminder && subStatus.nextDueISO && (
            <div className="mb-5 px-5 py-4 rounded-[28px] border border-[var(--warn-border)] bg-[var(--warn-soft)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 text-xs text-[var(--warn-text)]">
              <div className="flex items-start gap-2.5 min-w-0">
                <CalendarCheck className="w-4 h-4 shrink-0 mt-0.5" />
                {subStatus.isAnnual ? (
                  <p className="leading-relaxed">
                    <strong>Recordatorio de renovación anual ($50.000):</strong> tus 12 meses de
                    acceso completo finalizan{' '}
                    {subStatus.daysUntilDue === 1
                      ? 'mañana'
                      : `en ${subStatus.daysUntilDue} días`}{' '}
                    (<strong>{formatISODateSpanish(subStatus.nextDueISO)}</strong>). Al vencer los
                    12 meses, la página bloqueará las funciones hasta que renueves mensual ($5.990) o
                    anual ($50.000).
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    <strong>Recordatorio de pago mensual ($5.990):</strong> tu fecha de pago (día{' '}
                    {subStatus.billingDay}) vence{' '}
                    {subStatus.daysUntilDue === 1
                      ? 'mañana'
                      : `en ${subStatus.daysUntilDue} días`}{' '}
                    (<strong>{formatISODateSpanish(subStatus.nextDueISO)}</strong>). Al llegar esa
                    fecha, la página dejará de funcionar hasta que pagues con Mercado Pago (o
                    aproveches la Oferta Anual de $50.000).
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0">
                {pushNotifications.supported &&
                  !pushNotifications.isSubscribed &&
                  pushNotifications.permission !== 'denied' && (
                    <button
                      type="button"
                      disabled={pushNotifications.busy}
                      onClick={() => void pushNotifications.enablePush()}
                      className="min-h-[42px] px-4 rounded-full border border-[var(--warn-border)] bg-[var(--bg-surface)] text-[var(--warn-text)] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{pushNotifications.busy ? 'Activando...' : 'Activar aviso push'}</span>
                    </button>
                  )}
                <a
                  href={appConfig.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <span>Mensual $5.990</span>
                </a>
                <a
                  href={appConfig.annualPaymentUrl || appConfig.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[42px] px-5 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs"
                >
                  <span>Anual $50.000</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Anuncio global configurable por el administrador */}
          {appConfig.announcementActive && appConfig.announcementText.trim() && (
            <div className="mb-5 px-5 py-3.5 rounded-[24px] border border-[var(--sec-border)] bg-[var(--sec-soft)] flex items-center gap-3 text-xs font-medium text-[var(--sec-text)]">
              <Megaphone className="w-4 h-4 shrink-0" />
              <span>{appConfig.announcementText}</span>
            </div>
          )}

          {/* Aviso de negocio de ejemplo */}
          {activeBusiness.isDemo && (
            <div className="mb-5 px-5 py-3.5 rounded-[24px] border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <p>
                Estás viendo el negocio de ejemplo <strong>{activeBusiness.name}</strong>. Edítalo o
                comienza con un espacio limpio en blanco.
              </p>
              <button
                type="button"
                onClick={handleClearDemoData}
                className="min-h-[34px] px-4 rounded-full bg-[var(--accent-soft)] hover:opacity-90 font-semibold text-[var(--accent-strong)] whitespace-nowrap cursor-pointer transition-opacity"
              >
                Borrar datos de ejemplo
              </button>
            </div>
          )}

          <ViewTransition viewKey={`${activeTab}-${activeBusiness.id}`}>
            {activeTab === 'dashboard' && (
              <DashboardView
                business={activeBusiness}
                isDark={isDark}
                colorTone={colorTone}
                onNavigate={handleNavigate}
                initialSubTab={dashboardSubTab}
              />
            )}

            {activeTab === 'simple' && (
              <SimpleExplanationView
                business={activeBusiness}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'calculator' && (
              <CalculatorView
                business={activeBusiness}
                onUpdateBusiness={updateActiveBusiness}
              />
            )}

            {activeTab === 'projections' && (
              <ProjectionsView
                business={activeBusiness}
                onUpdateBusiness={updateActiveBusiness}
                initialSubTab={projectionsSubTab}
              />
            )}

            {activeTab === 'actuals' && (
              <ActualsView
                business={activeBusiness}
                onUpdateBusiness={updateActiveBusiness}
                initialSubTab={actualsSubTab}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogAndCostsView
                business={activeBusiness}
                onUpdateBusiness={updateActiveBusiness}
                initialSubTab={catalogSubTab}
              />
            )}

            {activeTab === 'faq' && (
              <FaqAndSupportView
                faqs={faqs}
                profile={profile}
                contactEmail={appConfig.contactEmail}
              />
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <BusinessSettingsView
                  state={appStateSnapshot}
                  activeBusiness={activeBusiness}
                  profile={profile}
                  appConfig={appConfig}
                  paymentHistory={paymentHistory}
                  pushNotifications={pushNotifications}
                  colorTone={colorTone}
                  isDark={isDark}
                  onChangeColorTone={setColorTone}
                  onToggleTheme={handleToggleTheme}
                  onUpdateActiveBusiness={updateActiveBusiness}
                  onSelectBusiness={setActiveBusinessId}
                  onCreateBusiness={handleCreateBusiness}
                  onDuplicateBusiness={handleDuplicateBusiness}
                  onDeleteBusiness={handleDeleteBusiness}
                  onClearDemoData={handleClearDemoData}
                  onRestoreDemoData={handleRestoreDemoData}
                  onImportState={handleImportState}
                  onReplayOnboardingTour={() => setShowOnboardingTour(true)}
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLandingExplicit(true)}
                    className="min-h-[44px] px-6 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--sec-soft)] cursor-pointer transition-colors"
                  >
                    Ver landing de presentación
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="min-h-[44px] px-6 rounded-full border border-[var(--accent-soft-border)] text-[var(--danger-text)] text-xs font-semibold hover:bg-[var(--danger-soft)] cursor-pointer transition-colors"
                  >
                    Cerrar sesión ({profile.email})
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'admin' && profile.role === 'admin' && (
              <AdminView adminProfile={profile} appConfig={appConfig} />
            )}
          </ViewTransition>

          {/* APARTADO INFERIOR PERMANENTE DE AYUDA, CONSULTAS Y ADJUNTOS */}
          <footer className="mt-10 pt-5 border-t border-[var(--border-hairline)]">
            <div className="growy-editorial-strip p-5 sm:p-7 rounded-[28px] flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-xs">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <HelpCircle className="w-4 h-4 text-[#F6A59E]" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="font-editorial italic text-lg font-semibold text-white">
                    ¿Necesitas ayuda o quieres comentarnos algo?
                  </p>
                  <p className="text-xs text-[#CFC5EE] leading-relaxed">
                    Si ya contrataste tu plan ($5.990 mensual o $50.000 anual) y tienes alguna
                    consulta, sugerencia o necesitas asistencia, escríbenos. Puedes adjuntar
                    documentos o capturas directamente para el administrador ({appConfig.contactEmail}).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProblemModal(true)}
                className="w-full md:w-auto min-h-[46px] px-6 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Escribir y adjuntar</span>
              </button>
            </div>
          </footer>
        </div>
      </main>

      {/* MODAL PARA REPORTE DE PROBLEMAS CON ADJUNTOS */}
      <AnimatePresence>
        {showProblemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: GROWY_EASE }}
              className="relative w-full max-w-xl my-6"
            >
              <button
                type="button"
                onClick={() => setShowProblemModal(false)}
                aria-label="Cerrar ventana"
                className="absolute top-3 right-3 z-10 min-w-[36px] min-h-[36px] rounded-full bg-[var(--bg-soft)] hover:bg-[var(--border-hairline)] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-[var(--text-primary)]" />
              </button>
              <ProblemReportPanel
                profile={profile}
                contactEmail={appConfig.contactEmail}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NAVEGACIÓN INFERIOR EN MÓVIL (<= 64px) */}
      <nav
        aria-label="Navegación inferior móvil"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 grid grid-cols-5 items-center border-t border-[var(--border-hairline)] bg-[var(--bg-surface-alpha)] backdrop-blur-md"
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-tour={`nav-${item.id}`}
              onClick={() => setActiveTab(item.id)}
              className={`relative min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-1 cursor-pointer transition-colors ${
                isActive
                  ? 'text-[var(--accent-strong)] font-semibold'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute top-0 left-4 right-4 h-0.5 rounded-full bg-[var(--accent-strong)]"
                />
              )}
              {item.icon}
              <span className="text-[10px] tracking-tight truncate max-w-full">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>

      <OnboardingTourModal
        open={showOnboardingTour}
        userName={profile.displayName}
        onNavigate={handleNavigate}
        onComplete={() => {
          setShowOnboardingTour(false);
          try {
            localStorage.setItem(`growy_onboarding_done_${profile.uid}`, '1');
          } catch {
            // Ignorar
          }
          setProfile((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
          if (profile.onboardingCompleted !== true) {
            void markUserOnboardingCompleted(profile.uid).catch(() => {});
          }
        }}
      />

      <OfflineIndicator />
      </div>
    </GrowyMotionRoot>
  );
};
