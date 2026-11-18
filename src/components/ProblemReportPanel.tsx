import React, { useRef, useState } from 'react';
import { FileText, HelpCircle, Paperclip, Send, Trash2 } from 'lucide-react';
import { createSupportTicket } from '../firebase/services';
import type { TicketAttachment, UserProfile } from '../types/finance';
import {
  formatAttachmentSize,
  MAX_SUPPORT_ATTACHMENTS,
  processSupportAttachments,
} from '../utils/attachments';

interface ProblemReportPanelProps {
  profile?: UserProfile | null;
  contactEmail: string;
  defaultSubject?: string;
  compact?: boolean;
  onSubmitted?: () => void;
}

export const ProblemReportPanel: React.FC<ProblemReportPanelProps> = ({
  profile,
  contactEmail,
  defaultSubject = '',
  compact = false,
  onSubmitted,
}) => {
  const [name, setName] = useState(profile?.displayName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveName = profile ? profile.displayName : name.trim();
  const effectiveEmail = profile ? profile.email : email.trim();

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setAttachError(null);
    try {
      const processed = await processSupportAttachments(files, attachments.length);
      setAttachments((prev) => [...prev, ...processed].slice(0, MAX_SUPPORT_ATTACHMENTS));
    } catch (err) {
      setAttachError(
        err instanceof Error ? err.message : 'No se pudo adjuntar el documento seleccionado.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
    setAttachError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveName.length < 2) {
      setFeedback({ type: 'err', text: 'Ingresa tu nombre.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail)) {
      setFeedback({ type: 'err', text: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 5) {
      setFeedback({
        type: 'err',
        text: 'Describe brevemente el asunto y lo que ocurrió (mínimo 5 caracteres).',
      });
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      await createSupportTicket({
        userId: profile?.uid ?? 'guest',
        name: effectiveName,
        email: effectiveEmail,
        subject: subject.trim(),
        message: message.trim(),
        ticketType: 'problema',
        attachments,
      });
      setSubject('');
      setMessage('');
      setAttachments([]);
      setAttachError(null);
      setFeedback({
        type: 'ok',
        text: `Reporte enviado con éxito al administrador (${contactEmail}) y registrado en su panel.`,
      });
      onSubmitted?.();
    } catch {
      setFeedback({
        type: 'err',
        text: 'No se pudo enviar el reporte en este momento. Intenta nuevamente.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`${
        compact
          ? 'p-4 sm:p-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-3.5'
          : 'boho-card p-6 space-y-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4 text-[var(--accent-strong)]" />
        </div>
        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)]">
            ¿Necesitas ayuda o quieres comentarnos algo?
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
            Si ya contrataste tu plan ($5.990 mensual o $50.000 anual) y tienes alguna consulta,
            sugerencia o necesitas asistencia, escríbenos. Puedes adjuntar documentos o capturas
            directamente para el administrador ({contactEmail}).
          </p>
        </div>
      </div>

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

      {!profile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Tu nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Camila Rojas"
              className="boho-input w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Tu correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="boho-input w-full"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold mb-1">¿Qué problema está ocurriendo?</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ej. Ya pagué $5.990 en Mercado Pago y no se habilita mi cuenta"
          className="boho-input w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1">Detalle del problema</label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Indica fecha/hora del pago, número de operación de Mercado Pago o lo que aparece en pantalla..."
          className="boho-input w-full py-2"
        />
      </div>

      {/* Adjuntar documentos o capturas */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Adjuntar documentos o comprobante (opcional, máx. {MAX_SUPPORT_ATTACHMENTS})
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= MAX_SUPPORT_ATTACHMENTS}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-4 py-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
          >
            <Paperclip className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
            <span>Adjuntar imagen o PDF</span>
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
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-xs"
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
                  onClick={() => handleRemoveAttachment(idx)}
                  aria-label={`Quitar ${att.name}`}
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-xl hover:bg-[var(--danger-soft)] text-[var(--danger-text)] cursor-pointer shrink-0"
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
        className="w-full sm:w-auto min-h-[44px] px-6 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 shadow-sm"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{sending ? 'Enviando mensaje...' : 'Enviar mensaje al administrador'}</span>
      </button>
    </form>
  );
};
