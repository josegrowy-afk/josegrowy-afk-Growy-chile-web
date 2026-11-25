import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
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
import { AuthModal, type EmailAuthSubmitPayload } from './components/AuthModal';
import { BusinessSettingsView } from './components/BusinessSettingsView';
import { EquilibrioProductIcon, GrowyLogoMark } from './components/GrowyMotifs';
import { CalculatorView } from './components/CalculatorView';
import { CatalogAndCostsView, type CatalogSubTab } from './components/CatalogAndCostsView';
import { DashboardView, type DashboardSubTab } from './components/DashboardView';
import { EmailVerificationWall } from './components/EmailVerificationWall';
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
import {
  BackdropBlobs,
  EditorialText,
  FloatingNav,
  GlassCard,
  SolidCard,
  type FloatingNavItem,
} from './components/design-system';
import { createEmptyBusiness } from './data/demoData';
import {
  calculatePlanComparisonFromConfig,
  clearPublicBreakEvenDraft,
  readPublicBreakEvenDraft,
} from './finance/phase1Insights';
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
  trackFunnelStepOncePerSession,
  verifyMercadoPagoPayment,
  verifyMercadoPagoSubscription,
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

const LazyDesignSystemShowcase = import.meta.env.DEV
  ? React.lazy(() =>
      import('./components/DesignSystemShowcase').then((m) => ({
        default: m.DesignSystemShowcase,
      }))
    )
  : null;

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
  const [unverifiedUser, setUnverifiedUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
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
  const [designSystemMode, setDesignSystemMode] = useState<boolean>(() => {
    if (!import.meta.env.DEV) return false;
    try {
      return new URLSearchParams(window.location.search).get('design-system') === '1';
    } catch {
      return false;
    }
  });
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [mpVerificationNotice, setMpVerificationNotice] = useState<string | null>(null);
  const [checkedMpPaymentId, setCheckedMpPaymentId] = useState<string | null>(null);
  const [checkedMpPreapprovalId, setCheckedMpPreapprovalId] = useState<string | null>(null);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [showOnboardingTour, setShowOnboardingTour] = useState(false);
  const [billingDayPick, setBillingDayPick] = useState<BillingDay | null>(null);
  const [savingBillingDay, setSavingBillingDay] = useState(false);
  const [billingDayError, setBillingDayError] = useState<string | null>(null);
  const [draftCarryNotice, setDraftCarryNotice] = useState<string | null>(null);
  const handledDraftRef = useRef(false);

  const planSummary = useMemo(() => calculatePlanComparisonFromConfig(appConfig), [appConfig]);

  const userInitials = useMemo(() => {
    const raw = (profile?.displayName || profile?.email || 'GR').trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  }, [profile?.displayName, profile?.email]);

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
    ((import.meta.env.DEV && designSystemMode) ||
      (authUid &&
        profile?.accessStatus === 'active' &&
        !subStatus.isExpired &&
        !showLandingExplicit)) &&
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
          ? '#14111F'
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

  // Listener de Firebase Auth (soporta Google Sign-In y Correo/Contraseña con verificación)
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUnverifiedUser(null);
        setAuthUid(null);
        setProfile(null);
        setBusinesses([]);
        setBusinessesLoaded(false);
        setAuthReady(true);
        return;
      }

      if (!fbUser.emailVerified) {
        setUnverifiedUser(fbUser);
        setAuthUid(null);
        setProfile(null);
        setBusinesses([]);
        setBusinessesLoaded(false);
        setAuthReady(true);
        return;
      }

      setUnverifiedUser(null);
      setAuthUid(fbUser.uid);
      setAuthModalOpen(false);
      void trackFunnelStepOncePerSession('login', { source: 'app' });
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
    if (params.has('excel_order')) return;
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

  // 3.7 Verificación al volver de Mercado Pago Suscripción Automática (?preapproval_id=...)
  useEffect(() => {
    if (!authUid || !profile) return;
    const params = new URLSearchParams(window.location.search);
    const preapprovalId = params.get('preapproval_id');
    if (!preapprovalId || checkedMpPreapprovalId === preapprovalId) return;

    setCheckedMpPreapprovalId(preapprovalId);
    verifyMercadoPagoSubscription({
      preapprovalId,
      profile,
    }).then((res) => {
      setMpVerificationNotice(res.message);
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    });
  }, [authUid, profile?.uid, checkedMpPreapprovalId]);

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

  // Conservar borrador ingresado en la calculadora pública de la landing tras iniciar sesión
  useEffect(() => {
    const expiredNow = getSubscriptionStatus(profile).isExpired;
    if (
      !authUid ||
      !profile ||
      profile.accessStatus !== 'active' ||
      expiredNow ||
      !businessesLoaded ||
      showLandingExplicit ||
      handledDraftRef.current
    ) {
      return;
    }

    const draft = readPublicBreakEvenDraft();
    if (!draft) return;

    handledDraftRef.current = true;
    const baseProductId = `prod-calc-${Date.now()}`;
    const unitContrib = draft.unitPrice - draft.variableCost;
    const suggestedUnits =
      unitContrib > 0 && draft.fixedCosts > 0
        ? Math.max(10, Math.ceil((draft.fixedCosts / unitContrib) * 1.25))
        : 40;

    const draftedBiz: BusinessWorkspace = {
      ...createEmptyBusiness('Mi cálculo inicial (Calculadora)'),
      id: `biz-draft-${Date.now()}`,
      ownerUid: profile.uid,
      tagline: 'Creado desde la calculadora pública de Equilibrio',
      fixedCosts:
        draft.fixedCosts > 0
          ? [
              {
                id: `fc-calc-${Date.now()}`,
                name: 'Costos fijos estimados',
                amount: draft.fixedCosts,
                category: 'otros',
                notes: 'Importado desde calculadora de la portada',
              },
            ]
          : [],
      products: [
        {
          id: baseProductId,
          name: 'Producto o servicio principal',
          category: 'General',
          price: draft.unitPrice,
          variableCost: draft.variableCost,
        },
      ],
      expectedMonthlyUnits: suggestedUnits,
      baseMonthlyUnitsByProduct: {
        [baseProductId]: suggestedUnits,
      },
      updatedAt: new Date().toISOString(),
    };

    clearPublicBreakEvenDraft();
    setBusinesses((prev) => [...prev, draftedBiz]);
    setActiveBusinessId(draftedBiz.id);
    setActiveTab('calculator');
    setDraftCarryNotice(
      'Cargamos los valores que probaste en la portada dentro de "Mi cálculo inicial (Calculadora)" para que puedas ajustarlos y proyectar tu mes.'
    );
    void trackFunnelStepOncePerSession('first_calculation', { source: 'app' });
    void saveUserBusiness(profile.uid, draftedBiz, true).catch(() => {});
  }, [
    authUid,
    profile?.uid,
    profile?.accessStatus,
    profile?.nextPaymentDueAt,
    businessesLoaded,
    showLandingExplicit,
  ]);

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

  // Registrar paso de primer cálculo cuando el usuario entra a la calculadora de Equilibrio
  useEffect(() => {
    if (activeTab === 'calculator' && authUid && !showLandingExplicit) {
      void trackFunnelStepOncePerSession('first_calculation', { source: 'app' });
    }
  }, [activeTab, authUid, showLandingExplicit]);

  const handleOpenAuthModal = () => {
    if (authUid) {
      setShowLandingExplicit(false);
      return;
    }
    setAuthError(null);
    setAuthModalOpen(true);
  };

  const handleGoogleSignIn = async () => {
    if (authUid) {
      setAuthModalOpen(false);
      setShowLandingExplicit(false);
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthModalOpen(false);
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

  const handleEmailAuth = async (
    payload: EmailAuthSubmitPayload
  ): Promise<{ ok: boolean; message?: string }> => {
    setAuthError(null);
    try {
      if (payload.mode === 'reset') {
        await sendPasswordResetEmail(auth, payload.email);
        return {
          ok: true,
          message:
            'Te enviamos un enlace a tu correo para restablecer tu contraseña (revisa también spam).',
        };
      }

      if (payload.mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
        if (payload.displayName) {
          await updateProfile(cred.user, { displayName: payload.displayName });
        }
        await sendEmailVerification(cred.user);
        setAuthModalOpen(false);
        setShowLandingExplicit(false);
        void trackFunnelStepOncePerSession('login', { source: 'app' });
        return { ok: true };
      }

      await signInWithEmailAndPassword(auth, payload.email, payload.password);
      setAuthModalOpen(false);
      setShowLandingExplicit(false);
      void trackFunnelStepOncePerSession('login', { source: 'app' });
      return { ok: true };
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      if (code === 'auth/email-already-in-use') {
        return {
          ok: false,
          message:
            'Ese correo ya tiene cuenta. Elige "Ya tengo cuenta" o recupera tu contraseña.',
        };
      }
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        return { ok: false, message: 'Correo o contraseña incorrectos. Revisa e intenta otra vez.' };
      }
      if (code === 'auth/weak-password') {
        return { ok: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
      }
      if (code === 'auth/invalid-email') {
        return { ok: false, message: 'El formato del correo no es válido.' };
      }
      if (code === 'auth/too-many-requests') {
        return {
          ok: false,
          message: 'Demasiados intentos seguidos. Espera un par de minutos e intenta nuevamente.',
        };
      }
      if (code === 'auth/operation-not-allowed') {
        return {
          ok: false,
          message:
            'El acceso con correo aún no está habilitado en Firebase Authentication. Usa "Entrar con Google" o actívalo en la consola.',
        };
      }
      return {
        ok: false,
        message: 'No pudimos completar el acceso con tu correo. Intenta nuevamente en unos segundos.',
      };
    }
  };

  const handleCheckEmailVerified = async (): Promise<{
    verified: boolean;
    message: string;
  }> => {
    const current = auth.currentUser;
    if (!current) {
      return { verified: false, message: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
    }
    try {
      await current.reload();
      await current.getIdToken(true);
      if (current.emailVerified) {
        setUnverifiedUser(null);
        setAuthUid(current.uid);
        await ensureUserProfile({
          uid: current.uid,
          email: current.email ?? '',
          displayName: current.displayName ?? 'Emprendedor',
        });
        return { verified: true, message: '¡Correo confirmado! Entrando a tu espacio...' };
      }
      return {
        verified: false,
        message:
          'Aún no vemos la confirmación. Abre el enlace que enviamos a tu bandeja (revisa spam) y vuelve a presionar el botón.',
      };
    } catch {
      return {
        verified: false,
        message: 'No pudimos verificar el estado ahora. Intenta nuevamente en unos segundos.',
      };
    }
  };

  const handleResendVerificationEmail = async (): Promise<{
    sent: boolean;
    message: string;
  }> => {
    const current = auth.currentUser;
    if (!current) {
      return { sent: false, message: 'Vuelve a iniciar sesión para reenviar el enlace.' };
    }
    try {
      await sendEmailVerification(current);
      return { sent: true, message: 'Te reenviamos el enlace de verificación a tu correo.' };
    } catch {
      return {
        sent: false,
        message: 'Espera unos segundos antes de volver a solicitar otro correo.',
      };
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUnverifiedUser(null);
    setActiveTab('dashboard');
    setShowLandingExplicit(false);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Vista de prueba interna (solo en entorno DEV con ?design-system=1)
  if (import.meta.env.DEV && designSystemMode && LazyDesignSystemShowcase) {
    return (
      <GrowyMotionRoot>
        <Suspense fallback={null}>
          <LazyDesignSystemShowcase
            theme={theme}
            colorTone={colorTone}
            onChangeTheme={setTheme}
            onChangeTone={setColorTone}
            onExit={() => {
              setDesignSystemMode(false);
              try {
                const url = new URL(window.location.href);
                url.searchParams.delete('design-system');
                window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
              } catch {
                // Ignorar
              }
            }}
          />
        </Suspense>
      </GrowyMotionRoot>
    );
  }

  // Estado inicial de carga Auth
  if (!authReady) {
    return (
      <GrowyMotionRoot>
        <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
          <BackdropBlobs />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: GROWY_EASE }}
            className="relative z-10 w-full max-w-sm"
          >
            <GlassCard className="p-6 sm:p-8 text-center space-y-3">
              <GrowyLogoMark size="lg" showSlogan className="mx-auto items-center" />
              <p className="text-sm text-[var(--text-secondary)]">
                Preparando tu espacio financiero...
              </p>
            </GlassCard>
          </motion.div>
        </div>
      </GrowyMotionRoot>
    );
  }

  // 1. Landing pública de venta (sin login, o si eligió volver a ver la landing)
  if ((!authUid && !unverifiedUser) || showLandingExplicit) {
    return (
      <GrowyMotionRoot>
        <LandingPage
          config={appConfig}
          faqs={faqs}
          isDark={theme === 'dark'}
          isSignedIn={Boolean(authUid)}
          onToggleTheme={handleToggleTheme}
          onLoginClick={handleOpenAuthModal}
          authLoading={authLoading}
          authError={authError}
        />
        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onGoogleSignIn={handleGoogleSignIn}
          onEmailAuth={handleEmailAuth}
          authLoading={authLoading}
          externalError={authError}
        />
        <OfflineIndicator />
      </GrowyMotionRoot>
    );
  }

  // 1B. Verificación obligatoria de correo (para cuentas creadas con correo y contraseña)
  if (!authUid && unverifiedUser) {
    return (
      <GrowyMotionRoot>
        <EmailVerificationWall
          email={unverifiedUser.email ?? ''}
          onCheckVerified={handleCheckEmailVerified}
          onResendEmail={handleResendVerificationEmail}
          onSignOut={handleSignOut}
        />
        <OfflineIndicator />
      </GrowyMotionRoot>
    );
  }

  // Cargando perfil (solo cuando hay sesión Firebase)
  if (!profile) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
        <BackdropBlobs />
        <GlassCard className="relative z-10 w-full max-w-sm p-6 sm:p-8 text-center space-y-3">
          <GrowyLogoMark size="lg" showSlogan className="mx-auto items-center" />
          <p className="text-sm text-[var(--text-secondary)]">Verificando tu acceso...</p>
        </GlassCard>
      </div>
    );
  }

  // 2. Pantalla de acceso pendiente, vencido o suspendido (solo para usuarios autenticados)
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
        <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <BackdropBlobs />
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: GROWY_EASE }}
            className="relative z-10 w-full max-w-xl"
          >
            <SolidCard className="p-6 sm:p-8 space-y-5">
              <div className="relative overflow-hidden growy-banner-surface rounded-[28px] p-5 flex items-start justify-between gap-3">
                <div className="growy-banner-grain" aria-hidden="true" />
                <div className="relative z-10 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <GrowyLogoMark size="sm" />
                    <span className="text-[var(--banner-ink)]/40" aria-hidden="true">·</span>
                    <EquilibrioProductIcon size="xs" />
                    <span className="font-display text-xs font-extrabold text-[var(--banner-ink)]">
                      Equilibrio
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-[1.75rem] font-extrabold text-[var(--banner-ink)] tracking-tight leading-tight">
                    <EditorialText text="Elige tu *fecha de pago* mensual" />
                  </h1>
                  <p className="text-xs text-[var(--banner-ink-muted)]">
                    Cuenta: <strong>{profile.email}</strong> · Plan {MONTHLY_PRICE_LABEL} (Precio por lanzamiento)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="relative z-10 min-h-[40px] px-4 rounded-full border border-[var(--banner-ink)]/25 bg-[var(--bg-surface)]/80 text-[var(--text-primary)] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--bg-surface)] cursor-pointer shrink-0"
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
                      style={
                        selected
                          ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                          : undefined
                      }
                      className={`min-h-[68px] p-3 rounded-[24px] border text-center transition-colors cursor-pointer ${
                        selected
                          ? 'border-transparent shadow-xs'
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
                <div className="p-3.5 rounded-[22px] bg-[var(--sec-soft)] border border-[var(--sec-border)] text-xs text-[var(--sec-text)] flex items-center gap-2.5">
                  <CalendarCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Tu primer vencimiento quedará fijado para el{' '}
                    <strong>{formatISODateSpanish(previewDue)}</strong>.
                  </span>
                </div>
              )}

              {billingDayError && (
                <p className="text-xs font-semibold p-3 rounded-[22px] bg-[var(--danger-soft)] text-[var(--danger-text)]">
                  {billingDayError}
                </p>
              )}

              <button
                type="button"
                disabled={!billingDayPick || savingBillingDay}
                onClick={handleConfirmBillingDay}
                style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                className="w-full min-h-[48px] rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs hover:opacity-92 transition-opacity"
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
            </SolidCard>
          </motion.div>
        </div>
        <OfflineIndicator />
      </GrowyMotionRoot>
    );
  }

  // Cargando espacios de trabajo
  if (!businessesLoaded || businesses.length === 0) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden">
        <BackdropBlobs />
        <GlassCard className="relative z-10 w-full max-w-sm p-6 sm:p-8 text-center space-y-3">
          <GrowyLogoMark size="lg" showSlogan className="mx-auto items-center" />
          <p className="text-sm text-[var(--text-secondary)]">
            Sincronizando tus negocios...
          </p>
        </GlassCard>
      </div>
    );
  }

  const activeBusiness = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0];
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

  const floatingNavItems: FloatingNavItem[] = [
    {
      id: 'dashboard',
      label: 'Resumen',
      shortLabel: 'Resumen',
      active: activeTab === 'dashboard',
      onClick: () => setActiveTab('dashboard'),
      dataTour: 'nav-dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'calculator',
      label: 'Equilibrio',
      shortLabel: 'Equilibrio',
      active: activeTab === 'calculator',
      onClick: () => setActiveTab('calculator'),
      dataTour: 'nav-calculator',
      icon: <Compass className="w-4 h-4" />,
    },
    {
      id: 'projections',
      label: 'Proyección',
      shortLabel: 'Proyección',
      active: activeTab === 'projections',
      onClick: () => setActiveTab('projections'),
      dataTour: 'nav-projections',
      icon: <CalendarRange className="w-4 h-4" />,
    },
    {
      id: 'actuals',
      label: 'Reales',
      shortLabel: 'Reales',
      active: activeTab === 'actuals',
      onClick: () => setActiveTab('actuals'),
      dataTour: 'nav-actuals',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'catalog',
      label: 'Catálogo',
      shortLabel: 'Catálogo',
      active: activeTab === 'catalog',
      onClick: () => setActiveTab('catalog'),
      dataTour: 'nav-catalog',
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: 'simple',
      label: 'En simple',
      shortLabel: 'En simple',
      active: activeTab === 'simple',
      onClick: () => setActiveTab('simple'),
      dataTour: 'nav-simple',
      icon: <Apple className="w-4 h-4" />,
    },
  ];

  // Móvil (5 ranuras: Resumen, Catálogo, [Equilibrio centro], Proyección, Reales)
  // Incluye data-tour="nav-actuals" también en móvil para el onboarding tour.
  const mobileNavItems: FloatingNavItem[] = [
    floatingNavItems[0],
    floatingNavItems[4],
    floatingNavItems[2],
    floatingNavItems[3],
  ];

  return (
    <GrowyMotionRoot>
      <div className="relative min-h-screen flex flex-col overflow-x-clip">
        <BackdropBlobs />

        {/* BARRA SUPERIOR FLOTANTE EN PÍLDORA (ESCRITORIO) + BARRA INFERIOR FLOTANTE (MÓVIL) */}
        <FloatingNav
          maxWidthClass="max-w-7xl"
          items={floatingNavItems}
          mobileItems={mobileNavItems}
          onLogoClick={() => setShowLandingExplicit(true)}
          centerMobileLabel="Equilibrio"
          centerMobileActive={activeTab === 'calculator'}
          onCenterMobileClick={() => setActiveTab('calculator')}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          extraRightSlot={
            <div className="flex items-center gap-1">
              <PWAInstallButton compact />
              <button
                type="button"
                onClick={() => setActiveTab('faq')}
                aria-label="Ayuda y FAQ"
                title="Ayuda y preguntas frecuentes"
                className={`min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'faq'
                    ? 'bg-[var(--bg-soft)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-soft)]'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                aria-label="Configuración y apariencia"
                title="Configuración del negocio y apariencia"
                className={`min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[var(--bg-soft)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-soft)]'
                }`}
              >
                <Settings2 className="w-4 h-4" />
              </button>
              {profile.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  aria-label="Panel Administrador"
                  title="Panel Administrador"
                  className={`relative min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-[var(--bg-soft)] text-[var(--accent-strong)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-soft)]'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  {openTicketsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent-strong)] text-white text-[10px] font-bold flex items-center justify-center">
                      {openTicketsCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          }
          primaryAction={{
            label: profile.displayName?.split(/\s+/)[0] || 'Mi cuenta',
            avatarInitials: userInitials,
            onClick: () => setActiveTab('settings'),
          }}
        />

        {/* CONTENIDO PRINCIPAL */}
        <main className="relative z-10 flex-1 pb-28 md:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-6">
            {/* Barra contextual compacta: negocio activo, plan y accesos rápidos móviles */}
            <div className="growy-nav-pill rounded-[26px] lg:rounded-full px-4 py-2.5 mb-5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                <div className="inline-flex items-center gap-2 pr-1">
                  <EquilibrioProductIcon size="xs" />
                  <span className="font-display text-xs font-extrabold text-[var(--text-primary)] tracking-tight">
                    Equilibrio
                  </span>
                  <span className="text-[11px] font-mono text-[var(--text-muted)] hidden sm:inline">
                    01
                  </span>
                </div>
                <label htmlFor="desktop-business-select" className="sr-only">
                  Negocio o escenario activo
                </label>
                <select
                  id="desktop-business-select"
                  value={activeBusiness.id}
                  onChange={(e) => setActiveBusinessId(e.target.value)}
                  className="boho-input !py-1.5 !px-3.5 !min-h-[36px] !rounded-full text-xs font-semibold max-w-[230px] sm:max-w-[270px]"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {!subStatus.isExemptAdmin &&
                  (subStatus.isAnnual || subStatus.billingDay || subStatus.isComplimentary) && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {subStatus.isComplimentary
                          ? 'Prueba'
                          : subStatus.isAnnual
                            ? 'Plan Anual'
                            : 'Plan $5.990/mes'}
                      </span>
                      {!subStatus.isComplimentary && (
                        <a
                          href={
                            subStatus.isAnnual
                              ? appConfig.annualPaymentUrl || appConfig.paymentUrl
                              : appConfig.paymentUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            void trackFunnelStepOncePerSession('payment', {
                              source: 'app',
                              planType: subStatus.isAnnual ? 'annual' : 'monthly',
                            })
                          }
                          className="font-bold text-[var(--accent-strong)] hover:underline inline-flex items-center gap-0.5"
                        >
                          <span>{subStatus.isAnnual ? 'Renovar' : 'Pagar'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                {/* Cambio rápido Pastel / Ejecutivo */}
                <button
                  type="button"
                  onClick={() =>
                    setColorTone((prev) => (prev === 'pastel' ? 'formal' : 'pastel'))
                  }
                  className="min-h-[34px] px-3 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  title="Alternar estilo Pastel / Ejecutivo"
                >
                  {colorTone === 'formal' ? 'Estilo: Ejecutivo' : 'Estilo: Pastel'}
                </button>

                {/* Accesos visibles en móvil para pestañas secundarias + tema */}
                <div className="flex md:hidden items-center gap-1">
                  <PWAInstallButton compact />
                  <button
                    type="button"
                    onClick={() => setActiveTab('simple')}
                    aria-label="Explícame en simple"
                    className={`min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center cursor-pointer ${
                      activeTab === 'simple'
                        ? 'bg-[var(--bg-soft)] text-[var(--accent-strong)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Apple className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('faq')}
                    aria-label="Ayuda y FAQ"
                    className={`min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center cursor-pointer ${
                      activeTab === 'faq'
                        ? 'bg-[var(--bg-soft)] text-[var(--accent-strong)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    aria-label="Configuración"
                    className={`min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-[var(--bg-soft)] text-[var(--accent-strong)]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  {profile.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('admin')}
                      aria-label="Administrador"
                      className={`min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center cursor-pointer ${
                        activeTab === 'admin'
                          ? 'bg-[var(--bg-soft)] text-[var(--accent-strong)]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleTheme}
                    aria-label="Cambiar tema"
                    className="min-w-[34px] min-h-[34px] rounded-full flex items-center justify-center cursor-pointer"
                  >
                    {isDark ? (
                      <Sun className="w-4 h-4 text-[var(--gold-motif)]" />
                    ) : (
                      <Moon className="w-4 h-4 text-[var(--text-primary)]" />
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLandingExplicit(true)}
                  className="min-h-[34px] px-3 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                >
                  Portada
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  className="min-h-[34px] px-3 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--danger-text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </div>
            </div>

            {/* Aviso tras retorno de Mercado Pago */}
            {mpVerificationNotice && (
              <SolidCard
                className="mb-5 p-4 !bg-[var(--sec-soft)] !border-[var(--sec-border)] flex items-center justify-between gap-3 text-xs font-medium text-[var(--sec-text)]"
              >
                <span>{mpVerificationNotice}</span>
                <button
                  type="button"
                  onClick={() => setMpVerificationNotice(null)}
                  aria-label="Cerrar aviso"
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-black/5 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </SolidCard>
            )}

            {/* Recordatorio de vencimiento mensual ($5.990) o fin de 12 meses anual ($50.000) */}
            {subStatus.shouldShowReminder && subStatus.nextDueISO && (
              <SolidCard
                className="mb-5 p-4 !bg-[var(--warn-soft)] !border-[var(--warn-border)] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 text-xs text-[var(--warn-text)]"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <CalendarCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  {subStatus.isAnnual ? (
                    <p className="leading-relaxed">
                      <strong>Recordatorio de renovación anual ({planSummary.annualPriceFormatted}):</strong> tus 12 meses de
                      acceso completo finalizan{' '}
                      {subStatus.daysUntilDue === 1
                        ? 'mañana'
                        : `en ${subStatus.daysUntilDue} días`}{' '}
                      (<strong>{formatISODateSpanish(subStatus.nextDueISO)}</strong>). Al vencer los
                      12 meses, la página bloqueará las funciones hasta que renueves mensual ({planSummary.monthlyPriceFormatted}) o
                      anual ({planSummary.annualPriceFormatted}).
                    </p>
                  ) : (
                    <p className="leading-relaxed">
                      <strong>Recordatorio de pago mensual ({planSummary.monthlyPriceFormatted}):</strong> tu fecha de pago (día{' '}
                      {subStatus.billingDay}) vence{' '}
                      {subStatus.daysUntilDue === 1
                        ? 'mañana'
                        : `en ${subStatus.daysUntilDue} días`}{' '}
                      (<strong>{formatISODateSpanish(subStatus.nextDueISO)}</strong>). Al llegar esa
                      fecha, la página dejará de funcionar hasta que pagues con Mercado Pago (o
                      aproveches el Plan Anual de {planSummary.annualPriceFormatted} y ahorres {planSummary.savingsFormatted}).
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
                    onClick={() =>
                      void trackFunnelStepOncePerSession('payment', {
                        source: 'app',
                        planType: 'monthly',
                      })
                    }
                    className="min-h-[42px] px-5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Mensual {planSummary.monthlyPriceFormatted}</span>
                  </a>
                  <a
                    href={appConfig.annualPaymentUrl || appConfig.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      void trackFunnelStepOncePerSession('payment', {
                        source: 'app',
                        planType: 'annual',
                      })
                    }
                    style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                    className="min-h-[42px] px-5 rounded-full font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs hover:opacity-92 transition-opacity"
                  >
                    <span>Anual {planSummary.annualPriceFormatted}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </SolidCard>
            )}

            {draftCarryNotice && (
              <SolidCard
                className="mb-5 p-4 !bg-[var(--pos-soft)] !border-[var(--pos-border)] flex items-center justify-between gap-3 text-xs font-medium text-[var(--pos-text)]"
              >
                <span>{draftCarryNotice}</span>
                <button
                  type="button"
                  onClick={() => setDraftCarryNotice(null)}
                  aria-label="Cerrar aviso de borrador"
                  className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-full hover:bg-black/5 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </SolidCard>
            )}

            {/* Anuncio global configurable por el administrador */}
            {appConfig.announcementActive && appConfig.announcementText.trim() && (
              <SolidCard
                className="mb-5 p-4 !bg-[var(--sec-soft)] !border-[var(--sec-border)] flex items-center gap-3 text-xs font-medium text-[var(--sec-text)]"
              >
                <Megaphone className="w-4 h-4 shrink-0" />
                <span>{appConfig.announcementText}</span>
              </SolidCard>
            )}

            {/* Aviso de negocio de ejemplo (solo usuarios autenticados) */}
            {activeBusiness.isDemo && (
              <SolidCard
                className="mb-5 p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <p className="text-[var(--text-primary)]">
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
              </SolidCard>
            )}

            <ViewTransition viewKey={`${activeTab}-${activeBusiness.id}`}>
              {activeTab === 'dashboard' && (
                <DashboardView
                  business={activeBusiness}
                  isDark={isDark}
                  colorTone={colorTone}
                  userName={profile?.displayName}
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
                  profile={profile ?? undefined}
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
              <div className="growy-editorial-strip p-5 sm:p-7 rounded-[32px] flex flex-col md:flex-row md:items-center md:justify-between gap-5 shadow-xs">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <HelpCircle className="w-4 h-4 text-[#F6A59E]" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="font-display text-lg font-extrabold text-white tracking-tight">
                      <EditorialText text="¿Necesitas *ayuda* o quieres comentarnos algo?" />
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
                  className="w-full md:w-auto min-h-[46px] px-6 rounded-full bg-[#F6A59E] hover:opacity-92 text-[#1F1B2E] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition-opacity"
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

        <OnboardingTourModal
          open={showOnboardingTour}
          userName={profile.displayName}
          onNavigate={handleNavigate}
          onComplete={() => {
            setShowOnboardingTour(false);
            void trackFunnelStepOncePerSession('onboarding', { source: 'app' });
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

        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onGoogleSignIn={handleGoogleSignIn}
          onEmailAuth={handleEmailAuth}
          authLoading={authLoading}
          externalError={authError}
        />

        <OfflineIndicator />
      </div>
    </GrowyMotionRoot>
  );
};
