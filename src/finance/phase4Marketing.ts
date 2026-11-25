import type {
  FaqItem,
  FunnelEventRecord,
  FunnelStep,
  TestimonialItem,
} from '../types/finance';

export const FUNNEL_STEPS_ORDER: FunnelStep[] = [
  'visit',
  'login',
  'onboarding',
  'first_calculation',
  'payment',
];

export const FUNNEL_STEP_LABELS: Record<FunnelStep, string> = {
  visit: 'Visita a portada',
  login: 'Inicio de sesión',
  onboarding: 'Tour / Bienvenida',
  first_calculation: 'Primer cálculo',
  payment: 'Intención o activación de pago',
};

/**
 * Normaliza un número de teléfono chileno o enlace de WhatsApp a una URL segura https://wa.me/...
 * Bloquea esquemas peligrosos (javascript:, data:, etc.) y devuelve null si no es válido.
 */
export function sanitizeWhatsappUrl(raw?: string): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;

  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      if (
        parsed.protocol === 'https:' &&
        (host === 'wa.me' ||
          host === 'api.whatsapp.com' ||
          host === 'chat.whatsapp.com' ||
          host === 'web.whatsapp.com')
      ) {
        return parsed.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  // Si es un número de teléfono (ej: +56 9 1234 5678 o 912345678)
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }
  const normalizedDigits =
    digits.length === 9 && digits.startsWith('9') ? `56${digits}` : digits;

  return `https://wa.me/${normalizedDigits}`;
}

/**
 * Filtra únicamente testimonios con permiso explícito del cliente y contenido completo.
 * Si no hay testimonios aprobados, la sección de la landing NO se renderiza.
 */
export function filterApprovedTestimonials(
  items?: TestimonialItem[] | null
): TestimonialItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item) =>
      Boolean(item) &&
      item.permissionGranted === true &&
      typeof item.name === 'string' &&
      item.name.trim().length > 0 &&
      typeof item.quote === 'string' &&
      item.quote.trim().length > 0
  );
}

/**
 * Construye el esquema JSON-LD de Schema.org FAQPage solo con preguntas publicadas.
 */
export function buildFaqJsonLd(
  faqs: FaqItem[]
): Record<string, unknown> | null {
  if (!Array.isArray(faqs)) return null;
  const published = faqs.filter(
    (item) =>
      Boolean(item) &&
      item.published === true &&
      item.question.trim().length > 0 &&
      item.answer.trim().length > 0
  );
  if (published.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: published.map((faq) => ({
      '@type': 'Question',
      name: faq.question.trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer.trim(),
      },
    })),
  };
}

export interface FunnelStepMetric {
  step: FunnelStep;
  label: string;
  count: number;
  uniqueSessions: number;
  conversionFromVisitPct: number;
  conversionFromPreviousPct: number;
}

export interface FunnelSummary {
  totalEvents: number;
  uniqueSessions: number;
  steps: FunnelStepMetric[];
}

/**
 * Resume eventos anónimos de embudo (sin PII ni cookies) por sesiones únicas y conversión.
 */
export function computeFunnelSummary(
  events: FunnelEventRecord[]
): FunnelSummary {
  const safeEvents = Array.isArray(events) ? events : [];
  const allSessions = new Set<string>();
  const countByStep: Record<FunnelStep, number> = {
    visit: 0,
    login: 0,
    onboarding: 0,
    first_calculation: 0,
    payment: 0,
  };
  const sessionsByStep: Record<FunnelStep, Set<string>> = {
    visit: new Set<string>(),
    login: new Set<string>(),
    onboarding: new Set<string>(),
    first_calculation: new Set<string>(),
    payment: new Set<string>(),
  };

  for (const evt of safeEvents) {
    if (!evt || !(evt.step in countByStep)) continue;
    const session = (evt.sessionId || '').trim() || `anon-${evt.id}`;
    allSessions.add(session);
    countByStep[evt.step] += 1;
    sessionsByStep[evt.step].add(session);
  }

  const visitSessions = sessionsByStep.visit.size;

  const steps: FunnelStepMetric[] = FUNNEL_STEPS_ORDER.map((step, idx) => {
    const unique = sessionsByStep[step].size;
    const prevStep = idx > 0 ? FUNNEL_STEPS_ORDER[idx - 1] : null;
    const prevUnique = prevStep ? sessionsByStep[prevStep].size : unique;

    const conversionFromVisitPct =
      visitSessions > 0 ? Math.min(100, (unique / visitSessions) * 100) : 0;
    const conversionFromPreviousPct =
      idx === 0
        ? unique > 0
          ? 100
          : 0
        : prevUnique > 0
          ? Math.min(100, (unique / prevUnique) * 100)
          : 0;

    return {
      step,
      label: FUNNEL_STEP_LABELS[step],
      count: countByStep[step],
      uniqueSessions: unique,
      conversionFromVisitPct: Number(conversionFromVisitPct.toFixed(1)),
      conversionFromPreviousPct: Number(conversionFromPreviousPct.toFixed(1)),
    };
  });

  return {
    totalEvents: safeEvents.length,
    uniqueSessions: allSessions.size,
    steps,
  };
}

export type EmailAuthMode = 'signin' | 'signup' | 'reset';

export interface EmailAuthValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Valida formularios de ingreso/registro/recuperación con correo y contraseña en español simple.
 */
export function validateEmailAuthFields(params: {
  mode: EmailAuthMode;
  email: string;
  password: string;
  displayName?: string;
}): EmailAuthValidationResult {
  const email = (params.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Ingresa un correo electrónico válido.' };
  }

  if (params.mode === 'reset') {
    return { valid: true, error: null };
  }

  if (params.mode === 'signup') {
    const cleanName = (params.displayName ?? '').trim();
    if (cleanName.length < 2) {
      return {
        valid: false,
        error: 'Escribe tu nombre o el de tu pyme (al menos 2 caracteres).',
      };
    }
  }

  const password = params.password ?? '';
  if (password.length < 6) {
    return {
      valid: false,
      error: 'La contraseña debe tener al menos 6 caracteres.',
    };
  }

  return { valid: true, error: null };
}
