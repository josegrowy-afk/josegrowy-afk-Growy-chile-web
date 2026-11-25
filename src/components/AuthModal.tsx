import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { validateEmailAuthFields, type EmailAuthMode } from '../finance/phase4Marketing';
import { EquilibrioProductIcon, GrowyLogoMark } from './GrowyMotifs';
import { GROWY_EASE } from './MotionPrimitives';
import { EditorialText } from './design-system';

export interface EmailAuthSubmitPayload {
  mode: EmailAuthMode;
  email: string;
  password: string;
  displayName?: string;
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onEmailAuth: (payload: EmailAuthSubmitPayload) => Promise<{
    ok: boolean;
    message?: string;
  }>;
  authLoading: boolean;
  externalError?: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  onGoogleSignIn,
  onEmailAuth,
  authLoading,
  externalError,
}) => {
  const [mode, setMode] = useState<EmailAuthMode>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const resetMessages = () => {
    setLocalError(null);
    setInfoMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const check = validateEmailAuthFields({
      mode,
      email,
      password,
      displayName,
    });
    if (!check.valid) {
      setLocalError(check.error);
      return;
    }

    setEmailBusy(true);
    try {
      const res = await onEmailAuth({
        mode,
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      if (!res.ok) {
        setLocalError(res.message || 'No pudimos completar la operación.');
      } else if (res.message) {
        setInfoMessage(res.message);
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const busy = authLoading || emailBusy;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: GROWY_EASE }}
            className="w-full max-w-md growy-solid rounded-[32px] p-6 sm:p-7 space-y-5 my-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <GrowyLogoMark size="sm" />
                  <span className="text-[var(--sec-border)]" aria-hidden="true">·</span>
                  <EquilibrioProductIcon size="xs" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">Equilibrio</span>
                </div>
                <h2
                  id="auth-modal-title"
                  className="font-display text-2xl font-extrabold text-[var(--text-primary)] tracking-tight"
                >
                  <EditorialText
                    text={
                      mode === 'signup'
                        ? 'Crea tu cuenta en *GROWy*'
                        : mode === 'reset'
                          ? 'Recupera tu *contraseña*'
                          : 'Entra a tu *espacio* financiero'
                    }
                  />
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Tus costos, productos y proyecciones quedan privados bajo tu cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar ventana de acceso"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opción 1: Google Sign-In */}
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                resetMessages();
                void onGoogleSignIn();
              }}
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="w-full min-h-[48px] px-5 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2.5 hover:opacity-92 transition-opacity cursor-pointer disabled:opacity-60 shadow-xs"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{authLoading ? 'Conectando con Google...' : 'Entrar con Google'}</span>
            </button>

            <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
              <span className="h-px flex-1 bg-[var(--border-hairline)]" />
              <span>o usa tu correo y contraseña</span>
              <span className="h-px flex-1 bg-[var(--border-hairline)]" />
            </div>

            {/* Pestañas Iniciar sesión / Crear cuenta */}
            {mode !== 'reset' && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-full bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    resetMessages();
                  }}
                  style={
                    mode === 'signin'
                      ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                      : undefined
                  }
                  className={`min-h-[38px] rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    mode === 'signin'
                      ? 'shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Ya tengo cuenta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    resetMessages();
                  }}
                  style={
                    mode === 'signup'
                      ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                      : undefined
                  }
                  className={`min-h-[38px] rounded-full text-xs font-bold transition-colors cursor-pointer ${
                    mode === 'signup'
                      ? 'shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Crear cuenta nueva
                </button>
              </div>
            )}

            {(localError || externalError) && (
              <p className="text-xs font-semibold p-3 rounded-2xl bg-[var(--danger-soft)] text-[var(--danger-text)]">
                {localError || externalError}
              </p>
            )}

            {infoMessage && (
              <div className="p-3.5 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] text-xs font-semibold text-[var(--pos-text)] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold mb-1">
                    Tu nombre o el de tu pyme
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-name"
                      type="text"
                      placeholder="Ej. Camila · Taller Raíz"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="boho-input w-full pl-10"
                      disabled={busy}
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    placeholder="tucorreo@pyme.cl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="boho-input w-full pl-10"
                    disabled={busy}
                  />
                </div>
              </div>

              {mode !== 'reset' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="auth-password" className="block text-xs font-semibold">
                      Contraseña
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('reset');
                          resetMessages();
                        }}
                        className="text-[11px] font-semibold text-[var(--accent-strong)] hover:underline cursor-pointer"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="boho-input w-full pl-10 pr-10"
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  backgroundColor: 'var(--btn-navy-bg)',
                  color: 'var(--btn-navy-text)',
                }}
                className="w-full min-h-[46px] px-6 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 hover:opacity-92 transition-opacity cursor-pointer disabled:opacity-60"
              >
                <span>
                  {emailBusy
                    ? 'Procesando...'
                    : mode === 'signup'
                      ? 'Crear cuenta con correo'
                      : mode === 'reset'
                        ? 'Enviar enlace de recuperación'
                        : 'Entrar con mi correo'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {mode === 'reset' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    resetMessages();
                  }}
                  className="w-full min-h-[38px] text-xs font-semibold text-[var(--sec-text)] hover:underline cursor-pointer"
                >
                  Volver a iniciar sesión
                </button>
              )}
            </form>

            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed text-center">
              Al registrarte con correo, te enviaremos un enlace de confirmación por seguridad.
              Mantendrás exactamente los mismos planes y reglas de acceso que con Google.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
