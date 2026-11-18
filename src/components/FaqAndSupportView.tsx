import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FileText, Paperclip, Search, Send, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createSupportTicket, subscribeUserTickets } from '../firebase/services';
import type {
  FaqCategory,
  FaqItem,
  SupportTicket,
  TicketAttachment,
  TicketType,
  UserProfile,
} from '../types/finance';
import {
  formatAttachmentSize,
  MAX_SUPPORT_ATTACHMENTS,
  processSupportAttachments,
} from '../utils/attachments';
import { InstallAppGuideSection } from './InstallAppGuideSection';
import { GROWY_EASE } from './MotionPrimitives';

interface FaqAndSupportViewProps {
  faqs: FaqItem[];
  profile: UserProfile;
  contactEmail: string;
}

const CAT_LABELS: Record<FaqCategory | 'all', string> = {
  all: 'Todas',
  pagos: 'Pagos',
  uso: 'Uso de la app',
  calculos: 'Cálculos financieros',
  cuenta: 'Cuenta y datos',
  soporte: 'Soporte',
};

export const FaqAndSupportView: React.FC<FaqAndSupportViewProps> = ({
  faqs,
  profile,
  contactEmail,
}) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategory | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  const [ticketType, setTicketType] = useState<TicketType>('duda');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    return subscribeUserTickets(profile.uid, setMyTickets);
  }, [profile.uid]);

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
    });
  }, [faqs, category, query]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachError(null);
    try {
      const processed = await processSupportAttachments(files, attachments.length);
      setAttachments((prev) => [...prev, ...processed].slice(0, MAX_SUPPORT_ATTACHMENTS));
    } catch (err) {
      setAttachError(
        err instanceof Error ? err.message : 'No se pudo adjuntar el documento.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 5) {
      setFeedback({
        type: 'err',
        text: 'Escribe un asunto y un mensaje de al menos 5 caracteres.',
      });
      return;
    }
    setSending(true);
    setFeedback(null);
    try {
      await createSupportTicket({
        userId: profile.uid,
        name: profile.displayName,
        email: profile.email,
        subject: subject.trim(),
        message: message.trim(),
        ticketType,
        attachments,
      });
      setSubject('');
      setMessage('');
      setAttachments([]);
      setAttachError(null);
      setFeedback({
        type: 'ok',
        text: `Tu ${
          ticketType === 'sugerencia'
            ? 'sugerencia'
            : ticketType === 'problema'
              ? 'reporte de problema'
              : 'duda'
        } fue enviada al administrador (${contactEmail}). Verás la respuesta aquí debajo.`,
      });
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo enviar tu ticket en este momento.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            Centro de ayuda · Fórmulas, cuenta y soporte
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Preguntas{' '}
            <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
              frecuentes
            </em>{' '}
            y soporte
          </h1>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Buscar en ayuda..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="boho-input w-full pl-10"
          />
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(CAT_LABELS) as Array<FaqCategory | 'all'>).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              category === cat
                ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] shadow-sm'
                : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {filteredFaqs.length === 0 ? (
          <p className="boho-card p-6 text-sm text-[var(--text-secondary)] text-center">
            No encontramos preguntas con ese criterio.
          </p>
        ) : (
          filteredFaqs.map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div key={faq.id} className="boho-card !rounded-[24px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full min-h-[52px] px-5 py-4 flex items-center justify-between gap-4 text-left cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <div>
                    <span className="text-[11px] font-bold text-[var(--sec-text)] block">
                      {CAT_LABELS[faq.category]}
                    </span>
                    <span className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
                      {faq.question}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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
                      <div className="px-5 pb-4 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-hairline)] pt-3">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </section>

      <InstallAppGuideSection />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleSubmitTicket} className="lg:col-span-6 boho-card p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Enviar duda o sugerencia
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Se envía directo al administrador ({contactEmail}) · Tu cuenta: {profile.email}
          </p>

          {feedback && (
            <p
              className={`text-xs font-semibold p-3 rounded-2xl ${
                feedback.type === 'ok'
                  ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                  : 'bg-[var(--danger-soft)] text-[var(--danger-text)]'
              }`}
            >
              {feedback.text}
            </p>
          )}

          <div>
            <span className="block text-xs font-semibold mb-1.5">Tipo de mensaje</span>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'duda', label: 'Duda' },
                  { id: 'problema', label: 'Ocurre un problema' },
                  { id: 'sugerencia', label: 'Sugerencia' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTicketType(opt.id)}
                  className={`min-h-[42px] px-3 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    ticketType === opt.id
                      ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-sm'
                      : 'bg-[var(--bg-soft-alt)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Asunto</label>
            <input
              type="text"
              placeholder={
                ticketType === 'sugerencia'
                  ? 'Ej. Sugerencia de nuevo reporte o función'
                  : ticketType === 'problema'
                    ? 'Ej. Problema con pago de $5.990 o error en pantalla'
                    : 'Ej. Duda sobre margen de contribución'
              }
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="boho-input w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              {ticketType === 'sugerencia'
                ? 'Cuéntanos tu sugerencia'
                : ticketType === 'problema'
                  ? 'Describe el problema ocurrido'
                  : 'Detalle de tu duda'}
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="boho-input w-full py-2.5"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Adjuntar documentos o capturas (opcional, máx. {MAX_SUPPORT_ATTACHMENTS})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_SUPPORT_ATTACHMENTS}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Paperclip className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                <span>Adjuntar archivo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFilesSelected}
                className="hidden"
              />
            </div>

            {attachError && (
              <p className="text-xs font-semibold text-[var(--danger-text)]">{attachError}</p>
            )}

            {attachments.length > 0 && (
              <div className="space-y-1.5">
                {attachments.map((att, idx) => (
                  <div
                    key={`${att.name}-${idx}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[var(--accent-strong)] shrink-0" />
                      <span className="truncate font-medium">{att.name}</span>
                      <span className="text-[11px] font-mono text-[var(--text-secondary)] shrink-0">
                        ({formatAttachmentSize(att.sizeBytes)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((_, i) => i !== idx))
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
            disabled={sending}
            className="min-h-[44px] px-6 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>
              {sending
                ? 'Enviando...'
                : ticketType === 'sugerencia'
                  ? 'Enviar sugerencia'
                  : ticketType === 'problema'
                    ? 'Reportar problema al administrador'
                    : 'Enviar duda al administrador'}
            </span>
          </button>
        </form>

        <section className="lg:col-span-6 boho-card p-6 space-y-4">
          <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Mis mensajes y reportes ({myTickets.length})
          </h2>

          {myTickets.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-6">
              Aún no has enviado dudas, problemas ni sugerencias.
            </p>
          ) : (
            <div className="space-y-3">
              {myTickets.map((t) => {
                const statusText =
                  t.status === 'cerrado'
                    ? 'Resuelto'
                    : t.status === 'respondido'
                      ? 'Respondido'
                      : 'Pendiente';
                const kindLabel =
                  t.ticketType === 'sugerencia'
                    ? 'Sugerencia'
                    : t.ticketType === 'problema'
                      ? 'Problema'
                      : 'Duda';
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-[var(--text-primary)]">
                        <span className="text-[11px] font-bold text-[var(--accent-strong)] mr-1.5">
                          [{kindLabel}]
                        </span>
                        {t.subject}
                      </p>
                      <span
                        className={`text-xs font-bold shrink-0 ${
                          t.status === 'cerrado'
                            ? 'text-[var(--pos-text)]'
                            : t.status === 'respondido'
                              ? 'text-[var(--sec-text)]'
                              : 'text-[var(--warn-text)]'
                        }`}
                      >
                        {statusText}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{t.message}</p>
                    {t.attachments && t.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {t.attachments.map((att, idx) => (
                          <a
                            key={`${t.id}-att-${idx}`}
                            href={att.dataUrl}
                            download={att.name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[11px] font-semibold hover:underline"
                          >
                            <FileText className="w-3 h-3" />
                            <span>{att.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {t.adminReply && (
                      <div className="mt-2 pt-2 border-t border-[var(--border-hairline)] text-xs">
                        <span className="font-bold text-[var(--pos-text)]">
                          Respuesta del administrador:
                        </span>{' '}
                        {t.adminReply}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
