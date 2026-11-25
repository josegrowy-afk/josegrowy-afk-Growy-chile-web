import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable && !isInIframe) {
    return (
      <button
        type="button"
        onClick={install}
        style={{
          backgroundColor: 'var(--btn-navy-bg)',
          color: 'var(--btn-navy-text)',
        }}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-full text-xs font-semibold hover:opacity-92 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{compact ? 'Instalar' : 'Instalar App'}</span>
      </button>
    );
  }

  if (isIOS || isInIframe || !compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-4 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--accent-soft)] hover:bg-[var(--bg-soft)] text-[var(--text-primary)] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="w-4 h-4 shrink-0 text-[var(--accent-strong)]" />
          <span>{compact ? 'Instalar' : isIOS ? 'Instalar en iPhone' : 'Cómo instalar App'}</span>
        </button>

        {showGuideModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-guide-title"
          >
            <div className="w-full max-w-md growy-solid p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="pwa-guide-title"
                    className="font-display text-2xl font-bold text-[var(--text-primary)]"
                  >
                    Instalar GROWy como App
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Para que abra como aplicación independiente y no como página web en el navegador.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="Cerrar guía de instalación"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isInIframe && (
                <div className="mt-4 p-3.5 rounded-2xl bg-[var(--warn-soft)] border border-[var(--warn-border)] text-xs text-[var(--warn-text)] space-y-2">
                  <p className="leading-relaxed">
                    <strong>Estás en una vista previa embebida.</strong> Para que se instale como
                    app real, ábrela primero en una pestaña directa del navegador:
                  </p>
                  <a
                    href={typeof window !== 'undefined' ? window.location.origin : '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[38px] px-4 rounded-full bg-[var(--bg-surface)] border border-[var(--warn-border)] text-[var(--text-primary)] font-bold"
                  >
                    Abrir enlace directo para instalar
                  </a>
                </div>
              )}

              <div className="mt-4 space-y-3 text-sm">
                <div className="p-3.5 rounded-2xl bg-[var(--accent-soft)]">
                  <p className="font-semibold text-xs sm:text-sm">En iPhone / iPad (solo Safari)</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    1. Abre este enlace en <strong>Safari</strong> (no Chrome ni WhatsApp).
                    <br />
                    2. Toca <strong>Compartir</strong> y elige <strong>Agregar a inicio</strong>.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[var(--pos-soft)]">
                  <p className="font-semibold text-xs sm:text-sm">En Android (Google Chrome)</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Abre el menú (⋮) de Chrome y pulsa <strong>&ldquo;Instalar aplicación&rdquo;</strong>{' '}
                    (evita <em>&ldquo;Crear acceso directo&rdquo;</em> para que no abra el navegador).
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[var(--sec-soft)]">
                  <p className="font-semibold text-xs sm:text-sm">En Computador (Chrome o Edge)</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Haz clic en el ícono de instalar en la barra de dirección, o en{' '}
                    <em>Crear acceso directo</em> marca siempre{' '}
                    <strong>&ldquo;Abrir como ventana&rdquo;</strong>.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                style={{
                  backgroundColor: 'var(--btn-navy-bg)',
                  color: 'var(--btn-navy-text)',
                }}
                className="mt-5 w-full min-h-[44px] rounded-full text-sm font-semibold hover:opacity-92 transition-opacity cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      style={{
        backgroundColor: 'var(--btn-navy-bg)',
        color: 'var(--btn-navy-text)',
      }}
      className="fixed bottom-24 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Sin conexión — los cambios se sincronizarán al volver</span>
    </div>
  );
};
