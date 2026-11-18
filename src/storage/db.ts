import { createInitialAppState } from '../data/demoData';
import type { AppStorageState, BusinessWorkspace } from '../types/finance';

const DB_NAME = 'luna_numerica_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'primary_state';
const LS_FALLBACK_KEY = 'luna_numerica_fallback_v1';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Error abriendo IndexedDB'));
  });
}

export async function loadAppState(): Promise<AppStorageState> {
  try {
    const db = await openDB();
    const result = await new Promise<AppStorageState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve(req.result as AppStorageState | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (result && Array.isArray(result.businesses) && result.businesses.length > 0) {
      return result;
    }
  } catch {
    // Fallback a localStorage si IndexedDB falla
  }

  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppStorageState;
      if (parsed && Array.isArray(parsed.businesses) && parsed.businesses.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignorar corrupción en fallback
  }

  const initial = createInitialAppState();
  await saveAppState(initial);
  return initial;
}

export async function saveAppState(state: AppStorageState): Promise<void> {
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // Ignorar error de cuota en localStorage
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // Ya quedó respaldado en localStorage
  }
}

export function exportBackupJSON(state: AppStorageState): void {
  const payload = {
    app: 'GROWy',
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `growy-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseAndValidateBackup(jsonText: string): AppStorageState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('El archivo no contiene un JSON válido.');
  }

  const candidate =
    typeof parsed === 'object' && parsed !== null && 'data' in parsed
      ? (parsed as { data: unknown }).data
      : parsed;

  if (
    !candidate ||
    typeof candidate !== 'object' ||
    !('businesses' in candidate) ||
    !Array.isArray((candidate as AppStorageState).businesses) ||
    (candidate as AppStorageState).businesses.length === 0
  ) {
    throw new Error('El respaldo no tiene negocios válidos de GROWy.');
  }

  const state = candidate as AppStorageState;
  const validBusinesses: BusinessWorkspace[] = state.businesses.filter(
    (b) => typeof b.id === 'string' && typeof b.name === 'string' && Array.isArray(b.products) && Array.isArray(b.fixedCosts)
  );

  if (validBusinesses.length === 0) {
    throw new Error('La estructura de los negocios en el respaldo está incompleta.');
  }

  const activeExists = validBusinesses.some((b) => b.id === state.activeBusinessId);
  return {
    version: state.version ?? 1,
    activeBusinessId: activeExists ? state.activeBusinessId : validBusinesses[0].id,
    businesses: validBusinesses,
    theme: state.theme === 'dark' ? 'dark' : 'light',
  };
}
