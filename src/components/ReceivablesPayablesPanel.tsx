import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { formatCurrency } from '../finance/formulas';
import {
  buildCollectReceivablePatch,
  buildCreditSalePatch,
  buildPayPayablePatch,
  calculateCashFlowProjection,
  calculatePayablesSummary,
  calculateReceivablesSummary,
  OBLIGATION_CATEGORY_LABELS,
} from '../finance/smeIntelligence';
import { toISODateLocal } from '../finance/subscription';
import type {
  AccountPayable,
  BusinessWorkspace,
  OperationalObligationCategory,
  PayablePriority,
} from '../types/finance';

interface ReceivablesPayablesPanelProps {
  mode: 'receivables' | 'payables';
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
}

export const ReceivablesPayablesPanel: React.FC<ReceivablesPayablesPanelProps> = ({
  mode,
  business,
  onUpdateBusiness,
}) => {
  const todayISO = toISODateLocal(new Date());
  const arSummary = useMemo(
    () => calculateReceivablesSummary(business.receivables),
    [business.receivables]
  );
  const apSummary = useMemo(
    () => calculatePayablesSummary(business.payables),
    [business.payables]
  );
  const cashFlow = useMemo(() => calculateCashFlowProjection(business), [business]);

  // Estado formulario CxC (Venta a crédito)
  const [arClient, setArClient] = useState('');
  const [arDoc, setArDoc] = useState('');
  const [arIssue, setArIssue] = useState(todayISO);
  const [arDue, setArDue] = useState(todayISO);
  const [arExpected, setArExpected] = useState(todayISO);
  const [arAmount, setArAmount] = useState('');
  const [arProductId, setArProductId] = useState('');
  const [arUnits, setArUnits] = useState('');
  const [arError, setArError] = useState<string | null>(null);

  // Estado cobro parcial/total inline CxC
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectAmt, setCollectAmt] = useState('');
  const [collectDate, setCollectDate] = useState(todayISO);

  // Estado formulario CxP (Obligación por pagar)
  const [apSupplier, setApSupplier] = useState('');
  const [apDoc, setApDoc] = useState('');
  const [apCategory, setApCategory] = useState<OperationalObligationCategory>('proveedores');
  const [apPriority, setApPriority] = useState<PayablePriority>('alta');
  const [apIssue, setApIssue] = useState(todayISO);
  const [apDue, setApDue] = useState(todayISO);
  const [apAmount, setApAmount] = useState('');
  const [apError, setApError] = useState<string | null>(null);

  // Estado pago parcial/total inline CxP
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmt, setPayAmt] = useState('');
  const [payDate, setPayDate] = useState(todayISO);

  const handleCreateReceivable = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(arAmount);
    if (!arClient.trim()) {
      setArError('Ingresa el nombre del cliente.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setArError('Ingresa un monto mayor a cero.');
      return;
    }

    const patch = buildCreditSalePatch(business, {
      clientName: arClient.trim(),
      documentRef: arDoc.trim() || 'Factura / Venta crédito',
      issueDate: arIssue || todayISO,
      dueDate: arDue || todayISO,
      expectedCollectionDate: arExpected || arDue || todayISO,
      amount: amt,
      productId: arProductId || undefined,
      units: arProductId && Number(arUnits) > 0 ? Number(arUnits) : undefined,
    });
    onUpdateBusiness(patch);
    setArClient('');
    setArDoc('');
    setArAmount('');
    setArProductId('');
    setArUnits('');
    setArError(null);
  };

  const handleConfirmCollect = (receivableId: string) => {
    const amt = Number(collectAmt);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const patch = buildCollectReceivablePatch(business, {
      receivableId,
      paymentDate: collectDate || todayISO,
      amount: amt,
    });
    onUpdateBusiness(patch);
    setCollectingId(null);
    setCollectAmt('');
  };

  const handleDeleteReceivable = (id: string) => {
    onUpdateBusiness({
      receivables: (business.receivables ?? []).filter((r) => r.id !== id),
    });
  };

  const handleCreatePayable = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(apAmount);
    if (!apSupplier.trim()) {
      setApError('Ingresa el nombre del proveedor o institución (ej. SII, Previred, Banco).');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setApError('Ingresa un monto mayor a cero.');
      return;
    }

    const nextAp: AccountPayable = {
      id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      supplierName: apSupplier.trim(),
      documentRef: apDoc.trim() || 'Documento por pagar',
      category: apCategory,
      issueDate: apIssue || todayISO,
      dueDate: apDue || todayISO,
      amount: amt,
      paidAmount: 0,
      priority: apPriority,
      payments: [],
    };
    onUpdateBusiness({
      payables: [nextAp, ...(business.payables ?? [])],
    });
    setApSupplier('');
    setApDoc('');
    setApAmount('');
    setApError(null);
  };

  const handleConfirmPay = (payableId: string) => {
    const amt = Number(payAmt);
    if (!Number.isFinite(amt) || amt <= 0) return;
    const patch = buildPayPayablePatch(business, {
      payableId,
      paymentDate: payDate || todayISO,
      amount: amt,
    });
    onUpdateBusiness(patch);
    setPayingId(null);
    setPayAmt('');
  };

  const handleDeletePayable = (id: string) => {
    onUpdateBusiness({
      payables: (business.payables ?? []).filter((p) => p.id !== id),
    });
  };

  if (mode === 'receivables') {
    return (
      <div className="space-y-6">
        {/* KPIs CxC */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-[28px] p-5 bg-[var(--sec-soft)] border border-[var(--sec-border)]">
            <p className="text-xs font-semibold text-[var(--sec-muted)]">
              Saldo pendiente por cobrar
            </p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2">
              {formatCurrency(arSummary.totalPending, business.currency)}
            </p>
            <p className="text-[11px] text-[var(--sec-muted)] mt-1">
              No se suma a caja hasta que se cobre
            </p>
          </div>

          <div className="rounded-[28px] p-5 bg-[var(--danger-soft)] border border-[var(--border-hairline)]">
            <p className="text-xs font-semibold text-[var(--danger-text)]">Cartera vencida</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[var(--danger-text)] mt-2">
              {formatCurrency(arSummary.overdueAmount, business.currency)}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">
              {arSummary.overdueCount} vencida(s) · {arSummary.upcomingCount} próxima(s)
            </p>
          </div>

          <div className="rounded-[28px] p-5 bg-[var(--pos-soft)] border border-[var(--pos-border)]">
            <p className="text-xs font-semibold text-[var(--pos-muted)]">
              Período promedio de cobranza
            </p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[var(--pos-text)] mt-2">
              {arSummary.averageCollectionDays !== null
                ? `${arSummary.averageCollectionDays} días`
                : 'Sin historial'}
            </p>
            <p className="text-[11px] text-[var(--pos-muted)] mt-1">
              {arSummary.paidCount} documento(s) cobrado(s)
            </p>
          </div>

          <div className="rounded-[28px] p-5 bg-[var(--warn-soft)] border border-[var(--warn-border)]">
            <p className="text-xs font-semibold text-[var(--warn-muted)]">
              Total cobrado a la fecha
            </p>
            <p className="font-mono tabular-nums text-2xl font-bold text-[var(--warn-text)] mt-2">
              {formatCurrency(arSummary.totalCollected, business.currency)}
            </p>
            <p className="text-[11px] text-[var(--warn-muted)] mt-1">
              Sobre {formatCurrency(arSummary.totalBilled, business.currency)} facturados
            </p>
          </div>
        </div>

        {/* ALERTA CLIENTES CON ATRASOS */}
        {arSummary.lateClientAlerts.length > 0 && (
          <div className="p-4 rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-soft)] flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-[var(--warn-text)] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[var(--warn-text)]">
                Alerta de cobranza: clientes con documentos vencidos
              </p>
              <p className="text-[var(--text-primary)] mt-1">
                {arSummary.lateClientAlerts
                  .slice(0, 3)
                  .map(
                    (c) =>
                      `${c.clientName} (${c.overdueCount} doc., ${formatCurrency(
                        c.totalOverdueAmount,
                        business.currency
                      )}, máx. ${c.maxDaysOverdue} días de atraso)`
                  )
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleCreateReceivable} className="lg:col-span-5 boho-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[var(--sec-text)] shrink-0" />
              <div>
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Registrar venta a crédito / factura por cobrar
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Actualiza flujo proyectado y descuenta inventario si asocias producto.
                </p>
              </div>
            </div>

            {arError && (
              <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] p-3 rounded-2xl">
                {arError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Cliente</label>
                <input
                  type="text"
                  placeholder="Ej. Café del Centro"
                  value={arClient}
                  onChange={(e) => setArClient(e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Documento asociado</label>
                <input
                  type="text"
                  placeholder="Ej. Factura 218"
                  value={arDoc}
                  onChange={(e) => setArDoc(e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Emisión</label>
                <input
                  type="date"
                  value={arIssue}
                  onChange={(e) => setArIssue(e.target.value)}
                  className="boho-input w-full font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Vencimiento</label>
                <input
                  type="date"
                  value={arDue}
                  onChange={(e) => setArDue(e.target.value)}
                  className="boho-input w-full font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Cobro estimado</label>
                <input
                  type="date"
                  value={arExpected}
                  onChange={(e) => setArExpected(e.target.value)}
                  className="boho-input w-full font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Monto total ({business.currency.code})
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={arAmount}
                onChange={(e) => setArAmount(e.target.value)}
                className="boho-input w-full font-mono tabular-nums"
              />
            </div>

            {business.products.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
                <div>
                  <label className="block text-[11px] font-semibold mb-1">
                    Producto (desc. stock opc.)
                  </label>
                  <select
                    value={arProductId}
                    onChange={(e) => setArProductId(e.target.value)}
                    className="boho-input w-full text-xs"
                  >
                    <option value="">Solo registro financiero</option>
                    {business.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1">Unidades</label>
                  <input
                    type="number"
                    min={0}
                    disabled={!arProductId}
                    placeholder="0"
                    value={arUnits}
                    onChange={(e) => setArUnits(e.target.value)}
                    className="boho-input w-full font-mono text-xs disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar cuenta por cobrar</span>
            </button>
          </form>

          <section className="lg:col-span-7 boho-card p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Listado de cobranza ({arSummary.items.length})
            </h3>

            {arSummary.items.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-10 text-center">
                No tienes cuentas por cobrar registradas. Cuando registres ventas a crédito
                aparecerán aquí clasificadas por vencimiento.
              </p>
            ) : (
              <div className="space-y-3">
                {arSummary.items.map((row) => (
                  <div
                    key={row.item.id}
                    className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          {row.item.clientName}{' '}
                          <span className="text-xs font-normal text-[var(--text-secondary)]">
                            · {row.item.documentRef}
                          </span>
                        </p>
                        <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
                          Emisión: {row.item.issueDate} · Vence: {row.item.dueDate}
                          {row.item.expectedCollectionDate
                            ? ` · Cobro est.: ${row.item.expectedCollectionDate}`
                            : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-bold ${
                            row.status === 'vencida'
                              ? 'text-[var(--danger-text)]'
                              : row.status === 'proxima'
                                ? 'text-[var(--warn-text)]'
                                : row.status === 'pagada'
                                  ? 'text-[var(--pos-text)]'
                                  : 'text-[var(--sec-text)]'
                          }`}
                        >
                          {row.statusLabel}
                        </span>
                        <p className="font-mono text-sm font-bold text-[var(--text-primary)] mt-0.5">
                          Saldo: {formatCurrency(row.pendingBalance, business.currency)}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                          Cobrado: {formatCurrency(row.item.paidAmount, business.currency)} /{' '}
                          {formatCurrency(row.item.amount, business.currency)}
                        </p>
                      </div>
                    </div>

                    {collectingId === row.item.id ? (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-hairline)]">
                        <input
                          type="number"
                          min={1}
                          max={row.pendingBalance}
                          value={collectAmt}
                          onChange={(e) => setCollectAmt(e.target.value)}
                          className="boho-input w-32 py-1 text-xs font-mono"
                          placeholder="Monto"
                        />
                        <input
                          type="date"
                          value={collectDate}
                          onChange={(e) => setCollectDate(e.target.value)}
                          className="boho-input py-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmCollect(row.item.id)}
                          className="min-h-[36px] px-4 rounded-full bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)] text-xs font-bold cursor-pointer"
                        >
                          Confirmar cobro a caja
                        </button>
                        <button
                          type="button"
                          onClick={() => setCollectingId(null)}
                          className="min-h-[36px] px-3.5 rounded-full text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        {row.pendingBalance > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCollectingId(row.item.id);
                              setCollectAmt(String(row.pendingBalance));
                              setCollectDate(todayISO);
                            }}
                            className="min-h-[36px] px-4 rounded-full bg-[var(--accent-btn)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Registrar cobro</span>
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-[var(--pos-text)]">
                            Cobrada íntegramente
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteReceivable(row.item.id)}
                          aria-label={`Eliminar cuenta por cobrar ${row.item.documentRef}`}
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  // MODO CUENTAS POR PAGAR
  const coverageDeficit = apSummary.totalPending > Math.max(0, cashFlow.currentAvailableCash);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-[28px] p-5 bg-[var(--sec-soft)] border border-[var(--sec-border)]">
          <p className="text-xs font-semibold text-[var(--sec-muted)]">
            Saldo pendiente por pagar
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2">
            {formatCurrency(apSummary.totalPending, business.currency)}
          </p>
          <p className="text-[11px] text-[var(--sec-muted)] mt-1">
            Caja disponible actual: {formatCurrency(cashFlow.currentAvailableCash, business.currency)}
          </p>
        </div>

        <div className="rounded-[28px] p-5 bg-[var(--danger-soft)] border border-[var(--border-hairline)]">
          <p className="text-xs font-semibold text-[var(--danger-text)]">Obligaciones vencidas</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--danger-text)] mt-2">
            {formatCurrency(apSummary.overdueAmount, business.currency)}
          </p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            {apSummary.overdueCount} vencida(s) · {apSummary.upcomingCount} próxima(s)
          </p>
        </div>

        <div className="rounded-[28px] p-5 bg-[var(--warn-soft)] border border-[var(--warn-border)]">
          <p className="text-xs font-semibold text-[var(--warn-muted)]">Prioridad alta</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--warn-text)] mt-2">
            {formatCurrency(apSummary.highPriorityAmount, business.currency)}
          </p>
          <p className="text-[11px] text-[var(--warn-muted)] mt-1">
            Proveedores, sueldos o impuestos urgentes
          </p>
        </div>

        <div className="rounded-[28px] p-5 bg-[var(--pos-soft)] border border-[var(--pos-border)]">
          <p className="text-xs font-semibold text-[var(--pos-muted)]">Pagos ya realizados</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--pos-text)] mt-2">
            {formatCurrency(apSummary.totalPaid, business.currency)}
          </p>
          <p className="text-[11px] text-[var(--pos-muted)] mt-1">
            De {formatCurrency(apSummary.totalCommitted, business.currency)} comprometidos
          </p>
        </div>
      </div>

      {coverageDeficit && apSummary.totalPending > 0 && (
        <div className="p-4 rounded-2xl border border-[var(--warn-border)] bg-[var(--warn-soft)] flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-[var(--warn-text)] shrink-0 mt-0.5" />
          <p className="text-[var(--text-primary)] leading-relaxed">
            <strong>Atención de liquidez:</strong> tus cuentas por pagar pendientes (
            {formatCurrency(apSummary.totalPending, business.currency)}) superan el efectivo
            disponible hoy ({formatCurrency(cashFlow.currentAvailableCash, business.currency)}).
            Revisa la tabla ordenada por prioridad y coordina tus cobros en Flujo de Caja.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleCreatePayable} className="lg:col-span-5 boho-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[var(--accent-strong)] shrink-0" />
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Registrar cuenta u obligación por pagar
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Incluye proveedores, remuneraciones, SII/impuestos o cuotas de crédito.
              </p>
            </div>
          </div>

          {apError && (
            <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] p-3 rounded-2xl">
              {apError}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Proveedor / Acreedor</label>
              <input
                type="text"
                placeholder="Ej. SII F29 o Proveedor Tela"
                value={apSupplier}
                onChange={(e) => setApSupplier(e.target.value)}
                className="boho-input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Documento asociado</label>
              <input
                type="text"
                placeholder="Ej. Factura 981 / Cuota 4"
                value={apDoc}
                onChange={(e) => setApDoc(e.target.value)}
                className="boho-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Categoría</label>
              <select
                value={apCategory}
                onChange={(e) =>
                  setApCategory(e.target.value as OperationalObligationCategory)
                }
                className="boho-input w-full text-xs"
              >
                {(
                  Object.keys(OBLIGATION_CATEGORY_LABELS) as OperationalObligationCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {OBLIGATION_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Prioridad de pago</label>
              <select
                value={apPriority}
                onChange={(e) => setApPriority(e.target.value as PayablePriority)}
                className="boho-input w-full text-xs"
              >
                <option value="alta">Alta (crítica)</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Emisión</label>
              <input
                type="date"
                value={apIssue}
                onChange={(e) => setApIssue(e.target.value)}
                className="boho-input w-full font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Vencimiento</label>
              <input
                type="date"
                value={apDue}
                onChange={(e) => setApDue(e.target.value)}
                className="boho-input w-full font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">
                Monto ({business.currency.code})
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={apAmount}
                onChange={(e) => setApAmount(e.target.value)}
                className="boho-input w-full font-mono tabular-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Guardar cuenta por pagar</span>
          </button>
        </form>

        <section className="lg:col-span-7 boho-card p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Obligaciones priorizadas por vencimiento ({apSummary.items.length})
          </h3>

          {apSummary.items.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-10 text-center">
              No tienes cuentas por pagar registradas. Las compras de inventario a crédito y tus
              obligaciones aparecerán aquí ordenadas por urgencia.
            </p>
          ) : (
            <div className="space-y-3">
              {apSummary.items.map((row) => (
                <div
                  key={row.item.id}
                  className="p-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {row.item.supplierName}{' '}
                        <span className="text-xs font-normal text-[var(--text-secondary)]">
                          · {row.item.documentRef}
                        </span>
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {OBLIGATION_CATEGORY_LABELS[row.item.category]} · Prioridad{' '}
                        <strong className="uppercase">{row.item.priority}</strong> · Vence:{' '}
                        <span className="font-mono">{row.item.dueDate}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs font-bold ${
                          row.status === 'vencida'
                            ? 'text-[var(--danger-text)]'
                            : row.status === 'proxima'
                              ? 'text-[var(--warn-text)]'
                              : row.status === 'pagada'
                                ? 'text-[var(--pos-text)]'
                                : 'text-[var(--sec-text)]'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                      <p className="font-mono text-sm font-bold text-[var(--text-primary)] mt-0.5">
                        Saldo: {formatCurrency(row.pendingBalance, business.currency)}
                      </p>
                      <p className="text-[11px] font-mono text-[var(--text-secondary)]">
                        Pagado: {formatCurrency(row.item.paidAmount, business.currency)} /{' '}
                        {formatCurrency(row.item.amount, business.currency)}
                      </p>
                    </div>
                  </div>

                  {payingId === row.item.id ? (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-hairline)]">
                      <input
                        type="number"
                        min={1}
                        max={row.pendingBalance}
                        value={payAmt}
                        onChange={(e) => setPayAmt(e.target.value)}
                        className="boho-input w-32 py-1 text-xs font-mono"
                        placeholder="Monto"
                      />
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="boho-input py-1 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleConfirmPay(row.item.id)}
                        className="min-h-[36px] px-4 rounded-full bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)] text-xs font-bold cursor-pointer"
                      >
                        Confirmar egreso real
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayingId(null)}
                        className="min-h-[36px] px-3.5 rounded-full text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {row.pendingBalance > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPayingId(row.item.id);
                            setPayAmt(String(row.pendingBalance));
                            setPayDate(todayISO);
                          }}
                          className="min-h-[36px] px-4 rounded-full bg-[var(--accent-btn)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Registrar pago</span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-[var(--pos-text)]">
                          Pagada íntegramente
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePayable(row.item.id)}
                        aria-label={`Eliminar cuenta por pagar ${row.item.documentRef}`}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
