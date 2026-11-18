import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildPaymentReminderNotification,
  getSubscriptionStatus,
  toISODateLocal,
} from '../finance/subscription';
import {
  deleteUserPushSubscription,
  saveUserPushSubscription,
} from '../firebase/services';
import type { UserProfile } from '../types/finance';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function computeSubscriptionDocId(endpoint: string): Promise<string> {
  if (window.crypto?.subtle) {
    const digest = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(endpoint)
    );
    return Array.from(new Uint8Array(digest))
      .slice(0, 12)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    hash = (hash * 31 + endpoint.charCodeAt(i)) | 0;
  }
  return `sub_${Math.abs(hash)}`;
}

function serializeSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    expirationTime: sub.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
  };
}

export interface PushNotificationsState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  busy: boolean;
  statusMessage: { type: 'ok' | 'err'; text: string } | null;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<void>;
  sendTestPush: () => Promise<void>;
  clearMessage: () => void;
}

export function usePushNotifications(profile: UserProfile | null): PushNotificationsState {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (!supported) return 'unsupported';
    return Notification.permission;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const lastSyncFingerprintRef = useRef<string>('');

  const syncWithBackendAndFirestore = useCallback(
    async (sub: PushSubscription, user: UserProfile) => {
      const serialized = serializeSubscription(sub);
      if (!serialized.keys.p256dh || !serialized.keys.auth) return;

      const subId = await computeSubscriptionDocId(serialized.endpoint);

      await Promise.allSettled([
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: serialized,
            user: {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              role: user.role,
              accessStatus: user.accessStatus,
              paymentStatus: user.paymentStatus,
              planType: user.planType,
              billingDay: user.billingDay,
              nextPaymentDueAt: user.nextPaymentDueAt,
            },
          }),
        }),
        user.accessStatus === 'active'
          ? saveUserPushSubscription(user.uid, {
              id: subId,
              ownerUid: user.uid,
              endpoint: serialized.endpoint,
              keys: serialized.keys,
              planType: user.planType,
              billingDay: user.billingDay,
              nextPaymentDueAt: user.nextPaymentDueAt,
              enabled: true,
              userAgent: navigator.userAgent,
            })
          : Promise.resolve(),
      ]);
    },
    []
  );

  // Detectar estado inicial de permiso y suscripción activa en el Service Worker
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    const inspect = async () => {
      try {
        setPermission(Notification.permission);
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(Boolean(existing));
        }
      } catch {
        if (!cancelled) setIsSubscribed(false);
      }
    };

    void inspect();
    return () => {
      cancelled = true;
    };
  }, [supported, profile?.uid]);

  // Sincronizar cambios de vencimiento/plan con backend + Firestore, y mostrar recordatorio local vía SW si aplica
  useEffect(() => {
    if (!supported || !profile) return;
    const subStatus = getSubscriptionStatus(profile);
    if (subStatus.isExemptAdmin || subStatus.isComplimentary) return;

    const fingerprint = `${profile.uid}|${profile.accessStatus}|${profile.planType ?? ''}|${profile.billingDay ?? ''}|${profile.nextPaymentDueAt ?? ''}|${permission}|${isSubscribed}`;
    if (lastSyncFingerprintRef.current === fingerprint) return;
    lastSyncFingerprintRef.current = fingerprint;

    let cancelled = false;
    const run = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const activeSub = await reg.pushManager.getSubscription();
        if (cancelled) return;

        if (activeSub) {
          setIsSubscribed(true);
          await syncWithBackendAndFirestore(activeSub, profile);
        }

        // Respaldo inmediato vía Service Worker si el usuario tiene permiso otorgado y está en ventana de aviso
        if (Notification.permission === 'granted' && subStatus.shouldShowReminder) {
          const todayISO = toISODateLocal(new Date());
          const dedupKey = `growy_sw_reminder_${profile.uid}_${todayISO}`;
          try {
            if (!localStorage.getItem(dedupKey)) {
              const payload = buildPaymentReminderNotification(profile, new Date());
              if (payload) {
                await reg.showNotification(payload.title, {
                  body: payload.body,
                  icon: '/growy-icon-192.png',
                  badge: '/growy-icon-192.png',
                  tag: payload.tag,
                  requireInteraction: payload.requireInteraction,
                  data: { url: payload.url },
                });
                localStorage.setItem(dedupKey, '1');
              }
            }
          } catch {
            // Ignorar si storage o notificación están restringidos
          }
        }
      } catch {
        // Silencioso si el SW aún está inicializando
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [supported, profile, permission, isSubscribed, syncWithBackendAndFirestore]);

  const enablePush = useCallback(async (): Promise<boolean> => {
    if (!supported || !profile) {
      setStatusMessage({
        type: 'err',
        text: 'Tu navegador actual no soporta notificaciones push con Service Worker.',
      });
      return false;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        setStatusMessage({
          type: 'err',
          text:
            nextPermission === 'denied'
              ? 'Bloqueaste los permisos de notificación. Habilítalos en el candado o ajustes del navegador para recibir avisos antes de que venza tu plan.'
              : 'No se aceptó el permiso de notificaciones.',
        });
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        const keyRes = await fetch('/api/push/vapid-public-key');
        if (!keyRes.ok) {
          throw new Error('No se pudo obtener la clave VAPID del servidor.');
        }
        const { publicKey } = (await keyRes.json()) as { publicKey?: string };
        if (!publicKey) {
          throw new Error('Clave pública VAPID no disponible.');
        }

        const applicationServerKey = urlBase64ToUint8Array(publicKey);
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource,
        });
      }

      await syncWithBackendAndFirestore(subscription, profile);
      setIsSubscribed(true);
      setStatusMessage({
        type: 'ok',
        text: 'Listo: activamos los recordatorios push en este dispositivo para avisarte antes del vencimiento.',
      });
      return true;
    } catch (err) {
      setStatusMessage({
        type: 'err',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudieron activar las notificaciones push.',
      });
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, profile, syncWithBackendAndFirestore]);

  const disablePush = useCallback(async () => {
    if (!supported || !profile) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        const endpoint = existing.endpoint;
        await existing.unsubscribe();
        const subId = await computeSubscriptionDocId(endpoint);
        await Promise.allSettled([
          fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint, uid: profile.uid }),
          }),
          deleteUserPushSubscription(profile.uid, subId),
        ]);
      }
      setIsSubscribed(false);
      setStatusMessage({
        type: 'ok',
        text: 'Recordatorios push desactivados en este dispositivo.',
      });
    } catch {
      setStatusMessage({
        type: 'err',
        text: 'No se pudieron desactivar los avisos push.',
      });
    } finally {
      setBusy(false);
    }
  }, [supported, profile]);

  const sendTestPush = useCallback(async () => {
    if (!supported || !profile) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        setStatusMessage({
          type: 'err',
          text: 'Primero activa los recordatorios push en este dispositivo.',
        });
        return;
      }

      const serialized = serializeSubscription(existing);
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: serialized,
          user: {
            uid: profile.uid,
            email: profile.email,
            displayName: profile.displayName,
            role: profile.role,
            accessStatus: profile.accessStatus,
            paymentStatus: profile.paymentStatus,
            planType: profile.planType,
            billingDay: profile.billingDay,
            nextPaymentDueAt: profile.nextPaymentDueAt,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Error enviando notificación push desde el servidor.');
      }

      setStatusMessage({
        type: 'ok',
        text: 'Notificación de prueba enviada a través del Service Worker.',
      });
    } catch {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('GROWy · Prueba de recordatorio', {
          body: 'Así te avisaremos antes de tu vencimiento para que tu cuenta nunca quede bloqueada.',
          icon: '/growy-icon-192.png',
          badge: '/growy-icon-192.png',
          tag: 'growy-test-local',
          data: { url: '/?reminder=payment' },
        });
        setStatusMessage({
          type: 'ok',
          text: 'Notificación de prueba mostrada vía Service Worker.',
        });
      } catch {
        setStatusMessage({
          type: 'err',
          text: 'No se pudo enviar la notificación de prueba en este navegador.',
        });
      }
    } finally {
      setBusy(false);
    }
  }, [supported, profile]);

  const clearMessage = useCallback(() => setStatusMessage(null), []);

  return {
    supported,
    permission,
    isSubscribed,
    busy,
    statusMessage,
    enablePush,
    disablePush,
    sendTestPush,
    clearMessage,
  };
}
