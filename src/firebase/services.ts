import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
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
  buildMonthlySummaryEmailPayload,
  buildReferralInviteCodeString,
  computeReferralBonusDueDate,
  REFERRAL_BONUS_DAYS,
} from '../finance/phase3Insights';
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
  AdminTrafficStats,
  AppConfig,
  BillingDay,
  BusinessWorkspace,
  ExcelOrderRecord,
  FaqCategory,
  FaqItem,
  FunnelEventRecord,
  FunnelStep,
  LandingContentConfig,
  MpSubscriptionStatus,
  PaymentHistoryEntry,
  PaymentMethodType,
  PaymentReceiptStatus,
  PaymentStatus,
  PlanType,
  PushSubscriptionRecord,
  SupportTicket,
  TestimonialItem,
  TicketAttachment,
  TicketStatus,
  TicketType,
  UserProfile,
  UserRole,
} from '../types/finance';
import { auth, db, handleFirestoreError, OperationType } from './client';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'jose.growy@gmail.com';

export const DEFAULT_MERCADOPAGO_URL =
  import.meta.env.VITE_MERCADOPAGO_PAYMENT_URL ||
  import.meta.env.VITE_PAYMENT_URL ||
  'https://mpago.la/1muS2bx';

export const DEFAULT_ANNUAL_MERCADOPAGO_URL =
  import.meta.env.VITE_MERCADOPAGO_ANNUAL_PAYMENT_URL ||
  'https://mpago.la/1htV6zn';

export const DEFAULT_MONTHLY_SUBSCRIPTION_URL =
  import.meta.env.VITE_MERCADOPAGO_MONTHLY_SUBSCRIPTION_URL ||
  'https://mpago.la/2feqLfB';

export const DEFAULT_ANNUAL_SUBSCRIPTION_URL =
  import.meta.env.VITE_MERCADOPAGO_ANNUAL_SUBSCRIPTION_URL ||
  'https://mpago.la/2CSA14N';

export const DEFAULT_EXCEL_MERCADOPAGO_URL =
  import.meta.env.VITE_MERCADOPAGO_EXCEL_PAYMENT_URL ||
  'https://mpago.la/2QPhp4N';

const LEGACY_MONTHLY_PAYMENT_URLS = new Set([
  'https://mpago.la/2WauQDR',
  'https://mpago.la/2JwG16F',
]);

const LEGACY_ANNUAL_PAYMENT_URLS = new Set([
  'https://mpago.la/2JwG16F',
  'https://mpago.la/2WauQDR',
]);

const LEGACY_EXCEL_PAYMENT_URLS = new Set([
  'https://mpago.la/2SUfb1A',
]);

function isPlaceholderPaymentUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.includes('tu-pasarela-de-pago.ejemplo') ||
    url.includes('tu-link-growy-5990')
  );
}

function isLegacyOrPlaceholderMonthlyUrl(url?: string): boolean {
  return isPlaceholderPaymentUrl(url) || LEGACY_MONTHLY_PAYMENT_URLS.has((url ?? '').trim());
}

function isLegacyOrPlaceholderAnnualUrl(url?: string): boolean {
  return isPlaceholderPaymentUrl(url) || LEGACY_ANNUAL_PAYMENT_URLS.has((url ?? '').trim());
}

function isLegacyOrPlaceholderExcelUrl(url?: string): boolean {
  return isPlaceholderPaymentUrl(url) || LEGACY_EXCEL_PAYMENT_URLS.has((url ?? '').trim());
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
    'Pago seguro vía Mercado Pago ($5.990/mes o $49.990/año por 12 meses). Al cumplirse tu ciclo mensual o anual, la página pausa el acceso hasta que renueves mensual o anual con tu link de pago.',
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
  painEyebrow: 'Lo que viven muchas pymes',
  painTitle: '¿Sabes si de verdad ganas con cada producto que vendes?',
  painPoints: [
    'Vendes harto todo el mes, pero al llegar al día 30 no sabes adónde se fue la plata.',
    'Fijas tus precios mirando a la competencia, sin saber si cubres tus insumos, envíos, comisiones ni tu propio sueldo.',
    'Las planillas de Excel se enredan o se rompen justo cuando necesitas tomar una decisión rápida.',
  ].join('\n'),
  priceComparisonText:
    'Por menos de lo que cuesta un café con pastel al mes ($5.990/mes, o ~$4.166/mes en el plan anual), ordenas los números de tu pyme todo el año.',
  privacyTitle: 'Tus datos son privados y solo tuyos',
  privacyBody:
    'Tu información se guarda aislada en tu cuenta personal sobre Google Cloud Firestore. Nunca te pedimos claves del banco, ni credenciales tributarias, ni acceso a tus cuentas corrientes. Tampoco vendemos ni compartimos tus cifras con terceros.',
  supportHumanTitle: 'Soporte humano cercano, sin bots fríos',
  supportHumanBody:
    'Detrás de GROWy hay personas reales que hablan en simple y conocen la realidad de emprender en Chile. Si te trabas cargando un costo o tienes dudas con tu comprobante, te ayudamos directo.',
  excelEyebrow: 'Opción inicial de pago único',
  excelTitle: 'Equilibrio Lite Excel',
  excelSubtitle:
    'Una planilla de Excel ordenada y pensada para emprendedores que quieren llevar los números de su negocio en su computador antes de dar el paso a la suscripción mensual.',
  excelAudienceText:
    'Pensada para quien hoy prefiere pagar una sola vez y anotar sus cifras paso a paso, sin mensualidades por ahora.',
  excelNonReplacementNotice:
    'Equilibrio Lite Excel no reemplaza la tecnología de GROWy. Al tomar Equilibrio tienes un analista financiero (el Analista PYME) que te explica tus cifras con palabras sencillas, y todo el proceso es mucho más automático.',
  excelBridgeQuote:
    'Empieza con lo básico; cuando quieras que los números se expliquen y se calculen solos, Equilibrio te espera',
  excelIncludesList: [
    'Inicio: guía rápida para partir ordenado sin perderte.',
    'Resumen: fotografía general con semáforos y gráficos.',
    'Mi negocio: datos base y orden mensual de tu emprendimiento.',
    'Costos fijos: arriendo, servicios, sueldos base y gastos del mes.',
    'Productos: registra hasta 10 productos con sus costos y márgenes.',
    'Punto de equilibrio: cuántas ventas necesitas para no perder.',
    'Ventas reales: seguimiento manual de lo que vas vendiendo.',
    'Caja: control simple de entradas y salidas de dinero.',
    'Cobrar y pagar: recordatorio de cuentas pendientes por cobrar y pagar.',
    'Siguiente paso: orientación clara cuando quieras pasar a Equilibrio.',
  ].join('\n'),
  excelCtaLabel: 'Quiero Equilibrio Lite Excel',
  excelSecondaryLabel: 'Conocer Equilibrio',
  excelTaxDisclaimer:
    'Las estimaciones tributarias de la planilla son referenciales y no reemplazan a un contador.',
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  paymentUrl: DEFAULT_MERCADOPAGO_URL,
  annualPaymentUrl: DEFAULT_ANNUAL_MERCADOPAGO_URL,
  monthlySubscriptionUrl: DEFAULT_MONTHLY_SUBSCRIPTION_URL,
  annualSubscriptionUrl: DEFAULT_ANNUAL_SUBSCRIPTION_URL,
  monthlyPriceClp: MONTHLY_PRICE_CLP,
  annualPriceClp: ANNUAL_PRICE_CLP,
  mpRecurringEnabled: true,
  priceLabel: MONTHLY_PRICE_LABEL,
  currencyNote: 'O $49.990 / año (12 meses · ahorras $21.890)',
  heroTitle: 'La creatividad *sueña*, los números la sostienen.',
  heroSubtitle:
    'Growy te explica tus cifras de forma simple, para que te dediques a hacer crecer lo que imaginas.',
  guaranteeText:
    'Elige $5.990/mes o $49.990/año (12 meses) en Mercado Pago. Al vencer el mes o el año, el acceso se pausa hasta renovar con tu link de pago.',
  refundGuaranteeText:
    'Garantía de tranquilidad: si pruebas Equilibrio durante tus primeros 7 días y sientes que no te da claridad, escríbenos y te devolvemos el 100% de tu pago.',
  whatsappUrl: '',
  testimonials: [],
  contactEmail: BOOTSTRAPPED_ADMIN_EMAIL,
  welcomeMessage:
    'Bienvenido a Growy. Activa tu acceso a Equilibrio eligiendo tu plan mensual ($5.990/mes) o anual ($49.990/año) o ingresando tu código.',
  announcementText: '',
  announcementActive: false,
  excelProductName: 'Equilibrio Lite Excel',
  excelPriceLabel: '$4.990 CLP',
  excelPriceAmount: 4990,
  excelPaymentUrl: DEFAULT_EXCEL_MERCADOPAGO_URL,
  excelActive: true,
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
      'Puedes elegir Plan Mensual por $5.990 al mes (escogiendo fecha de pago los días 5, 15 o 30) o Plan Anual por $49.990 por 12 meses completos (ahorras $21.890 frente al valor mensual). Al cumplirse tu ciclo mensual o los 12 meses del plan anual, la página bloquea el acceso y te muestra los enlaces de pago de Mercado Pago para renovar en modalidad mensual o anual.',
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
  {
    id: 'faq-excel-que-incluye',
    question: '¿Qué incluye Equilibrio Lite Excel?',
    answer:
      'Incluye una planilla de Excel con 10 hojas ordenadas (Inicio, Resumen, Mi negocio, Costos fijos, Productos para hasta 10 productos, Punto de equilibrio, Ventas reales, Caja, Cobrar y pagar, y Siguiente paso), además de semáforos visuales y gráficos. Las estimaciones tributarias que incluye son referenciales y no reemplazan a un contador. Equilibrio Lite Excel no reemplaza la tecnología de GROWy ni al Analista PYME de Equilibrio.',
    category: 'cuenta',
    order: 9,
    published: true,
  },
  {
    id: 'faq-excel-como-recibo',
    question: '¿Cómo recibo Equilibrio Lite Excel después de pagar?',
    answer:
      'Apenas Mercado Pago aprueba tu pago único, nuestro servidor genera tu copia personalizada con tu nombre e ID de licencia único y te la envía automáticamente como archivo adjunto al correo electrónico que ingresaste al comprar. Si no ves el correo en unos minutos, revisa spam o escríbenos a jose.growy@gmail.com.',
    category: 'pagos',
    order: 10,
    published: true,
  },
  {
    id: 'faq-excel-requisitos',
    question: '¿Necesito tener Microsoft Excel instalado para usarla?',
    answer:
      'La planilla está optimizada para Microsoft Excel en computador (Windows o Mac), donde los gráficos, semáforos y protecciones de fórmulas funcionan completos. También puedes abrirla en Google Sheets o en el celular, considerando que algunas funciones visuales y formatos avanzados de Excel pueden verse con limitaciones.',
    category: 'cuenta',
    order: 11,
    published: true,
  },
  {
    id: 'faq-excel-licencia',
    question: '¿Qué significa que Equilibrio Lite Excel tiene licencia personal?',
    answer:
      'Cada compra entrega una licencia personal e intransferible para uso exclusivo de tu propio emprendimiento. Cada archivo generado lleva tu nombre completo y un código único (ej. GROWY-XXXXXXXX), y no está permitida su copia, distribución ni reventa a terceros.',
    category: 'pagos',
    order: 12,
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
  if (raw.equilibrioTrustNote?.includes('$50.000')) {
    next.equilibrioTrustNote = raw.equilibrioTrustNote.replace(/\$50\.000/g, '$49.990');
  }
  if (raw.priceComparisonText?.includes('$4.167')) {
    next.priceComparisonText = raw.priceComparisonText.replace(/\$4\.167/g, '$4.166');
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
        const effectivePaymentUrl = isLegacyOrPlaceholderMonthlyUrl(remote.paymentUrl)
          ? DEFAULT_APP_CONFIG.paymentUrl
          : remote.paymentUrl;
        const effectiveAnnualPaymentUrl =
          isLegacyOrPlaceholderAnnualUrl(remote.annualPaymentUrl) ||
          remote.annualPaymentUrl === DEFAULT_MERCADOPAGO_URL
            ? DEFAULT_ANNUAL_MERCADOPAGO_URL
            : remote.annualPaymentUrl;

        const isOldHero = LEGACY_HERO_TITLES.has(remote.heroTitle ?? '');

        const isErroneousOneTimePricing =
          remote.priceLabel === '$29 USD' ||
          remote.priceLabel === '$50.000 CLP' ||
          (remote.currencyNote ?? '').toLowerCase().includes('sin mensualidades') ||
          (remote.currencyNote ?? '').toLowerCase().includes('pago único');

        const isLegacyAnnualAmount = remote.annualPriceClp === 50000;

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

        const effectiveCurrencyNote = isErroneousOneTimePricing
          ? DEFAULT_APP_CONFIG.currencyNote
          : (remote.currencyNote || DEFAULT_APP_CONFIG.currencyNote)
              .replace(/\$50\.000/g, '$49.990')
              .replace(/\$21\.880/g, '$21.890');
        const effectiveGuaranteeText = (remote.guaranteeText || DEFAULT_APP_CONFIG.guaranteeText)
          .replace(/\$50\.000/g, '$49.990')
          .replace(/\$21\.880/g, '$21.890');
        const effectiveWelcomeMessage = (remote.welcomeMessage || DEFAULT_APP_CONFIG.welcomeMessage)
          .replace(/\$50\.000/g, '$49.990');

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
          currencyNote: effectiveCurrencyNote,
          guaranteeText: effectiveGuaranteeText,
          welcomeMessage: effectiveWelcomeMessage,
          paymentUrl: effectivePaymentUrl,
          annualPaymentUrl: effectiveAnnualPaymentUrl,
          monthlySubscriptionUrl:
            remote.monthlySubscriptionUrl && !isPlaceholderPaymentUrl(remote.monthlySubscriptionUrl)
              ? remote.monthlySubscriptionUrl
              : DEFAULT_MONTHLY_SUBSCRIPTION_URL,
          annualSubscriptionUrl:
            remote.annualSubscriptionUrl && !isPlaceholderPaymentUrl(remote.annualSubscriptionUrl)
              ? remote.annualSubscriptionUrl
              : DEFAULT_ANNUAL_SUBSCRIPTION_URL,
          monthlyPriceClp:
            typeof remote.monthlyPriceClp === 'number' && remote.monthlyPriceClp > 0
              ? Math.round(remote.monthlyPriceClp)
              : MONTHLY_PRICE_CLP,
          annualPriceClp:
            typeof remote.annualPriceClp === 'number' &&
            remote.annualPriceClp > 0 &&
            !isLegacyAnnualAmount
              ? Math.round(remote.annualPriceClp)
              : ANNUAL_PRICE_CLP,
          mpRecurringEnabled: remote.mpRecurringEnabled !== false,
          excelProductName:
            remote.excelProductName || DEFAULT_APP_CONFIG.excelProductName,
          excelPriceLabel:
            remote.excelPriceLabel || DEFAULT_APP_CONFIG.excelPriceLabel,
          excelPriceAmount:
            typeof remote.excelPriceAmount === 'number' && remote.excelPriceAmount > 0
              ? Math.round(remote.excelPriceAmount)
              : DEFAULT_APP_CONFIG.excelPriceAmount,
          excelPaymentUrl:
            remote.excelPaymentUrl && !isLegacyOrPlaceholderExcelUrl(remote.excelPaymentUrl)
              ? remote.excelPaymentUrl
              : DEFAULT_EXCEL_MERCADOPAGO_URL,
          excelActive: remote.excelActive !== false,
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
        data.landingContent.equilibrioTrustNote?.includes('$50.000') ||
        data.landingContent.priceComparisonText?.includes('$4.167') ||
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
      if (isLegacyOrPlaceholderMonthlyUrl(data.paymentUrl)) {
        patch.paymentUrl = DEFAULT_APP_CONFIG.paymentUrl;
      }
      if (isLegacyOrPlaceholderAnnualUrl(data.annualPaymentUrl)) {
        patch.annualPaymentUrl = DEFAULT_APP_CONFIG.annualPaymentUrl;
      }
      if (!data.monthlySubscriptionUrl || isPlaceholderPaymentUrl(data.monthlySubscriptionUrl)) {
        patch.monthlySubscriptionUrl = DEFAULT_MONTHLY_SUBSCRIPTION_URL;
      }
      if (!data.annualSubscriptionUrl || isPlaceholderPaymentUrl(data.annualSubscriptionUrl)) {
        patch.annualSubscriptionUrl = DEFAULT_ANNUAL_SUBSCRIPTION_URL;
      }
      if (data.annualPriceClp === 50000) {
        patch.annualPriceClp = ANNUAL_PRICE_CLP;
      }
      if (data.currencyNote?.includes('$50.000') || data.currencyNote?.includes('$21.880')) {
        patch.currencyNote = data.currencyNote
          .replace(/\$50\.000/g, '$49.990')
          .replace(/\$21\.880/g, '$21.890');
      }
      if (data.guaranteeText?.includes('$50.000') || data.guaranteeText?.includes('$21.880')) {
        patch.guaranteeText = data.guaranteeText
          .replace(/\$50\.000/g, '$49.990')
          .replace(/\$21\.880/g, '$21.890');
      }
      if (data.welcomeMessage?.includes('$50.000')) {
        patch.welcomeMessage = data.welcomeMessage.replace(/\$50\.000/g, '$49.990');
      }
      if (!data.excelPaymentUrl || isLegacyOrPlaceholderExcelUrl(data.excelPaymentUrl)) {
        patch.excelPaymentUrl = DEFAULT_EXCEL_MERCADOPAGO_URL;
      }
      if (!data.excelProductName) {
        patch.excelProductName = DEFAULT_APP_CONFIG.excelProductName;
      }
      if (!data.excelPriceLabel) {
        patch.excelPriceLabel = DEFAULT_APP_CONFIG.excelPriceLabel;
      }
      if (typeof data.excelPriceAmount !== 'number' || data.excelPriceAmount <= 0) {
        patch.excelPriceAmount = DEFAULT_APP_CONFIG.excelPriceAmount;
      }
      if (typeof data.excelActive !== 'boolean') {
        patch.excelActive = true;
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
        (String(paymentFaq.data().answer ?? '').includes(
          'El valor y modalidad vigente aparecen indicados'
        ) ||
          String(paymentFaq.data().answer ?? '').includes('$50.000'));

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
        const missingExcelFaqs = DEFAULT_FAQS.filter(
          (faq) =>
            faq.id.startsWith('faq-excel-') &&
            !faqsSnap.docs.some((d) => d.id === faq.id)
        );
        if (missingExcelFaqs.length > 0) {
          const batch = writeBatch(db);
          for (const faq of missingExcelFaqs) {
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

  const isReferral = codeData.codeKind === 'referral';
  if (isReferral) {
    throw new Error(
      'La promoción de códigos de referido ya no está vigente. Activa tu acceso eligiendo un plan o con un código oficial.'
    );
  }

  const chosenPlan: PlanType = params.planType === 'annual' ? 'annual' : 'monthly';
  const effectiveBillingDay: BillingDay = params.billingDay ?? 5;
  const nextDue = isReferral
    ? computeReferralBonusDueDate(params.currentDueAt, codeData.bonusDays ?? REFERRAL_BONUS_DAYS)
    : chosenPlan === 'annual'
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
    ...(isReferral ? { referredByCode: cleanCode } : {}),
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
      amountClp: isReferral
        ? 0
        : chosenPlan === 'annual'
          ? ANNUAL_PRICE_CLP
          : MONTHLY_PRICE_CLP,
      transactionId: cleanCode,
      paymentMethod: 'codigo_acceso',
      paidAt: nowISO,
      periodCoveredEnd: nextDue,
      notes: isReferral
        ? `Activación con código de referido (${codeData.bonusDays ?? REFERRAL_BONUS_DAYS} días gratis para tu pyme)`
        : 'Activación mediante código único de acceso',
    });
  } catch {
    // No bloquear acceso si el envío/registro secundario falla
  }
}

export async function verifyMercadoPagoPayment(params: {
  paymentId?: string;
  orderId?: string;
  uid: string;
  email: string;
  planType?: PlanType;
  billingDay?: BillingDay;
}): Promise<{
  verified: boolean;
  activated: boolean;
  planType?: PlanType;
  nextPaymentDueAt?: string;
  message: string;
}> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Continuar sin token si falla obtención puntual
    }

    const res = await fetch('/api/payments/mercadopago-verify', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    const data = (await res.json()) as {
      verified?: boolean;
      activated?: boolean;
      planType?: PlanType;
      nextPaymentDueAt?: string;
      message?: string;
    };
    return {
      verified: Boolean(data.verified),
      activated: Boolean(data.activated),
      planType: data.planType,
      nextPaymentDueAt: data.nextPaymentDueAt,
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

export async function createEquilibrioCheckoutSession(params: {
  profile: UserProfile;
  planType: PlanType;
  appConfig: AppConfig;
}): Promise<{
  ok: boolean;
  orderId?: string;
  checkoutUrl: string;
  mode: 'preference' | 'static_fallback';
  message: string;
}> {
  const fallbackUrl =
    params.planType === 'annual'
      ? params.appConfig.annualPaymentUrl || params.appConfig.paymentUrl
      : params.appConfig.paymentUrl;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/payments/equilibrio-checkout', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        planType: params.planType,
        billingDay: params.profile.billingDay,
      }),
    });
    if (!res.ok) {
      throw new Error('Checkout fallback');
    }
    const data = (await res.json()) as {
      ok?: boolean;
      orderId?: string;
      checkoutUrl?: string;
      mode?: 'preference' | 'static_fallback';
      message?: string;
    };
    if (data.ok && data.checkoutUrl) {
      return {
        ok: true,
        orderId: data.orderId,
        checkoutUrl: data.checkoutUrl,
        mode: data.mode || 'preference',
        message: data.message || 'Redirigiendo a Mercado Pago...',
      };
    }
  } catch {
    // Fallback al link oficial estático si el servidor o red no responden
  }

  return {
    ok: true,
    checkoutUrl: fallbackUrl,
    mode: 'static_fallback',
    message:
      'Abriendo el enlace oficial de Mercado Pago. Asegúrate de pagar con tu mismo correo de GROWy.',
  };
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
      personalTimeMinutes:
        product.personalTimeMinutes !== undefined && Number(product.personalTimeMinutes) > 0
          ? Math.min(100000, Math.max(0, Number(product.personalTimeMinutes) || 0))
          : undefined,
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

  const cleanIvaSettings = business.ivaSettings
    ? {
        enabled: business.ivaSettings.enabled ?? true,
        pricesIncludeIva: business.ivaSettings.pricesIncludeIva ?? true,
        f29Day: Math.max(1, Math.min(28, Math.round(Number(business.ivaSettings.f29Day) || 12))),
        ivaRatePercent: Math.max(
          0,
          Math.min(50, Number(business.ivaSettings.ivaRatePercent ?? 19) || 0)
        ),
      }
    : undefined;

  const cleanOwnerSalary = business.ownerSalary
    ? {
        included: Boolean(business.ownerSalary.included),
        monthlyAmount: Math.max(
          0,
          Math.min(1000000000, Number(business.ownerSalary.monthlyAmount) || 0)
        ),
      }
    : undefined;

  const cleanScenarioConfig = business.cashFlowScenarioConfig
    ? {
        optimisticInflowPct: Math.max(
          -80,
          Math.min(200, Number(business.cashFlowScenarioConfig.optimisticInflowPct ?? 15) || 0)
        ),
        optimisticOutflowPct: Math.max(
          -80,
          Math.min(200, Number(business.cashFlowScenarioConfig.optimisticOutflowPct ?? -5) || 0)
        ),
        pessimisticInflowPct: Math.max(
          -80,
          Math.min(200, Number(business.cashFlowScenarioConfig.pessimisticInflowPct ?? -15) || 0)
        ),
        pessimisticOutflowPct: Math.max(
          -80,
          Math.min(200, Number(business.cashFlowScenarioConfig.pessimisticOutflowPct ?? 10) || 0)
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
      ivaSettings: cleanIvaSettings,
      ownerSalary: cleanOwnerSalary,
      monthlyCloseChecklists: business.monthlyCloseChecklists,
      cashFlowScenarioConfig: cleanScenarioConfig,
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
      for (const defaultFaq of DEFAULT_FAQS) {
        if (
          (defaultFaq.id === 'faq-instalar-app' || defaultFaq.id.startsWith('faq-excel-')) &&
          !list.some((item) => item.id === defaultFaq.id)
        ) {
          list.push(defaultFaq);
        }
      }
      list.sort((a, b) => a.order - b.order);
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
      action: 'Registrar pago anual ($49.990 · 12 meses)',
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
    painEyebrow: clampStr(src.painEyebrow, 140),
    painTitle: clampStr(src.painTitle, 220),
    painPoints: clampStr(src.painPoints, 900),
    priceComparisonText: clampStr(src.priceComparisonText, 350),
    privacyTitle: clampStr(src.privacyTitle, 180),
    privacyBody: clampStr(src.privacyBody, 700),
    supportHumanTitle: clampStr(src.supportHumanTitle, 180),
    supportHumanBody: clampStr(src.supportHumanBody, 700),
    excelEyebrow: clampStr(src.excelEyebrow, 140),
    excelTitle: clampStr(src.excelTitle, 220),
    excelSubtitle: clampStr(src.excelSubtitle, 600),
    excelAudienceText: clampStr(src.excelAudienceText, 400),
    excelNonReplacementNotice: clampStr(src.excelNonReplacementNotice, 600),
    excelBridgeQuote: clampStr(src.excelBridgeQuote, 300),
    excelIncludesList: clampStr(src.excelIncludesList, 1000),
    excelCtaLabel: clampStr(src.excelCtaLabel, 100),
    excelSecondaryLabel: clampStr(src.excelSecondaryLabel, 100),
    excelTaxDisclaimer: clampStr(src.excelTaxDisclaimer, 400),
  };
}

function sanitizeTestimonials(raw?: TestimonialItem[]): TestimonialItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 8)
    .map((item, idx) => {
      const cleanId =
        clampStr(item?.id, 80).replace(/[^a-zA-Z0-9_-]/g, '') ||
        `testimonio-${Date.now()}-${idx}`;
      const cleanName = clampStr(item?.name, 100);
      const cleanBiz = clampStr(item?.businessName, 120);
      const cleanQuote = clampStr(item?.quote, 600);
      const cleanCity = clampStr(item?.city, 80);
      const cleanHighlight = clampStr(item?.resultHighlight, 140);
      const sanitized: TestimonialItem = {
        id: cleanId,
        name: cleanName,
        businessName: cleanBiz,
        quote: cleanQuote,
        permissionGranted: Boolean(item?.permissionGranted),
        ...(cleanCity ? { city: cleanCity } : {}),
        ...(cleanHighlight ? { resultHighlight: cleanHighlight } : {}),
      };
      return sanitized;
    })
    .filter(
      (item) =>
        item.name.length >= 1 &&
        item.businessName.length >= 1 &&
        item.quote.length >= 3
    );
}

export async function adminSaveAppConfig(admin: UserProfile, nextConfig: AppConfig): Promise<void> {
  try {
    const monthlyPriceClp =
      typeof nextConfig.monthlyPriceClp === 'number' && Number.isFinite(nextConfig.monthlyPriceClp) && nextConfig.monthlyPriceClp > 0
        ? Math.min(10000000, Math.round(nextConfig.monthlyPriceClp))
        : MONTHLY_PRICE_CLP;
    const annualPriceClp =
      typeof nextConfig.annualPriceClp === 'number' && Number.isFinite(nextConfig.annualPriceClp) && nextConfig.annualPriceClp > 0
        ? Math.min(100000000, Math.round(nextConfig.annualPriceClp))
        : ANNUAL_PRICE_CLP;

    const cleanWhatsapp = clampStr(nextConfig.whatsappUrl, 300);
    const cleanRefundGuarantee = clampStr(nextConfig.refundGuaranteeText, 500);
    const cleanTestimonials = sanitizeTestimonials(nextConfig.testimonials);
    const excelPriceAmount =
      typeof nextConfig.excelPriceAmount === 'number' &&
      Number.isFinite(nextConfig.excelPriceAmount) &&
      nextConfig.excelPriceAmount >= 0
        ? Math.min(10000000, Math.round(nextConfig.excelPriceAmount))
        : (DEFAULT_APP_CONFIG.excelPriceAmount ?? 4990);

    await setDoc(doc(db, 'appConfig', 'public'), {
      paymentUrl: clampStr(nextConfig.paymentUrl, 500),
      annualPaymentUrl: clampStr(
        nextConfig.annualPaymentUrl || DEFAULT_ANNUAL_MERCADOPAGO_URL,
        500
      ),
      monthlySubscriptionUrl: clampStr(
        nextConfig.monthlySubscriptionUrl || DEFAULT_MONTHLY_SUBSCRIPTION_URL,
        500
      ),
      annualSubscriptionUrl: clampStr(
        nextConfig.annualSubscriptionUrl || DEFAULT_ANNUAL_SUBSCRIPTION_URL,
        500
      ),
      monthlyPriceClp,
      annualPriceClp,
      mpRecurringEnabled: nextConfig.mpRecurringEnabled !== false,
      priceLabel: clampStr(nextConfig.priceLabel, 60),
      currencyNote: clampStr(nextConfig.currencyNote, 160),
      heroTitle: clampStr(nextConfig.heroTitle, 160),
      heroSubtitle: clampStr(nextConfig.heroSubtitle, 400),
      guaranteeText: clampStr(nextConfig.guaranteeText, 400),
      refundGuaranteeText: cleanRefundGuarantee,
      whatsappUrl: cleanWhatsapp,
      testimonials: cleanTestimonials,
      contactEmail: clampStr(nextConfig.contactEmail, 120),
      welcomeMessage: clampStr(nextConfig.welcomeMessage, 400),
      announcementText: clampStr(nextConfig.announcementText, 300),
      announcementActive: Boolean(nextConfig.announcementActive),
      excelProductName:
        clampStr(nextConfig.excelProductName, 120) || 'Equilibrio Lite Excel',
      excelPriceLabel:
        clampStr(nextConfig.excelPriceLabel, 60) || '$4.990 CLP',
      excelPriceAmount,
      excelPaymentUrl: clampStr(nextConfig.excelPaymentUrl, 500),
      excelActive: nextConfig.excelActive !== false,
      landingContent: sanitizeLandingContent(nextConfig.landingContent),
      updatedAt: serverTimestamp(),
    });
    await logAdminAction({
      adminUid: admin.uid,
      adminEmail: admin.email,
      action: 'Actualizar configuración global',
      target: 'appConfig/public',
      details: `Precio: ${nextConfig.priceLabel} (Mensual $${monthlyPriceClp} / Anual $${annualPriceClp}) · Excel: ${nextConfig.excelActive !== false ? nextConfig.excelPriceLabel : 'Oculto'} · Testimonios: ${cleanTestimonials.length}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'appConfig/public');
  }
}

export async function savePublicBreakEvenGuideLead(params: {
  email: string;
  fixedCosts?: number;
  variableCost?: number;
  unitPrice?: number;
  breakEvenUnits?: number;
  consentAccepted: boolean;
}): Promise<{ id: string; emailed: boolean }> {
  const cleanEmail = clampStr(params.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Ingresa un correo válido para enviarte la guía.');
  }
  if (!params.consentAccepted) {
    throw new Error('Marca la casilla de autorización para poder enviarte la guía.');
  }

  const leadId = `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `guideLeads/${leadId}`;
  const docPayload = JSON.parse(
    JSON.stringify({
      id: leadId,
      email: cleanEmail,
      fixedCosts:
        params.fixedCosts !== undefined && Number.isFinite(params.fixedCosts)
          ? Math.max(0, Math.min(10000000000, Math.round(params.fixedCosts)))
          : undefined,
      variableCost:
        params.variableCost !== undefined && Number.isFinite(params.variableCost)
          ? Math.max(0, Math.min(1000000000, Math.round(params.variableCost)))
          : undefined,
      unitPrice:
        params.unitPrice !== undefined && Number.isFinite(params.unitPrice)
          ? Math.max(0, Math.min(1000000000, Math.round(params.unitPrice)))
          : undefined,
      breakEvenUnits:
        params.breakEvenUnits !== undefined && Number.isFinite(params.breakEvenUnits)
          ? Math.max(0, Math.min(100000000, Math.round(params.breakEvenUnits)))
          : undefined,
      consentAccepted: true,
      source: 'landing_calculator',
    })
  );

  try {
    await setDoc(doc(db, 'guideLeads', leadId), {
      ...docPayload,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  let emailed = false;
  try {
    const res = await fetch('/api/public/breakeven-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docPayload),
    });
    if (res.ok) {
      const json = (await res.json()) as { emailed?: boolean };
      emailed = Boolean(json.emailed);
    }
  } catch {
    // El correo quedó registrado en Firestore aunque no haya Resend activo
  }

  return { id: leadId, emailed };
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

/* ============================================================================
 * FASE 3: CORREO MENSUAL RESEND, REFERIDOS Y SUSCRIPCIÓN RECURRENTE MERCADO PAGO
 * ============================================================================ */

export async function updateUserMonthlySummaryEmailPref(
  uid: string,
  enabled: boolean
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      monthlySummaryEmailEnabled: Boolean(enabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sendMonthlySummaryEmail(params: {
  profile: UserProfile;
  business: BusinessWorkspace;
  month: string;
}): Promise<{ ok: boolean; emailed: boolean; skipped?: boolean; message: string }> {
  const { profile, business, month } = params;
  if (profile.monthlySummaryEmailEnabled === false) {
    return {
      ok: true,
      emailed: false,
      skipped: true,
      message: 'Tienes desactivado el resumen mensual por correo en Configuración.',
    };
  }

  const summary = buildMonthlySummaryEmailPayload(business, month);
  try {
    const res = await fetch('/api/reports/send-monthly-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: profile.email,
        displayName: profile.displayName,
        emailOptOut: false,
        ...summary,
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      emailed?: boolean;
      skipped?: boolean;
      message?: string;
    };
    return {
      ok: Boolean(json.ok),
      emailed: Boolean(json.emailed),
      skipped: json.skipped,
      message:
        json.message ||
        (json.emailed
          ? `Enviamos tu resumen «Así te fue en este mes» (${summary.monthLabel}) a ${profile.email}.`
          : 'Preparamos el resumen de tu mes. Para enviarlo automáticamente por correo, configura RESEND_API_KEY en el servidor.'),
    };
  } catch {
    return {
      ok: false,
      emailed: false,
      message: 'No pudimos conectar con el servidor de correo en este momento.',
    };
  }
}

export async function createReferralInviteCode(params: {
  profile: UserProfile;
  note?: string;
}): Promise<string> {
  const code = buildReferralInviteCodeString(params.profile.uid);
  const path = `accessCodes/${code}`;
  try {
    await setDoc(doc(db, 'accessCodes', code), {
      code,
      status: 'unused',
      note: clampStr(
        params.note || `Invitación de ${params.profile.displayName || params.profile.email}`,
        160
      ),
      codeKind: 'referral',
      referrerUid: params.profile.uid,
      referrerEmail: clampStr(params.profile.email, 160),
      referrerDisplayName: clampStr(params.profile.displayName || params.profile.email, 100),
      bonusDays: REFERRAL_BONUS_DAYS,
      createdBy: params.profile.uid,
      createdAt: serverTimestamp(),
    });
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserReferralCodes(
  uid: string,
  onUpdate: (codes: AccessCode[]) => void
): () => void {
  const q = query(collection(db, 'accessCodes'), where('referrerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as AccessCode));
    },
    (err) => {
      console.warn('No se pudieron cargar códigos de referido:', err);
      onUpdate([]);
    }
  );
}

export async function adminGrantReferralBonus(params: {
  admin: UserProfile;
  codeDoc: AccessCode;
  referrerUser: UserProfile;
}): Promise<{ nextDue: string }> {
  const { admin, codeDoc, referrerUser } = params;
  if (codeDoc.status !== 'used' || codeDoc.codeKind !== 'referral') {
    throw new Error('Este código aún no ha sido canjeado como referido.');
  }
  if (codeDoc.referrerRewardApplied) {
    throw new Error('Este premio ya fue acreditado anteriormente.');
  }

  const bonusDays = codeDoc.bonusDays ?? REFERRAL_BONUS_DAYS;
  const nextDue = computeReferralBonusDueDate(referrerUser.nextPaymentDueAt, bonusDays);
  const nowISO = new Date().toISOString();

  const batch = writeBatch(db);
  batch.update(doc(db, 'accessCodes', codeDoc.code), {
    referrerRewardApplied: true,
    referrerRewardAppliedAt: nowISO,
  });
  batch.update(doc(db, 'users', referrerUser.uid), {
    nextPaymentDueAt: nextDue,
    referralMonthsEarned: (referrerUser.referralMonthsEarned ?? 0) + 1,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `accessCodes/${codeDoc.code}`);
  }

  try {
    await recordPaymentAndSendReceipt({
      id: `ref-${codeDoc.code.replace(/[^a-zA-Z0-9_-]/g, '')}`,
      uid: referrerUser.uid,
      email: referrerUser.email,
      displayName: referrerUser.displayName,
      planType: referrerUser.planType === 'annual' ? 'annual' : 'monthly',
      amountClp: 0,
      transactionId: `BONO-${codeDoc.code}`,
      paymentMethod: 'codigo_acceso',
      paidAt: nowISO,
      periodCoveredEnd: nextDue,
      notes: `Bono referido (+${bonusDays} días) por invitar a ${codeDoc.usedByEmail || 'otra pyme'}`,
    });
  } catch {
    // No bloquear acreditación
  }

  await logAdminAction({
    adminUid: admin.uid,
    adminEmail: admin.email,
    action: 'Acreditar +1 mes referido',
    target: referrerUser.email,
    details: `Código ${codeDoc.code} canjeado por ${codeDoc.usedByEmail ?? 'pyme'} -> Vence: ${nextDue}`,
  });

  return { nextDue };
}

export async function createMercadoPagoRecurringCheckout(params: {
  profile: UserProfile;
  planType: PlanType;
  appConfig: AppConfig;
  backUrl?: string;
}): Promise<{
  ok: boolean;
  mode: 'preapproval' | 'manual_fallback';
  checkoutUrl: string;
  preapprovalId?: string;
  message: string;
}> {
  const fallbackUrl =
    params.planType === 'annual'
      ? params.appConfig.annualSubscriptionUrl ||
        DEFAULT_ANNUAL_SUBSCRIPTION_URL ||
        params.appConfig.annualPaymentUrl ||
        params.appConfig.paymentUrl
      : params.appConfig.monthlySubscriptionUrl ||
        DEFAULT_MONTHLY_SUBSCRIPTION_URL ||
        params.appConfig.paymentUrl;

  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => undefined);
    const res = await fetch('/api/payments/mercadopago-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        uid: params.profile.uid,
        email: params.profile.email,
        displayName: params.profile.displayName,
        planType: params.planType,
        monthlyPriceClp: params.appConfig.monthlyPriceClp ?? MONTHLY_PRICE_CLP,
        annualPriceClp: params.appConfig.annualPriceClp ?? ANNUAL_PRICE_CLP,
        fallbackUrl,
        backUrl: params.backUrl,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      mode?: 'preapproval' | 'manual_fallback';
      initPoint?: string;
      fallbackUrl?: string;
      preapprovalId?: string;
      message?: string;
    };

    if (data.mode === 'preapproval' && data.initPoint) {
      if (data.preapprovalId) {
        try {
          await updateDoc(doc(db, 'users', params.profile.uid), {
            mpPreapprovalId: clampStr(data.preapprovalId, 120),
            mpSubscriptionStatus: 'pending' as MpSubscriptionStatus,
            autoRenewEnabled: true,
            planType: params.planType,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignorar si falla actualización secundaria
        }
      }
      return {
        ok: true,
        mode: 'preapproval',
        checkoutUrl: data.initPoint,
        preapprovalId: data.preapprovalId,
        message:
          data.message ||
          'Redirigiendo a Mercado Pago para autorizar tu suscripción automática.',
      };
    }

    return {
      ok: true,
      mode: 'manual_fallback',
      checkoutUrl: data.fallbackUrl || fallbackUrl,
      message:
        data.message ||
        'Abrimos el link directo de Mercado Pago como respaldo (si prefieres, también puedes activar con código de acceso).',
    };
  } catch {
    return {
      ok: true,
      mode: 'manual_fallback',
      checkoutUrl: fallbackUrl,
      message:
        'Abrimos el link manual oficial de Mercado Pago como respaldo.',
    };
  }
}

export async function verifyMercadoPagoSubscription(params: {
  preapprovalId: string;
  profile: UserProfile;
}): Promise<{
  verified: boolean;
  status: MpSubscriptionStatus;
  message: string;
}> {
  try {
    const res = await fetch('/api/payments/mercadopago-subscription-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preapprovalId: params.preapprovalId,
        uid: params.profile.uid,
        email: params.profile.email,
      }),
    });
    const data = (await res.json()) as {
      verified?: boolean;
      status?: MpSubscriptionStatus;
      message?: string;
    };
    const nextStatus: MpSubscriptionStatus = data.status || 'pending';
    try {
      await updateDoc(doc(db, 'users', params.profile.uid), {
        mpPreapprovalId: clampStr(params.preapprovalId, 120),
        mpSubscriptionStatus: nextStatus,
        autoRenewEnabled: nextStatus === 'authorized' || nextStatus === 'pending',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Ignorar si perfil no permite escritura aún
    }
    return {
      verified: Boolean(data.verified),
      status: nextStatus,
      message:
        data.message ||
        'Estado de tu suscripción automática de Mercado Pago consultado.',
    };
  } catch {
    return {
      verified: false,
      status: 'pending',
      message:
        'No pudimos confirmar tu suscripción automática ahora. Puedes usar el link manual o adjuntar tu comprobante.',
    };
  }
}

/* ============================================================================
 * FASE 4: ANALÍTICA DE EMBUDO MÍNIMA Y RESPETUOSA CON LA PRIVACIDAD
 * (Sin cookies, sin correos, sin UID: solo conteos por sesión anónima efímera)
 * ============================================================================ */

function getAnonymousSessionId(): string {
  try {
    const existing = sessionStorage.getItem('growy_funnel_sid');
    if (existing && /^[a-zA-Z0-9_-]{4,80}$/.test(existing)) {
      return existing;
    }
    const generated = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('growy_funnel_sid', generated);
    return generated;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

export async function recordFunnelEvent(params: {
  step: FunnelStep;
  source?: FunnelEventRecord['source'];
  planType?: PlanType;
}): Promise<void> {
  try {
    const id = `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionId = getAnonymousSessionId();
    const day = new Date().toISOString().slice(0, 10);
    const payload = JSON.parse(
      JSON.stringify({
        id,
        sessionId,
        step: params.step,
        source: params.source,
        planType: params.planType,
        day,
      })
    );
    await setDoc(doc(db, 'funnelEvents', id), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Nunca interrumpir al usuario si un bloqueador de red o estado offline impide registrar métricas
  }
}

export function trackFunnelStepOncePerSession(
  step: FunnelStep,
  options?: { source?: FunnelEventRecord['source']; planType?: PlanType }
): void {
  try {
    const key = `growy_funnel_step_${step}`;
    if (sessionStorage.getItem(key) === '1') return;
    sessionStorage.setItem(key, '1');
  } catch {
    // Continuar aunque sessionStorage no esté disponible
  }
  void recordFunnelEvent({
    step,
    source: options?.source,
    planType: options?.planType,
  });
}

export function subscribeFunnelEventsAdmin(
  onUpdate: (events: FunnelEventRecord[]) => void
): () => void {
  const q = query(
    collection(db, 'funnelEvents'),
    orderBy('createdAt', 'desc'),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((d) => d.data() as FunnelEventRecord));
    },
    (err) => {
      console.warn('No se pudieron cargar métricas de embudo:', err);
      onUpdate([]);
    }
  );
}

/* ============================================================================
 * EQUILIBRIO LITE EXCEL: COMPRA ÚNICA, VERIFICACIÓN Y PANEL ADMIN
 * ============================================================================ */

async function getCurrentIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión como administrador para realizar esta acción.');
  }
  return user.getIdToken();
}

export async function createExcelCheckoutOrder(params: {
  name: string;
  email: string;
  emailConfirm: string;
  termsAccepted: boolean;
}): Promise<{
  ok: boolean;
  orderId?: string;
  checkoutUrl?: string;
  mode?: 'preference' | 'static_fallback';
  message?: string;
  error?: string;
}> {
  const res = await fetch('/api/excel/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    orderId?: string;
    checkoutUrl?: string;
    mode?: 'preference' | 'static_fallback';
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(
      data.error || data.message || 'No pudimos iniciar tu compra en este momento.'
    );
  }
  return {
    ok: true,
    orderId: data.orderId,
    checkoutUrl: data.checkoutUrl,
    mode: data.mode,
    message: data.message,
  };
}

export async function verifyExcelPaymentReturn(params: {
  orderId: string;
  paymentId?: string;
  status?: string;
}): Promise<{
  ok: boolean;
  status?: string;
  delivered?: boolean;
  licenseId?: string;
  message: string;
}> {
  const res = await fetch('/api/excel/verify-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    status?: string;
    delivered?: boolean;
    licenseId?: string;
    message?: string;
    error?: string;
  };
  return {
    ok: Boolean(res.ok && data.ok),
    status: data.status,
    delivered: Boolean(data.delivered),
    licenseId: data.licenseId,
    message:
      data.message ||
      data.error ||
      'Estamos verificando el estado de tu pago con Mercado Pago.',
  };
}

export function subscribeExcelOrdersAdmin(
  onUpdate: (orders: ExcelOrderRecord[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const q = query(collection(db, 'excelOrders'), orderBy('createdAt', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => ({
          ...(d.data() as Omit<ExcelOrderRecord, 'id'>),
          id: d.id,
        }))
      );
    },
    (err) => {
      console.warn('No se pudieron cargar órdenes Excel:', err);
      onError?.(err);
      onUpdate([]);
    }
  );
}

export async function adminFetchExcelOrdersServer(): Promise<ExcelOrderRecord[] | null> {
  try {
    const token = await getCurrentIdToken();
    const res = await fetch('/api/admin/excel-orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; orders?: ExcelOrderRecord[] };
    return data.ok && Array.isArray(data.orders) ? data.orders : null;
  } catch {
    return null;
  }
}

export async function adminResendExcelOrder(params: {
  admin: UserProfile;
  order: ExcelOrderRecord;
  confirmManualPayment?: boolean;
}): Promise<{ ok: boolean; status?: string; message: string }> {
  const token = await getCurrentIdToken();
  const res = await fetch(`/api/admin/excel-orders/${encodeURIComponent(params.order.id)}/resend`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      confirmManualPayment: Boolean(params.confirmManualPayment),
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    status?: string;
    message?: string;
    error?: string;
  };
  if (data.ok) {
    try {
      await logAdminAction({
        adminUid: params.admin.uid,
        adminEmail: params.admin.email,
        action: params.confirmManualPayment
          ? 'Confirmar pago y enviar Equilibrio Lite Excel'
          : 'Reenviar Equilibrio Lite Excel',
        target: `${params.order.licenseId} (${params.order.email})`,
        details: params.confirmManualPayment
          ? `Pago confirmado manualmente y orden ${params.order.id} enviada por correo.`
          : `Orden ${params.order.id} reenviada por correo.`,
      });
    } catch {
      // Silencioso si el servidor ya registró la acción
    }
  }
  return {
    ok: Boolean(data.ok),
    status: data.status,
    message:
      data.message ||
      data.error ||
      (data.ok
        ? 'Archivo personalizado enviado correctamente.'
        : 'No se pudo enviar la planilla.'),
  };
}

export async function adminCancelExcelOrder(params: {
  admin: UserProfile;
  order: ExcelOrderRecord;
  reason?: string;
}): Promise<{ ok: boolean; message: string }> {
  const cleanReason = clampStr(params.reason || 'Anulada desde Panel Administrador', 240);
  try {
    const token = await getCurrentIdToken();
    const res = await fetch(
      `/api/admin/excel-orders/${encodeURIComponent(params.order.id)}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cleanReason }),
      }
    );
    const data = (await res.json()) as {
      ok?: boolean;
      useClientFallback?: boolean;
      message?: string;
      error?: string;
    };
    if (res.ok && data.ok) {
      await logAdminAction({
        adminUid: params.admin.uid,
        adminEmail: params.admin.email,
        action: 'Anular orden Equilibrio Lite Excel',
        target: `${params.order.licenseId} (${params.order.email})`,
        details: `Orden ${params.order.id} anulada · ${cleanReason}`,
      });
      return { ok: true, message: data.message || 'Orden anulada correctamente.' };
    }
    if (!data.useClientFallback) {
      throw new Error(data.error || data.message || 'No se pudo anular la orden.');
    }
  } catch (err) {
    // Si Admin SDK no tiene credenciales en preview, el admin verificado puede anular vía reglas Firestore
    if (err instanceof Error && !err.message.includes('Failed to fetch')) {
      // Continuar al fallback verificado solo si no fue un error de validación de negocio
    }
  }

  await updateDoc(doc(db, 'excelOrders', params.order.id), {
    status: 'anulada',
    lastError: cleanReason,
  });
  await logAdminAction({
    adminUid: params.admin.uid,
    adminEmail: params.admin.email,
    action: 'Anular orden Equilibrio Lite Excel',
    target: `${params.order.licenseId} (${params.order.email})`,
    details: `Orden ${params.order.id} anulada · ${cleanReason}`,
  });
  return { ok: true, message: 'Orden marcada como anulada y registrada en Actividad.' };
}

export async function adminSendTestExcelEmail(params: {
  admin: UserProfile;
  recipientName: string;
  recipientEmail: string;
}): Promise<{ ok: boolean; licenseId?: string; missingResend?: boolean; message: string }> {
  const token = await getCurrentIdToken();
  const res = await fetch('/api/admin/excel-test-send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: clampStr(params.recipientName, 100),
      email: clampStr(params.recipientEmail, 160).toLowerCase(),
    }),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    licenseId?: string;
    missingResend?: boolean;
    message?: string;
    error?: string;
  };

  if (res.ok && data.ok) {
    try {
      await logAdminAction({
        adminUid: params.admin.uid,
        adminEmail: params.admin.email,
        action: 'Enviar correo de prueba Equilibrio Lite Excel',
        target: clampStr(params.recipientEmail, 160).toLowerCase(),
        details: `Envío de prueba (${data.licenseId || 'GROWY-PRUEBA01'}) a ${clampStr(params.recipientName, 100)}.`,
      });
    } catch {
      // Silencioso si el log opcional falla
    }
  }

  return {
    ok: Boolean(res.ok && data.ok),
    licenseId: data.licenseId,
    missingResend: Boolean(data.missingResend),
    message:
      data.message ||
      data.error ||
      (res.ok
        ? 'Correo de prueba enviado correctamente.'
        : 'No se pudo enviar el correo de prueba.'),
  };
}

export async function adminDownloadTestExcelPreview(params: {
  recipientName: string;
}): Promise<{ ok: boolean; filename?: string; message?: string }> {
  const token = await getCurrentIdToken();
  const res = await fetch('/api/admin/excel-test-download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: clampStr(params.recipientName, 100),
    }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    return {
      ok: false,
      message: data.error || data.message || 'No pudimos generar la planilla de prueba.',
    };
  }

  const blob = await res.blob();
  const filename = 'Equilibrio-Lite-GROWY-PRUEBA01.xlsx';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return { ok: true, filename };
}

/* ============================================================================
 * ANALÍTICA DE VISITAS EN VIVO E HISTÓRICA (SOLO ADMINISTRADOR)
 * ============================================================================ */

export function getSiteAnalyticsSessionId(): string {
  try {
    const existing = sessionStorage.getItem('growy_analytics_sid');
    if (existing && /^[a-zA-Z0-9_-]{4,80}$/.test(existing)) {
      return existing;
    }
    const generated = `vis_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem('growy_analytics_sid', generated);
    return generated;
  } catch {
    return `vis_${Date.now().toString(36)}`;
  }
}

export async function sendSiteAnalyticsPing(params: {
  sessionId: string;
  path?: string;
  isPageView?: boolean;
}): Promise<void> {
  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: params.sessionId,
        path: params.path || '/',
        isPageView: Boolean(params.isPageView),
      }),
      keepalive: true,
    });
  } catch {
    // Silencioso en modo offline o si un bloqueador impide la métrica
  }
}

export async function fetchAdminTrafficStats(): Promise<AdminTrafficStats> {
  const token = await getCurrentIdToken();
  const res = await fetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as Partial<AdminTrafficStats> & {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'No pudimos obtener las estadísticas de tráfico.');
  }
  return {
    activeNow: typeof data.activeNow === 'number' ? data.activeNow : 0,
    activeWindowSeconds:
      typeof data.activeWindowSeconds === 'number' ? data.activeWindowSeconds : 90,
    viewsToday: typeof data.viewsToday === 'number' ? data.viewsToday : 0,
    views15d: typeof data.views15d === 'number' ? data.views15d : 0,
    views30d: typeof data.views30d === 'number' ? data.views30d : 0,
    views90d: typeof data.views90d === 'number' ? data.views90d : 0,
    dailySeries: Array.isArray(data.dailySeries) ? data.dailySeries : [],
    persistenceMode: data.persistenceMode === 'firestore' ? 'firestore' : 'memory',
    generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : new Date().toISOString(),
  };
}




