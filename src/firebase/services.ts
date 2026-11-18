import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createDemoBusinesses } from '../data/demoData';
import {
  ANNUAL_PRICE_CLP,
  ANNUAL_PRICE_LABEL,
  buildReceiptNumber,
  computeAnnualDueDate,
  computeInitialNextDueDate,
  computeNextCycleDueDate,
  isComplimentaryClientEmail,
  MONTHLY_PRICE_CLP,
  MONTHLY_PRICE_LABEL,
} from '../finance/subscription';
import type {
  AccessCode,
  AccessStatus,
  AdminLogEntry,
  AppConfig,
  BillingDay,
  BusinessWorkspace,
  FaqCategory,
  FaqItem,
  LandingContentConfig,
  PaymentHistoryEntry,
  PaymentMethodType,
  PaymentReceiptStatus,
  PaymentStatus,
  PlanType,
  PushSubscriptionRecord,
  SupportTicket,
  TicketAttachment,
  TicketStatus,
  TicketType,
  UserProfile,
  UserRole,
} from '../types/finance';
import { db, handleFirestoreError, OperationType } from './client';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'jose.growy@gmail.com';

export const DEFAULT_MERCADOPAGO_URL =
  import.meta.env.VITE_MERCADOPAGO_PAYMENT_URL ||
  import.meta.env.VITE_PAYMENT_URL ||
  'https://mpago.la/2JwG16F';

export const DEFAULT_ANNUAL_MERCADOPAGO_URL =
  import.meta.env.VITE_MERCADOPAGO_ANNUAL_PAYMENT_URL ||
  'https://mpago.la/2JwG16F';

function isPlaceholderPaymentUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.includes('tu-pasarela-de-pago.ejemplo') ||
    url.includes('tu-link-growy-5990')
  );
}

export const DEFAULT_LANDING_CONTENT: LandingContentConfig = {
  heroEyebrow: 'Potenciador de ideas para pymes',
  heroPrimaryCta: 'Conocer Equilibrio',
  heroChecks: 'Sin jerga financiera\nCelular y computador\nHecho por un contador auditor',
  step1Title: '1 · Conoce tu realidad',
  step1Desc: 'Registra tus costos y productos en minutos.',
  step2Title: '2 · Encuentra tu equilibrio',
  step2Desc: 'Sabe cuánto vender para no perder.',
  step3Title: '3 · Define cuánto quieres ganar',
  step3Desc: 'Te decimos cuántos productos vender.',
  whatIsEyebrow: 'Qué es Growy',
  whatIsTitle: 'Un potenciador para las ideas de tu pyme, afirmado en bases firmes.',
  whatIsBody:
    'En Growy creemos que el corazón de una pyme es la innovación y la creatividad. No venimos a reemplazar a nadie: somos el puente para que tu idea crezca sin que los números te frenen. Cuando tus cifras están claras, puedes crear, decidir y proyectar con calma.',
  whatIsPillar1Title: 'Innovación y creatividad al centro',
  whatIsPillar1Desc:
    'Tu proyecto nace de tu visión y talento. Nuestras herramientas liberan tiempo mental para que te dediques a imaginar, probar y mejorar lo que ofreces.',
  whatIsPillar2Title: 'Bases firmes para crecer',
  whatIsPillar2Desc:
    'Toda creatividad necesita suelo estable. Traducimos tus costos, precios y metas en cifras simples, sin jerga financiera ni planillas enredadas.',
  breakevenEyebrow: 'Primero, los cimientos',
  breakevenTitle: '¿Qué es el punto de equilibrio?',
  breakevenDefinition:
    'El punto de equilibrio es el momento exacto en que tus ventas cubren todos tus costos, de modo que no ganas ni pierdes. Desde la venta siguiente, empiezas a ganar.',
  breakevenImportanceTitle: 'Por qué conocerlo cambia el día a día de tu pyme',
  breakevenImportancePoints: [
    'Te dice cuánto necesitas vender como mínimo cada mes para cubrir tu operación.',
    'Te permite poner metas reales en vez de intuiciones o suposiciones.',
    'Te ayuda a decidir precios, gastos e inversiones con seguridad.',
    'Te da tranquilidad para dedicarte a lo más importante: innovar.',
  ].join('\n'),
  breakevenPillarsTitle: 'Los tres números simples que lo componen',
  breakevenFixedTitle: 'Costos fijos',
  breakevenFixedDesc:
    'Lo que pagas mes a mes vendas o no vendas: arriendo, luz, internet, sueldos base o herramientas.',
  breakevenVariableTitle: 'Costos variables',
  breakevenVariableDesc:
    'Lo que gastas por cada producto o servicio que vendes: materias primas, empaque, envíos o comisiones.',
  breakevenPriceTitle: 'Precio de venta',
  breakevenPriceDesc:
    'Lo que cobra tu pyme al cliente por cada producto o servicio entregado.',
  breakevenExampleTitle: 'Ejemplo visual: un taller de velas artesanales',
  breakevenExampleBody:
    'Imagina que haces velas artesanales. Tienes $300.000 de costos fijos al mes, cada vela te cuesta $3.000 en insumos y empaque, y la vendes a $9.000. Cada vela deja $6.000 para cubrir el taller. Con 50 velas cubres exactamente todos tus costos; desde la vela 51 en adelante, cada venta suma ganancia.',
  breakevenRealityToProjection:
    'De la realidad a la proyección: Equilibrio parte desde tu realidad actual, te deja proyectar cuánto quieres ganar mes a mes y calcula cuántos productos o servicios debes vender para lograrlo.',
  breakevenClosingQuote: 'Conocer tus números no limita tu creatividad: la libera.',
  equilibrioEyebrow: 'Nuestro primer producto',
  equilibrioTitle: 'Equilibrio',
  equilibrioSubtitle:
    'La base numérica de tu pyme en un panel claro, simple y cercano. Úsalo desde el computador o el celular.',
  equilibrioFeatures: [
    'Encuentra tu punto de equilibrio sin fórmulas complicadas.',
    'Registra tus costos fijos, costos variables y tus productos o servicios.',
    'Define cuánto quieres ganar y descubre cuántos productos o servicios debes vender.',
    'Proyecta mes a mes y compara tus metas frente a tus ingresos y egresos reales.',
    'Visualiza todo en un panel claro, desde el celular o el computador.',
  ].join('\n'),
  equilibrioCtaLabel: 'Suscribirme ($5.990 / mes)',
  equilibrioTrustNote:
    'Pago seguro vía Mercado Pago ($5.990/mes o $50.000/año por 12 meses). Al cumplirse tu ciclo mensual o anual, la página pausa el acceso hasta que renueves mensual o anual con tu link de pago.',
  upcomingEyebrow: 'Próximamente',
  upcomingTitle: 'Equilibrio es el primer paso',
  upcomingSubtitle:
    'Estamos creando más herramientas para potenciar tu pyme con innovación, creatividad y automatización.',
  creatorEyebrow: 'Quién está detrás de Growy',
  creatorTitle: 'Contabilidad para entender el esqueleto; creatividad para impulsar la idea.',
  creatorName: 'José Ignacia',
  creatorRole: 'Contador auditor · Creador de Growy',
  creatorPhotoUrl: '',
  creatorBio:
    'Growy fue creado por José Ignacia, contador auditor especializado en innovación y automatización de procesos.\n\nEstudió contabilidad y auditoría para conocer el esqueleto y el sistema nervioso de una empresa, pero el motor siempre ha sido la innovación y la creatividad: eso es lo que lo motiva a hacer crecer una pyme.\n\nCon Growy quiere hacer crecer a las pymes a través de la innovación y la creatividad, pero primero afirmándose en los números. Growy es un potenciador de tus ideas, nunca un reemplazo ni un gerente.',
  creatorClosingNote: 'Hecho en Chile para emprendedores y pymes que quieren crecer con claridad.',
  creatorQuoteCta: 'Conocer la historia',
  closingTitle: 'Dale bases firmes a lo que estás imaginando.',
  closingSubtitle:
    'Empieza hoy con Equilibrio y transforma tus cifras en tranquilidad para crear.',
  closingCtaLabel: 'Conocer Equilibrio',
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  paymentUrl: DEFAULT_MERCADOPAGO_URL,
  annualPaymentUrl: DEFAULT_ANNUAL_MERCADOPAGO_URL,
  priceLabel: MONTHLY_PRICE_LABEL,
  currencyNote: 'O $50.000 / año (12 meses · ahorras $21.880)',
  heroTitle: 'La creatividad *sueña*, los números la sostienen.',
  heroSubtitle:
    'Growy te explica tus cifras de forma simple, para que te dediques a hacer crecer lo que imaginas.',
  guaranteeText:
    'Elige $5.990/mes o $50.000/año (12 meses) en Mercado Pago. Al vencer el mes o el año, el acceso se pausa hasta renovar con tu link de pago.',
  contactEmail: BOOTSTRAPPED_ADMIN_EMAIL,
  welcomeMessage:
    'Bienvenido a Growy. Activa tu acceso a Equilibrio eligiendo tu plan mensual ($5.990/mes) o anual ($50.000/año) o ingresando tu código.',
  announcementText: '',
  announcementActive: false,
  landingContent: DEFAULT_LANDING_CONTENT,
};

export const DEFAULT_FAQS: Array<Omit<FaqItem, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'faq-que-es-growy',
    question: '¿Qué es Growy?',
    answer:
      'Growy es una plataforma de productos digitales para potenciar las ideas de tu pyme a través de la innovación, la creatividad y bases numéricas claras. No reemplaza tu liderazgo ni actúa como gerente: te da claridad simple para que tú hagas crecer tu negocio.',
    category: 'uso',
    order: 1,
    published: true,
  },
  {
    id: 'faq-punto-equilibrio',
    question: '¿Qué es el punto de equilibrio en palabras simples?',
    answer:
      'Es la cantidad mínima de ventas que tu pyme necesita al mes para cubrir todos sus costos fijos y variables sin perder dinero. En ese punto no ganas ni pierdes; desde la venta siguiente empieza tu ganancia real.',
    category: 'calculos',
    order: 2,
    published: true,
  },
  {
    id: 'faq-para-quien-equilibrio',
    question: '¿Para quién es Equilibrio?',
    answer:
      'Para emprendedores, talleres creativos, comercios y pymes de productos o servicios que quieren dejar de fijar precios o metas al azar y necesitan ver con claridad cuánto deben vender cada mes para cubrir costos y alcanzar su meta de ganancia.',
    category: 'uso',
    order: 3,
    published: true,
  },
  {
    id: 'faq-sin-conocimientos',
    question: '¿Necesito saber de finanzas o contabilidad para usarlo?',
    answer:
      'No. Equilibrio explica todo en palabras cotidianas, sin jerga financiera. Solo ingresas tus costos fijos, cuánto cuesta producir o entregar lo que vendes y tu precio de venta: la herramienta calcula el resto paso a paso.',
    category: 'calculos',
    order: 4,
    published: true,
  },
  {
    id: 'faq-pago-unico',
    question: '¿Cuánto cuesta Equilibrio y qué pasa cuando vence el mes o el año?',
    answer:
      'Puedes elegir Plan Mensual por $5.990 al mes (escogiendo fecha de pago los días 5, 15 o 30) o Plan Anual por $50.000 por 12 meses completos (ahorras $21.880 frente al valor mensual). Al cumplirse tu ciclo mensual o los 12 meses del plan anual, la página bloquea el acceso y te muestra los enlaces de pago de Mercado Pago para renovar en modalidad mensual o anual.',
    category: 'pagos',
    order: 5,
    published: true,
  },
  {
    id: 'faq-activacion-acceso',
    question: '¿Cómo accedo después de pagar?',
    answer:
      'Después de completar el pago en Mercado Pago, entra con tu cuenta de Google en Growy. Si necesitas activación manual, puedes ingresar tu código o adjuntar tu comprobante en el formulario de contacto para habilitarte de inmediato.',
    category: 'pagos',
    order: 6,
    published: true,
  },
  {
    id: 'faq-instalar-app',
    question: '¿Funciona en el celular y el computador?',
    answer:
      'Sí. Puedes usar Equilibrio directamente desde el navegador en tu computador o celular, y también instalarlo como aplicación en Android, iPhone o escritorio para tenerlo siempre a mano.',
    category: 'uso',
    order: 7,
    published: true,
  },
  {
    id: 'faq-soporte',
    question: '¿Cómo contacto a soporte?',
    answer:
      'Puedes escribirnos directamente desde el formulario de contacto al final de la página o desde tu cuenta. Tu mensaje llega directo a José Ignacia (jose.growy@gmail.com).',
    category: 'soporte',
    order: 8,
    published: true,
  },
];

// Sanitización defensiva acorde a firebase-blueprint.json
function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

const LEGACY_HERO_TITLES = new Set([
  'Impulso el crecimiento de tu negocio con números claros',
  'Growy, el puente entre tu idea y tu pyme.',
]);

function migrateLandingContent(raw?: Partial<LandingContentConfig>): Partial<LandingContentConfig> {
  if (!raw) return {};
  const next: Partial<LandingContentConfig> = { ...raw };
  if (raw.creatorName === 'José Ignacio Acuña') {
    next.creatorName = DEFAULT_LANDING_CONTENT.creatorName;
  }
  if (raw.creatorBio?.includes('José Ignacio Acuña')) {
    next.creatorBio = raw.creatorBio.replace(/José Ignacio Acuña/g, 'José Ignacia');
  }
  if (raw.heroEyebrow === 'Growy · Herramientas digitales para pymes') {
    next.heroEyebrow = DEFAULT_LANDING_CONTENT.heroEyebrow;
  }
  if (raw.creatorRole === 'Contador Auditor · Especialista en innovación y automatización de procesos') {
    next.creatorRole = DEFAULT_LANDING_CONTENT.creatorRole;
  }
  return next;
}

/**
 * Suscribirse a la configuración pública (/appConfig/public)
 */
export function subscribeAppConfig(onUpdate: (config: AppConfig) => void): () => void {
  const ref = doc(db, 'appConfig', 'public');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const remote = snap.data() as AppConfig;
        const effectivePaymentUrl = isPlaceholderPaymentUrl(remote.paymentUrl)
          ? DEFAULT_APP_CONFIG.paymentUrl
          : remote.paymentUrl;
        const effectiveAnnualPaymentUrl =
          isPlaceholderPaymentUrl(remote.annualPaymentUrl) ||
          remote.annualPaymentUrl === DEFAULT_MERCADOPAGO_URL
            ? DEFAULT_ANNUAL_MERCADOPAGO_URL
            : remote.annualPaymentUrl;

        const isOldHero = LEGACY_HERO_TITLES.has(remote.heroTitle ?? '');

        const isErroneousOneTimePricing =
          remote.priceLabel === '$29 USD' ||
          remote.priceLabel === '$50.000 CLP' ||
          (remote.currencyNote ?? '').toLowerCase().includes('sin mensualidades') ||
          (remote.currencyNote ?? '').toLowerCase().includes('pago único');

        const migratedLanding = migrateLandingContent(remote.landingContent);
        if (
          !migratedLanding.equilibrioTrustNote ||
          migratedLanding.equilibrioTrustNote ===
            'Pago seguro vía Mercado Pago. Al completar tu compra, activas tu acceso ingresando con Google o enviando tu comprobante desde soporte para habilitarlo de inmediato.'
        ) {
          migratedLanding.equilibrioTrustNote = DEFAULT_LANDING_CONTENT.equilibrioTrustNote;
        }
        if (migratedLanding.equilibrioCtaLabel === 'Comprar acceso') {
          migratedLanding.equilibrioCtaLabel = DEFAULT_LANDING_CONTENT.equilibrioCtaLabel;
        }

        onUpdate({
          ...DEFAULT_APP_CONFIG,
          ...remote,
          heroTitle: isOldHero
            ? DEFAULT_APP_CONFIG.heroTitle
            : remote.heroTitle || DEFAULT_APP_CONFIG.heroTitle,
          heroSubtitle: isOldHero
            ? DEFAULT_APP_CONFIG.heroSubtitle
            : remote.heroSubtitle || DEFAULT_APP_CONFIG.heroSubtitle,
          priceLabel: isErroneousOneTimePricing
            ? DEFAULT_APP_CONFIG.priceLabel
            : remote.priceLabel || DEFAULT_APP_CONFIG.priceLabel,
          currencyNote: isErroneousOneTimePricing
            ? DEFAULT_APP_CONFIG.currencyNote
            : remote.currencyNote || DEFAULT_APP_CONFIG.currencyNote,
          paymentUrl: effectivePaymentUrl,
          annualPaymentUrl: effectiveAnnualPaymentUrl,
          landingContent: {
            ...DEFAULT_LANDING_CONTENT,
            ...migratedLanding,
          },
        });
      } else {
        onUpdate(DEFAULT_APP_CONFIG);
      }
    },
    (err) => {
      console.warn('No se pudo leer appConfig remoto, usando valores base:', err);
      onUpdate(DEFAULT_APP_CONFIG);
    }
  );
}

/**
 * Inicializar y migrar documentos base (appConfig/public y FAQs actualizadas)
 */
export async function ensureAdminSeedDefaults(): Promise<void> {
  try {
    const configRef = doc(db, 'appConfig', 'public');
    const configSnap = await getDoc(configRef);
    if (!configSnap.exists()) {
      await setDoc(configRef, {
        ...DEFAULT_APP_CONFIG,
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = configSnap.data() as Partial<AppConfig>;
      const patch: Partial<AppConfig> = {};
      if (data.contactEmail === 'soporte@growy.app') {
        patch.contactEmail = BOOTSTRAPPED_ADMIN_EMAIL;
      }
      if (LEGACY_HERO_TITLES.has(data.heroTitle ?? '')) {
        patch.heroTitle = DEFAULT_APP_CONFIG.heroTitle;
        patch.heroSubtitle = DEFAULT_APP_CONFIG.heroSubtitle;
      }
      if (
        data.priceLabel === '$29 USD' ||
        data.priceLabel === '$50.000 CLP' ||
        (data.currencyNote ?? '').toLowerCase().includes('sin mensualidades') ||
        (data.currencyNote ?? '').toLowerCase().includes('pago único')
      ) {
        patch.priceLabel = DEFAULT_APP_CONFIG.priceLabel;
        patch.currencyNote = DEFAULT_APP_CONFIG.currencyNote;
        patch.guaranteeText = DEFAULT_APP_CONFIG.guaranteeText;
        patch.welcomeMessage = DEFAULT_APP_CONFIG.welcomeMessage;
      }
      const migratedLanding = migrateLandingContent(data.landingContent);
      if (
        !data.landingContent ||
        data.landingContent.creatorName === 'José Ignacio Acuña' ||
        data.landingContent.creatorBio?.includes('José Ignacio Acuña') ||
        !data.landingContent.step1Title ||
        data.landingContent.equilibrioCtaLabel === 'Comprar acceso' ||
        data.landingContent.equilibrioTrustNote ===
          'Pago seguro vía Mercado Pago. Al completar tu compra, activas tu acceso ingresando con Google o enviando tu comprobante desde soporte para habilitarlo de inmediato.'
      ) {
        if (
          !migratedLanding.equilibrioTrustNote ||
          migratedLanding.equilibrioTrustNote ===
            'Pago seguro vía Mercado Pago. Al completar tu compra, activas tu acceso ingresando con Google o enviando tu comprobante desde soporte para habilitarlo de inmediato.'
        ) {
          migratedLanding.equilibrioTrustNote = DEFAULT_LANDING_CONTENT.equilibrioTrustNote;
        }
        if (migratedLanding.equilibrioCtaLabel === 'Comprar acceso') {
          migratedLanding.equilibrioCtaLabel = DEFAULT_LANDING_CONTENT.equilibrioCtaLabel;
        }
        patch.landingContent = {
          ...DEFAULT_LANDING_CONTENT,
          ...migratedLanding,
        };
      }
      if (isPlaceholderPaymentUrl(data.paymentUrl)) {
        patch.paymentUrl = DEFAULT_APP_CONFIG.paymentUrl;
      }
      if (isPlaceholderPaymentUrl(data.annualPaymentUrl)) {
        patch.annualPaymentUrl = DEFAULT_APP_CONFIG.annualPaymentUrl;
      }
      if (Object.keys(patch).length > 0) {
        await updateDoc(configRef, {
          ...patch,
          updatedAt: serverTimestamp(),
        });
      }
    }

    const faqsSnap = await getDocs(collection(db, 'faqs'));
    if (faqsSnap.empty) {
      const batch = writeBatch(db);
      for (const faq of DEFAULT_FAQS) {
        const faqRef = doc(db, 'faqs', faq.id);
        batch.set(faqRef, {
          question: faq.question,
          answer: faq.answer,
          category: faq.category,
          order: faq.order,
          published: faq.published,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } else {
      const hasLegacyMensualFaq = faqsSnap.docs.some((d) => d.id === 'faq-pago-mensual');
      const supportFaq = faqsSnap.docs.find((d) => d.id === 'faq-soporte');
      const paymentFaq = faqsSnap.docs.find((d) => d.id === 'faq-pago-unico');
      const hasLegacyCreatorInFaq =
        supportFaq && String(supportFaq.data().answer ?? '').includes('José Ignacio Acuña');
      const hasLegacyPaymentFaq =
        paymentFaq &&
        String(paymentFaq.data().answer ?? '').includes(
          'El valor y modalidad vigente aparecen indicados'
        );

      if (hasLegacyMensualFaq) {
        const batch = writeBatch(db);
        for (const legacyId of [
          'faq-pago-mensual',
          'faq-pago-anual',
          'faq-fechas-pago',
          'faq-activacion',
          'faq-codigo',
          'faq-equilibrio-mix',
          'faq-offline',
        ]) {
          if (faqsSnap.docs.some((d) => d.id === legacyId)) {
            batch.delete(doc(db, 'faqs', legacyId));
          }
        }
        for (const faq of DEFAULT_FAQS) {
          batch.set(doc(db, 'faqs', faq.id), {
            question: faq.question,
            answer: faq.answer,
            category: faq.category,
            order: faq.order,
            published: faq.published,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } else {
        if (hasLegacyCreatorInFaq && supportFaq) {
          await updateDoc(doc(db, 'faqs', 'faq-soporte'), {
            answer: String(supportFaq.data().answer).replace(/José Ignacio Acuña/g, 'José Ignacia'),
            updatedAt: serverTimestamp(),
          });
        }
        if (hasLegacyPaymentFaq) {
          const defaultPayFaq = DEFAULT_FAQS.find((f) => f.id === 'faq-pago-unico');
          if (defaultPayFaq) {
            await updateDoc(doc(db, 'faqs', 'faq-pago-unico'), {
              question: defaultPayFaq.question,
              answer: defaultPayFaq.answer,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Seed inicial admin omitido o ya existente:', err);
  }
}

/**
 * Obtiene o crea el perfil de usuario tras autenticarse con Google
 */
export async function ensureUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<UserProfile> {
  const userPath = `users/${params.uid}`;
  const userRef = doc(db, 'users', params.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const isBootAdmin =
    params.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
  const isComplimentaryClient =
    !isBootAdmin && isComplimentaryClientEmail(params.email);

  if (snap.exists()) {
    const existing = snap.data() as UserProfile;
    if (isBootAdmin) {
      const needsPromotion =
        existing.role !== 'admin' || existing.accessStatus !== 'active';
      try {
        if (needsPromotion) {
          await updateDoc(userRef, {
            role: 'admin',
            accessStatus: 'active',
            paymentStatus:
              existing.paymentStatus === 'unpaid'
                ? 'manual_admin'
                : existing.paymentStatus,
            updatedAt: serverTimestamp(),
          });
        }
        const adminRef = doc(db, 'admins', params.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: params.uid,
            email: clampStr(params.email, 160),
            grantedBy: 'bootstrap',
            createdAt: serverTimestamp(),
          });
        }
        if (needsPromotion) {
          const refreshed = await getDoc(userRef);
          return refreshed.data() as UserProfile;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    } else if (
      isComplimentaryClient &&
      (existing.accessStatus !== 'active' || existing.paymentStatus === 'unpaid')
    ) {
      try {
        await updateDoc(userRef, {
          accessStatus: 'active',
          paymentStatus:
            existing.paymentStatus === 'unpaid' ? 'manual_admin' : existing.paymentStatus,
          paymentReference: existing.paymentReference ?? 'cliente-prueba-sin-cobro',
          updatedAt: serverTimestamp(),
        });
        const refreshed = await getDoc(userRef);
        return refreshed.data() as UserProfile;
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, userPath);
      }
    }
    return existing;
  }

  const newProfile: Record<string, unknown> = {
    uid: params.uid,
    email: clampStr(params.email, 160),
    displayName: clampStr(params.displayName || params.email.split('@')[0], 100),
    role: (isBootAdmin ? 'admin' : 'user') as UserRole,
    accessStatus: (isBootAdmin || isComplimentaryClient ? 'active' : 'pending') as AccessStatus,
    paymentStatus: (isBootAdmin || isComplimentaryClient ? 'manual_admin' : 'unpaid') as PaymentStatus,
    onboardingCompleted: isBootAdmin,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isComplimentaryClient) {
    newProfile.paymentReference = 'cliente-prueba-sin-cobro';
  }

  try {
    await setDoc(userRef, newProfile);
    if (isBootAdmin) {
      await setDoc(doc(db, 'admins', params.uid), {
        uid: params.uid,
        email: newProfile.email,
        grantedBy: 'bootstrap',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, userPath);
  }

  const created = await getDoc(userRef);
  return created.data() as UserProfile;
}

export function subscribeUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onUpdate(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

/**
 * Guarda la preferencia de modalidad de plan elegida por el cliente (mensual o anual).
 */
export async function setUserPlanPreference(params: {
  profile: UserProfile;
  planType: PlanType;
}): Promise<void> {
  const path = `users/${params.profile.uid}`;
  try {
    await updateDoc(doc(db, 'users', params.profile.uid), {
      planType: params.planType,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Guarda la fecha de pago mensual elegida por el cliente (día 5, 15 o 30).
 */
export async function setUserBillingDay(params: {
  profile: UserProfile;
  billingDay: BillingDay;
}): Promise<void> {
  const path = `users/${params.profile.uid}`;
  const ref = doc(db, 'users', params.profile.uid);
  const updateData: Record<string, unknown> = {
    planType: 'monthly',
    billingDay: params.billingDay,
    updatedAt: serverTimestamp(),
  };

  if (params.profile.accessStatus === 'active' && !params.profile.nextPaymentDueAt) {
    updateData.nextPaymentDueAt = computeInitialNextDueDate(params.billingDay);
  }

  try {
    await updateDoc(ref, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Marca el tour guiado de bienvenida como completado o saltado para que no vuelva a abrirse automáticamente.
 */
export async function markUserOnboardingCompleted(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      onboardingCompleted: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Canje atómico de código de acceso o renovación (validado con getAfter en Firestore Rules)
 */
export async function redeemAccessCode(params: {
  uid: string;
  email: string;
  displayName?: string;
  rawCode: string;
  planType?: PlanType;
  billingDay?: BillingDay;
  currentDueAt?: string;
}): Promise<void> {
  const cleanCode = params.rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9\-]{4,40}$/.test(cleanCode)) {
    throw new Error('Formato de código inválido. Revisa letras, números y guiones.');
  }

  const codeRef = doc(db, 'accessCodes', cleanCode);
  let codeSnap;
  try {
    codeSnap = await getDoc(codeRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `accessCodes/${cleanCode}`);
  }

  if (!codeSnap.exists()) {
    throw new Error('Ese código no existe. Verifica que esté bien escrito.');
  }

  const codeData = codeSnap.data() as AccessCode;
  if (codeData.status !== 'unused') {
    throw new Error('Este código ya fue utilizado o revocado.');
  }

  const chosenPlan: PlanType = params.planType === 'annual' ? 'annual' : 'monthly';
  const effectiveBillingDay: BillingDay = params.billingDay ?? 5;
  const nextDue =
    chosenPlan === 'annual'
      ? computeAnnualDueDate(params.currentDueAt)
      : computeNextCycleDueDate(effectiveBillingDay, params.currentDueAt);
  const nowISO = new Date().toISOString();

  const batch = writeBatch(db);
  batch.update(codeRef, {
    status: 'used',
    usedByUid: params.uid,
    usedByEmail: clampStr(params.email, 160),
    usedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', params.uid), {
    accessStatus: 'active',
    paymentStatus: 'code_redeemed',
    planType: chosenPlan,
    accessCodeUsed: cleanCode,
    nextPaymentDueAt: nextDue,
    lastPaymentAt: nowISO,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `accessCodes/${cleanCode}`);
  }

  // Registrar en historial transparente y enviar comprobante al correo del usuario
  try {
    await recordPaymentAndSendReceipt({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName || params.email,
      planType: chosenPlan,
      amountClp: chosenPlan === 'annual' ? ANNUAL_PRICE_CLP : MONTHLY_PRICE_CLP,
      transactionId: cleanCode,
      paymentMethod: 'codigo_acceso',
      paidAt: nowISO,
      periodCoveredEnd: nextDue,
      notes: 'Activación mediante código único de acceso',
    });
  } catch {
    // No bloquear acceso si el envío/registro secundario falla
  }
}

export async function verifyMercadoPagoPayment(params: {
  paymentId: string;
  uid: string;
  email: string;
  planType?: PlanType;
  billingDay?: BillingDay;
}): Promise<{ verified: boolean; activated: boolean; planType?: PlanType; message: string }> {
  try {
    const res = await fetch('/api/payments/mercadopago-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as {
      verified?: boolean;
      activated?: boolean;
      planType?: PlanType;
      message?: string;
    };
    return {
      verified: Boolean(data.verified),
      activated: Boolean(data.activated),
      planType: data.planType,
      message:
        data.message ||
        'Recibimos el retorno de Mercado Pago. Si tu acceso no se habilita automáticamente en segundos, adjunta tu comprobante abajo.',
    };
  } catch {
    return {
      verified: false,
      activated: false,
      message:
        'No se pudo validar automáticamente en este momento. Adjunta tu comprobante abajo para activación inmediata.',
    };
  }
}

/**
 * Historial de pagos y envío de comprobantes por correo (/users/{uid}/paymentHistory)
 */
async function dispatchPaymentReceiptEmail(params: {
  email: string;
  displayName: string;
  planType: PlanType;
  amountClp: number;
  transactionId: string;
  paidAt: string;
  periodCoveredEnd: string;
  paymentMethod: PaymentMethodType;
  receiptNumber: string;
}): Promise<{
  emailed: boolean;
  receiptStatus: PaymentReceiptStatus;
  receiptNumber: string;
  sentAt?: string;
}> {
  try {
    const res = await fetch('/api/payments/send-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      return {
        emailed: false,
        receiptStatus: 'pendiente_envio',
        receiptNumber: params.receiptNumber,
      };
    }
    const data = (await res.json()) as {
      emailed?: boolean;
      receiptStatus?: PaymentReceiptStatus;
      receiptNumber?: string;
      sentAt?: string;
    };
    return {
      emailed: Boolean(data.emailed),
      receiptStatus: data.emailed
        ? 'enviado_correo'
        : data.receiptStatus || 'disponible_descarga',
      receiptNumber: data.receiptNumber || params.receiptNumber,
      sentAt: data.sentAt,
    };
  } catch {
    return {
      emailed: false,
      receiptStatus: 'disponible_descarga',
      receiptNumber: params.receiptNumber,
    };
  }
}

export async function recordPaymentAndSendReceipt(params: {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  planType: PlanType;
  amountClp: number;
  transactionId: string;
  paymentMethod: PaymentMethodType;
  paidAt?: string;
  periodCoveredEnd: string;
  notes?: string;
}): Promise<PaymentHistoryEntry> {
  const paidAt = params.paidAt || new Date().toISOString();
  const safeId = (
    params.id ||
    `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  )
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 128);
  const receiptNumber = buildReceiptNumber(params.transactionId, paidAt);
  const path = `users/${params.uid}/paymentHistory/${safeId}`;
  const ref = doc(db, `users/${params.uid}/paymentHistory`, safeId);

  // Evitar duplicar una misma transacción de Mercado Pago si ya fue registrada
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      return existingSnap.data() as PaymentHistoryEntry;
    }
  } catch {
    // Continuar con el flujo de escritura
  }

  const emailDispatch = await dispatchPaymentReceiptEmail({
    email: params.email,
    displayName: params.displayName,
    planType: params.planType,
    amountClp: params.amountClp,
    transactionId: params.transactionId,
    paidAt,
    periodCoveredEnd: params.periodCoveredEnd,
    paymentMethod: params.paymentMethod,
    receiptNumber,
  });

  const payload = JSON.parse(
    JSON.stringify({
      id: safeId,
      ownerUid: params.uid,
      planType: params.planType,
      amountClp: Math.max(0, Math.round(params.amountClp)),
      transactionId: clampStr(params.transactionId, 160),
      paymentMethod: params.paymentMethod,
      paidAt: clampStr(paidAt, 40),
      periodCoveredEnd: params.periodCoveredEnd,
      receiptStatus: emailDispatch.receiptStatus,
      receiptNumber: emailDispatch.receiptNumber,
      receiptSentTo: emailDispatch.emailed ? clampStr(params.email, 160) : undefined,
      receiptSentAt: emailDispatch.emailed ? emailDispatch.sentAt || new Date().toISOString() : undefined,
      notes: params.notes ? clampStr(params.notes, 400) : undefined,
    })
  );

  try {
    await setDoc(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return payload as PaymentHistoryEntry;
}

export async function resendPaymentReceiptEmail(
  user: UserProfile,
  entry: PaymentHistoryEntry
): Promise<{ emailed: boolean; receiptStatus: PaymentReceiptStatus; receiptNumber: string }> {
  const receiptNumber =
    entry.receiptNumber || buildReceiptNumber(entry.transactionId, entry.paidAt);
  const dispatch = await dispatchPaymentReceiptEmail({
    email: user.email,
    displayName: user.displayName,
    planType: entry.planType,
    amountClp: entry.amountClp,
    transactionId: entry.transactionId,
    paidAt: entry.paidAt,
    periodCoveredEnd: entry.periodCoveredEnd,
    paymentMethod: entry.paymentMethod,
    receiptNumber,
  });

  const path = `users/${user.uid}/paymentHistory/${entry.id}`;
  try {
    await updateDoc(doc(db, `users/${user.uid}/paymentHistory`, entry.id), {
      receiptStatus: dispatch.receiptStatus,
      receiptNumber: dispatch.receiptNumber,
      ...(dispatch.emailed
        ? {
            receiptSentTo: clampStr(user.email, 160),
            receiptSentAt: dispatch.sentAt || new Date().toISOString(),
          }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return {
    emailed: dispatch.emailed,
    receiptStatus: dispatch.receiptStatus,
    receiptNumber: dispatch.receiptNumber,
  };
}

export function subscribeUserPaymentHistory(
  uid: string,
  onUpdate: (entries: PaymentHistoryEntry[]) => void
): () => void {
  const path = `users/${uid}/paymentHistory`;
  const q = query(collection(db, path), orderBy('paidAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as PaymentHistoryEntry));
    },
    (err) => {
      console.warn('No se pudo leer historial de pagos:', err);
      onUpdate([]);
    }
  );
}

/**
 * Negocios privados del usuario (/users/{uid}/businesses/{bizId})
 */
export function subscribeUserBusinesses(
  uid: string,
  onUpdate: (businesses: BusinessWorkspace[]) => void
): () => void {
  const path = `users/${uid}/businesses`;
  const q = query(collection(db, path), orderBy('updatedAt', 'asc'));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const raw = d.data() as BusinessWorkspace;
        return {
          ...raw,
          updatedAt:
            typeof raw.updatedAt === 'string'
              ? raw.updatedAt
              : new Date().toISOString(),
        };
      });
      onUpdate(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function saveUserBusiness(
  uid: string,
  business: BusinessWorkspace,
  isNew = false
): Promise<void> {
  const path = `users/${uid}/businesses/${business.id}`;
  const ref = doc(db, `users/${uid}/businesses`, business.id);

  const sanitizedProducts = (business.products ?? []).slice(0, 200).map((product) => {
    const cleanItems = Array.isArray(product.supplyCostItems)
      ? product.supplyCostItems
          .slice(0, 50)
          .map((item, idx) => ({
            id: clampStr(item.id, 60) || `sup-${idx}`,
            name: clampStr(item.name, 80),
            amount: Math.max(0, Number(item.amount) || 0),
          }))
          .filter((item) => item.name.length > 0 || item.amount > 0)
      : undefined;

    return {
      ...product,
      name: clampStr(product.name, 120),
      category: clampStr(product.category, 80) || 'General',
      price: Math.max(0, Number(product.price) || 0),
      variableCost: Math.max(0, Number(product.variableCost) || 0),
      supplyCostItems: cleanItems && cleanItems.length > 0 ? cleanItems : undefined,
      trackInventory: product.trackInventory ? true : undefined,
      initialStock:
        product.initialStock !== undefined ? Math.max(0, Number(product.initialStock) || 0) : undefined,
      minStock:
        product.minStock !== undefined ? Math.max(0, Number(product.minStock) || 0) : undefined,
    };
  });

  const cleanReceivables = Array.isArray(business.receivables)
    ? business.receivables.slice(0, 200)
    : [];
  const cleanPayables = Array.isArray(business.payables)
    ? business.payables.slice(0, 200)
    : [];
  const cleanInventoryMovements = Array.isArray(business.inventoryMovements)
    ? business.inventoryMovements.slice(0, 400)
    : [];
  const cleanWorkingCapitalExtras = business.workingCapitalExtras
    ? {
        otherCurrentAssets: Math.max(0, Number(business.workingCapitalExtras.otherCurrentAssets) || 0),
        pendingTaxes: Math.max(0, Number(business.workingCapitalExtras.pendingTaxes) || 0),
        pendingPayroll: Math.max(0, Number(business.workingCapitalExtras.pendingPayroll) || 0),
        shortTermDebt: Math.max(0, Number(business.workingCapitalExtras.shortTermDebt) || 0),
        otherCurrentLiabilities: Math.max(
          0,
          Number(business.workingCapitalExtras.otherCurrentLiabilities) || 0
        ),
      }
    : undefined;

  // Eliminar propiedades undefined antes de enviar a Firestore
  const payload = JSON.parse(
    JSON.stringify({
      id: business.id,
      ownerUid: uid,
      name: clampStr(business.name || 'Mi Negocio', 120),
      tagline: clampStr(business.tagline, 200),
      currency: business.currency,
      startMonth: business.startMonth,
      targetProfit: Math.max(0, Number(business.targetProfit) || 0),
      expectedMonthlyUnits: Math.max(0, Number(business.expectedMonthlyUnits) || 0),
      monthlyGrowthPercent: Number(business.monthlyGrowthPercent) || 0,
      projectionMonthsCount: Math.max(12, Math.min(60, Number(business.projectionMonthsCount) || 12)),
      baseMonthlyUnitsByProduct: business.baseMonthlyUnitsByProduct ?? {},
      fixedCosts: (business.fixedCosts ?? []).slice(0, 100),
      products: sanitizedProducts,
      projectionOverrides: business.projectionOverrides ?? {},
      actuals: business.actuals ?? {},
      initialCashBalance: Number(business.initialCashBalance) || 0,
      cashBalanceConfigured: Boolean(business.cashBalanceConfigured),
      workingCapitalExtras: cleanWorkingCapitalExtras,
      receivables: cleanReceivables,
      payables: cleanPayables,
      inventoryMovements: cleanInventoryMovements,
      isDemo: Boolean(business.isDemo),
    })
  );

  try {
    if (isNew) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        await setDoc(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          ...payload,
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteUserBusiness(uid: string, businessId: string): Promise<void> {
  const path = `users/${uid}/businesses/${businessId}`;
  try {
    await deleteDoc(doc(db, `users/${uid}/businesses`, businessId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedDemoBusinessesForUser(uid: string): Promise<BusinessWorkspace[]> {
  const demos = createDemoBusinesses();
  for (const biz of demos) {
    await saveUserBusiness(uid, { ...biz, ownerUid: uid }, true);
  }
  return demos;
}

/**
 * Suscripciones Web Push por usuario/dispositivo para alertas antes del vencimiento
 */
export async function saveUserPushSubscription(
  uid: string,
  sub: Omit<PushSubscriptionRecord, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const safeId = sub.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const path = `users/${uid}/pushSubscriptions/${safeId}`;
  const ref = doc(db, `users/${uid}/pushSubscriptions`, safeId);
  const payload = JSON.parse(
    JSON.stringify({
      id: safeId,
      ownerUid: uid,
      endpoint: clampStr(sub.endpoint, 1200),
      keys: {
        p256dh: clampStr(sub.keys.p256dh, 300),
        auth: clampStr(sub.keys.auth, 150),
      },
      planType: sub.planType === 'annual' ? 'annual' : 'monthly',
      billingDay:
        sub.billingDay === 5 || sub.billingDay === 15 || sub.billingDay === 30
          ? sub.billingDay
          : undefined,
      nextPaymentDueAt:
        sub.nextPaymentDueAt && /^\d{4}-\d{2}-\d{2}$/.test(sub.nextPaymentDueAt)
          ? sub.nextPaymentDueAt
          : undefined,
      enabled: Boolean(sub.enabled),
      userAgent: sub.userAgent ? clampStr(sub.userAgent, 250) : undefined,
    })
  );

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserPushSubscription(uid: string, subscriptionId: string): Promise<void> {
  const safeId = subscriptionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const path = `users/${uid}/pushSubscriptions/${safeId}`;
  try {
    await deleteDoc(doc(db, `users/${uid}/pushSubscriptions`, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * FAQs públicas y de administrador
 */
export function subscribePublishedFaqs(onUpdate: (faqs: FaqItem[]) => void): () => void {
  const q = query(collection(db, 'faqs'), where('published', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onUpdate(DEFAULT_FAQS);
        return;
      }
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Omit<FaqItem, 'id'>), id: d.id }))
        .sort((a, b) => a.order - b.order);
      if (!list.some((item) => item.id === 'faq-instalar-app')) {
        const installDefault = DEFAULT_FAQS.find((f) => f.id === 'faq-instalar-app');
        if (installDefault) {
          list.push(installDefault);
          list.sort((a, b) => a.order - b.order);
        }
      }
      onUpdate(list);
    },
    (err) => {
      console.warn('Usando FAQs locales por defecto:', err);
      onUpdate(DEFAULT_FAQS);
    }
  );
}

export function subscribeAllFaqsAdmin(onUpdate: (faqs: FaqItem[]) => void): () => void {
  return onSnapshot(
    collection(db, 'faqs'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ ...(d.data() as Omit<FaqItem, 'id'>), id: d.id }))
        .sort((a, b) => a.order - b.order);
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'faqs')
  );
}

/**
 * Tickets de soporte (dudas, sugerencias y reportes de problema con adjuntos)
 */
export async function createSupportTicket(params: {
  userId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ticketType?: TicketType;
  attachments?: TicketAttachment[];
}): Promise<void> {
  const id = `tkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `supportTickets/${id}`;
  const ticketType: TicketType =
    params.ticketType === 'sugerencia'
      ? 'sugerencia'
      : params.ticketType === 'problema'
        ? 'problema'
        : 'duda';
  const cleanName = clampStr(params.name, 100);
  const cleanEmail = clampStr(params.email, 160);
  const cleanSubject = clampStr(params.subject, 160);
  const cleanMessage = clampStr(params.message, 2000);
  const cleanAttachments = Array.isArray(params.attachments)
    ? params.attachments
        .slice(0, 2)
        .filter((att) => att && typeof att.dataUrl === 'string' && att.dataUrl.length <= 400000)
        .map((att) => ({
          name: clampStr(att.name, 160) || 'documento',
          mimeType: clampStr(att.mimeType, 100) || 'application/octet-stream',
          sizeBytes: Math.max(0, Math.min(400000, Number(att.sizeBytes) || att.dataUrl.length)),
          dataUrl: att.dataUrl,
        }))
    : undefined;

  const ticketDoc: Record<string, unknown> = {
    userId: params.userId,
    name: cleanName,
    email: cleanEmail,
    subject: cleanSubject,
    message: cleanMessage,
    ticketType,
    status: 'nuevo',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (cleanAttachments && cleanAttachments.length > 0) {
    ticketDoc.attachments = cleanAttachments;
  }

  try {
    await setDoc(doc(db, 'supportTickets', id), ticketDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Notificación no bloqueante hacia servidor para reenvío al correo administrador (jose.growy@gmail.com)
  try {
    await fetch('/api/support/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: id,
        ticketType,
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        attachments: cleanAttachments ?? [],
      }),
    });
  } catch {
    // Si está offline o sin backend de correo, el ticket ya quedó guardado en Firestore para el Admin.
  }
}

export function subscribeUserTickets(
  uid: string,
  onUpdate: (tickets: SupportTicket[]) => void
): () => void {
  const q = query(collection(db, 'supportTickets'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Omit<SupportTicket, 'id'>), id: d.id }));
      onUpdate(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets')
  );
}

/**
 * ============================================================================
 * FUNCIONES EXCLUSIVAS DEL ADMINISTRADOR
 * ============================================================================
 */

export async function logAdminAction(params: {
  adminUid: string;
  adminEmail: string;
  action: string;
  target: string;
  details: string;
}): Promise<void> {
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await setDoc(doc(db, 'adminLogs', id), {
      adminUid: params.adminUid,
      adminEmail: clampStr(params.adminEmail, 160),
      action: clampStr(params.action, 120),
      target: clampStr(params.target, 160),
      details: clampStr(params.details, 400),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `adminLogs/${id}`);
  }
}

export function subscribeAllUsersAdmin(onUpdate: (users: UserProfile[]) => void): () => void {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as UserProfile));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users')
  );
}

export function subscribeAccessCodesAdmin(onUpdate: (codes: AccessCode[]) => void): () => void {
  return onSnapshot(
    collection(db, 'accessCodes'),
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as AccessCode));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'accessCodes')
  );
}

export function subscribeAllTicketsAdmin(onUpdate: (tickets: SupportTicket[]) => void): () => void {
  return onSnapshot(
    collection(db, 'supportTickets'),
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({ ...(d.data() as Omit<SupportTicket, 'id'>), id: d.id }))
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets')
  );
}

export function subscribeAdminLogs(onUpdate: (logs: AdminLogEntry[]) => void): () => void {
  return onSnapshot(
    collection(db, 'adminLogs'),
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({ ...(d.data() as Omit<AdminLogEntry, 'id'>), id: d.id }))
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'adminLogs')
  );
}

export async function adminUpdateUserAccess(params: {
  admin: UserProfile;
  targetUser: UserProfile;
  accessStatus: AccessStatus;
  paymentStatus: PaymentStatus;
  role: UserRole;
}): Promise<void> {
  const { admin, targetUser, accessStatus, paymentStatus, role } = params;
  const path = `users/${targetUser.uid}`;
  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      accessStatus,
      paymentStatus,
      role,
      updatedAt: serverTimestamp(),
    };
    if (accessStatus === 'active' && targetUser.billingDay && !targetUser.nextPaymentDueAt) {
      updatePayload.nextPaymentDueAt = computeInitialNextDueDate(targetUser.billingDay);
    }
    batch.update(doc(db, 'users', targetUser.uid), updatePayload);
    if (role === 'admin') {
      batch.set(doc(db, 'admins', targetUser.uid), {
        uid: targetUser.uid,
        email: targetUser.email,
        grantedBy: admin.uid,
        createdAt: serverTimestamp(),
      });
    } else if (targetUser.email.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
      batch.delete(doc(db, 'admins', targetUser.uid));
    }
    await batch.commit();
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Actualizar usuario',
      target: targetUser.email,
      details: `Acceso: ${accessStatus}, Pago: ${paymentStatus}, Rol: ${role}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRegisterMonthlyPayment(params: {
  admin: UserProfile;
  targetUser: UserProfile;
  paymentReference?: string;
  transactionId?: string;
}): Promise<{ nextDue: string; emailed: boolean }> {
  const { admin, targetUser, paymentReference } = params;
  const billingDay: BillingDay = targetUser.billingDay ?? 5;
  const nextDue = computeNextCycleDueDate(billingDay, targetUser.nextPaymentDueAt);
  const path = `users/${targetUser.uid}`;
  const paidAtISO = new Date().toISOString();
  const txId =
    clampStr(params.transactionId, 160) ||
    `MP-MES-${Date.now().toString(36).toUpperCase()}`;

  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      accessStatus: 'active',
      paymentStatus: 'paid',
      planType: 'monthly',
      billingDay,
      nextPaymentDueAt: nextDue,
      lastPaymentAt: paidAtISO,
      paymentReference: clampStr(paymentReference || `Mercado Pago $5.990 (${txId})`, 120),
      updatedAt: serverTimestamp(),
    });

    const historyEntry = await recordPaymentAndSendReceipt({
      uid: targetUser.uid,
      email: targetUser.email,
      displayName: targetUser.displayName,
      planType: 'monthly',
      amountClp: MONTHLY_PRICE_CLP,
      transactionId: txId,
      paymentMethod: params.transactionId ? 'mercadopago' : 'registro_admin',
      paidAt: paidAtISO,
      periodCoveredEnd: nextDue,
      notes: `Suscripción mensual (día ${billingDay}) · Tarifa por lanzamiento`,
    });

    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Registrar pago mensual ($5.990)',
      target: targetUser.email,
      details: `Día: ${billingDay} · Tx: ${txId} · Vence: ${nextDue}`,
    });
    return { nextDue, emailed: historyEntry.receiptStatus === 'enviado_correo' };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRegisterAnnualPayment(params: {
  admin: UserProfile;
  targetUser: UserProfile;
  paymentReference?: string;
  transactionId?: string;
}): Promise<{ nextDue: string; emailed: boolean }> {
  const { admin, targetUser, paymentReference } = params;
  const nextDue = computeAnnualDueDate(targetUser.nextPaymentDueAt);
  const path = `users/${targetUser.uid}`;
  const paidAtISO = new Date().toISOString();
  const txId =
    clampStr(params.transactionId, 160) ||
    `MP-ANUAL-${Date.now().toString(36).toUpperCase()}`;

  try {
    await updateDoc(doc(db, 'users', targetUser.uid), {
      accessStatus: 'active',
      paymentStatus: 'paid',
      planType: 'annual',
      nextPaymentDueAt: nextDue,
      lastPaymentAt: paidAtISO,
      paymentReference: clampStr(
        paymentReference || `Mercado Pago ${ANNUAL_PRICE_LABEL} (${txId})`,
        120
      ),
      updatedAt: serverTimestamp(),
    });

    const historyEntry = await recordPaymentAndSendReceipt({
      uid: targetUser.uid,
      email: targetUser.email,
      displayName: targetUser.displayName,
      planType: 'annual',
      amountClp: ANNUAL_PRICE_CLP,
      transactionId: txId,
      paymentMethod: params.transactionId ? 'mercadopago' : 'registro_admin',
      paidAt: paidAtISO,
      periodCoveredEnd: nextDue,
      notes: 'Plan Anual 12 meses (sin cobro mensual) · Tarifa por lanzamiento',
    });

    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Registrar pago anual ($50.000 · 12 meses)',
      target: targetUser.email,
      details: `Tx: ${txId} · Vigencia 12 meses · Vence: ${nextDue}`,
    });
    return { nextDue, emailed: historyEntry.receiptStatus === 'enviado_correo' };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteUser(admin: UserProfile, targetUser: UserProfile): Promise<void> {
  if (targetUser.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('No es posible eliminar la cuenta del administrador principal.');
  }
  try {
    await deleteDoc(doc(db, 'users', targetUser.uid));
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Eliminar cuenta',
      target: targetUser.email,
      details: `UID eliminado: ${targetUser.uid}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${targetUser.uid}`);
  }
}

export async function adminCreateAccessCode(params: {
  admin: UserProfile;
  note?: string;
}): Promise<string> {
  const randA = Math.random().toString(36).substring(2, 6).toUpperCase();
  const randB = Math.random().toString(36).substring(2, 6).toUpperCase();
  const code = `GROWY-${randA}-${randB}`;
  try {
    await setDoc(doc(db, 'accessCodes', code), {
      code,
      status: 'unused',
      note: clampStr(params.note || 'Acceso pago único', 160),
      createdBy: params.admin.uid,
      createdAt: serverTimestamp(),
    });
    await logAdminAction({
      adminUid: params.admin.uid,
      adminEmail: params.admin.email,
      action: 'Generar código',
      target: code,
      details: params.note || 'Código de acceso único creado',
    });
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `accessCodes/${code}`);
  }
}

export async function adminRevokeAccessCode(admin: UserProfile, code: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'accessCodes', code), {
      status: 'revoked',
    });
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Revocar código',
      target: code,
      details: 'Código marcado como revocado',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `accessCodes/${code}`);
  }
}

export async function adminSaveFaq(params: {
  admin: UserProfile;
  id?: string;
  question: string;
  answer: string;
  category: FaqCategory;
  order: number;
  published: boolean;
}): Promise<void> {
  const faqId = params.id ?? `faq-${Date.now()}`;
  const path = `faqs/${faqId}`;
  try {
    if (params.id) {
      await updateDoc(doc(db, 'faqs', faqId), {
        question: clampStr(params.question, 250),
        answer: clampStr(params.answer, 2000),
        category: params.category,
        order: Math.max(0, Number(params.order) || 0),
        published: params.published,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'faqs', faqId), {
        question: clampStr(params.question, 250),
        answer: clampStr(params.answer, 2000),
        category: params.category,
        order: Math.max(0, Number(params.order) || 0),
        published: params.published,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await logAdminAction({
      adminUid: params.admin.uid,
      adminEmail: params.admin.email,
      action: params.id ? 'Editar FAQ' : 'Crear FAQ',
      target: faqId,
      details: clampStr(params.question, 120),
    });
  } catch (error) {
    handleFirestoreError(error, params.id ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function adminDeleteFaq(admin: UserProfile, faq: FaqItem): Promise<void> {
  try {
    await deleteDoc(doc(db, 'faqs', faq.id));
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Eliminar FAQ',
      target: faq.id,
      details: clampStr(faq.question, 120),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `faqs/${faq.id}`);
  }
}

function sanitizeLandingContent(raw?: Partial<LandingContentConfig>): LandingContentConfig {
  const src = { ...DEFAULT_LANDING_CONTENT, ...(raw ?? {}) };
  return {
    heroEyebrow: clampStr(src.heroEyebrow, 140),
    heroPrimaryCta: clampStr(src.heroPrimaryCta, 80),
    heroChecks: clampStr(src.heroChecks, 300),
    step1Title: clampStr(src.step1Title, 100),
    step1Desc: clampStr(src.step1Desc, 240),
    step2Title: clampStr(src.step2Title, 100),
    step2Desc: clampStr(src.step2Desc, 240),
    step3Title: clampStr(src.step3Title, 100),
    step3Desc: clampStr(src.step3Desc, 240),
    whatIsEyebrow: clampStr(src.whatIsEyebrow, 140),
    whatIsTitle: clampStr(src.whatIsTitle, 220),
    whatIsBody: clampStr(src.whatIsBody, 900),
    whatIsPillar1Title: clampStr(src.whatIsPillar1Title, 140),
    whatIsPillar1Desc: clampStr(src.whatIsPillar1Desc, 400),
    whatIsPillar2Title: clampStr(src.whatIsPillar2Title, 140),
    whatIsPillar2Desc: clampStr(src.whatIsPillar2Desc, 400),
    breakevenEyebrow: clampStr(src.breakevenEyebrow, 140),
    breakevenTitle: clampStr(src.breakevenTitle, 220),
    breakevenDefinition: clampStr(src.breakevenDefinition, 700),
    breakevenImportanceTitle: clampStr(src.breakevenImportanceTitle, 180),
    breakevenImportancePoints: clampStr(src.breakevenImportancePoints, 900),
    breakevenPillarsTitle: clampStr(src.breakevenPillarsTitle, 180),
    breakevenFixedTitle: clampStr(src.breakevenFixedTitle, 100),
    breakevenFixedDesc: clampStr(src.breakevenFixedDesc, 350),
    breakevenVariableTitle: clampStr(src.breakevenVariableTitle, 100),
    breakevenVariableDesc: clampStr(src.breakevenVariableDesc, 350),
    breakevenPriceTitle: clampStr(src.breakevenPriceTitle, 100),
    breakevenPriceDesc: clampStr(src.breakevenPriceDesc, 350),
    breakevenExampleTitle: clampStr(src.breakevenExampleTitle, 180),
    breakevenExampleBody: clampStr(src.breakevenExampleBody, 700),
    breakevenRealityToProjection: clampStr(src.breakevenRealityToProjection, 700),
    breakevenClosingQuote: clampStr(src.breakevenClosingQuote, 240),
    equilibrioEyebrow: clampStr(src.equilibrioEyebrow, 140),
    equilibrioTitle: clampStr(src.equilibrioTitle, 220),
    equilibrioSubtitle: clampStr(src.equilibrioSubtitle, 600),
    equilibrioFeatures: clampStr(src.equilibrioFeatures, 1200),
    equilibrioCtaLabel: clampStr(src.equilibrioCtaLabel, 100),
    equilibrioTrustNote: clampStr(src.equilibrioTrustNote, 600),
    upcomingEyebrow: clampStr(src.upcomingEyebrow, 140),
    upcomingTitle: clampStr(src.upcomingTitle, 220),
    upcomingSubtitle: clampStr(src.upcomingSubtitle, 600),
    creatorEyebrow: clampStr(src.creatorEyebrow, 140),
    creatorTitle: clampStr(src.creatorTitle, 220),
    creatorName: clampStr(src.creatorName, 140),
    creatorRole: clampStr(src.creatorRole, 180),
    creatorPhotoUrl: clampStr(src.creatorPhotoUrl, 500),
    creatorBio: clampStr(src.creatorBio, 1400),
    creatorClosingNote: clampStr(src.creatorClosingNote, 350),
    creatorQuoteCta: clampStr(src.creatorQuoteCta, 80),
    closingTitle: clampStr(src.closingTitle, 220),
    closingSubtitle: clampStr(src.closingSubtitle, 600),
    closingCtaLabel: clampStr(src.closingCtaLabel, 100),
  };
}

export async function adminSaveAppConfig(admin: UserProfile, nextConfig: AppConfig): Promise<void> {
  try {
    await setDoc(doc(db, 'appConfig', 'public'), {
      paymentUrl: clampStr(nextConfig.paymentUrl, 500),
      annualPaymentUrl: clampStr(
        nextConfig.annualPaymentUrl || DEFAULT_ANNUAL_MERCADOPAGO_URL,
        500
      ),
      priceLabel: clampStr(nextConfig.priceLabel, 60),
      currencyNote: clampStr(nextConfig.currencyNote, 160),
      heroTitle: clampStr(nextConfig.heroTitle, 160),
      heroSubtitle: clampStr(nextConfig.heroSubtitle, 400),
      guaranteeText: clampStr(nextConfig.guaranteeText, 400),
      contactEmail: clampStr(nextConfig.contactEmail, 120),
      welcomeMessage: clampStr(nextConfig.welcomeMessage, 400),
      announcementText: clampStr(nextConfig.announcementText, 300),
      announcementActive: Boolean(nextConfig.announcementActive),
      landingContent: sanitizeLandingContent(nextConfig.landingContent),
      updatedAt: serverTimestamp(),
    });
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Actualizar configuración global',
      target: 'appConfig/public',
      details: `Precio: ${nextConfig.priceLabel} · Anuncio: ${nextConfig.announcementActive ? 'Activo' : 'Inactivo'}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'appConfig/public');
  }
}

export async function adminUpdateSupportTicket(params: {
  admin: UserProfile;
  ticket: SupportTicket;
  status: TicketStatus;
  adminReply: string;
}): Promise<void> {
  try {
    await updateDoc(doc(db, 'supportTickets', params.ticket.id), {
      status: params.status,
      adminReply: clampStr(params.adminReply, 2000),
      updatedAt: serverTimestamp(),
    });
    await logAdminAction({
      adminUid: params.admin.uid,
      adminEmail: params.admin.email,
      action: 'Responder soporte',
      target: params.ticket.email,
      details: `Ticket ${params.ticket.id} -> ${params.status}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `supportTickets/${params.ticket.id}`);
  }
}
