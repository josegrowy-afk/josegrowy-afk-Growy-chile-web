import React, { useState } from 'react';
import { CheckCircle2, LogOut, Mail, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { EquilibrioProductIcon, GrowyLogoMark } from './GrowyMotifs';
import { GROWY_EASE } from './MotionPrimitives';
import { BackdropBlobs, EditorialText } from './design-system';

interface EmailVerificationWallProps {
  email: string;
  onCheckVerified: () => Promise<{ verified: boolean; message: string }>;
  onResendEmail: () => Promise<{ sent: boolean; message: string }>;
  onSignOut: () => void;
}

export const EmailVerificationWall: React.FC<EmailVerificationWallProps> = ({
  email,
  onCheckVerified,
  onResendEmail,
  onSignOut,
}) => {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleCheck = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onCheckVerified();
      setFeedback({
        type: res.verified ? 'ok' : 'err',
        text: res.message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await onResendEmail();
      setFeedback({
        type: res.sent ? 'ok' : 'err',
        text: res.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-x-clip">
      <BackdropBlobs />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: GROWY_EASE }}
        className="relative z-10 w-full max-w-lg growy-solid p-6 sm:p-8 space-y-5"
      >
        <div className="growy-banner-surface rounded-[24px] p-5 flex items-start justify-between gap-3">
          <div className="growy-banner-grain" aria-hidden="true" />
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <GrowyLogoMark size="sm" />
              <span style={{ color: 'var(--hero-sub-ink)' }} aria-hidden="true">·</span>
              <EquilibrioProductIcon size="xs" />
              <span
                className="font-display text-xs font-bold"
                style={{ color: 'var(--hero-ink)' }}
              >
                Equilibrio
              </span>
            </div>
            <h1
              className="font-display text-2xl font-extrabold tracking-tight"
              style={{ color: 'var(--hero-ink)' }}
            >
              <EditorialText text="Confirma tu correo para *proteger* tus datos" />
            </h1>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="relative z-10 min-h-[40px] px-4 rounded-full border border-white/80 bg-white/85 text-xs font-semibold text-[#1F1B2E] inline-flex items-center gap-1.5 hover:bg-white cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)] flex items-start gap-3 text-xs sm:text-sm text-[var(--text-primary)]">
          <Mail className="w-5 h-5 text-[var(--sec-text)] shrink-0 mt-0.5" />
          <div className="space-y-1 leading-relaxed">
            <p>
              Te enviamos un enlace de verificación a <strong>{email}</strong>.
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Por seguridad, en GROWy solo habilitamos la base privada de tu pyme cuando confirmas
              que ese correo es tuyo (revisa también spam o promociones).
            </p>
          </div>
        </div>

        {feedback && (
          <p
            className={`text-xs font-semibold p-3 rounded-2xl ${
              feedback.type === 'ok'
                ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                : 'bg-[var(--warn-soft)] text-[var(--warn-text)]'
            }`}
          >
            {feedback.text}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCheck()}
            style={{
              backgroundColor: 'var(--btn-navy-bg)',
              color: 'var(--btn-navy-text)',
            }}
            className="flex-1 min-h-[48px] px-5 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 hover:opacity-92 transition-opacity shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Ya confirmé mi correo · Continuar</span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleResend()}
            className="min-h-[48px] px-5 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-xs font-semibold text-[var(--text-primary)] inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reenviar enlace</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
