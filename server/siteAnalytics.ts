import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getFirebaseAdminContext, isAdminCredentialError } from './excelDelivery';

const ACTIVE_SESSION_WINDOW_MS = 90_000;
const CHILE_TZ = 'America/Santiago';

interface ActiveSessionEntry {
  lastSeenMs: number;
  path: string;
}

const activeSessions = new Map<string, ActiveSessionEntry>();
const inMemoryDailyViews = new Map<string, number>();

export function getChileDateISO(date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: CHILE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function addDaysISO(baseISO: string, deltaDays: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function pruneExpiredActiveSessions(nowMs: number = Date.now()): void {
  for (const [sid, entry] of activeSessions.entries()) {
    if (nowMs - entry.lastSeenMs > ACTIVE_SESSION_WINDOW_MS) {
      activeSessions.delete(sid);
    }
  }
}

export async function recordSiteAnalyticsPing(params: {
  sessionId: string;
  path?: string;
  isPageView?: boolean;
}): Promise<{ activeNow: number; day: string }> {
  const nowMs = Date.now();
  pruneExpiredActiveSessions(nowMs);

  const cleanSid = params.sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const cleanPath = (params.path || '/').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 160) || '/';

  if (cleanSid.length >= 4) {
    // Evitar crecimiento ilimitado ante tráfico anómalo
    if (activeSessions.size > 20_000 && !activeSessions.has(cleanSid)) {
      const oldestKey = activeSessions.keys().next().value;
      if (oldestKey) activeSessions.delete(oldestKey);
    }
    activeSessions.set(cleanSid, { lastSeenMs: nowMs, path: cleanPath });
  }

  const todayISO = getChileDateISO(new Date(nowMs));

  if (params.isPageView) {
    inMemoryDailyViews.set(todayISO, (inMemoryDailyViews.get(todayISO) ?? 0) + 1);

    // Mantener máximo 120 días en memoria
    if (inMemoryDailyViews.size > 120) {
      const sortedKeys = Array.from(inMemoryDailyViews.keys()).sort();
      while (inMemoryDailyViews.size > 120 && sortedKeys.length > 0) {
        const k = sortedKeys.shift();
        if (k) inMemoryDailyViews.delete(k);
      }
    }

    try {
      const { db } = getFirebaseAdminContext();
      await db
        .collection('siteDailyStats')
        .doc(todayISO)
        .set(
          {
            day: todayISO,
            views: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (err) {
      if (!isAdminCredentialError(err)) {
        console.warn('[SiteAnalytics] Error incrementando vista diaria:', err);
      }
    }
  }

  return {
    activeNow: activeSessions.size,
    day: todayISO,
  };
}

export interface AdminTrafficStatsResponse {
  ok: true;
  activeNow: number;
  activeWindowSeconds: number;
  viewsToday: number;
  views15d: number;
  views30d: number;
  views90d: number;
  dailySeries: Array<{ day: string; views: number }>;
  persistenceMode: 'firestore' | 'memory';
  generatedAt: string;
}

export async function getAdminTrafficStats(): Promise<AdminTrafficStatsResponse> {
  const now = new Date();
  pruneExpiredActiveSessions(now.getTime());

  const todayISO = getChileDateISO(now);
  const start15ISO = addDaysISO(todayISO, -14);
  const start30ISO = addDaysISO(todayISO, -29);
  const start90ISO = addDaysISO(todayISO, -89);

  const dayMap = new Map<string, number>();
  let persistenceMode: 'firestore' | 'memory' = 'memory';

  try {
    const { db } = getFirebaseAdminContext();
    const snap = await (db as Firestore)
      .collection('siteDailyStats')
      .where('day', '>=', start90ISO)
      .orderBy('day', 'asc')
      .limit(100)
      .get();

    persistenceMode = 'firestore';
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as { day?: string; views?: number };
      const dayKey = typeof data.day === 'string' ? data.day : docSnap.id;
      const views = typeof data.views === 'number' && Number.isFinite(data.views) ? data.views : 0;
      dayMap.set(dayKey, Math.max(0, Math.round(views)));
    }
  } catch (err) {
    if (!isAdminCredentialError(err)) {
      console.warn('[SiteAnalytics] Error leyendo siteDailyStats:', err);
    }
    for (const [dayKey, views] of inMemoryDailyViews.entries()) {
      if (dayKey >= start90ISO) {
        dayMap.set(dayKey, views);
      }
    }
  }

  // Asegurar que si Firestore está en modo memoria o aún no tiene el día actual, al menos refleje memoria local
  if (persistenceMode === 'memory') {
    for (const [dayKey, views] of inMemoryDailyViews.entries()) {
      if (dayKey >= start90ISO) {
        dayMap.set(dayKey, Math.max(dayMap.get(dayKey) ?? 0, views));
      }
    }
  }

  let viewsToday = 0;
  let views15d = 0;
  let views30d = 0;
  let views90d = 0;

  for (const [dayKey, views] of dayMap.entries()) {
    if (dayKey === todayISO) viewsToday += views;
    if (dayKey >= start15ISO && dayKey <= todayISO) views15d += views;
    if (dayKey >= start30ISO && dayKey <= todayISO) views30d += views;
    if (dayKey >= start90ISO && dayKey <= todayISO) views90d += views;
  }

  // Construir serie de los últimos 30 días para gráfico admin (incluyendo días en 0)
  const dailySeries: Array<{ day: string; views: number }> = [];
  for (let offset = -29; offset <= 0; offset++) {
    const d = addDaysISO(todayISO, offset);
    dailySeries.push({
      day: d,
      views: dayMap.get(d) ?? 0,
    });
  }

  return {
    ok: true,
    activeNow: activeSessions.size,
    activeWindowSeconds: Math.round(ACTIVE_SESSION_WINDOW_MS / 1000),
    viewsToday,
    views15d,
    views30d,
    views90d,
    dailySeries,
    persistenceMode,
    generatedAt: now.toISOString(),
  };
}
