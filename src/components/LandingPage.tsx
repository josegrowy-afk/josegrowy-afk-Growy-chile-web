import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  ChevronDown,
  FileText,
  HelpCircle,
  Lock,
  Mail,
  Paperclip,
  Play,
  PlayCircle,
  Quote,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BLOG_POSTS, type BlogPost } from '../data/blogArticles';
import {
  createSupportTicket,
  DEFAULT_LANDING_CONTENT,
  trackFunnelStepOncePerSession,
} from '../firebase/services';
import {
  calculatePlanComparisonFromConfig,
  savePublicBreakEvenDraft,
} from '../finance/phase1Insights';
import {
  buildFaqJsonLd,
  filterApprovedTestimonials,
  sanitizeWhatsappUrl,
} from '../finance/phase4Marketing';
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
  BackdropBlobs,
  ChipLink,
  EditorialText,
  FloatingNav,
  GlassCard,
  HeroBanner,
  SectionTitle,
  SolidCard,
  type FloatingNavItem,
  type HeroBannerChip,
} from './design-system';
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
import { PublicBreakEvenCalculator } from './PublicBreakEvenCalculator';

interface LandingPageProps {
  config: AppConfig;
  faqs: FaqItem[];
  isDark: boolean;
  isSignedIn: boolean;
  onToggleTheme: () => void;
  onLoginClick: () => void;
  onTryDemo?: () => void;
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
 * Prepara el titular del Hero para `EditorialText`, destacando en cursiva
 * el texto entre asteriscos o la palabra "sueña" si aún no tiene asteriscos.
 */
function formatHeroHeadlineForEditorial(title: string): string {
  if (/\*[^*]+\*/.test(title)) {
    return title;
  }
  const suenaIndex = title.toLowerCase().indexOf('sueña');
  if (suenaIndex !== -1) {
    const before = title.slice(0, suenaIndex);
    const word = title.slice(suenaIndex, suenaIndex + 5);
    const after = title.slice(suenaIndex + 5);
    return `${before}*${word}*${after}`;
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
  onTryDemo,
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

  const planSummary = useMemo(
    () => calculatePlanComparisonFromConfig(config),
    [config]
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

  // Modales legales y lector de guías (Blog)
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);
  const [selectedBlogPost, setSelectedBlogPost] = useState<BlogPost | null>(null);

  const heroChecks = useMemo(() => splitLines(lc.heroChecks), [lc.heroChecks]);
  const painPointsList = useMemo(() => splitLines(lc.painPoints), [lc.painPoints]);

  const approvedTestimonials = useMemo(
    () => filterApprovedTestimonials(config.testimonials),
    [config.testimonials]
  );

  const whatsappHref = useMemo(
    () => sanitizeWhatsappUrl(config.whatsappUrl),
    [config.whatsappUrl]
  );

  const importancePoints = useMemo(
    () => splitLines(lc.breakevenImportancePoints),
    [lc.breakevenImportancePoints]
  );

  const equilibrioFeatures = useMemo(
    () => splitLines(lc.equilibrioFeatures),
    [lc.equilibrioFeatures]
  );

  const creatorParagraphs = useMemo(() => splitParagraphs(lc.creatorBio), [lc.creatorBio]);

  // 4.5 Analítica mínima de embudo: registrar visita una vez por sesión sin PII ni cookies
  useEffect(() => {
    trackFunnelStepOncePerSession('visit', { source: 'landing' });
  }, []);

  // 4.4 SEO dinámico: FAQPage JSON-LD construido únicamente desde FAQs publicadas
  useEffect(() => {
    const schema = buildFaqJsonLd(faqs);
    const scriptId = 'growy-faq-jsonld';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!schema) {
      if (scriptEl) scriptEl.remove();
      return;
    }

    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(schema);

    return () => {
      document.getElementById(scriptId)?.remove();
    };
  }, [faqs]);

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

  const navItems: FloatingNavItem[] = useMemo(
    () => [
      {
        id: 'plataforma',
        label: 'Plataforma',
        shortLabel: 'Inicio',
        href: '#que-es-growy',
        icon: <Sparkles className="w-4 h-4" />,
      },
      {
        id: 'equilibrio',
        label: 'Equilibrio',
        shortLabel: 'Equilibrio',
        href: '#equilibrio',
      },
      {
        id: 'cimientos',
        label: 'Punto de equilibrio',
        shortLabel: 'Cimientos',
        href: '#punto-de-equilibrio',
        icon: <Calculator className="w-4 h-4" />,
      },
      {
        id: 'creador',
        label: 'Quién soy',
        shortLabel: 'Quién soy',
        href: '#creador',
      },
      {
        id: 'guias',
        label: 'Guías',
        shortLabel: 'Guías',
        href: '#guias',
        icon: <BookOpen className="w-4 h-4" />,
      },
      {
        id: 'faq',
        label: 'Preguntas',
        shortLabel: 'Dudas',
        href: '#faq',
        icon: <HelpCircle className="w-4 h-4" />,
      },
    ],
    []
  );

  // Ítems del dock móvil (2 izquierda + centro Equilibrio + 2 derecha)
  const mobileDockItems = useMemo(
    () => [navItems[0], navItems[2], navItems[4], navItems[5]],
    [navItems]
  );

  const heroChips: HeroBannerChip[] = useMemo(() => {
    const base: HeroBannerChip[] = [
      {
        id: 'equilibrio',
        label: `${lc.heroPrimaryCta}`,
        href: '#equilibrio',
        variant: 'navy',
      },
      {
        id: 'cimientos',
        label: 'Calcular *equilibrio*',
        href: '#punto-de-equilibrio',
        variant: 'cream',
      },
      {
        id: 'aprende',
        label: 'Video *1 min*',
        href: '#aprende-con-nosotros',
        variant: 'lilac',
      },
    ];
    if (onTryDemo && !isSignedIn) {
      base.splice(1, 0, {
        id: 'demo',
        label: 'Probar *demo* gratis',
        onClick: onTryDemo,
        variant: 'sage',
      });
    }
    return base;
  }, [isSignedIn, lc.heroPrimaryCta, onTryDemo]);

  return (
    <div id="inicio" className="relative min-h-screen flex flex-col">
      <BackdropBlobs />

      {/* NAVEGACIÓN FLOTANTE EN PÍLDORA (escritorio superior + dock móvil inferior con Equilibrio) */}
      <FloatingNav
        items={navItems}
        mobileItems={mobileDockItems}
        logoHref="#inicio"
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        primaryAction={{
          label: isSignedIn ? 'Ir a mi cuenta' : authLoading ? 'Conectando...' : 'Entrar',
          onClick: authLoading ? undefined : onLoginClick,
        }}
        onCenterMobileClick={() => {
          document.getElementById('equilibrio')?.scrollIntoView({ behavior: 'smooth' });
        }}
        centerMobileLabel="Ir a Equilibrio"
        className="pt-3 relative z-40"
      />

      <main className="relative z-10 flex-1">
        {/* 1. HERO BANNER CÁLIDO EDITORIAL + LÍNEA DE PRODUCTOS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-8 space-y-6">
          <HeroBanner
            eyebrow={lc.heroEyebrow}
            headline={formatHeroHeadlineForEditorial(config.heroTitle)}
            headlineSize="landing"
            subtitle={config.heroSubtitle}
            chips={heroChips}
            bottomSlot={
              <div className="space-y-3">
                {authError && (
                  <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] border border-[var(--accent-soft-border)] px-4 py-2.5 rounded-2xl max-w-lg">
                    {authError}
                  </p>
                )}

                <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                  {heroChecks.map((checkLabel) => (
                    <li
                      key={checkLabel}
                      className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold"
                      style={{ color: 'var(--hero-ink)' }}
                    >
                      <span className="w-5 h-5 rounded-full bg-white/65 border border-[var(--navy-ink)]/20 inline-flex items-center justify-center shrink-0">
                        <Check
                          className="w-3 h-3 text-[var(--navy-ink)]"
                          strokeWidth={2.6}
                        />
                      </span>
                      <span>{checkLabel}</span>
                    </li>
                  ))}
                </ul>
              </div>
            }
            rightSlot={
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.08, ease: GROWY_EASE }}
                className="w-full max-w-[340px] rounded-[32px] bg-white/40 border border-white/75 backdrop-blur-md p-4 sm:p-5 shadow-[var(--glass-shadow)]"
              >
                <GrowyCharacterArtwork className="w-full max-w-[290px] mx-auto block select-none growy-float-a" />
              </motion.div>
            }
          />

          {/* Tira de productos: solo 01 · Equilibrio disponible ahora; 02 y 03 siguen en Próximamente */}
          <GlassCard radius="lg" className="p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
              <a
                href="#equilibrio"
                className="lg:col-span-6 flex items-center justify-between gap-3 px-5 py-4 rounded-[24px] bg-[var(--pos-soft)] hover:opacity-95 border border-[var(--pos-border)] transition-all group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <EquilibrioProductIcon size="sm" />
                  <div className="min-w-0">
                    <p className="font-display text-sm sm:text-base font-extrabold text-[var(--text-primary)]">
                      01 · Equilibrio
                    </p>
                    <p className="text-xs font-medium text-[var(--pos-text)] mt-0.5 font-mono tabular-nums">
                      Disponible ahora · {planSummary.monthlyPriceFormatted}/mes o{' '}
                      {planSummary.annualPriceFormatted}/año
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-primary)] group-hover:translate-x-0.5 transition-transform shrink-0" />
              </a>

              <div className="lg:col-span-3 px-4 py-3.5 rounded-[24px] border border-dashed border-[var(--sec-border)] bg-[var(--sec-soft)]/60 flex flex-col justify-center">
                <p className="font-display text-xs font-extrabold text-[var(--sec-text)]">
                  02 · Próximamente
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Innovación y creatividad
                </p>
              </div>

              <div className="lg:col-span-3 px-4 py-3.5 rounded-[24px] border border-dashed border-[var(--sec-border)] bg-[var(--sec-soft)]/60 flex flex-col justify-center">
                <p className="font-display text-xs font-extrabold text-[var(--sec-text)]">
                  03 · Próximamente
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Automatización de procesos
                </p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 2. TRES PASOS DE CÓMO FUNCIONA */}
        <section id="como-funciona" className="py-6 sm:py-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerSection className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {[
              { title: lc.step1Title, desc: lc.step1Desc },
              { title: lc.step2Title, desc: lc.step2Desc },
              { title: lc.step3Title, desc: lc.step3Desc },
            ].map((step, idx) => (
              <StaggerItem key={step.title}>
                <SolidCard interactive className="px-6 py-5 h-full space-y-1.5">
                  <span className="font-mono text-xs font-bold text-[var(--accent-strong)]">
                    0{idx + 1}
                  </span>
                  <h2 className="font-display text-base sm:text-lg font-extrabold text-[var(--text-primary)] tracking-tight">
                    {step.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    {step.desc}
                  </p>
                </SolidCard>
              </StaggerItem>
            ))}
          </StaggerSection>
        </section>

        {/* 2B. APRENDE CON NOSOTROS (Video explicativo en la parte inicial) */}
        <section
          id="aprende-con-nosotros"
          className="py-10 sm:py-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
        >
          <ScrollReveal>
            <GlassCard
              radius="lg"
              className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center"
            >
              {/* Texto introductorio */}
              <div className="lg:col-span-5 space-y-5">
                <span className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.06em] uppercase text-[var(--sec-text)]">
                  <PlayCircle className="w-4 h-4 shrink-0" />
                  <span>Aprende con nosotros</span>
                </span>

                <div className="space-y-2.5">
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                    <EditorialText text="¿Qué es el punto de equilibrio? *En un minuto.*" />
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
                  <ChipLink
                    variant="white"
                    label="Probar *ejemplo*"
                    href="#punto-de-equilibrio"
                  />
                  <a
                    href="#equilibrio"
                    style={{
                      backgroundColor: 'var(--btn-navy-bg)',
                      color: 'var(--btn-navy-text)',
                    }}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-full hover:opacity-92 text-xs sm:text-sm font-bold transition-opacity whitespace-nowrap"
                  >
                    <span>Conocer Equilibrio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Reproductor del video */}
              <div className="lg:col-span-7">
                <div className="relative aspect-video rounded-[28px] overflow-hidden bg-[#101018] border border-[var(--sec-border)] shadow-lg">
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
                      <span className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#F6A59E] group-hover:bg-[#ee928a] text-[#1F1B2E] text-sm font-bold shadow-md transition-transform group-hover:scale-[1.03]">
                        <Play className="w-4 h-4 fill-current" />
                        <span>Ver video ahora</span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          </ScrollReveal>
        </section>

        {/* 3. QUÉ ES GROWY */}
        <section
          id="que-es-growy"
          className="py-14 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <ScrollReveal className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5 text-xs font-bold tracking-[0.06em] uppercase text-[var(--sec-text)]">
                <DoodleSparkleMotif className="w-5 h-5 shrink-0" />
                <span>{lc.whatIsEyebrow}</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                <EditorialText text={lc.whatIsTitle} />
              </h2>
            </ScrollReveal>

            <ScrollReveal className="lg:col-span-7 space-y-7" delay={0.05}>
              <p className="text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed">
                {lc.whatIsBody}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <SolidCard interactive className="p-6 space-y-3">
                  <DoodleIdeaMotif className="w-9 h-9" />
                  <h3 className="font-display text-xl font-extrabold text-[var(--text-primary)]">
                    {lc.whatIsPillar1Title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {lc.whatIsPillar1Desc}
                  </p>
                </SolidCard>

                <SolidCard interactive className="p-6 space-y-3">
                  <DoodleSproutMotif className="w-9 h-9" />
                  <h3 className="font-display text-xl font-extrabold text-[var(--text-primary)]">
                    {lc.whatIsPillar2Title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {lc.whatIsPillar2Desc}
                  </p>
                </SolidCard>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* 3B. DOLORES REALES DE LA PYME (4.3) */}
        <section className="pb-14 sm:pb-18 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <SolidCard
              radius="lg"
              className="p-6 sm:p-10 border-[var(--accent-soft-border)] bg-[var(--accent-soft)]/35 space-y-6"
            >
              <SectionTitle
                eyebrow={lc.painEyebrow}
                title={lc.painTitle}
                rightSlot={
                  <ChipLink
                    variant="white"
                    label="Probar en la *calculadora*"
                    href="#punto-de-equilibrio"
                  />
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {painPointsList.map((pain, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-start gap-3"
                  >
                    <AlertCircle className="w-4 h-4 text-[var(--accent-strong)] shrink-0 mt-0.5" />
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {pain}
                    </p>
                  </div>
                ))}
              </div>
            </SolidCard>
          </ScrollReveal>
        </section>

        {/* 4. SECCIÓN EDUCATIVA: PRIMERO, LOS CIMIENTOS: ¿QUÉ ES EL PUNTO DE EQUILIBRIO? */}
        <section
          id="punto-de-equilibrio"
          className="py-16 sm:py-22 bg-[var(--sec-soft)]/45 border-y border-[var(--border-hairline)] scroll-mt-24"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            {/* Qué es */}
            <ScrollReveal className="max-w-3xl">
              <SectionTitle
                eyebrow={lc.breakevenEyebrow}
                title={`Primero, los *cimientos*: ${lc.breakevenTitle}`}
                subtitle={lc.breakevenDefinition}
                size="lg"
              />
            </ScrollReveal>

            {/* Por qué es tan importante + Los tres números simples */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <ScrollReveal className="lg:col-span-5">
                <SolidCard radius="lg" className="p-6 sm:p-8 space-y-4">
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
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
                </SolidCard>
              </ScrollReveal>

              <ScrollReveal className="lg:col-span-7 space-y-5" delay={0.05}>
                <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
                  {lc.breakevenPillarsTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                    <span className="font-mono text-xs font-bold text-[var(--accent-strong)]">
                      01
                    </span>
                    <h4 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                      {lc.breakevenFixedTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {lc.breakevenFixedDesc}
                    </p>
                  </div>

                  <div className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                    <span className="font-mono text-xs font-bold text-[var(--sec-text)]">
                      02
                    </span>
                    <h4 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                      {lc.breakevenVariableTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {lc.breakevenVariableDesc}
                    </p>
                  </div>

                  <div className="p-5 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] space-y-2">
                    <span className="font-mono text-xs font-bold text-[var(--pos-text)]">
                      03
                    </span>
                    <h4 className="font-display text-lg font-extrabold text-[var(--text-primary)]">
                      {lc.breakevenPriceTitle}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                      {lc.breakevenPriceDesc}
                    </p>
                  </div>
                </div>

                {/* De la realidad a la proyección */}
                <div className="p-6 rounded-[24px] bg-[var(--bg-surface)] border border-[var(--sec-border)] space-y-2">
                  <p className="text-xs font-bold tracking-[0.04em] uppercase text-[var(--sec-text)]">
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
                <SectionTitle
                  eyebrow="Ejemplo visual"
                  title={lc.breakevenExampleTitle}
                  subtitle={lc.breakevenExampleBody}
                />
              </ScrollReveal>

              <ScrollReveal className="lg:col-span-7" delay={0.05}>
                <BreakEvenExampleChart />
              </ScrollReveal>
            </div>

            {/* Calculadora pública interactiva sin login */}
            <ScrollReveal>
              <PublicBreakEvenCalculator
                isSignedIn={isSignedIn}
                authLoading={authLoading}
                onOpenPrivacy={() => setLegalModal('privacy')}
                onSaveAndContinue={(draft) => {
                  savePublicBreakEvenDraft(draft);
                  onLoginClick();
                }}
              />
            </ScrollReveal>

            {/* Frase de cierre destacada */}
            <ScrollReveal className="text-center max-w-3xl mx-auto pt-2 space-y-2.5">
              <DoodleSparkleMotif className="w-7 h-7 mx-auto" />
              <blockquote className="growy-editorial-phrase text-2xl sm:text-3xl text-[var(--text-primary)] text-balance leading-snug">
                &ldquo;{lc.breakevenClosingQuote}&rdquo;
              </blockquote>
            </ScrollReveal>
          </div>
        </section>

        {/* 5. NUESTRO PRIMER PRODUCTO: EQUILIBRIO */}
        <section
          id="equilibrio"
          className="py-16 sm:py-22 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-24"
        >
          <ScrollReveal>
            <ProductShowcaseCard
              eyebrow={lc.equilibrioEyebrow}
              title={lc.equilibrioTitle}
              subtitle={lc.equilibrioSubtitle}
              features={equilibrioFeatures}
              priceLabel={config.priceLabel || `${planSummary.monthlyPriceFormatted} / mes`}
              priceNote={config.currencyNote}
              ctaLabel={lc.equilibrioCtaLabel}
              paymentUrl={config.paymentUrl}
              annualPriceLabel={`${planSummary.annualPriceFormatted} / año`}
              annualPriceNote={planSummary.anchorComparisonText}
              annualCtaLabel={`Plan anual (${planSummary.annualPriceFormatted} / año)`}
              annualPaymentUrl={config.annualPaymentUrl || config.paymentUrl}
              annualBadgeLabel={planSummary.annualHighlightBadge}
              priceComparisonText={lc.priceComparisonText}
              refundGuaranteeText={config.refundGuaranteeText}
              trustNote={lc.equilibrioTrustNote}
              onPaymentCtaClick={(planType) =>
                trackFunnelStepOncePerSession('payment', { source: 'landing', planType })
              }
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
            {onTryDemo && !isSignedIn && (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-center">
                <span className="text-xs text-[var(--text-secondary)]">
                  ¿Prefieres recorrer Equilibrio por dentro antes de entrar?
                </span>
                <ChipLink
                  variant="sage"
                  label="Explorar *demo* de Cafetería & Repostería"
                  onClick={onTryDemo}
                />
              </div>
            )}
          </ScrollReveal>
        </section>

        {/* 5B. PRIVACIDAD DE TUS DATOS Y SOPORTE HUMANO (4.1) */}
        <section
          id="confianza"
          className="pb-16 sm:pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
        >
          <ScrollReveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SolidCard
                radius="lg"
                className="p-6 sm:p-8 space-y-3 border-[var(--pos-border)] bg-[var(--pos-soft)]/35"
              >
                <div className="flex items-center gap-2.5 text-xs font-bold tracking-[0.04em] uppercase text-[var(--pos-text)]">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Resguardo en Firebase · Sin acceso a tu banco</span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                  {lc.privacyTitle}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {lc.privacyBody}
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--pos-text)] font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Nunca pedimos claves bancarias ni SII</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setLegalModal('privacy')}
                    className="underline font-bold cursor-pointer"
                  >
                    Ver política de privacidad
                  </button>
                </div>
              </SolidCard>

              <SolidCard radius="lg" className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-2.5 text-xs font-bold tracking-[0.04em] uppercase text-[var(--sec-text)]">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Acompañamiento real en Chile</span>
                </div>
                <h3 className="font-display text-2xl font-extrabold text-[var(--text-primary)] tracking-tight">
                  {lc.supportHumanTitle}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {lc.supportHumanBody}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {whatsappHref && (
                    <ChipLink
                      variant="sage"
                      label="Escribir por *WhatsApp*"
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  )}
                  <a
                    href="#contacto"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2 rounded-full border border-[var(--sec-border)] bg-[var(--bg-soft-alt)] hover:bg-[var(--sec-soft)] text-xs font-semibold text-[var(--text-primary)] transition-colors whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Enviar mensaje por correo</span>
                  </a>
                </div>
              </SolidCard>
            </div>
          </ScrollReveal>
        </section>

        {/* 5C. TESTIMONIOS Y CASOS REALES (4.2 — Solo se muestra si existen testimonios aprobados con permiso) */}
        {approvedTestimonials.length > 0 && (
          <section
            id="testimonios"
            className="pb-16 sm:pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-24"
          >
            <ScrollReveal>
              <SectionTitle
                eyebrow="Historias reales con Equilibrio"
                title="Lo que cuentan quienes ya *ordenaron* sus números"
              />
            </ScrollReveal>

            <StaggerSection inView className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {approvedTestimonials.map((t) => (
                <StaggerItem key={t.id}>
                  <SolidCard
                    as="article"
                    interactive
                    className="p-6 h-full flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <Quote className="w-5 h-5 text-[var(--accent-strong)]" />
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                        &ldquo;{t.quote}&rdquo;
                      </p>
                      {t.resultHighlight && (
                        <p className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--pos-soft)] border border-[var(--pos-border)] text-[11px] font-bold text-[var(--pos-text)]">
                          {t.resultHighlight}
                        </p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-[var(--border-hairline)] text-xs">
                      <p className="font-bold text-[var(--text-primary)]">{t.name}</p>
                      <p className="text-[var(--text-secondary)]">
                        {t.businessName}
                        {t.city ? ` · ${t.city}` : ''}
                      </p>
                    </div>
                  </SolidCard>
                </StaggerItem>
              ))}
            </StaggerSection>
          </section>
        )}

        {/* 6. PRÓXIMAMENTE */}
        <section
          id="proximamente"
          className="py-14 sm:py-20 bg-[var(--sec-soft)]/45 border-y border-[var(--border-hairline)] scroll-mt-24"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <ScrollReveal className="max-w-2xl">
              <SectionTitle
                eyebrow={lc.upcomingEyebrow}
                title={lc.upcomingTitle}
                subtitle={lc.upcomingSubtitle}
                size="lg"
              />
            </ScrollReveal>

            <StaggerSection inView className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                'Innovación y creatividad aplicada',
                'Automatización de procesos diarios',
                'Nuevas herramientas en camino',
              ].map((hint, idx) => (
                <StaggerItem key={idx}>
                  <div className="p-7 rounded-[28px] bg-[var(--bg-surface)] border border-dashed border-[var(--sec-border)] flex flex-col items-start justify-between gap-6 h-full min-h-[156px]">
                    <DoodleSparkleMotif className="w-7 h-7" />
                    <div className="space-y-1">
                      <p className="font-display text-xl font-extrabold text-[var(--text-primary)]">
                        Próximamente
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">{hint}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </StaggerSection>

            {/* Campo opcional para recibir novedades */}
            <ScrollReveal>
              <form
                onSubmit={handleNotifySubmit}
                className="p-6 rounded-[28px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[var(--glass-shadow)]"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">
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
                    style={{
                      backgroundColor: 'var(--btn-navy-bg)',
                      color: 'var(--btn-navy-text)',
                    }}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-full hover:opacity-92 text-xs font-bold cursor-pointer whitespace-nowrap disabled:opacity-60 transition-opacity"
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
          className="py-16 sm:py-22 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 scroll-mt-24"
        >
          {/* Franja oscura (#1F1B2E) con cita en Fraunces cursiva y botón Conocer la historia */}
          <ScrollReveal>
            <div className="growy-editorial-strip rounded-[36px] px-7 py-8 sm:px-10 sm:py-9 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
              <div className="space-y-2 max-w-2xl">
                <blockquote className="growy-editorial-phrase text-xl sm:text-2xl lg:text-[1.75rem] leading-snug text-white text-balance">
                  &ldquo;{lc.breakevenClosingQuote}&rdquo;
                </blockquote>
                <p className="text-xs sm:text-sm text-[#CFC5EE] font-medium">
                  {lc.creatorName} · {lc.creatorRole}
                </p>
              </div>
              <a
                href="#historia-creador"
                style={{
                  backgroundColor: 'var(--accent-coral)',
                  color: 'var(--navy-ink)',
                }}
                className="inline-flex items-center justify-center min-h-[46px] px-7 py-3 rounded-full hover:opacity-92 text-sm font-bold transition-opacity whitespace-nowrap shrink-0 self-start lg:self-center"
              >
                {lc.creatorQuoteCta}
              </a>
            </div>
          </ScrollReveal>

          {/* Historia de José Ignacia */}
          <ScrollReveal>
            <GlassCard id="historia-creador" radius="lg" className="p-7 sm:p-11 space-y-6 scroll-mt-24">
              <div className="space-y-2 max-w-3xl">
                <p className="text-xs font-bold tracking-[0.06em] uppercase text-[var(--sec-text)]">
                  {lc.creatorEyebrow}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-tight text-balance">
                  <EditorialText text={lc.creatorTitle} />
                </h2>
                <p className="text-sm font-semibold text-[var(--pos-text)]">
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
            </GlassCard>
          </ScrollReveal>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <GrowyDivider />
        </div>

        {/* 7B. GUÍAS PARA PYMES / ESTRUCTURA BLOG (4.4) */}
        <section
          id="guias"
          className="py-14 sm:py-18 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24"
        >
          <SectionTitle
            eyebrow="Guías prácticas para pymes · Blog"
            title="Aprende en *simple* antes de decidir"
            subtitle="Lecturas cortas sobre costos, precios, IVA en Chile y flujo de caja escritas sin jerga."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {BLOG_POSTS.map((post) => (
              <SolidCard
                key={post.id}
                as="article"
                interactive
                className="p-6 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="px-3 py-1 rounded-full bg-[var(--sec-soft)] border border-[var(--sec-border)] font-bold text-[var(--sec-text)]">
                      {post.category}
                    </span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {post.readingTime}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-extrabold text-[var(--text-primary)] leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBlogPost(post)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)] hover:underline cursor-pointer self-start min-h-[38px]"
                >
                  <span>Leer guía completa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </SolidCard>
            ))}
          </div>
        </section>

        {/* 8. PREGUNTAS FRECUENTES */}
        <section
          id="faq"
          className="py-16 sm:py-22 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24"
        >
          <SectionTitle
            eyebrow="Preguntas frecuentes"
            title="Claridad *antes* de empezar"
            rightSlot={
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  placeholder="Buscar pregunta..."
                  aria-label="Buscar en preguntas frecuentes"
                  value={faqQuery}
                  onChange={(e) => setFaqQuery(e.target.value)}
                  className="boho-input rounded-full w-full pl-10"
                />
              </div>
            }
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(FAQ_CAT_LABELS) as Array<FaqCategory | 'all'>).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFaqCat(cat)}
                className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                  faqCat === cat
                    ? 'bg-[var(--btn-navy-bg)] border-[var(--btn-navy-bg)] text-[var(--btn-navy-text)]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-[var(--bg-soft)]'
                }`}
              >
                {FAQ_CAT_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <SolidCard className="p-6 text-sm text-[var(--text-secondary)] text-center">
                No encontramos preguntas que coincidan con tu búsqueda.
              </SolidCard>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="rounded-[24px] bg-[var(--bg-surface)] border border-[var(--border-hairline)] overflow-hidden"
                  >
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
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sec-text)] hover:underline cursor-pointer min-h-[36px]"
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
          className="py-16 sm:py-22 bg-[var(--sec-soft)]/45 border-t border-[var(--border-hairline)] scroll-mt-24"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            {/* Llamada a la acción de cierre */}
            <ScrollReveal className="text-center max-w-2xl mx-auto space-y-5">
              <DoodleSproutMotif className="w-10 h-10 mx-auto" />
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[var(--text-primary)] tracking-tight text-balance">
                <EditorialText text={lc.closingTitle} />
              </h2>
              <p className="text-base text-[var(--text-secondary)] leading-relaxed">
                {lc.closingSubtitle}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
                <a
                  href="#equilibrio"
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-full hover:opacity-92 text-sm font-bold transition-opacity whitespace-nowrap shadow-xs"
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
                  {isSignedIn ? 'Ir a mi cuenta' : 'Entrar con Google o correo'}
                </button>
              </div>
            </ScrollReveal>

            {/* Formulario de contacto y soporte */}
            <ScrollReveal>
              <GlassCard radius="lg" className="max-w-3xl mx-auto p-6 sm:p-9">
                <form onSubmit={handleContactSubmit} className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold tracking-[0.04em] uppercase text-[var(--sec-text)]">
                        Contacto directo humano
                      </p>
                      <h3 className="font-display text-2xl font-extrabold text-[var(--text-primary)]">
                        ¿Tienes alguna duda o necesitas activar tu comprobante?
                      </h3>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                        Escríbenos aquí y te responderemos directamente desde {config.contactEmail}.
                      </p>
                    </div>
                    {whatsappHref && (
                      <ChipLink
                        variant="sage"
                        label="WhatsApp *directo*"
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start"
                      />
                    )}
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
                              ? 'bg-[var(--btn-navy-bg)] border-[var(--btn-navy-bg)] text-[var(--btn-navy-text)]'
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
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] text-xs bg-[var(--bg-surface)]"
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
                    style={{
                      backgroundColor: 'var(--btn-navy-bg)',
                      color: 'var(--btn-navy-text)',
                    }}
                    className="inline-flex items-center justify-center gap-2 min-h-[46px] px-7 py-2.5 rounded-full text-sm font-bold transition-opacity cursor-pointer disabled:opacity-60 hover:opacity-92"
                  >
                    <Send className="w-4 h-4" />
                    <span>{contactSending ? 'Enviando...' : 'Enviar mensaje'}</span>
                  </button>
                </form>
              </GlassCard>
            </ScrollReveal>
          </div>
        </section>
      </main>

      {/* PIE DE PÁGINA CON TÉRMINOS Y PRIVACIDAD (espacio inferior en móvil para el dock flotante) */}
      <footer className="relative z-10 border-t border-[var(--border-hairline)] pt-8 pb-28 md:pb-8 bg-[var(--bg-canvas)]">
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
              className="w-full max-w-lg growy-solid rounded-[28px] p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-extrabold">
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
                    datos que registres voluntariamente dentro de tu cuenta (ya sea ingresando con
                    Google o con correo y contraseña) sobre Google Cloud Firestore.
                  </p>
                  <p>
                    Tus costos, productos, proyecciones y resultados reales son privados y están
                    protegidos mediante reglas de seguridad por usuario (`ownerUid`). Nunca te
                    pedimos claves bancarias, ni del SII, ni vendemos tu información a terceros.
                  </p>
                  <p>
                    Para mejorar la claridad de la página, medimos únicamente conteos mínimos de
                    embudo por sesión anónima sin cookies ni datos personales. Puedes exportar un
                    respaldo completo en JSON o solicitar la eliminación de tu cuenta escribiendo a{' '}
                    {config.contactEmail}.
                  </p>
                </div>
              ) : (
                <div className="text-sm text-[var(--text-secondary)] space-y-3 leading-relaxed">
                  <p>
                    Equilibrio de Growy se ofrece mediante pago a través de Mercado Pago (
                    {config.priceLabel} o plan anual), entregando acceso a sus herramientas en la
                    web y como aplicación instalable.
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

      {/* Lector modal de artículos del Blog (#guias) */}
      <AnimatePresence>
        {selectedBlogPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-reader-title"
          >
            <motion.article
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: GROWY_EASE }}
              className="w-full max-w-2xl growy-solid rounded-[28px] p-6 sm:p-8 space-y-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-3 py-1 rounded-full bg-[var(--sec-soft)] border border-[var(--sec-border)] font-bold text-[var(--sec-text)]">
                      {selectedBlogPost.category}
                    </span>
                    <span className="font-mono text-[var(--text-secondary)]">
                      {selectedBlogPost.readingTime}
                    </span>
                  </div>
                  <h3
                    id="blog-reader-title"
                    className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight leading-snug"
                  >
                    {selectedBlogPost.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBlogPost(null)}
                  aria-label="Cerrar artículo"
                  className="min-w-[42px] min-h-[42px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                {selectedBlogPost.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
                <strong className="text-[var(--pos-text)]">En resumen:</strong>{' '}
                {selectedBlogPost.keyTakeaway}
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)]">
                <a
                  href="#punto-de-equilibrio"
                  onClick={() => setSelectedBlogPost(null)}
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="inline-flex items-center gap-2 min-h-[42px] px-5 py-2 rounded-full hover:opacity-92 text-xs font-bold transition-opacity"
                >
                  <span>Probar en la calculadora gratis</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedBlogPost(null)}
                  className="min-h-[42px] px-5 py-2 rounded-full border border-[var(--border-hairline)] text-xs font-semibold cursor-pointer hover:bg-[var(--bg-soft)]"
                >
                  Cerrar guía
                </button>
              </div>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
