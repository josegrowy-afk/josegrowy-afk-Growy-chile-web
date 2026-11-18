/// <reference lib="webworker" />
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();

const manifestEntries = self.__WB_MANIFEST || [];
precacheAndRoute(manifestEntries);
cleanupOutdatedCaches();

// Solo registrar NavigationRoute con handler precacheado cuando index.html exista en el manifiesto (build prod)
const hasPrecachedIndex = manifestEntries.some((entry) => {
  const url = typeof entry === 'string' ? entry : entry.url;
  return url === '/index.html' || url === 'index.html';
});

if (hasPrecachedIndex) {
  const navigationHandler = createHandlerBoundToURL('/index.html');
  registerRoute(
    new NavigationRoute(navigationHandler, {
      denylist: [/^\/api\//, /^\/__\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
    })
  );
}

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

interface PushMessagePayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

self.addEventListener('push', (event: PushEvent) => {
  let parsed: PushMessagePayload = {};
  if (event.data) {
    try {
      parsed = event.data.json() as PushMessagePayload;
    } catch {
      parsed = { body: event.data.text() };
    }
  }

  const title = parsed.title || 'GROWy · Recordatorio de pago';
  const body =
    parsed.body ||
    'Tu fecha de pago está próxima a vencer. Renueva en Mercado Pago para evitar que tu cuenta quede bloqueada.';
  const tag = parsed.tag || 'growy-payment-reminder';
  const targetUrl = parsed.url || '/?reminder=payment';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/growy-icon-192.png',
      badge: '/growy-icon-192.png',
      tag,
      requireInteraction: Boolean(parsed.requireInteraction),
      data: { url: targetUrl },
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as { url?: string };
  const targetPath = data.url || '/?reminder=payment';
  const absoluteTarget = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focusedClient) => {
            if (focusedClient && 'navigate' in focusedClient) {
              return focusedClient.navigate(absoluteTarget);
            }
            return focusedClient;
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTarget);
      }
      return undefined;
    })
  );
});
