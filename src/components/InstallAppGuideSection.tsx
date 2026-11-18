import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Laptop,
  Share,
  Smartphone,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallButton } from './PWAControls';

type DeviceTab = 'android' | 'ios' | 'desktop';

export const InstallAppGuideSection: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => {
  const { isInstalled, isIOS, isAndroid, isInIframe } = usePWAInstall();
  const [deviceTab, setDeviceTab] = useState<DeviceTab>(() =>
    isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
  );

  const directUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://growy.app';

  return (
    <section className="boho-card p-6 sm:p-7 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <p className="text-xs font-bold text-[var(--sec-text)] inline-flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span>Nube + App instalable en tu dispositivo</span>
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
            Cómo instalar GROWy. y Equilibrio en tu celular o computador
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Usa cada producto desde la nube o sigue estos pasos para instalarlo como aplicación
            independiente con su propio ícono y ventana en Windows, Mac, Android o iPhone.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isInstalled ? (
            <div className="px-4 py-2.5 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] text-xs font-bold text-[var(--pos-text)] inline-flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Ya estás usando la App instalada</span>
            </div>
          ) : (
            <PWAInstallButton />
          )}
        </div>
      </div>

      {isInIframe && (
        <div className="p-4 rounded-2xl bg-[var(--warn-soft)] border border-[var(--warn-border)] text-xs text-[var(--warn-text)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Importante:</strong> estás viendo GROWy dentro de una vista previa o ventana
              embebida. Si la instalas desde aquí, tu dispositivo puede guardar el enlace web en vez
              de la app real. Ábrela primero en una pestaña directa del navegador.
            </p>
          </div>
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-4 rounded-full bg-[var(--bg-surface)] border border-[var(--warn-border)] text-[var(--text-primary)] font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Abrir enlace directo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* SELECTOR DE DISPOSITIVO */}
      <div
        role="tablist"
        aria-label="Instrucciones según dispositivo"
        className="growy-tab-track"
      >
        <button
          type="button"
          role="tab"
          aria-selected={deviceTab === 'android'}
          onClick={() => setDeviceTab('android')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
            deviceTab === 'android'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[var(--pos-text)]" />
          <span>Android (Chrome)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={deviceTab === 'ios'}
          onClick={() => setDeviceTab('ios')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
            deviceTab === 'ios'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Share className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
          <span>iPhone / iPad (Safari)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={deviceTab === 'desktop'}
          onClick={() => setDeviceTab('desktop')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer ${
            deviceTab === 'desktop'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Laptop className="w-3.5 h-3.5 text-[var(--sec-text)]" />
          <span>Computador (PC / Mac)</span>
        </button>
      </div>

      {/* PASOS SEGÚN EQUIPO */}
      {deviceTab === 'android' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--pos-text)]">Paso 1</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Abre directo en Google Chrome
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Si abriste el enlace desde WhatsApp, Instagram o Gmail, toca los 3 puntos y elige{' '}
              <strong>&ldquo;Abrir en Chrome&rdquo;</strong> antes de instalar.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--pos-text)]">Paso 2</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Elige &ldquo;Instalar aplicación&rdquo;
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Pulsa el botón <strong>Instalar App</strong> de GROWy o abre el menú (⋮) de Chrome y
              toca <strong>&ldquo;Instalar aplicación&rdquo;</strong> (espera 2–3 segundos si solo
              dice &ldquo;Agregar a pantalla&rdquo;).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--pos-text)]">Paso 3</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Ábrela desde su ícono propio
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Chrome instalará la app real en tu cajón de aplicaciones (sin barra de direcciones ni
              logo de navegador encima).
            </p>
          </div>
        </div>
      )}

      {deviceTab === 'ios' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--accent-strong)]">Paso 1</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Usa siempre Safari (no Chrome)
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              En iPhone y iPad, Apple solo permite instalar apps web reales desde{' '}
              <strong>Safari</strong>. Si estás en otro navegador, copia el enlace y ábrelo en
              Safari.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--accent-strong)]">Paso 2</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Toca Compartir → Agregar a inicio
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Toca el botón <strong>Compartir</strong> (cuadro con flecha hacia arriba) en Safari,
              baja un poco y selecciona <strong>&ldquo;Agregar a inicio&rdquo;</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--accent-strong)]">Paso 3</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Confirma &ldquo;Agregar&rdquo; y abre el ícono
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Pulsa <strong>Agregar</strong> arriba a la derecha. Luego ábrela desde el ícono de
              GROWy en tu pantalla de inicio: cargará en pantalla completa sin barras de Safari.
            </p>
          </div>
        </div>
      )}

      {deviceTab === 'desktop' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--sec-text)]">Paso 1</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Abre en Chrome o Microsoft Edge
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Asegúrate de estar en la pestaña directa de GROWy (no dentro de una vista previa
              embebida) usando Google Chrome o Microsoft Edge.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--sec-text)]">Paso 2</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Usa el ícono de Instalar en la barra
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Haz clic en el botón <strong>Instalar App</strong> de GROWy o en el ícono de pantalla
              con flecha que aparece a la derecha de la barra de dirección y pulsa{' '}
              <strong>Instalar</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1">
            <p className="font-mono text-xs font-bold text-[var(--sec-text)]">Paso 3</p>
            <h3 className="font-display text-sm font-bold text-[var(--text-primary)]">
              Si creas acceso directo, marca ventana
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Si usas <em>Más herramientas → Crear acceso directo</em>, marca la casilla{' '}
              <strong>&ldquo;Abrir como ventana&rdquo;</strong> para que funcione como programa
              instalado y no abra pestañas del navegador.
            </p>
          </div>
        </div>
      )}

      {/* DIAGNÓSTICO ESPECÍFICO: POR QUÉ REDIRIGE A LA WEB */}
      {!compact && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)] space-y-2">
          <p className="text-xs font-bold text-[var(--sec-text)]">
            ¿La instalaste pero al abrirla te redirigió a la página web? Revisa estos 3 motivos:
          </p>
          <ul className="space-y-1.5 text-xs text-[var(--text-primary)] leading-relaxed">
            <li>
              <strong>1. Se creó un &ldquo;Acceso directo&rdquo; en lugar de &ldquo;Instalar aplicación&rdquo;:</strong>{' '}
              Si el ícono tiene un circulito pequeño de Chrome/Safari encima o en PC no marcaste{' '}
              <em>&ldquo;Abrir como ventana&rdquo;</em>, solo guardaste un marcador web. Bórralo y
              repite usando <strong>&ldquo;Instalar aplicación&rdquo;</strong>.
            </li>
            <li>
              <strong>2. La instalaste desde WhatsApp, Instagram, Gmail o una vista embebida:</strong>{' '}
              Los navegadores internos de otras apps no instalan PWAs completas. Abre primero el
              enlace directo en <strong>Chrome / Edge</strong> (Android o PC) o{' '}
              <strong>Safari</strong> (iPhone).
            </li>
            <li>
              <strong>3. En iPhone usaste Chrome u otro navegador:</strong> En iOS únicamente{' '}
              <strong>Safari → Compartir → Agregar a inicio</strong> abre GROWy como aplicación
              independiente con el ícono oficial.
            </li>
            <li>
              <strong>4. ¿Ves un ícono antiguo en tu inicio?:</strong> Los celulares y PC guardan el
              ícono en caché al instalar. Elimina o desinstala el ícono anterior, recarga la página
              e instálala nuevamente para ver el logo actual de <strong>GROWy.</strong>
            </li>
          </ul>
        </div>
      )}
    </section>
  );
};
