import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Mail,
  Moon,
  Paperclip,
  Play,
  PlayCircle,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createSupportTicket, DEFAULT_LANDING_CONTENT } from '../firebase/services';
import type {
  AppConfig,
  FaqCategory,
  FaqItem,
  TicketAttachment,
  TicketType,
} from '../types/finance';
import {
  formatAttachmentSize,
  MAX_SUPPORT_ATTACHMENTS,
  processSupportAttachments,
} from '../utils/attachments';
import { BreakEvenExampleChart } from './BreakEvenExampleChart';
import {
  DoodleIdeaMotif,
  DoodleSparkleMotif,
  DoodleSproutMotif,
  EquilibrioProductIcon,
  GrowyCharacterArtwork,
  GrowyDivider,
  GrowyLogoMark,
} from './GrowyMotifs';
import { InstallAppGuideSection } from './InstallAppGuideSection';
import {
  GROWY_EASE,
  ScrollReveal,
  StaggerItem,
  StaggerSection,
} from './MotionPrimitives';
import { EquilibrioProductMockup, ProductShowcaseCard } from './ProductShowcaseCard';

interface LandingPageProps {
  config: AppConfig;
  faqs: FaqItem[];
  isDark: boolean;
  isSignedIn: boolean;
  onToggleTheme: () => void;
  onLoginClick: () => void;
  authLoading: boolean;
  authError: string | null;
}

const FAQ_CAT_LABELS: Record<FaqCategory | 'all', string> = {
  all: 'Todas',
  uso: 'Uso y alcance',
  calculos: 'Punto de equilibrio',
  pagos: 'Pago y acceso',
  cuenta: 'Cuenta',
  soporte: 'Soporte',
};

function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Renderiza el titular del Hero destacando en Fraunces cursiva (#B4474A)
 * el texto entre asteriscos (*sueña*) o la palabra "sueña" si no tiene asteriscos.
 */
function renderHeroHeadline(title: string): React.ReactNode {
  const starMatch = title.match(/\*(.+?)\*/);
  if (starMatch && starMatch.index !== undefined) {
    const before = title.slice(0, starMatch.index);
    const word = starMatch[1];
    const after = title.slice(starMatch.index + starMatch[0].length);
    return (
      <>
        {before}
        <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
          {word}
        </em>
        {after}
      </>
    );
  }

  const suenaIndex = title.toLowerCase().indexOf('sueña');
  if (suenaIndex !== -1) {
    const before = title.slice(0, suenaIndex);
    const word = title.slice(suenaIndex, suenaIndex + 5);
    const after = title.slice(suenaIndex + 5);
    return (
      <>
        {before}
        <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
          {word}
        </em>
        {after}
      </>
    );
  }

  return title;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  config,
  faqs,
  isDark,
  isSignedIn,
  onToggleTheme,
  onLoginClick,
  authLoading,
  authError,
}) => {
  const lc = useMemo(
    () => ({
      ...DEFAULT_LANDING_CONTENT,
      ...(config.landingContent ?? {}),
    }),
    [config.landingContent]
  );

  // FAQ state
  const [faqQuery, setFaqQuery] = useState('');
  const [faqCat, setFaqCat] = useState<FaqCategory | 'all'>('all');
  const [openFaqId, setOpenFaqId] = useState<string | null>(faqs[0]?.id ?? null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Novedades Próximamente (correo opcional)
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySending, setNotifySending] = useState(false);
  const [notifyFeedback, setNotifyFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Formulario de contacto
  const [contactType, setContactType] = useState<TicketType>('duda');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [contactAttachments, setContactAttachments] = useState<TicketAttachment[]>([]);
  const [contactAttachError, setContactAttachError] = useState<string | null>(null);
  const contactFileRef = useRef<HTMLInputElement | null>(null);
  const [contactSending, setContactSending] = useState(false);
  const [contactFeedback, setContactFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Video educativo "Aprende con nosotros"
  const learnVideoRef = useRef<HTMLVideoElement | null>(null);
  const [learnVideoStarted, setLearnVideoStarted] = useState(false);

  // Modales legales
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  const heroChecks = useMemo(() => splitLines(lc.heroChecks), [lc.heroChecks]);

  const importancePoints = useMemo(
    () => splitLines(lc.breakevenImportancePoints),
    [lc.breakevenImportancePoints]
  );

  const equilibrioFeatures = useMemo(
    () => splitLines(lc.equilibrioFeatures),
    [lc.equilibrioFeatures]
  );

  const creatorParagraphs = useMemo(() => splitParagraphs(lc.creatorBio), [lc.creatorBio]);

  const filteredFaqs = useMemo(() => {
    const q = faqQuery.trim().toLowerCase();
    return faqs.filter((item) => {
      if (faqCat !== 'all' && item.category !== faqCat) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q)
      );
    });
  }, [faqs, faqCat, faqQuery]);

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = notifyEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setNotifyFeedback({ type: 'err', text: 'Ingresa un correo electrónico válido.' });
      return;
    }
    setNotifySending(true);
    setNotifyFeedback(null);
    try {
      await createSupportTicket({
        userId: 'guest',
        name: 'Lista de novedades Growy',
        email: clean,
        subject: 'Aviso de próximos productos de Growy',
        message: `El visitante ${clean} dejó su correo en la sección Próximamente para recibir novedades de nuevas herramientas de Growy.`,
        ticketType: 'sugerencia',
      });
      setNotifyEmail('');
      setNotifyFeedback({
        type: 'ok',
        text: 'Gracias. Te avisaremos por correo cuando sumemos nuevas herramientas a Growy.',
      });
    } catch {
      setNotifyFeedback({
        type: 'err',
        text: 'No pudimos registrar tu correo ahora. Intenta nuevamente en unos segundos.',
      });
    } finally {
      setNotifySending(false);
    }
  };

  const handleContactFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setContactAttachError(null);
    try {
      const processed = await processSupportAttachments(files, contactAttachments.length);
      setContactAttachments((prev) =>
        [...prev, ...processed].slice(0, MAX_SUPPORT_ATTACHMENTS)
      );
    } catch (err) {
      setContactAttachError(
        err instanceof Error ? err.message : 'No se pudo adjuntar el documento.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactName.trim().length < 2) {
      setContactFeedback({ type: 'err', text: 'Ingresa tu nombre.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setContactFeedback({ type: 'err', text: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (contactSubject.trim().length < 3 || contactMsg.trim().length < 5) {
      setContactFeedback({
        type: 'err',
        text: 'Escribe un asunto y un mensaje de al menos 5 caracteres.',
      });
      return;
    }

    setContactSending(true);
    setContactFeedback(null);
    try {
      await createSupportTicket({
        userId: 'guest',
        name: contactName.trim(),
        email: contactEmail.trim(),
        subject: contactSubject.trim(),
        message: contactMsg.trim(),
        ticketType: contactType,
        attachments: contactAttachments,
      });
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMsg('');
      setContactAttachments([]);
      setContactAttachError(null);
      setContactFeedback({
        type: 'ok',
        text: `Mensaje enviado a ${config.contactEmail}. Te responderemos a la brevedad.`,
      });
    } catch {
      setContactFeedback({
        type: 'err',
        text: 'No se pudo enviar el mensaje. Intenta nuevamente en unos segundos.',
      });
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* BARRA SUPERIOR: Logo GROWy. | 5 enlaces | Entrar con Google + Modo oscuro */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas-alpha)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <a
            href="#inicio"
            aria-label="GROWy. Inicio"
            className="whitespace-nowrap shrink-0"
          >
            <GrowyLogoMark size="md" />
          </a>

          <nav
            aria-label="Secciones principales"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--text-secondary)]"
          >
            <a
              href="#que-es-growy"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Plataforma
            </a>
            <a
              href="#equilibrio"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Equilibrio
            </a>
            <a
              href="#punto-de-equilibrio"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Punto de equilibrio
            </a>
            <a
              href="#creador"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Quién soy
            </a>
            <a
              href="#faq"
              className="hover:text-[var(--text-primary)] transition-colors whitespace-nowrap shrink-0"
            >
              Preguntas
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Activar modo día' : 'Activar modo noche'}
              className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-full hover:bg-[var(--bg-surface)] cursor-pointer transition-colors"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[var(--gold-motif)]" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--text-primary)]" />
              )}
            </button>
            <button
              type="button"
              onClick={onLoginClick}
              disabled={authLoading}
              className="min-h-[44px] px-6 py-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-xs"
            >
              {isSignedIn ? 'Ir a mi cuenta' : authLoading ? 'Conectando...' : 'Entrar con Google'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 1. HERO */}
        <section id="inicio" className="relative overflow-hidden pt-10 pb-10 sm:pt-14 sm:pb-12">
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <StaggerSection className="lg:col-span-6 space-y-6">
              <StaggerItem>
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--sec-soft)] border border-[var(--sec-border)] text-xs font-semibold text-[var(--sec-text)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--sec-text)] shrink-0" />
                  <span>{lc.heroEyebrow}</span>
                </span>
              </StaggerItem>

              <StaggerItem>
                <h1
                  className="font-display font-bold text-[var(--text-primary)] leading-[1.05] tracking-[-0.03em] text-balance"
                  style={{ fontSize: 'clamp(2.55rem, 4.6vw, 4.15rem)' }}
                >
                  {renderHeroHeadline(config.heroTitle)}
                </h1>
              </StaggerItem>

              <StaggerItem>
                <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed max-w-xl">
                  {config.heroSubtitle}
                </p>
              </StaggerItem>

              {authError && (
                <StaggerItem>
                  <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] p-3 rounded-2xl max-w-lg">
                    {authError}
                  </p>
                </StaggerItem>
              )}

              <StaggerItem>
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <a
                    href="#equilibrio"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors whitespace-nowrap shadow-xs"
                  >
                    <span>{lc.heroPrimaryCta}</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>

                  <a
                    href="#punto-de-equilibrio"
                    className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] border border-[var(--sec-border)] text-sm font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap"
                  >
                    ¿Qué es el punto de equilibrio?
                  </a>
                </div>
              </StaggerItem>

              <StaggerItem>
                <ul className="flex flex-wrap items-center gap-x-6 gap-y-2.5 pt-2">
                  {heroChecks.map((checkLabel) => (
                    <li
                      key={checkLabel}
                      className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-[var(--text-secondary)]"
                    >
                      <Check
                        className="w-4 h-4 text-[var(--pos-text)] shrink-0"
                        strokeWidth={2.4}
                      />
                      <span>{checkLabel}</span>
                    </li>
                  ))}
                </ul>
              </StaggerItem>
            </StaggerSection>

            {/* Columna derecha: tarjeta blanca grande con el personaje oficial y tarjetas de producto */}
            <motion.div
              className="lg:col-span-6"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.1, ease: GROWY_EASE }}
            >
              <div className="boho-card rounded-[36px] p-5 sm:p-6 space-y-4">
                <div
                  className="rounded-[26px] px-4 pt-5 pb-3 overflow-hidden"
                  style={{
                    background: isDark
                      ? 'linear-gradient(155deg, #2B2440 0%, #37252D 100%)'
                      : 'linear-gradient(155deg, #EDEAF8 0%, #FBECE9 100%)',
                  }}
                >
                  <GrowyCharacterArtwork className="w-full max-w-[360px] mx-auto block select-none growy-float-a" />
                </div>

                {/* 01 · Equilibrio (verde destacada) */}
                <a
                  href="#equilibrio"
                  className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-[var(--pos-soft)] hover:opacity-95 border border-[var(--pos-dot)]/60 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <EquilibrioProductIcon size="sm" />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-[var(--text-primary)]">
                        01 · Equilibrio
                      </p>
                      <p className="text-xs font-medium text-[var(--pos-text)] mt-0.5 tabular-nums">
                        Disponible ahora · Desde {config.priceLabel} o $50.000 / año
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-primary)] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </a>

                {/* 02 y 03 · Próximamente (borde punteado lila) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="px-4 py-3 rounded-2xl border border-dashed border-[var(--sec-border)] bg-[var(--sec-soft)]/55">
                    <p className="font-display text-xs font-bold text-[var(--sec-text)]">
                      02 · Próximamente
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Innovación y creatividad
                    </p>
                  </div>
                  <div className="px-4 py-3 rounded-2xl border border-dashed border-[var(--sec-border)] bg-[var(--sec-soft)]/55">
                    <p className="font-display text-xs font-bold text-[var(--sec-text)]">
                      03 · Próximamente
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Automatización de procesos
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2. TRES PASOS DE CÓMO FUNCIONA */}
        <section id="como-funciona" className="py-6 sm:py-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerSection className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              { title: lc.step1Title, desc: lc.step1Desc },
              { title: lc.step2Title, desc: lc.step2Desc },
              { title: lc.step3Title, desc: lc.step3Desc },
            ].map((step) => (
              <StaggerItem key={step.title}>
                <div className="boho-card boho-card-hover rounded-[24px] px-6 py-5 h-full space-y-1.5">
                  <h2 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-tight">
                    {step.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerSection>
        </section>

        {/* 2B. APRENDE CON NOSOTROS (Video explicativo en la parte inicial) */}
        <section
          id="aprende-con-nosotros"
          className="py-10 sm:py-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20"
        >
          <ScrollReveal>
            <div className="boho-card rounded-[32px] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center border-2 border-[var(--sec-border)]">
              {/* Texto introductorio */}
              <div className="lg:col-span-5 space-y-5">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--sec-soft)] border border-[var(--sec-border)] text-xs font-semibold text-[var(--sec-text)]">
                  <PlayCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Aprende con nosotros</span>
                </span>

                <div className="space-y-2.5">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                    ¿Qué es el punto de equilibrio?{' '}
                    <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                      En un minuto.
                    </em>
                  </h2>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                    Si recién estás conociendo Growy, parte por aquí. Te explicamos de forma simple y
                    visual cómo saber cuánto debes vender para no perder dinero y empezar a ganar.
                  </p>
                </div>

                <ul className="space-y-2.5 text-xs sm:text-sm text-[var(--text-primary)]">
                  {[
                    'El momento exacto en que tus ventas cubren tus costos',
                    'Solo 3 números: costos fijos, variables y precio',
                    'Ejemplo práctico paso a paso con velas artesanales',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[var(--pos-soft)] border border-[var(--pos-border)] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[var(--pos-text)]" strokeWidth={2.5} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <a
                    href="#punto-de-equilibrio"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-xs sm:text-sm font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap"
                  >
                    <span>Probar ejemplo interactivo</span>
                  </a>
                  <a
                    href="#equilibrio"
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
                  >
                    <span>Conocer Equilibrio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Reproductor del video */}
              <div className="lg:col-span-7">
                <div className="relative aspect-video rounded-[24px] overflow-hidden bg-[#101018] border border-[var(--sec-border)] shadow-lg">
                  <video
                    ref={learnVideoRef}
                    src="/assets/aistudio/Video_Project_47975f9c.mp4"
                    controls
                    playsInline
                    preload="metadata"
                    onPlay={() => setLearnVideoStarted(true)}
                    aria-label="Aprende con nosotros: video de Growy explicando qué es el punto de equilibrio"
                    className="w-full h-full object-contain block"
                  >
                    Tu navegador no puede reproducir este video. Puedes descargarlo desde{' '}
                    <a href="/assets/aistudio/Video_Project_47975f9c.mp4">aquí</a>.
                  </video>

                  {!learnVideoStarted && (
                    <button
                      type="button"
                      onClick={() => {
                        setLearnVideoStarted(true);
                        void learnVideoRef.current?.play();
                      }}
                      aria-label="Reproducir video Aprende con nosotros: ¿Qué es el punto de equilibrio?"
                      className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-4 p-6 text-center bg-gradient-to-br from-[#161322]/95 via-[#1C182B]/92 to-[#271C33]/95 text-white cursor-pointer group transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <EquilibrioProductIcon size="sm" />
                        <span className="text-xs font-semibold tracking-wide text-[#F6A59E]">
                          Growy te explica · 1 min
                        </span>
                      </div>
                      <div className="space-y-1 max-w-md">
                        <p className="font-display text-xl sm:text-2xl font-bold leading-snug">
                          ¿Qué es el punto de equilibrio?
                        </p>
                        <p className="text-xs sm:text-sm text-[#CFC5EE]">
                          Una explicación simple, en un minuto.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[var(--accent-btn)] group-hover:bg-[var(--accent-btn-hover)] text-[#1F1B2E] text-sm font-bold shadow-md transition-transform group-hover:scale-[1.03]">
                        <Play className="w-4 h-4 fill-current" />
                        <span>Ver video ahora</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* 3. QUÉ ES GROWY */}
        <section
          id="que-es-growy"
          className="py-14 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <ScrollReveal className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-[var(--sec-text)]">
                <DoodleSparkleMotif className="w-5 h-5 shrink-0" />
                <span>{lc.whatIsEyebrow}</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                {lc.whatIsTitle}
              </h2>
            </ScrollReveal>

            <ScrollReveal className="lg:col-span-7 space-y-7" delay={0.05}>
              <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
                {lc.whatIsBody}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="boho-card rounded-[28px] p-6 space-y-3">
                  <DoodleIdeaMotif className="w-9 h-9" />
                  <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                    {lc.whatIsPillar1Title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {lc.whatIsPillar1Desc}
                  </p>
                </div>

                <div className="boho-card rounded-[28px] p-6 space-y-3">
                  <DoodleSproutMotif className="w-9 h-9" />
                  <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
                    {lc.whatIsPillar2Title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {lc.whatIsPillar2Desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* 4. SECCIÓN EDUCATIVA: PRIMERO, LOS CIMIENTOS: ¿QUÉ ES EL PUNTO DE EQUILIBRIO? */}
        <section
          id="punto-de-equilibrio"
          className="py-16 sm:py-22 bg-[var(--sec-soft)]/55 border-y border-[var(--border-hairline)] scroll-mt-20"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            {/* Qué es */}
            <ScrollReveal className="max-w-3xl space-y-3.5">
              <p className="text-xs font-semibold text-[var(--sec-text)]">
                {lc.breakevenEyebrow}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                {lc.breakevenTitle}
              </h2>
              <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
                {lc.breakevenDefinition}
              </p>
            </ScrollReveal>

            {/* Por qué es tan importante + Los tres números simples */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <ScrollReveal className="lg:col-span-5 boho-card rounded-[28px] p-6 sm:p-8 space-y-4">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                  {lc.breakevenImportanceTitle}
                </h3>
                <ul className="space-y-3.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {importancePoints.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-[var(--pos-soft)] border border-[var(--pos-border)] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[var(--pos-text)]" strokeWidth={2.5} />
                      </span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </ScrollReveal>

              <ScrollReveal className="lg:col-span-7 space-y-5" delay={0.05}>
                <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                  {lc.breakevenPillarsTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                    <span className="font-mono text-xs font-semibold text-[var(--accent-strong)]">
                      01
                    </span>
                    <h4 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      {lc.breakevenFixedTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {lc.breakevenFixedDesc}
                    </p>
                  </div>

                  <div className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                    <span className="font-mono text-xs font-semibold text-[var(--sec-text)]">
                      02
                    </span>
                    <h4 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      {lc.breakevenVariableTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {lc.breakevenVariableDesc}
                    </p>
                  </div>

                  <div className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                    <span className="font-mono text-xs font-semibold text-[var(--pos-text)]">
                      03
                    </span>
                    <h4 className="font-display text-lg font-bold text-[var(--text-primary)]">
                      {lc.breakevenPriceTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {lc.breakevenPriceDesc}
                    </p>
                  </div>
                </div>

                {/* De la realidad a la proyección */}
                <div className="p-6 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--sec-border)] space-y-2">
                  <p className="text-xs font-semibold text-[var(--sec-text)]">
                    De la realidad a la proyección
                  </p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                    {lc.breakevenRealityToProjection}
                  </p>
                </div>
              </ScrollReveal>
            </div>

            {/* Ejemplo visual con gráfico */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <ScrollReveal className="lg:col-span-5 space-y-4">
                <p className="text-xs font-semibold text-[var(--warn-text)]">
                  Ejemplo visual
                </p>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight text-balance">
                  {lc.breakevenExampleTitle}
                </h3>
                <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                  {lc.breakevenExampleBody}
                </p>
              </ScrollReveal>

              <ScrollReveal className="lg:col-span-7" delay={0.05}>
                <BreakEvenExampleChart />
              </ScrollReveal>
            </div>

            {/* Frase de cierre destacada */}
            <ScrollReveal className="text-center max-w-3xl mx-auto pt-2 space-y-2.5">
              <DoodleSparkleMotif className="w-7 h-7 mx-auto" />
              <blockquote className="font-editorial italic text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] text-balance leading-snug">
                &ldquo;{lc.breakevenClosingQuote}&rdquo;
              </blockquote>
            </ScrollReveal>
          </div>
        </section>

        {/* 5. NUESTRO PRIMER PRODUCTO: EQUILIBRIO */}
        <section
          id="equilibrio"
          className="py-16 sm:py-22 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-20"
        >
          <ScrollReveal>
            <ProductShowcaseCard
              eyebrow={lc.equilibrioEyebrow}
              title={lc.equilibrioTitle}
              subtitle={lc.equilibrioSubtitle}
              features={equilibrioFeatures}
              priceLabel={config.priceLabel}
              priceNote={config.currencyNote}
              ctaLabel={lc.equilibrioCtaLabel}
              paymentUrl={config.paymentUrl}
              annualPriceLabel="$50.000 / año"
              annualPriceNote="12 meses completos (ahorras $21.880). Al vencer el año se bloquea hasta renovar mensual o anual."
              annualCtaLabel="Plan anual ($50.000 / año)"
              annualPaymentUrl={config.annualPaymentUrl || config.paymentUrl}
              trustNote={lc.equilibrioTrustNote}
              iconSrc="/assets/aistudio/equilibrio-chispa-claro_8dfad465.svg"
              secondaryAction={{
                label: isSignedIn
                  ? 'Abrir mi panel'
                  : authLoading
                    ? 'Conectando...'
                    : 'Ya tengo acceso · Entrar',
                onClick: onLoginClick,
                disabled: authLoading,
              }}
              mockupSlot={<EquilibrioProductMockup />}
            />
          </ScrollReveal>
        </section>

        {/* 6. PRÓXIMAMENTE */}
        <section
          id="proximamente"
          className="py-14 sm:py-20 bg-[var(--sec-soft)]/45 border-y border-[var(--border-hairline)] scroll-mt-20"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <ScrollReveal className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold text-[var(--sec-text)]">
                {lc.upcomingEyebrow}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight text-balance">
                {lc.upcomingTitle}
              </h2>
              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                {lc.upcomingSubtitle}
              </p>
            </ScrollReveal>

            <StaggerSection inView className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[0, 1, 2].map((idx) => (
                <StaggerItem key={idx}>
                  <div className="p-7 rounded-[28px] bg-[var(--bg-surface)] border border-dashed border-[var(--sec-border)] flex flex-col items-start justify-between gap-6 h-full min-h-[156px]">
                    <DoodleSparkleMotif className="w-7 h-7" />
                    <div className="space-y-1">
                      <p className="font-display text-xl font-bold text-[var(--text-primary)]">
                        Próximamente
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Nueva herramienta dentro de Growy
                      </p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerSection>

            {/* Campo opcional para recibir novedades */}
            <ScrollReveal>
              <form
                onSubmit={handleNotifySubmit}
                className="p-6 rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    ¿Quieres enterarte cuando sumemos nuevas herramientas?
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Déjanos tu correo opcionalmente y te avisaremos cuando estén listas.
                  </p>
                  {notifyFeedback && (
                    <p
                      className={`text-xs font-semibold pt-1 ${
                        notifyFeedback.type === 'ok'
                          ? 'text-[var(--pos-text)]'
                          : 'text-[var(--danger-text)]'
                      }`}
                    >
                      {notifyFeedback.text}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
                  <input
                    type="email"
                    value={notifyEmail}
                    onChange={(e) => setNotifyEmail(e.target.value)}
                    placeholder="tucorreo@pyme.cl"
                    aria-label="Correo electrónico para recibir novedades"
                    className="boho-input rounded-full px-5 sm:w-64"
                  />
                  <button
                    type="submit"
                    disabled={notifySending}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-full bg-[var(--sec-soft)] hover:opacity-90 border border-[var(--sec-border)] text-[var(--sec-text)] text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{notifySending ? 'Guardando...' : 'Avisarme'}</span>
                  </button>
                </div>
              </form>
            </ScrollReveal>
          </div>
        </section>

        {/* 7. QUIÉN ESTÁ DETRÁS DE GROWY (franja oscura #1F1B2E + historia de José Ignacia) */}
        <section
          id="creador"
          className="py-16 sm:py-22 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-20"
        >
          {/* Franja oscura (#1F1B2E) con cita en Fraunces cursiva y botón Conocer la historia */}
          <ScrollReveal>
            <div className="rounded-[32px] bg-[#1F1B2E] text-white px-7 py-8 sm:px-10 sm:py-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2 max-w-2xl">
                <blockquote className="font-editorial italic text-xl sm:text-2xl lg:text-[1.75rem] font-semibold leading-snug text-white text-balance">
                  &ldquo;{lc.breakevenClosingQuote}&rdquo;
                </blockquote>
                <p className="text-xs sm:text-sm text-[#CFC5EE] font-medium">
                  {lc.creatorName} · {lc.creatorRole}
                </p>
              </div>
              <a
                href="#historia-creador"
                className="inline-flex items-center justify-center min-h-[46px] px-7 py-3 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[#1F1B2E] text-sm font-bold transition-colors whitespace-nowrap shrink-0 self-start lg:self-center"
              >
                {lc.creatorQuoteCta}
              </a>
            </div>
          </ScrollReveal>

          {/* Historia de José Ignacia */}
          <ScrollReveal>
            <div
              id="historia-creador"
              className="boho-card rounded-[32px] p-7 sm:p-11 space-y-6 scroll-mt-24"
            >
              <div className="space-y-2 max-w-3xl">
                <p className="text-xs font-semibold text-[var(--sec-text)]">
                  {lc.creatorEyebrow}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                  {lc.creatorTitle}
                </h2>
                <p className="text-sm font-medium text-[var(--pos-text)]">
                  {lc.creatorName} · {lc.creatorRole}
                </p>
              </div>

              <div className="space-y-4 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-4xl">
                {creatorParagraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              <p className="text-xs font-medium text-[var(--text-secondary)] pt-3 border-t border-[var(--border-hairline)]">
                {lc.creatorClosingNote}
              </p>
            </div>
          </ScrollReveal>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <GrowyDivider />
        </div>

        {/* 8. PREGUNTAS FRECUENTES */}
        <section
          id="faq"
          className="py-16 sm:py-22 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-20"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[var(--sec-text)]">
                Preguntas frecuentes
              </p>
              <h2 className="font-display text-3xl font-bold text-[var(--text-primary)] tracking-tight mt-1">
                Claridad antes de empezar
              </h2>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Buscar pregunta..."
                value={faqQuery}
                onChange={(e) => setFaqQuery(e.target.value)}
                className="boho-input rounded-full w-full pl-10"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(FAQ_CAT_LABELS) as Array<FaqCategory | 'all'>).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFaqCat(cat)}
                className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  faqCat === cat
                    ? 'bg-[var(--sec-soft)] border-[var(--sec-border)] text-[var(--sec-text)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-soft)]'
                }`}
              >
                {FAQ_CAT_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <p className="boho-card p-6 text-sm text-[var(--text-secondary)] text-center">
                No encontramos preguntas que coincidan con tu búsqueda.
              </p>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div key={faq.id} className="boho-card rounded-[24px] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      className="w-full min-h-[54px] px-6 py-4 flex items-center justify-between gap-4 text-left cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[var(--text-secondary)] shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: GROWY_EASE }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-5 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-hairline)] pt-3.5">
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

          <div id="instalar-app" className="pt-2 scroll-mt-24">
            <button
              type="button"
              onClick={() => setShowInstallGuide((prev) => !prev)}
              aria-expanded={showInstallGuide}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sec-text)] hover:underline cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>
                {showInstallGuide
                  ? 'Ocultar guía para instalar Equilibrio en celular o computador'
                  : '¿Quieres saber cómo instalar Equilibrio como aplicación en tu celular o computador?'}
              </span>
            </button>
            {showInstallGuide && (
              <div className="mt-4">
                <InstallAppGuideSection compact />
              </div>
            )}
          </div>
        </section>

        {/* 9. CIERRE CON LLAMADA A LA ACCIÓN Y CONTACTO */}
        <section
          id="contacto"
          className="py-16 sm:py-22 bg-[var(--sec-soft)]/50 border-t border-[var(--border-hairline)] scroll-mt-20"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            {/* Llamada a la acción de cierre */}
            <ScrollReveal className="text-center max-w-2xl mx-auto space-y-5">
              <DoodleSproutMotif className="w-10 h-10 mx-auto" />
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight text-balance">
                {lc.closingTitle}
              </h2>
              <p className="text-base text-[var(--text-secondary)] leading-relaxed">
                {lc.closingSubtitle}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
                <a
                  href="#equilibrio"
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <span>{lc.closingCtaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={onLoginClick}
                  disabled={authLoading}
                  className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-full border border-[var(--sec-border)] bg-[var(--bg-surface)] hover:bg-[var(--sec-soft)] text-sm font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  {isSignedIn ? 'Ir a mi cuenta' : 'Entrar con Google'}
                </button>
              </div>
            </ScrollReveal>

            {/* Formulario de contacto y soporte */}
            <ScrollReveal>
              <form
                onSubmit={handleContactSubmit}
                className="max-w-3xl mx-auto boho-card rounded-[32px] p-6 sm:p-9 space-y-5"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--sec-text)]">
                    Contacto directo
                  </p>
                  <h3 className="font-display text-2xl font-bold text-[var(--text-primary)]">
                    ¿Tienes alguna duda o necesitas activar tu comprobante?
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                    Escríbenos aquí y te responderemos directamente desde {config.contactEmail}.
                  </p>
                </div>

                {contactFeedback && (
                  <p
                    className={`text-xs font-semibold p-3 rounded-2xl ${
                      contactFeedback.type === 'ok'
                        ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                        : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
                    }`}
                  >
                    {contactFeedback.text}
                  </p>
                )}

                <div>
                  <span className="block text-xs font-semibold mb-1.5 text-[var(--text-primary)]">
                    Tipo de mensaje
                  </span>
                  <div className="grid grid-cols-3 gap-2 max-w-md">
                    {(
                      [
                        { id: 'duda', label: 'Duda o consulta' },
                        { id: 'problema', label: 'Soporte o pago' },
                        { id: 'sugerencia', label: 'Sugerencia' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setContactType(opt.id)}
                        className={`min-h-[40px] px-3 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                          contactType === opt.id
                            ? 'bg-[var(--pos-soft)] border-[var(--pos-border)] text-[var(--pos-text)]'
                            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Tu nombre</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="boho-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Tu correo electrónico
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="boho-input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Asunto</label>
                  <input
                    type="text"
                    placeholder="Ej. Consulta sobre Equilibrio o activación de compra"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    className="boho-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Mensaje</label>
                  <textarea
                    rows={3}
                    value={contactMsg}
                    onChange={(e) => setContactMsg(e.target.value)}
                    className="boho-input w-full py-2.5"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      Adjuntar comprobante o imagen (opcional, máx. {MAX_SUPPORT_ATTACHMENTS})
                    </span>
                    <button
                      type="button"
                      onClick={() => contactFileRef.current?.click()}
                      disabled={contactAttachments.length >= MAX_SUPPORT_ATTACHMENTS}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Adjuntar imagen o PDF</span>
                    </button>
                    <input
                      ref={contactFileRef}
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleContactFiles}
                      className="hidden"
                    />
                  </div>

                  {contactAttachError && (
                    <p className="text-xs font-semibold text-[var(--danger-text)]">
                      {contactAttachError}
                    </p>
                  )}

                  {contactAttachments.length > 0 && (
                    <div className="space-y-1.5">
                      {contactAttachments.map((att, idx) => (
                        <div
                          key={`${att.name}-${idx}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="truncate font-medium">{att.name}</span>
                            <span className="text-[11px] font-mono opacity-75 shrink-0">
                              ({formatAttachmentSize(att.sizeBytes)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setContactAttachments((prev) => prev.filter((_, i) => i !== idx))
                            }
                            aria-label={`Quitar ${att.name}`}
                            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-xl text-[var(--danger-text)] cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={contactSending}
                  className="inline-flex items-center justify-center gap-2 min-h-[46px] px-7 py-2.5 rounded-full bg-[#1F1B2E] text-white dark:bg-[var(--accent-btn)] dark:text-[#1F1B2E] text-sm font-bold transition-colors cursor-pointer disabled:opacity-60 hover:opacity-90"
                >
                  <Send className="w-4 h-4" />
                  <span>{contactSending ? 'Enviando...' : 'Enviar mensaje'}</span>
                </button>
              </form>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* PIE DE PÁGINA CON TÉRMINOS Y PRIVACIDAD */}
      <footer className="border-t border-[var(--border-hairline)] py-8 bg-[var(--bg-canvas)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <GrowyLogoMark size="sm" showSlogan />
            <span>{config.contactEmail}</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setLegalModal('privacy')}
              className="hover:underline cursor-pointer min-h-[36px]"
            >
              Aviso de privacidad
            </button>
            <button
              type="button"
              onClick={() => setLegalModal('terms')}
              className="hover:underline cursor-pointer min-h-[36px]"
            >
              Términos de uso
            </button>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {legalModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: GROWY_EASE }}
              className="w-full max-w-lg boho-card rounded-[28px] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold">
                  {legalModal === 'privacy' ? 'Aviso de privacidad' : 'Términos de uso'}
                </h3>
                <button
                  type="button"
                  onClick={() => setLegalModal(null)}
                  aria-label="Cerrar ventana legal"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {legalModal === 'privacy' ? (
                <div className="text-sm text-[var(--text-secondary)] space-y-3 leading-relaxed">
                  <p>
                    Growy y su producto Equilibrio almacenan únicamente tu correo, nombre y los
                    datos que registres voluntariamente dentro de tu cuenta autenticada en Google
                    Cloud Firestore.
                  </p>
                  <p>
                    Tus costos, productos, proyecciones y resultados reales son privados y están
                    protegidos mediante reglas de seguridad por usuario (`ownerUid`). No vendemos ni
                    compartimos tu información con terceros.
                  </p>
                  <p>
                    Puedes exportar un respaldo completo en JSON o solicitar la eliminación de tu
                    cuenta escribiendo a {config.contactEmail}.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-[var(--text-secondary)] space-y-3 leading-relaxed">
                  <p>
                    Equilibrio de Growy se ofrece mediante pago a través de Mercado Pago (
                    {config.priceLabel}), entregando acceso a sus herramientas en la web y como
                    aplicación instalable.
                  </p>
                  <p>
                    Los cálculos de punto de equilibrio, metas de venta y proyecciones se basan en
                    los datos reales que ingresas y sirven como apoyo visual y de planificación; no
                    sustituyen asesoría contable o tributaria oficial de tu país.
                  </p>
                  <p>
                    El acceso es personal e intransferible. Si tienes cualquier inconveniente tras
                    realizar tu pago, escríbenos desde el formulario de contacto o a{' '}
                    {config.contactEmail}.
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
