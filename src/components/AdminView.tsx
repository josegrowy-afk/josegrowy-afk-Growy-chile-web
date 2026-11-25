import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarCheck,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Gift,
  KeyRound,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Quote,
  Search,
  Shield,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { formatISODateSpanish, getSubscriptionStatus } from '../finance/subscription';
import { calculatePlanComparisonFromConfig } from '../finance/phase1Insights';
import { REFERRAL_PROGRAM_RULES } from '../finance/phase3Insights';
import { computeFunnelSummary, sanitizeWhatsappUrl } from '../finance/phase4Marketing';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_LANDING_CONTENT,
  adminCreateAccessCode,
  adminDeleteFaq,
  adminDeleteUser,
  adminGrantReferralBonus,
  adminRegisterAnnualPayment,
  adminRegisterMonthlyPayment,
  adminRevokeAccessCode,
  adminSaveAppConfig,
  adminSaveFaq,
  adminUpdateSupportTicket,
  adminUpdateUserAccess,
  ensureAdminSeedDefaults,
  subscribeAccessCodesAdmin,
  subscribeAllFaqsAdmin,
  subscribeAllTicketsAdmin,
  subscribeAllUsersAdmin,
  subscribeAdminLogs,
  subscribeFunnelEventsAdmin,
} from '../firebase/services';
import type {
  AccessCode,
  AccessStatus,
  AdminLogEntry,
  AppConfig,
  FaqCategory,
  FaqItem,
  FunnelEventRecord,
  LandingContentConfig,
  PaymentStatus,
  SupportTicket,
  TestimonialItem,
  TicketStatus,
  TicketType,
  UserProfile,
  UserRole,
} from '../types/finance';
import { SectionTitle, SolidCard } from './design-system';

interface AdminViewProps {
  adminProfile: UserProfile;
  appConfig: AppConfig;
}

type AdminSection = 'overview' | 'users' | 'codes' | 'faqs' | 'config' | 'tickets' | 'logs';

export const AdminView: React.FC<AdminViewProps> = ({ adminProfile, appConfig }) => {
  const [section, setSection] = useState<AdminSection>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [funnelEvents, setFunnelEvents] = useState<FunnelEventRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Filtros de usuarios e ID de transacción opcional al registrar pago
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState<AccessStatus | 'all'>('all');
  const [paymentTxDraft, setPaymentTxDraft] = useState('');

  // Códigos
  const [codeNote, setCodeNote] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // FAQs
  const [editFaqId, setEditFaqId] = useState<string | null>(null);
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState('');
  const [faqCat, setFaqCat] = useState<FaqCategory>('uso');
  const [faqOrder, setFaqOrder] = useState('1');
  const [faqPub, setFaqPub] = useState(true);

  // Config global editable
  const [draftConfig, setDraftConfig] = useState<AppConfig>(() => ({
    ...appConfig,
    testimonials: Array.isArray(appConfig.testimonials) ? appConfig.testimonials : [],
    landingContent: {
      ...DEFAULT_LANDING_CONTENT,
      ...(appConfig.landingContent ?? {}),
    },
  }));

  // Respuestas y filtros soporte
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [ticketTypeFilter, setTicketTypeFilter] = useState<TicketType | 'all'>('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | 'all'>('all');

  useEffect(() => {
    setDraftConfig({
      ...appConfig,
      testimonials: Array.isArray(appConfig.testimonials) ? appConfig.testimonials : [],
      landingContent: {
        ...DEFAULT_LANDING_CONTENT,
        ...(appConfig.landingContent ?? {}),
      },
    });
  }, [appConfig]);

  const draftLanding: LandingContentConfig = {
    ...DEFAULT_LANDING_CONTENT,
    ...(draftConfig.landingContent ?? {}),
  };

  const draftTestimonials = Array.isArray(draftConfig.testimonials)
    ? draftConfig.testimonials
    : [];

  const updateLandingField = <K extends keyof LandingContentConfig>(
    field: K,
    value: LandingContentConfig[K]
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      landingContent: {
        ...DEFAULT_LANDING_CONTENT,
        ...(prev.landingContent ?? {}),
        [field]: value,
      },
    }));
  };

  const handleAddTestimonial = () => {
    if (draftTestimonials.length >= 8) return;
    const nextItem: TestimonialItem = {
      id: `test-${Date.now()}`,
      name: '',
      businessName: '',
      city: '',
      quote: '',
      resultHighlight: '',
      permissionGranted: false,
    };
    setDraftConfig((prev) => ({
      ...prev,
      testimonials: [...(Array.isArray(prev.testimonials) ? prev.testimonials : []), nextItem],
    }));
  };

  const handleUpdateTestimonial = <K extends keyof TestimonialItem>(
    id: string,
    field: K,
    value: TestimonialItem[K]
  ) => {
    setDraftConfig((prev) => ({
      ...prev,
      testimonials: (Array.isArray(prev.testimonials) ? prev.testimonials : []).map((t) =>
        t.id === id ? { ...t, [field]: value } : t
      ),
    }));
  };

  const handleRemoveTestimonial = (id: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      testimonials: (Array.isArray(prev.testimonials) ? prev.testimonials : []).filter(
        (t) => t.id !== id
      ),
    }));
  };

  useEffect(() => {
    ensureAdminSeedDefaults();
    const unsubs = [
      subscribeAllUsersAdmin(setUsers),
      subscribeAccessCodesAdmin(setCodes),
      subscribeAllFaqsAdmin(setFaqs),
      subscribeAllTicketsAdmin(setTickets),
      subscribeAdminLogs(setLogs),
      subscribeFunnelEventsAdmin(setFunnelEvents),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const funnelSummary = useMemo(() => computeFunnelSummary(funnelEvents), [funnelEvents]);

  const stats = useMemo(() => {
    const active = users.filter((u) => u.accessStatus === 'active').length;
    const pending = users.filter((u) => u.accessStatus === 'pending').length;
    const unusedCodes = codes.filter((c) => c.status === 'unused').length;
    const openTickets = tickets.filter((t) => t.status === 'nuevo').length;
    const openProblems = tickets.filter(
      (t) => t.status === 'nuevo' && t.ticketType === 'problema'
    ).length;
    const openDoubts = tickets.filter(
      (t) => t.status === 'nuevo' && (!t.ticketType || t.ticketType === 'duda')
    ).length;
    const openSuggestions = tickets.filter(
      (t) => t.status === 'nuevo' && t.ticketType === 'sugerencia'
    ).length;
    const resolvedTickets = tickets.filter((t) => t.status === 'cerrado').length;
    return {
      totalUsers: users.length,
      active,
      pending,
      unusedCodes,
      openTickets,
      openProblems,
      openDoubts,
      openSuggestions,
      resolvedTickets,
    };
  }, [users, codes, tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const kind: TicketType =
        t.ticketType === 'sugerencia'
          ? 'sugerencia'
          : t.ticketType === 'problema'
            ? 'problema'
            : 'duda';
      if (ticketTypeFilter !== 'all' && kind !== ticketTypeFilter) return false;
      if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false;
      return true;
    });
  }, [tickets, ticketTypeFilter, ticketStatusFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (userFilter !== 'all' && u.accessStatus !== userFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q)
      );
    });
  }, [users, userFilter, userSearch]);

  const handleToggleUserStatus = async (
    target: UserProfile,
    nextAccess: AccessStatus,
    nextPayment: PaymentStatus,
    nextRole: UserRole
  ) => {
    await adminUpdateUserAccess({
      admin: adminProfile,
      targetUser: target,
      accessStatus: nextAccess,
      paymentStatus: nextPayment,
      role: nextRole,
    });
    showNotice(`Usuario ${target.email} actualizado.`);
  };

  const handleRegisterMonthlyPayment = async (target: UserProfile) => {
    const cleanTx = paymentTxDraft.trim() || undefined;
    const { nextDue, emailed } = await adminRegisterMonthlyPayment({
      admin: adminProfile,
      targetUser: target,
      transactionId: cleanTx,
    });
    if (cleanTx) setPaymentTxDraft('');
    showNotice(
      `Pago mensual ($5.990) registrado para ${target.email}. Vence: ${formatISODateSpanish(nextDue)}. ${
        emailed ? 'Comprobante enviado al correo.' : 'Comprobante disponible en su historial.'
      }`
    );
  };

  const handleRegisterAnnualPayment = async (target: UserProfile) => {
    const cleanTx = paymentTxDraft.trim() || undefined;
    const { nextDue, emailed } = await adminRegisterAnnualPayment({
      admin: adminProfile,
      targetUser: target,
      transactionId: cleanTx,
    });
    if (cleanTx) setPaymentTxDraft('');
    showNotice(
      `Pago anual ($50.000 · 12 meses) registrado para ${target.email}. Vence: ${formatISODateSpanish(nextDue)}. ${
        emailed ? 'Comprobante enviado al correo.' : 'Comprobante disponible en su historial.'
      }`
    );
  };

  const handleCopyRenewalMessage = async (target: UserProfile) => {
    const monthlyUrl = appConfig.paymentUrl;
    const annualUrl = appConfig.annualPaymentUrl || appConfig.paymentUrl;
    const msg = `Hola ${target.displayName}, tu acceso a Equilibrio de GROWy está listo para renovar. Elige tu plan y paga aquí:\n• Plan Mensual ($5.990 / mes): ${monthlyUrl}\n• Plan Anual ($50.000 / año · 12 meses): ${annualUrl}\nAl pagar, entra con tu cuenta Google (${target.email}) o envíanos tu comprobante para reactivar de inmediato.`;
    await navigator.clipboard.writeText(msg);
    showNotice(`Mensaje con links de pago ($5.990/mes y $50.000/año) copiado para ${target.email}.`);
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const generated = await adminCreateAccessCode({
      admin: adminProfile,
      note: codeNote.trim(),
    });
    setCodeNote('');
    showNotice(`Código ${generated} generado.`);
  };

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleGrantReferralBonus = async (codeDoc: AccessCode) => {
    const referrerUser = users.find((u) => u.uid === codeDoc.referrerUid);
    if (!referrerUser) {
      showNotice('No encontramos el perfil de la pyme anfitriona para este código.');
      return;
    }
    const { nextDue } = await adminGrantReferralBonus({
      admin: adminProfile,
      codeDoc,
      referrerUser,
    });
    showNotice(
      `+1 mes acreditado a ${referrerUser.email} por referido (${codeDoc.code}). Nueva vigencia: ${formatISODateSpanish(nextDue)}.`
    );
  };

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (faqQ.trim().length < 3 || faqA.trim().length < 3) return;
    await adminSaveFaq({
      admin: adminProfile,
      id: editFaqId ?? undefined,
      question: faqQ.trim(),
      answer: faqA.trim(),
      category: faqCat,
      order: Number(faqOrder) || 1,
      published: faqPub,
    });
    setEditFaqId(null);
    setFaqQ('');
    setFaqA('');
    setFaqOrder('1');
    setFaqPub(true);
    showNotice('Pregunta frecuente guardada.');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminSaveAppConfig(adminProfile, draftConfig);
    showNotice('Configuración global y textos de la landing actualizados.');
  };

  const handleSaveTicketReply = async (ticket: SupportTicket, status: TicketStatus) => {
    await adminUpdateSupportTicket({
      admin: adminProfile,
      ticket,
      status,
      adminReply: replyDrafts[ticket.id] ?? ticket.adminReply ?? '',
    });
    const statusLabel =
      status === 'cerrado' ? 'resuelto' : status === 'respondido' ? 'respondido' : status;
    showNotice(`Mensaje de ${ticket.email} marcado como ${statusLabel}.`);
  };

  const TABS: Array<{ id: AdminSection; label: string }> = [
    { id: 'overview', label: 'Resumen' },
    { id: 'users', label: `Usuarios (${users.length})` },
    { id: 'codes', label: `Códigos (${stats.unusedCodes})` },
    { id: 'faqs', label: `FAQ (${faqs.length})` },
    { id: 'config', label: 'Configuración y Landing' },
    { id: 'tickets', label: `Soporte (${stats.openTickets})` },
    { id: 'logs', label: 'Actividad' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-[var(--sec-text)] inline-flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Panel de administración protegido en servidor</span>
          </p>
          <SectionTitle
            as="h1"
            size="md"
            title="Administración de *GROWy.*"
          />
        </div>
        {notice && (
          <p className="text-xs font-bold bg-[var(--pos-soft)] border border-[var(--pos-border)] text-[var(--pos-text)] px-4 py-2 rounded-full">
            {notice}
          </p>
        )}
      </header>

      <div className="growy-tab-track">
        {TABS.map((t) => {
          const active = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              style={
                active
                  ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                  : undefined
              }
              className={`min-h-[38px] px-4 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* RESUMEN */}
      {section === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-[28px] p-5 bg-[var(--sec-soft)] border border-[var(--sec-border)]">
              <p className="text-xs font-semibold text-[var(--sec-muted)]">
                Total usuarios
              </p>
              <p className="font-mono tabular-nums text-3xl font-bold text-[var(--text-primary)] mt-1">
                {stats.totalUsers}
              </p>
            </div>
            <div className="rounded-[28px] p-5 bg-[var(--pos-soft)] border border-[var(--pos-border)]">
              <p className="text-xs font-semibold text-[var(--pos-muted)]">
                Accesos activos
              </p>
              <p className="font-mono tabular-nums text-3xl font-bold text-[var(--pos-text)] mt-1">
                {stats.active}
              </p>
            </div>
            <div className="rounded-[28px] p-5 bg-[var(--warn-soft)] border border-[var(--warn-border)]">
              <p className="text-xs font-semibold text-[var(--warn-muted)]">
                Pendientes de pago
              </p>
              <p className="font-mono tabular-nums text-3xl font-bold text-[var(--warn-text)] mt-1">
                {stats.pending}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSection('tickets')}
              className="text-left rounded-[28px] p-5 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)] hover:opacity-95 transition-opacity cursor-pointer"
            >
              <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
                Reportes, dudas y sugerencias
              </p>
              <p className="font-mono tabular-nums text-3xl font-bold text-[var(--accent-strong)] mt-1">
                {stats.openTickets}
              </p>
              <p className="text-[11px] text-[var(--accent-soft-muted)] mt-1">
                {stats.openProblems} problemas · {stats.openDoubts} dudas · {stats.openSuggestions} sugerencias
              </p>
            </button>
          </div>

          <SolidCard as="section" className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-[var(--sec-text)] shrink-0" />
                <SectionTitle
                  as="h2"
                  size="sm"
                  title="Embudo de *conversión* (últimos eventos)"
                  subtitle="Métricas anónimas por sesión (sin cookies ni datos personales)."
                />
              </div>
              <div className="text-right font-mono tabular-nums text-xs text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-primary)]">
                  {funnelSummary.uniqueSessions}
                </span>{' '}
                sesiones ·{' '}
                <span className="font-bold text-[var(--text-primary)]">
                  {funnelSummary.totalEvents}
                </span>{' '}
                eventos
              </div>
            </div>

            {funnelSummary.totalEvents === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] p-4 rounded-[20px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                Aún no hay eventos registrados en el embudo. Se irán guardando cuando alguien visite
                la portada, inicie sesión, complete el tour, haga su primer cálculo o inicie un pago.
              </p>
            ) : (
              <div className="space-y-2.5">
                {funnelSummary.steps.map((step, idx) => {
                  const maxSessions = Math.max(
                    1,
                    ...funnelSummary.steps.map((s) => s.uniqueSessions)
                  );
                  const widthPct = Math.max(4, Math.round((step.uniqueSessions / maxSessions) * 100));
                  return (
                    <div
                      key={step.step}
                      className="p-3.5 rounded-[20px] bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {idx + 1}. {step.label}
                        </span>
                        <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                          <strong className="text-[var(--text-primary)]">
                            {step.uniqueSessions}
                          </strong>{' '}
                          sesiones ({step.count} ev.) ·{' '}
                          <span className="text-[var(--pos-text)] font-semibold">
                            {step.conversionFromVisitPct}% vs visita
                          </span>
                          {idx > 0 && ` · ${step.conversionFromPreviousPct}% paso anterior`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent-strong)] transition-all"
                          style={{ width: `${step.uniqueSessions === 0 ? 0 : widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SolidCard>

          <SolidCard as="section" className="p-6 space-y-3">
            <SectionTitle
              as="h2"
              size="sm"
              title="Registros *recientes*"
            />
            <div className="divide-y divide-[var(--border-hairline)]">
              {users.slice(0, 8).map((u) => (
                <div key={u.uid} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <p className="font-semibold">{u.displayName}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{u.email}</p>
                  </div>
                  <p className="text-xs font-mono">
                    {u.role} · {u.accessStatus} · {u.paymentStatus}
                  </p>
                </div>
              ))}
            </div>
          </SolidCard>
        </div>
      )}

      {/* USUARIOS */}
      {section === 'users' && (
        <SolidCard as="section" className="p-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                placeholder="Buscar por nombre o correo..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="boho-input w-full !rounded-full pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="ID transacción MP (opcional)"
                value={paymentTxDraft}
                onChange={(e) => setPaymentTxDraft(e.target.value)}
                className="boho-input text-xs font-mono min-w-[210px]"
              />
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value as AccessStatus | 'all')}
                className="boho-input text-xs font-semibold"
              >
                <option value="all">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="pending">Pendientes</option>
                <option value="revoked">Suspendidos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[880px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                  <th className="py-2.5 pr-3">Usuario</th>
                  <th className="py-2.5 px-3">Rol</th>
                  <th className="py-2.5 px-3">Acceso</th>
                  <th className="py-2.5 px-3">Día y Vencimiento</th>
                  <th className="py-2.5 pl-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isPrimaryAdmin =
                    u.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
                  const sub = getSubscriptionStatus(u);
                  return (
                    <tr
                      key={u.uid}
                      className="border-b border-[var(--border-hairline)] last:border-0"
                    >
                      <td className="py-3 pr-3">
                        <p className="font-semibold">
                          {u.displayName}
                          {isPrimaryAdmin && (
                            <span className="ml-2 text-[11px] font-semibold text-[var(--sec-text)]">
                              (Admin principal)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{u.email}</p>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.role}
                          disabled={isPrimaryAdmin}
                          onChange={(e) =>
                            handleToggleUserStatus(
                              u,
                              u.accessStatus,
                              u.paymentStatus,
                              e.target.value as UserRole
                            )
                          }
                          className="boho-input py-1 min-h-[36px] text-xs disabled:opacity-60"
                        >
                          <option value="user">Usuario</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.accessStatus}
                          disabled={isPrimaryAdmin}
                          onChange={(e) => {
                            const nextStatus = e.target.value as AccessStatus;
                            const nextPay =
                              nextStatus === 'active' && u.paymentStatus === 'unpaid'
                                ? 'manual_admin'
                                : u.paymentStatus;
                            handleToggleUserStatus(u, nextStatus, nextPay, u.role);
                          }}
                          className="boho-input py-1 min-h-[36px] text-xs disabled:opacity-60"
                        >
                          <option value="active">Activo</option>
                          <option value="pending">Pendiente</option>
                          <option value="revoked">Suspendido</option>
                        </select>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {isPrimaryAdmin || u.role === 'admin' ? (
                          <span className="text-[var(--text-secondary)]">Exento (Admin)</span>
                        ) : sub.isComplimentary ? (
                          <div className="space-y-0.5">
                            <p className="font-semibold text-[var(--pos-text)]">
                              Cliente de prueba (sin cobro)
                            </p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {u.billingDay ? `Día elegido: ${u.billingDay}` : 'Acceso continuo'}
                            </p>
                          </div>
                        ) : sub.isAnnual ? (
                          <div className="space-y-0.5">
                            <p className="font-semibold text-[var(--sec-text)]">
                              Plan Anual (12M · $50.000)
                            </p>
                            <p
                              className={`text-[11px] font-mono ${
                                sub.isExpired
                                  ? 'text-[var(--danger-text)] font-bold'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {u.nextPaymentDueAt
                                ? `${sub.isExpired ? 'Venció' : 'Vence'}: ${formatISODateSpanish(u.nextPaymentDueAt)}`
                                : 'Sin fecha'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="font-semibold">
                              {u.billingDay ? `Mensual · Día ${u.billingDay}` : 'Mensual · Sin día'}
                            </p>
                            <p
                              className={`text-[11px] font-mono ${
                                sub.isExpired
                                  ? 'text-[var(--danger-text)] font-bold'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                            >
                              {u.nextPaymentDueAt
                                ? `${sub.isExpired ? 'Venció' : 'Vence'}: ${formatISODateSpanish(u.nextPaymentDueAt)}`
                                : u.paymentStatus}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {!isPrimaryAdmin && u.role !== 'admin' && !sub.isComplimentary && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyRenewalMessage(u)}
                                title="Copiar mensaje y links de cobro ($5.990/mes o $50.000/año)"
                                className={`min-h-[36px] px-3.5 rounded-full border text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                                  sub.isExpired
                                    ? 'bg-[var(--danger-soft)] text-[var(--danger-text)] border-[var(--danger-border)]'
                                    : 'bg-[var(--bg-soft-alt)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                                }`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{sub.isExpired ? 'Enviar cobro' : 'Link cobro'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRegisterMonthlyPayment(u)}
                                className="min-h-[36px] px-3.5 rounded-full bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>Mes $5.990</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRegisterAnnualPayment(u)}
                                className="min-h-[36px] px-3.5 rounded-full bg-[var(--sec-soft)] text-[var(--sec-text)] border border-[var(--sec-border)] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CalendarCheck className="w-3.5 h-3.5" />
                                <span>Año $50.000</span>
                              </button>
                            </>
                          )}
                          {u.uid !== adminProfile.uid && !isPrimaryAdmin && (
                            <button
                              type="button"
                              onClick={() => adminDeleteUser(adminProfile, u)}
                              aria-label={`Eliminar cuenta de ${u.email}`}
                              className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-full text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SolidCard>
      )}

      {/* CÓDIGOS DE ACCESO */}
      {section === 'codes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <SolidCard className="lg:col-span-4 p-6">
            <form onSubmit={handleGenerateCode} className="space-y-4">
              <SectionTitle
                as="h2"
                size="sm"
                title="Generar *código* único"
                subtitle="Crea códigos de un solo uso para entregar acceso tras pagos por transferencia o becas."
              />
              <div>
                <label className="block text-xs font-semibold mb-1">Nota interna (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej. Pago transferencia Ana"
                  value={codeNote}
                  onChange={(e) => setCodeNote(e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <button
                type="submit"
                style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                className="w-full min-h-[44px] rounded-full text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:opacity-92 transition-opacity"
              >
                <KeyRound className="w-4 h-4" />
                <span>Generar nuevo código</span>
              </button>
            </form>
          </SolidCard>

          <SolidCard as="section" className="lg:col-span-8 p-6 space-y-5">
            <div className="p-4 rounded-[20px] bg-[var(--sec-soft)] border border-[var(--sec-border)] space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--sec-text)]">
                <Gift className="w-4 h-4 shrink-0" />
                <span>Reglas del programa de referidos («Invita a otra pyme y ambos ganan un mes»)</span>
              </div>
              <ul className="text-[11px] text-[var(--text-secondary)] space-y-1 list-disc pl-5">
                {REFERRAL_PROGRAM_RULES.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <SectionTitle
                as="h2"
                size="sm"
                title={`Listado de *códigos* y referidos (${codes.length})`}
              />
              <div className="divide-y divide-[var(--border-hairline)]">
                {codes.map((c) => {
                  const isReferral = c.codeKind === 'referral';
                  const canCreditReferrer =
                    isReferral && c.status === 'used' && !c.referrerRewardApplied && Boolean(c.referrerUid);
                  return (
                    <div key={c.code} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-mono font-semibold text-sm flex flex-wrap items-center gap-2">
                          <span>{c.code}</span>
                          {isReferral && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)] text-[10px] font-sans font-bold">
                              Referido (+1 mes)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          <span>Estado: {c.status}</span>
                          {c.note ? ` · ${c.note}` : ''}
                          {c.referrerEmail ? ` · Invita: ${c.referrerEmail}` : ''}
                          {c.usedByEmail ? ` · Usado por ${c.usedByEmail}` : ''}
                          {c.referrerRewardApplied ? ' · Premio anfitrión acreditado' : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canCreditReferrer && (
                          <button
                            type="button"
                            onClick={() => void handleGrantReferralBonus(c)}
                            className="min-h-[38px] px-4 rounded-full bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Gift className="w-3.5 h-3.5" />
                            <span>Acreditar +1 mes al anfitrión</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyCode(c.code)}
                          className="min-h-[38px] px-4 rounded-full border border-[var(--border-hairline)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-soft)]"
                        >
                          {copiedCode === c.code ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[var(--pos-text)]" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                        {c.status === 'unused' && (
                          <button
                            type="button"
                            onClick={() => adminRevokeAccessCode(adminProfile, c.code)}
                            className="min-h-[38px] px-4 rounded-full text-xs font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer"
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </SolidCard>
        </div>
      )}

      {/* GESTIÓN FAQ */}
      {section === 'faqs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <SolidCard className="lg:col-span-5 p-6">
            <form onSubmit={handleSaveFaq} className="space-y-4">
              <SectionTitle
                as="h2"
                size="sm"
                title={editFaqId ? 'Editar *pregunta*' : 'Nueva *pregunta* frecuente'}
              />
              <div>
                <label className="block text-xs font-semibold mb-1">Pregunta</label>
                <input
                  type="text"
                  value={faqQ}
                  onChange={(e) => setFaqQ(e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Respuesta</label>
                <textarea
                  rows={4}
                  value={faqA}
                  onChange={(e) => setFaqA(e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Categoría</label>
                  <select
                    value={faqCat}
                    onChange={(e) => setFaqCat(e.target.value as FaqCategory)}
                    className="boho-input w-full text-xs"
                  >
                    <option value="pagos">Pagos</option>
                    <option value="uso">Uso de la app</option>
                    <option value="calculos">Cálculos financieros</option>
                    <option value="cuenta">Cuenta y datos</option>
                    <option value="soporte">Soporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Orden</label>
                  <input
                    type="number"
                    min={1}
                    value={faqOrder}
                    onChange={(e) => setFaqOrder(e.target.value)}
                    className="boho-input w-full font-mono"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={faqPub}
                  onChange={(e) => setFaqPub(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>Publicada (visible en landing y ayuda)</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
                  className="flex-1 min-h-[44px] rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm hover:opacity-92 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  <span>{editFaqId ? 'Actualizar FAQ' : 'Guardar FAQ'}</span>
                </button>
                {editFaqId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditFaqId(null);
                      setFaqQ('');
                      setFaqA('');
                    }}
                    className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </SolidCard>

          <SolidCard as="section" className="lg:col-span-7 p-6 space-y-3">
            <SectionTitle
              as="h2"
              size="sm"
              title="Preguntas *actuales*"
            />
            <div className="divide-y divide-[var(--border-hairline)]">
              {faqs.map((f) => (
                <div key={f.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      #{f.order} · {f.category} · {f.published ? 'Publicada' : 'Oculta'}
                    </p>
                    <p className="font-semibold text-sm mt-0.5">{f.question}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditFaqId(f.id);
                        setFaqQ(f.question);
                        setFaqA(f.answer);
                        setFaqCat(f.category);
                        setFaqOrder(String(f.order));
                        setFaqPub(f.published);
                      }}
                      aria-label={`Editar ${f.question}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => adminDeleteFaq(adminProfile, f)}
                      aria-label={`Eliminar ${f.question}`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SolidCard>
        </div>
      )}

      {/* CONFIGURACIÓN GLOBAL Y TEXTOS DE LA LANDING EDITABLES SIN CÓDIGO */}
      {section === 'config' && (
        <form onSubmit={handleSaveConfig} className="space-y-6 max-w-4xl">
          <SolidCard className="p-6 space-y-5">
            <SectionTitle
              as="h2"
              size="sm"
              title="Planes ($5.990/mes y $50.000/año), *links* de pago y contacto"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Link de pago Mensual ($5.990 / mes) · Mercado Pago
                </label>
                <input
                  type="text"
                  placeholder="https://mpago.la/..."
                  value={draftConfig.paymentUrl}
                  onChange={(e) => setDraftConfig({ ...draftConfig, paymentUrl: e.target.value })}
                  className="boho-input w-full"
                />
                <span className="block text-[11px] text-[var(--text-secondary)] mt-1">
                  Se usa en el botón del plan mensual y en avisos de renovación.
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Link de pago Anual ($50.000 / año · 12 meses) · Mercado Pago
                </label>
                <input
                  type="text"
                  placeholder="https://mpago.la/2JwG16F"
                  value={draftConfig.annualPaymentUrl ?? 'https://mpago.la/2JwG16F'}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, annualPaymentUrl: e.target.value })
                  }
                  className="boho-input w-full"
                />
                <span className="block text-[11px] text-[var(--text-secondary)] mt-1">
                  Se usa en el plan anual de 12 meses y al vencer para renovar.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Precio mensual mostrado</label>
                <input
                  type="text"
                  value={draftConfig.priceLabel}
                  onChange={(e) => setDraftConfig({ ...draftConfig, priceLabel: e.target.value })}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Correo de contacto</label>
                <input
                  type="email"
                  value={draftConfig.contactEmail}
                  onChange={(e) => setDraftConfig({ ...draftConfig, contactEmail: e.target.value })}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-[var(--pos-text)]" />
                <span>WhatsApp de soporte humano (opcional · +569... o https://wa.me/...)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. +56912345678 o https://wa.me/56912345678"
                value={draftConfig.whatsappUrl ?? ''}
                onChange={(e) => setDraftConfig({ ...draftConfig, whatsappUrl: e.target.value })}
                className="boho-input w-full"
              />
              <span className="block text-[11px] text-[var(--text-secondary)] mt-1">
                {(() => {
                  const raw = (draftConfig.whatsappUrl ?? '').trim();
                  if (!raw) {
                    return 'Si lo dejas vacío, se mostrará el botón de correo y formulario de soporte.';
                  }
                  const normalized = sanitizeWhatsappUrl(raw);
                  return normalized
                    ? `Enlace válido listo para la landing: ${normalized}`
                    : 'Formato no reconocido. Usa un número (+569...) o un enlace https://wa.me/...';
                })()}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Valor mensual CLP (para anclaje automático)
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={draftConfig.monthlyPriceClp ?? 5990}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      monthlyPriceClp: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="boho-input w-full font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Valor anual CLP (12 meses)
                </label>
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={draftConfig.annualPriceClp ?? 50000}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      annualPriceClp: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                  className="boho-input w-full font-mono tabular-nums"
                />
              </div>
              <p className="sm:col-span-2 text-xs text-[var(--pos-text)] font-medium">
                Vista previa en landing y renovación:{' '}
                <strong className="font-mono">
                  {calculatePlanComparisonFromConfig(draftConfig).anchorComparisonText}
                </strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Nota debajo del precio</label>
              <input
                type="text"
                value={draftConfig.currencyNote}
                onChange={(e) => setDraftConfig({ ...draftConfig, currencyNote: e.target.value })}
                className="boho-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Garantía de devolución editable (se muestra junto al precio en portada)
              </label>
              <textarea
                rows={2}
                value={draftConfig.refundGuaranteeText ?? ''}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, refundGuaranteeText: e.target.value })
                }
                placeholder="Ej. Garantía tranquila de 7 días: si pruebas Equilibrio y sientes que no te ordena..."
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Texto de garantía / respaldo</label>
              <textarea
                rows={2}
                value={draftConfig.guaranteeText}
                onChange={(e) => setDraftConfig({ ...draftConfig, guaranteeText: e.target.value })}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Mensaje de bienvenida para cuentas pendientes
              </label>
              <textarea
                rows={2}
                value={draftConfig.welcomeMessage}
                onChange={(e) => setDraftConfig({ ...draftConfig, welcomeMessage: e.target.value })}
                className="boho-input w-full py-2"
              />
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
              <label className="inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.mpRecurringEnabled !== false}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, mpRecurringEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>
                  Ofrecer suscripción recurrente automática con Mercado Pago (manteniendo link manual y códigos como respaldo)
                </span>
              </label>

              <label className="inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={draftConfig.announcementActive}
                  onChange={(e) =>
                    setDraftConfig({ ...draftConfig, announcementActive: e.target.checked })
                  }
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>Mostrar anuncio global dentro de la app</span>
              </label>
              <input
                type="text"
                placeholder="Ej. Nueva guía de costos variables disponible en Ayuda."
                value={draftConfig.announcementText}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, announcementText: e.target.value })
                }
                className="boho-input w-full"
              />
            </div>
          </SolidCard>

          {/* 1. HERO Y 2. QUÉ ES GROWY */}
          <SolidCard className="p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              1. Hero y 2. Qué es Growy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Píldora superior del Hero</label>
                <input
                  type="text"
                  value={draftLanding.heroEyebrow}
                  onChange={(e) => updateLandingField('heroEyebrow', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Botón principal del Hero</label>
                <input
                  type="text"
                  value={draftLanding.heroPrimaryCta}
                  onChange={(e) => updateLandingField('heroPrimaryCta', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Título principal (Hero) — usa *palabra* para destacar en cursiva Fraunces
              </label>
              <input
                type="text"
                value={draftConfig.heroTitle}
                onChange={(e) => setDraftConfig({ ...draftConfig, heroTitle: e.target.value })}
                className="boho-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Subtítulo (Hero)</label>
              <textarea
                rows={2}
                value={draftConfig.heroSubtitle}
                onChange={(e) => setDraftConfig({ ...draftConfig, heroSubtitle: e.target.value })}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                3 checks verdes del Hero (una línea por check)
              </label>
              <textarea
                rows={3}
                value={draftLanding.heroChecks}
                onChange={(e) => updateLandingField('heroChecks', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
              <p className="text-xs font-bold text-[var(--sec-text)]">
                Tres pasos bajo el Hero (1 · 2 · 3)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={draftLanding.step1Title}
                    onChange={(e) => updateLandingField('step1Title', e.target.value)}
                    className="boho-input w-full"
                    placeholder="Paso 1 título"
                  />
                  <textarea
                    rows={2}
                    value={draftLanding.step1Desc}
                    onChange={(e) => updateLandingField('step1Desc', e.target.value)}
                    className="boho-input w-full py-2"
                    placeholder="Paso 1 descripción"
                  />
                </div>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={draftLanding.step2Title}
                    onChange={(e) => updateLandingField('step2Title', e.target.value)}
                    className="boho-input w-full"
                    placeholder="Paso 2 título"
                  />
                  <textarea
                    rows={2}
                    value={draftLanding.step2Desc}
                    onChange={(e) => updateLandingField('step2Desc', e.target.value)}
                    className="boho-input w-full py-2"
                    placeholder="Paso 2 descripción"
                  />
                </div>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={draftLanding.step3Title}
                    onChange={(e) => updateLandingField('step3Title', e.target.value)}
                    className="boho-input w-full"
                    placeholder="Paso 3 título"
                  />
                  <textarea
                    rows={2}
                    value={draftLanding.step3Desc}
                    onChange={(e) => updateLandingField('step3Desc', e.target.value)}
                    className="boho-input w-full py-2"
                    placeholder="Paso 3 descripción"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Etiqueta &ldquo;Qué es Growy&rdquo;</label>
                  <input
                    type="text"
                    value={draftLanding.whatIsEyebrow}
                    onChange={(e) => updateLandingField('whatIsEyebrow', e.target.value)}
                    className="boho-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Título &ldquo;Qué es Growy&rdquo;</label>
                  <input
                    type="text"
                    value={draftLanding.whatIsTitle}
                    onChange={(e) => updateLandingField('whatIsTitle', e.target.value)}
                    className="boho-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Descripción de Growy</label>
                <textarea
                  rows={3}
                  value={draftLanding.whatIsBody}
                  onChange={(e) => updateLandingField('whatIsBody', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold">Pilar 1 (Título y texto)</label>
                  <input
                    type="text"
                    value={draftLanding.whatIsPillar1Title}
                    onChange={(e) => updateLandingField('whatIsPillar1Title', e.target.value)}
                    className="boho-input w-full"
                  />
                  <textarea
                    rows={2}
                    value={draftLanding.whatIsPillar1Desc}
                    onChange={(e) => updateLandingField('whatIsPillar1Desc', e.target.value)}
                    className="boho-input w-full py-2"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold">Pilar 2 (Título y texto)</label>
                  <input
                    type="text"
                    value={draftLanding.whatIsPillar2Title}
                    onChange={(e) => updateLandingField('whatIsPillar2Title', e.target.value)}
                    className="boho-input w-full"
                  />
                  <textarea
                    rows={2}
                    value={draftLanding.whatIsPillar2Desc}
                    onChange={(e) => updateLandingField('whatIsPillar2Desc', e.target.value)}
                    className="boho-input w-full py-2"
                  />
                </div>
              </div>
            </div>
          </SolidCard>

          {/* 3. SECCIÓN EDUCATIVA: PUNTO DE EQUILIBRIO */}
          <SolidCard className="p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              3. Sección educativa: ¿Qué es el punto de equilibrio?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Antetítulo</label>
                <input
                  type="text"
                  value={draftLanding.breakevenEyebrow}
                  onChange={(e) => updateLandingField('breakevenEyebrow', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Título principal</label>
                <input
                  type="text"
                  value={draftLanding.breakevenTitle}
                  onChange={(e) => updateLandingField('breakevenTitle', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Definición simple</label>
              <textarea
                rows={2}
                value={draftLanding.breakevenDefinition}
                onChange={(e) => updateLandingField('breakevenDefinition', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Título importancia</label>
                <input
                  type="text"
                  value={draftLanding.breakevenImportanceTitle}
                  onChange={(e) => updateLandingField('breakevenImportanceTitle', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Título 3 números</label>
                <input
                  type="text"
                  value={draftLanding.breakevenPillarsTitle}
                  onChange={(e) => updateLandingField('breakevenPillarsTitle', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Por qué es importante (una línea por punto)
              </label>
              <textarea
                rows={4}
                value={draftLanding.breakevenImportancePoints}
                onChange={(e) => updateLandingField('breakevenImportancePoints', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Número 1 (Fijos)</label>
                <input
                  type="text"
                  value={draftLanding.breakevenFixedTitle}
                  onChange={(e) => updateLandingField('breakevenFixedTitle', e.target.value)}
                  className="boho-input w-full"
                />
                <textarea
                  rows={2}
                  value={draftLanding.breakevenFixedDesc}
                  onChange={(e) => updateLandingField('breakevenFixedDesc', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Número 2 (Variables)</label>
                <input
                  type="text"
                  value={draftLanding.breakevenVariableTitle}
                  onChange={(e) => updateLandingField('breakevenVariableTitle', e.target.value)}
                  className="boho-input w-full"
                />
                <textarea
                  rows={2}
                  value={draftLanding.breakevenVariableDesc}
                  onChange={(e) => updateLandingField('breakevenVariableDesc', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold">Número 3 (Precio)</label>
                <input
                  type="text"
                  value={draftLanding.breakevenPriceTitle}
                  onChange={(e) => updateLandingField('breakevenPriceTitle', e.target.value)}
                  className="boho-input w-full"
                />
                <textarea
                  rows={2}
                  value={draftLanding.breakevenPriceDesc}
                  onChange={(e) => updateLandingField('breakevenPriceDesc', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Título del ejemplo visual</label>
              <input
                type="text"
                value={draftLanding.breakevenExampleTitle}
                onChange={(e) => updateLandingField('breakevenExampleTitle', e.target.value)}
                className="boho-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Texto del ejemplo visual</label>
              <textarea
                rows={3}
                value={draftLanding.breakevenExampleBody}
                onChange={(e) => updateLandingField('breakevenExampleBody', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">De la realidad a la proyección</label>
              <textarea
                rows={2}
                value={draftLanding.breakevenRealityToProjection}
                onChange={(e) => updateLandingField('breakevenRealityToProjection', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Frase de cierre / Franja oscura</label>
              <input
                type="text"
                value={draftLanding.breakevenClosingQuote}
                onChange={(e) => updateLandingField('breakevenClosingQuote', e.target.value)}
                className="boho-input w-full"
              />
            </div>
          </SolidCard>

          {/* 4. PRODUCTO EQUILIBRIO Y 5. PRÓXIMAMENTE */}
          <SolidCard className="p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              4. Producto Equilibrio y 5. Próximamente
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Antetítulo Equilibrio</label>
                <input
                  type="text"
                  value={draftLanding.equilibrioEyebrow}
                  onChange={(e) => updateLandingField('equilibrioEyebrow', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre del producto</label>
                <input
                  type="text"
                  value={draftLanding.equilibrioTitle}
                  onChange={(e) => updateLandingField('equilibrioTitle', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Descripción de Equilibrio</label>
              <textarea
                rows={2}
                value={draftLanding.equilibrioSubtitle}
                onChange={(e) => updateLandingField('equilibrioSubtitle', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Lista de qué permite hacer (una línea por punto)
              </label>
              <textarea
                rows={5}
                value={draftLanding.equilibrioFeatures}
                onChange={(e) => updateLandingField('equilibrioFeatures', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Texto botón comprar</label>
                <input
                  type="text"
                  value={draftLanding.equilibrioCtaLabel}
                  onChange={(e) => updateLandingField('equilibrioCtaLabel', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nota de confianza post-pago</label>
                <input
                  type="text"
                  value={draftLanding.equilibrioTrustNote}
                  onChange={(e) => updateLandingField('equilibrioTrustNote', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Antetítulo Próximamente</label>
                  <input
                    type="text"
                    value={draftLanding.upcomingEyebrow}
                    onChange={(e) => updateLandingField('upcomingEyebrow', e.target.value)}
                    className="boho-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Título Próximamente</label>
                  <input
                    type="text"
                    value={draftLanding.upcomingTitle}
                    onChange={(e) => updateLandingField('upcomingTitle', e.target.value)}
                    className="boho-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Texto Próximamente</label>
                <textarea
                  rows={2}
                  value={draftLanding.upcomingSubtitle}
                  onChange={(e) => updateLandingField('upcomingSubtitle', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
            </div>
          </SolidCard>

          {/* 4B. DOLORES DEL CLIENTE, COMPARACIÓN COTIDIANA, PRIVACIDAD Y SOPORTE HUMANO */}
          <SolidCard className="p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              4B. Dolores reales, comparación de precio, privacidad y soporte humano
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Antetítulo dolores reales</label>
                <input
                  type="text"
                  value={draftLanding.painEyebrow}
                  onChange={(e) => updateLandingField('painEyebrow', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Título dolores reales</label>
                <input
                  type="text"
                  value={draftLanding.painTitle}
                  onChange={(e) => updateLandingField('painTitle', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Lista de dolores cotidianos (una línea por tarjeta)
              </label>
              <textarea
                rows={4}
                value={draftLanding.painPoints}
                onChange={(e) => updateLandingField('painPoints', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Comparación cotidiana del precio (junto a los planes)
              </label>
              <input
                type="text"
                value={draftLanding.priceComparisonText}
                onChange={(e) => updateLandingField('priceComparisonText', e.target.value)}
                className="boho-input w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-hairline)]">
              <div className="space-y-2">
                <label className="block text-xs font-semibold">Título bloque privacidad</label>
                <input
                  type="text"
                  value={draftLanding.privacyTitle}
                  onChange={(e) => updateLandingField('privacyTitle', e.target.value)}
                  className="boho-input w-full"
                />
                <label className="block text-xs font-semibold">Texto bloque privacidad</label>
                <textarea
                  rows={3}
                  value={draftLanding.privacyBody}
                  onChange={(e) => updateLandingField('privacyBody', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold">Título soporte humano</label>
                <input
                  type="text"
                  value={draftLanding.supportHumanTitle}
                  onChange={(e) => updateLandingField('supportHumanTitle', e.target.value)}
                  className="boho-input w-full"
                />
                <label className="block text-xs font-semibold">Texto soporte humano</label>
                <textarea
                  rows={3}
                  value={draftLanding.supportHumanBody}
                  onChange={(e) => updateLandingField('supportHumanBody', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
            </div>
          </SolidCard>

          {/* 4C. TESTIMONIOS Y CASOS REALES (CON PERMISO DEL CLIENTE) */}
          <SolidCard className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-[var(--text-primary)] inline-flex items-center gap-2">
                  <Quote className="w-5 h-5 text-[var(--accent-strong)]" />
                  <span>4C. Testimonios y casos reales ({draftTestimonials.length}/8)</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Solo se publican en la landing si marcas la casilla{' '}
                  <strong>«Tengo permiso del cliente»</strong>. Si no hay testimonios con permiso,
                  la sección no se muestra.
                </p>
              </div>
              <button
                type="button"
                disabled={draftTestimonials.length >= 8}
                onClick={handleAddTestimonial}
                className="min-h-[40px] px-4 rounded-full bg-[var(--sec-soft)] text-[var(--sec-text)] border border-[var(--sec-border)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar testimonio</span>
              </button>
            </div>

            {draftTestimonials.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                No hay testimonios cargados. La sección de testimonios permanecerá oculta en la
                landing hasta que agregues al menos uno con permiso del cliente.
              </p>
            ) : (
              <div className="space-y-4">
                {draftTestimonials.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Caso #{idx + 1}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.permissionGranted
                              ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                              : 'bg-[var(--warn-soft)] text-[var(--warn-text)]'
                          }`}
                        >
                          {item.permissionGranted
                            ? 'Publicado en landing'
                            : 'Oculto (sin permiso)'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveTestimonial(item.id)}
                        aria-label={`Eliminar testimonio ${idx + 1}`}
                        className="min-h-[34px] px-3 rounded-xl text-xs font-semibold text-[var(--danger-text)] hover:bg-[var(--danger-soft)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">
                          Nombre del emprendedor/a
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Camila Rojas"
                          value={item.name}
                          onChange={(e) =>
                            handleUpdateTestimonial(item.id, 'name', e.target.value)
                          }
                          className="boho-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">
                          Nombre de la pyme / rubro
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Pastelería Canela"
                          value={item.businessName}
                          onChange={(e) =>
                            handleUpdateTestimonial(item.id, 'businessName', e.target.value)
                          }
                          className="boho-input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">
                          Ciudad / comuna (opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Valdivia"
                          value={item.city ?? ''}
                          onChange={(e) =>
                            handleUpdateTestimonial(item.id, 'city', e.target.value)
                          }
                          className="boho-input w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1">
                        Logro concreto destacado (opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. Ajustó 3 precios y subió su margen en 18%"
                        value={item.resultHighlight ?? ''}
                        onChange={(e) =>
                          handleUpdateTestimonial(item.id, 'resultHighlight', e.target.value)
                        }
                        className="boho-input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold mb-1">
                        Testimonio en palabras del cliente
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ej. Por fin supe cuántas tortas tenía que vender al mes antes de empezar a ganar..."
                        value={item.quote}
                        onChange={(e) =>
                          handleUpdateTestimonial(item.id, 'quote', e.target.value)
                        }
                        className="boho-input w-full py-2"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-[var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={item.permissionGranted}
                        onChange={(e) =>
                          handleUpdateTestimonial(
                            item.id,
                            'permissionGranted',
                            e.target.checked
                          )
                        }
                        className="w-4 h-4 accent-[var(--pos-text)]"
                      />
                      <UserCheck className="w-4 h-4 text-[var(--pos-text)] shrink-0" />
                      <span>
                        Tengo permiso explícito del cliente para publicar este testimonio en la
                        portada
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </SolidCard>

          {/* 6. QUIÉN ESTÁ DETRÁS Y 8. CIERRE CTA */}
          <SolidCard className="p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-[var(--text-primary)]">
              6. Quién está detrás de Growy y 8. Cierre CTA
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Antetítulo sección creador</label>
                <input
                  type="text"
                  value={draftLanding.creatorEyebrow}
                  onChange={(e) => updateLandingField('creatorEyebrow', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre del creador</label>
                <input
                  type="text"
                  value={draftLanding.creatorName}
                  onChange={(e) => updateLandingField('creatorName', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Título de la sección</label>
                <input
                  type="text"
                  value={draftLanding.creatorTitle}
                  onChange={(e) => updateLandingField('creatorTitle', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Rol / especialidad</label>
                <input
                  type="text"
                  value={draftLanding.creatorRole}
                  onChange={(e) => updateLandingField('creatorRole', e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Botón franja oscura</label>
              <input
                type="text"
                value={draftLanding.creatorQuoteCta}
                onChange={(e) => updateLandingField('creatorQuoteCta', e.target.value)}
                className="boho-input w-full"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Biografía del creador (separa párrafos con una línea en blanco)
              </label>
              <textarea
                rows={5}
                value={draftLanding.creatorBio}
                onChange={(e) => updateLandingField('creatorBio', e.target.value)}
                className="boho-input w-full py-2"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Nota final del creador</label>
              <input
                type="text"
                value={draftLanding.creatorClosingNote}
                onChange={(e) => updateLandingField('creatorClosingNote', e.target.value)}
                className="boho-input w-full"
              />
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Título cierre CTA</label>
                  <input
                    type="text"
                    value={draftLanding.closingTitle}
                    onChange={(e) => updateLandingField('closingTitle', e.target.value)}
                    className="boho-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Botón cierre CTA</label>
                  <input
                    type="text"
                    value={draftLanding.closingCtaLabel}
                    onChange={(e) => updateLandingField('closingCtaLabel', e.target.value)}
                    className="boho-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Subtítulo cierre CTA</label>
                <textarea
                  rows={2}
                  value={draftLanding.closingSubtitle}
                  onChange={(e) => updateLandingField('closingSubtitle', e.target.value)}
                  className="boho-input w-full py-2"
                />
              </div>
            </div>
          </SolidCard>

          <button
            type="submit"
            style={{ backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }}
            className="min-h-[46px] px-7 rounded-full text-sm font-bold cursor-pointer shadow-sm hover:opacity-92 transition-opacity"
          >
            Guardar toda la configuración y textos de la landing
          </button>
        </form>
      )}

      {/* BANDEJA DE SOPORTE (DUDAS Y SUGERENCIAS) */}
      {section === 'tickets' && (
        <section className="space-y-4">
          <SolidCard className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <SectionTitle
                as="h2"
                size="sm"
                title={`Bandeja de *dudas* y sugerencias (${BOOTSTRAPPED_ADMIN_EMAIL})`}
                subtitle="Recibe, responde y resuelve consultas o sugerencias enviadas desde la app y la landing."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['all', 'problema', 'duda', 'sugerencia'] as const).map((kind) => {
                const active = ticketTypeFilter === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setTicketTypeFilter(kind)}
                    style={
                      active
                        ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                        : undefined
                    }
                    className={`min-h-[38px] px-4 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'border-transparent shadow-xs'
                        : 'bg-[var(--bg-soft-alt)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {kind === 'all'
                      ? `Todos (${tickets.length})`
                      : kind === 'problema'
                        ? 'Problemas'
                        : kind === 'duda'
                          ? 'Dudas'
                          : 'Sugerencias'}
                  </button>
                );
              })}

              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value as TicketStatus | 'all')}
                aria-label="Filtrar por estado"
                className="boho-input py-1.5 min-h-[38px] text-xs font-semibold !rounded-full"
              >
                <option value="all">Todos los estados</option>
                <option value="nuevo">Pendientes ({stats.openTickets})</option>
                <option value="respondido">Respondidos</option>
                <option value="cerrado">Resueltos ({stats.resolvedTickets})</option>
              </select>
            </div>
          </SolidCard>

          {filteredTickets.length === 0 ? (
            <SolidCard className="p-6 text-sm text-[var(--text-secondary)]">
              No hay dudas, problemas ni sugerencias con el filtro seleccionado.
            </SolidCard>
          ) : (
            filteredTickets.map((t) => {
              const kindLabel =
                t.ticketType === 'sugerencia'
                  ? 'Sugerencia'
                  : t.ticketType === 'problema'
                    ? 'Problema'
                    : 'Duda';
              const statusLabel =
                t.status === 'cerrado'
                  ? 'Resuelto'
                  : t.status === 'respondido'
                    ? 'Respondido'
                    : 'Pendiente';
              const draftText = replyDrafts[t.id] ?? t.adminReply ?? '';
              const mailtoHref = `mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent(
                `Re: [GROWy · ${kindLabel}] ${t.subject}`
              )}&body=${encodeURIComponent(
                `Hola ${t.name},\n\n${draftText || 'Gracias por escribirnos a GROWy.'}\n\nSaludos,\nGROWy Soporte (${BOOTSTRAPPED_ADMIN_EMAIL})`
              )}`;
              const matchedUser = users.find(
                (u) =>
                  u.uid === t.userId ||
                  u.email.trim().toLowerCase() === t.email.trim().toLowerCase()
              );

              return (
                <SolidCard key={t.id} className="p-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-base text-[var(--text-primary)]">
                        <span className="text-xs font-bold text-[var(--accent-strong)] mr-2">
                          [{kindLabel}]
                        </span>
                        {t.subject}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t.name} · {t.email}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        t.status === 'cerrado'
                          ? 'text-[var(--pos-text)]'
                          : t.status === 'respondido'
                            ? 'text-[var(--sec-text)]'
                            : 'text-[var(--warn-text)]'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-[var(--text-primary)]">{t.message}</p>

                  {t.attachments && t.attachments.length > 0 && (
                    <div className="pt-1 space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        Documentos adjuntos ({t.attachments.length}):
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {t.attachments.map((att, idx) => (
                          <div
                            key={`${t.id}-att-${idx}`}
                            className="p-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-2 max-w-[220px]"
                          >
                            {att.mimeType.startsWith('image/') && (
                              <a
                                href={att.dataUrl}
                                download={att.name}
                                className="block overflow-hidden rounded-xl border border-[var(--border-hairline)]"
                              >
                                <img
                                  src={att.dataUrl}
                                  alt={att.name}
                                  className="w-full max-h-36 object-cover"
                                />
                              </a>
                            )}
                            <a
                              href={att.dataUrl}
                              download={att.name}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)] hover:underline break-all"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span>{att.name}</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col lg:flex-row gap-3">
                    <input
                      type="text"
                      placeholder="Escribir respuesta o resolución para el usuario..."
                      value={draftText}
                      onChange={(e) =>
                        setReplyDrafts({ ...replyDrafts, [t.id]: e.target.value })
                      }
                      className="boho-input flex-1"
                    />
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {matchedUser && matchedUser.role !== 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleRegisterMonthlyPayment(matchedUser)}
                          className="min-h-[44px] px-4 rounded-full bg-[var(--sec-soft)] text-[var(--sec-text)] border border-[var(--sec-border)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>Activar / Renovar mes</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSaveTicketReply(t, 'respondido')}
                        style={{
                          backgroundColor: 'var(--btn-navy-bg)',
                          color: 'var(--btn-navy-text)',
                        }}
                        className="min-h-[44px] px-5 rounded-full text-xs font-bold cursor-pointer hover:opacity-92 transition-opacity"
                      >
                        Responder
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveTicketReply(t, 'cerrado')}
                        className="min-h-[44px] px-4 rounded-full bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolver</span>
                      </button>
                      <a
                        href={mailtoHref}
                        className="min-h-[44px] px-4 rounded-full border border-[var(--border-hairline)] hover:bg-[var(--bg-soft)] text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Responder por correo</span>
                      </a>
                    </div>
                  </div>
                </SolidCard>
              );
            })
          )}
        </section>
      )}

      {/* REGISTRO DE ACTIVIDAD ADMINISTRATIVA */}
      {section === 'logs' && (
        <SolidCard as="section" className="p-6 space-y-4">
          <SectionTitle
            as="h2"
            size="sm"
            title="Registro de *actividad* administrativa"
          />
          {logs.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Aún no hay acciones registradas.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {logs.map((log) => (
                <div key={log.id} className="py-3 flex flex-wrap justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold">{log.action}</span> ·{' '}
                    <span className="font-mono">{log.target}</span>
                    <p className="text-[var(--text-secondary)] mt-0.5">{log.details}</p>
                  </div>
                  <span className="text-[var(--text-secondary)]">{log.adminEmail}</span>
                </div>
              ))}
            </div>
          )}
        </SolidCard>
      )}
    </div>
  );
};
