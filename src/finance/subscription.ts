import type {
  BillingDay,
  PaymentNotificationPayload,
  PlanType,
  UserProfile,
} from '../types/finance';

export const MONTHLY_PRICE_CLP = 5990;
export const MONTHLY_PRICE_LABEL = '$5.990 / mes';
export const ANNUAL_PRICE_CLP = 49990;
export const ANNUAL_NORMAL_PRICE_CLP = 71880;
export const ANNUAL_EQUIV_MONTHLY_CLP = 4166;
export const ANNUAL_SAVINGS_CLP = 21890;
export const ANNUAL_DISCOUNT_LABEL = '30,45%';
export const ANNUAL_PRICE_LABEL = '$49.990 / año';
export const LAUNCH_PRICING_BADGE = 'Precio por lanzamiento';
export const LAUNCH_PRICING_NOTE =
  'Valores por lanzamiento por tiempo limitado: aprovecha hoy antes de que pasen a su valor regular.';

export const BILLING_DAY_OPTIONS: readonly BillingDay[] = [5, 15, 30] as const;
export const COMPLIMENTARY_CLIENT_EMAILS = ['matias.fonseca.luna@gmail.com'] as const;

export function isComplimentaryClientEmail(email?: string | null): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  return (COMPLIMENTARY_CLIENT_EMAILS as readonly string[]).includes(normalized);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getDaysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

export function clampDayToMonth(year: number, month1to12: number, billingDay: BillingDay): number {
  return Math.min(billingDay, getDaysInMonth(year, month1to12));
}

export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

export function parseISODateLocal(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function diffCalendarDays(fromISO: string, toISO: string): number {
  const a = parseISODateLocal(fromISO);
  const b = parseISODateLocal(toISO);
  if (!a || !b) return 0;
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
}

function buildBillingDate(year: number, month1to12: number, billingDay: BillingDay): string {
  const day = clampDayToMonth(year, month1to12, billingDay);
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

function addMonthsToYearMonth(year: number, month1to12: number, add: number): { year: number; month: number } {
  const total = year * 12 + (month1to12 - 1) + add;
  return {
    year: Math.floor(total / 12),
    month: (total % 12) + 1,
  };
}

/**
 * Calcula la próxima fecha de vencimiento inicial al elegir día 5, 15 o 30.
 * Garantiza al menos 15 días de uso en el primer ciclo pagado para que sea justo.
 */
export function computeInitialNextDueDate(
  billingDay: BillingDay,
  referenceDate: Date = new Date()
): string {
  const todayISO = toISODateLocal(referenceDate);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  for (let offset = 0; offset <= 2; offset++) {
    const ym = addMonthsToYearMonth(year, month, offset);
    const candidate = buildBillingDate(ym.year, ym.month, billingDay);
    if (diffCalendarDays(todayISO, candidate) >= 15) {
      return candidate;
    }
  }
  const fallback = addMonthsToYearMonth(year, month, 1);
  return buildBillingDate(fallback.year, fallback.month, billingDay);
}

/**
 * Calcula la siguiente fecha de vencimiento al renovar un pago mensual de $5.990.
 */
export function computeNextCycleDueDate(
  billingDay: BillingDay,
  currentDueISO?: string | null,
  referenceDate: Date = new Date()
): string {
  const todayISO = toISODateLocal(referenceDate);
  if (currentDueISO) {
    const parsed = parseISODateLocal(currentDueISO);
    if (parsed && diffCalendarDays(todayISO, currentDueISO) > 0) {
      const nextYm = addMonthsToYearMonth(parsed.getFullYear(), parsed.getMonth() + 1, 1);
      return buildBillingDate(nextYm.year, nextYm.month, billingDay);
    }
  }
  return computeInitialNextDueDate(billingDay, referenceDate);
}

/**
 * Calcula la fecha de vencimiento anual (exactamente 12 meses después del pago único de $49.990).
 * Si renueva antes de vencer, suma 12 meses a su vencimiento vigente.
 */
export function computeAnnualDueDate(
  currentDueISO?: string | null,
  referenceDate: Date = new Date()
): string {
  const todayISO = toISODateLocal(referenceDate);
  let baseDate = referenceDate;
  if (currentDueISO) {
    const parsed = parseISODateLocal(currentDueISO);
    if (parsed && diffCalendarDays(todayISO, currentDueISO) > 0) {
      baseDate = parsed;
    }
  }
  const targetYear = baseDate.getFullYear() + 1;
  const targetMonth = baseDate.getMonth() + 1;
  const clampedDay = Math.min(baseDate.getDate(), getDaysInMonth(targetYear, targetMonth));
  return `${targetYear}-${pad2(targetMonth)}-${pad2(clampedDay)}`;
}

export function formatISODateSpanish(isoDate?: string | null): string {
  if (!isoDate) return 'Sin definir';
  const parsed = parseISODateLocal(isoDate);
  if (!parsed) return isoDate;
  return parsed.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export interface SubscriptionStatusInfo {
  isExemptAdmin: boolean;
  isComplimentary: boolean;
  planType: PlanType;
  isAnnual: boolean;
  hasBillingDay: boolean;
  billingDay: BillingDay | null;
  nextDueISO: string | null;
  daysUntilDue: number | null;
  isExpired: boolean;
  shouldShowReminder: boolean;
}

export function getSubscriptionStatus(
  profile: UserProfile | null,
  now: Date = new Date()
): SubscriptionStatusInfo {
  if (!profile) {
    return {
      isExemptAdmin: false,
      isComplimentary: false,
      planType: 'monthly',
      isAnnual: false,
      hasBillingDay: false,
      billingDay: null,
      nextDueISO: null,
      daysUntilDue: null,
      isExpired: false,
      shouldShowReminder: false,
    };
  }

  const isExemptAdmin = profile.role === 'admin';
  const isComplimentary = !isExemptAdmin && isComplimentaryClientEmail(profile.email);
  const planType: PlanType = profile.planType === 'annual' ? 'annual' : 'monthly';
  const isAnnual = planType === 'annual';
  const billingDay =
    profile.billingDay === 5 || profile.billingDay === 15 || profile.billingDay === 30
      ? profile.billingDay
      : null;

  if (isExemptAdmin) {
    return {
      isExemptAdmin: true,
      isComplimentary: false,
      planType,
      isAnnual,
      hasBillingDay: true,
      billingDay,
      nextDueISO: profile.nextPaymentDueAt ?? null,
      daysUntilDue: null,
      isExpired: false,
      shouldShowReminder: false,
    };
  }

  const nextDueISO = profile.nextPaymentDueAt ?? null;
  if (isComplimentary) {
    return {
      isExemptAdmin: false,
      isComplimentary: true,
      planType,
      isAnnual,
      hasBillingDay: isAnnual || billingDay !== null,
      billingDay,
      nextDueISO,
      daysUntilDue: null,
      isExpired: false,
      shouldShowReminder: false,
    };
  }

  // En plan anual ($49.990 pago único 12 meses), NO se pide ni cobra fecha mensual (5/15/30).
  const hasBillingDay = isAnnual ? true : billingDay !== null;

  if (!nextDueISO) {
    return {
      isExemptAdmin: false,
      isComplimentary: false,
      planType,
      isAnnual,
      hasBillingDay,
      billingDay,
      nextDueISO: null,
      daysUntilDue: null,
      isExpired: false,
      shouldShowReminder: false,
    };
  }

  const todayISO = toISODateLocal(now);
  const daysUntilDue = diffCalendarDays(todayISO, nextDueISO);
  // Cuando finaliza la fecha de pago mensual o los 12 meses del plan anual, la página bloquea acceso hasta renovar.
  const isExpired = profile.accessStatus === 'active' && daysUntilDue <= 0;
  const reminderWindowDays = isAnnual ? 15 : 5;
  const shouldShowReminder =
    profile.accessStatus === 'active' && daysUntilDue > 0 && daysUntilDue <= reminderWindowDays;

  return {
    isExemptAdmin: false,
    isComplimentary: false,
    planType,
    isAnnual,
    hasBillingDay,
    billingDay,
    nextDueISO,
    daysUntilDue,
    isExpired,
    shouldShowReminder,
  };
}

/**
 * Construye el payload de notificación push antes de que la cuenta quede bloqueada
 * (o al vencerse) respetando exención de admin y cliente de prueba sin cobro.
 */
export function buildPaymentReminderNotification(
  profile: UserProfile | null,
  now: Date = new Date()
): PaymentNotificationPayload | null {
  const status = getSubscriptionStatus(profile, now);
  if (
    !profile ||
    status.isExemptAdmin ||
    status.isComplimentary ||
    !status.nextDueISO ||
    status.daysUntilDue === null
  ) {
    return null;
  }

  const formattedDate = formatISODateSpanish(status.nextDueISO);

  if (status.shouldShowReminder) {
    const daysText =
      status.daysUntilDue === 1
        ? 'mañana'
        : `en ${status.daysUntilDue} días`;

    if (status.isAnnual) {
      return {
        kind: 'reminder',
        title:
          status.daysUntilDue === 1
            ? 'GROWy: ¡Tu Plan Anual vence mañana!'
            : 'GROWy: Tu Plan Anual vence pronto',
        body: `Tus 12 meses ($49.990) finalizan ${daysText} (${formattedDate}). Renueva antes para evitar que tu cuenta quede bloqueada.`,
        tag: `growy-payment-reminder-${status.nextDueISO}`,
        url: '/?reminder=payment',
        requireInteraction: status.daysUntilDue <= 2,
        daysUntilDue: status.daysUntilDue,
        nextDueISO: status.nextDueISO,
      };
    }

    return {
      kind: 'reminder',
      title:
        status.daysUntilDue === 1
          ? 'GROWy: ¡Tu pago mensual vence mañana!'
          : 'GROWy: Recordatorio antes de vencimiento',
      body: `Tu pago mensual de $5.990${status.billingDay ? ` (día ${status.billingDay})` : ''} vence ${daysText} (${formattedDate}). Paga antes para evitar que tu cuenta quede bloqueada.`,
      tag: `growy-payment-reminder-${status.nextDueISO}`,
      url: '/?reminder=payment',
      requireInteraction: status.daysUntilDue <= 2,
      daysUntilDue: status.daysUntilDue,
      nextDueISO: status.nextDueISO,
    };
  }

  if (status.isExpired) {
    return {
      kind: 'expired',
      title: 'GROWy: Acceso pausado por vencimiento',
      body: `Tu fecha de pago venció (${formattedDate}). Renueva con Mercado Pago para recuperar el acceso completo a tus datos.`,
      tag: `growy-payment-expired-${status.nextDueISO}`,
      url: '/?reminder=payment',
      requireInteraction: true,
      daysUntilDue: status.daysUntilDue,
      nextDueISO: status.nextDueISO,
    };
  }

  return null;
}

export function formatCLPAmount(amount: number): string {
  const safe = Math.max(0, Math.round(Number(amount) || 0));
  return `$${safe.toLocaleString('es-CL')}`;
}

export function buildReceiptNumber(transactionId: string, paidAtISO: string): string {
  const year = /^\d{4}/.test(paidAtISO) ? paidAtISO.slice(0, 4) : String(new Date().getFullYear());
  const cleanSuffix = transactionId
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(-8)
    .padStart(4, '0');
  return `GRW-${year}-${cleanSuffix}`;
}

