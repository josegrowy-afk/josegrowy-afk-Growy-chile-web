import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Trash2,
  TrendingDown,
  UserCheck,
} from 'lucide-react';
import {
  buildMonthlyProjections,
  compareMonthActualVsProjected,
  formatCurrency,
  formatMonthLabel,
  formatPercent,
  getCurrentYearMonth,
  type PerformanceStatus,
} from '../finance/formulas';
import {
  buildCreditSalePatch,
  calculatePayablesSummary,
  calculateReceivablesSummary,
  OBLIGATION_CATEGORY_LABELS,
} from '../finance/smeIntelligence';
import { toISODateLocal } from '../finance/subscription';
import type {
  AccountPayable,
  ActualTransaction,
  BusinessWorkspace,
  InventoryMovement,
  MonthlyActualRecord,
  OperationalObligationCategory,
  TransactionType,
} from '../types/finance';
import { ReceivablesPayablesPanel } from './ReceivablesPayablesPanel';

export type ActualsSubTab = 'cash' | 'receivables' | 'payables';

interface ActualsViewProps {
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
  initialSubTab?: ActualsSubTab;
}

const TX_TYPE_LABELS: Record<TransactionType, string> = {
  income: 'Ingreso por ventas',
  fixed_expense: 'Egreso fijo',
  variable_expense: 'Egreso variable',
  other_expense: 'Otro egreso',
};

function StatusIndicator({
  status,
  label,
}: {
  status: PerformanceStatus;
  label: string;
}) {
  if (status === 'good') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--pos-text)]">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--warn-text)]">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (status === 'negative') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--danger-text)]">
        <TrendingDown className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
      <Clock className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

export const ActualsView: React.FC<ActualsViewProps> = ({
  business,
  onUpdateBusiness,
  initialSubTab = 'cash',
}) => {
  const [subTab, setSubTab] = useState<ActualsSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const arSummary = useMemo(
    () => calculateReceivablesSummary(business.receivables),
    [business.receivables]
  );
  const apSummary = useMemo(
    () => calculatePayablesSummary(business.payables),
    [business.payables]
  );

  const projections = useMemo(() => buildMonthlyProjections(business), [business]);
  const currentMonth = getCurrentYearMonth();
  const initialSelected =
    projections.find((p) => p.month === currentMonth)?.month ?? projections[0]?.month ?? currentMonth;

  const [selectedMonth, setSelectedMonth] = useState(initialSelected);
  const [txDate, setTxDate] = useState(`${initialSelected}-15`);
  const [txDesc, setTxDesc] = useState('');
  const [txType, setTxType] = useState<TransactionType>('income');
  const [txAmount, setTxAmount] = useState('');
  const [txUnits, setTxUnits] = useState('');
  const [txProductId, setTxProductId] = useState('');
  const [txPaymentMode, setTxPaymentMode] = useState<'cash' | 'credit'>('cash');
  const [txCounterparty, setTxCounterparty] = useState('');
  const [txDocRef, setTxDocRef] = useState('');
  const [txDueDate, setTxDueDate] = useState(toISODateLocal(new Date()));
  const [txExpenseCategory, setTxExpenseCategory] =
    useState<OperationalObligationCategory>('proveedores');
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const comparisons = useMemo(
    () =>
      projections.map((proj) =>
        compareMonthActualVsProjected({
          projected: proj,
          actualRecord: business.actuals[proj.month],
          business,
        })
      ),
    [projections, business]
  );

  const selectedComparison = useMemo(
    () => comparisons.find((c) => c.month === selectedMonth) ?? comparisons[0],
    [comparisons, selectedMonth]
  );

  const currentRecord: MonthlyActualRecord = business.actuals[selectedMonth] ?? {
    month: selectedMonth,
    transactions: [],
  };

  const handleSelectMonth = (month: string) => {
    setSelectedMonth(month);
    setTxDate(`${month}-15`);
    setFormError(null);
    setFormNotice(null);
  };

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(txAmount);
    if (!txDesc.trim()) {
      setFormError('Escribe una breve descripción para identificar el movimiento.');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormError('Ingresa un monto mayor a cero.');
      return;
    }

    const effectiveDate = txDate || `${selectedMonth}-15`;
    const cleanUnits =
      txType === 'income' && Number(txUnits) > 0 ? Math.round(Number(txUnits)) : undefined;

    // 1. Venta a crédito -> crea CxC + actualiza inventario si aplica, SIN sumarlo como efectivo recibido aún
    if (txType === 'income' && txPaymentMode === 'credit') {
      if (!txCounterparty.trim()) {
        setFormError('Ingresa el nombre del cliente para registrar la venta a crédito.');
        return;
      }
      const patch = buildCreditSalePatch(business, {
        clientName: txCounterparty.trim(),
        documentRef: txDocRef.trim() || txDesc.trim(),
        issueDate: effectiveDate,
        dueDate: txDueDate || effectiveDate,
        expectedCollectionDate: txDueDate || effectiveDate,
        amount: amountNum,
        productId: txProductId || undefined,
        units: cleanUnits,
        notes: txDesc.trim(),
      });
      onUpdateBusiness(patch);
      setTxDesc('');
      setTxAmount('');
      setTxUnits('');
      setTxProductId('');
      setTxCounterparty('');
      setTxDocRef('');
      setFormError(null);
      setFormNotice(
        'Venta registrada en Cuentas por Cobrar (no se suma a caja disponible hasta registrar el cobro).'
      );
      return;
    }

    // 2. Egreso pendiente por pagar -> crea CxP sin descontar efectivo disponible hoy
    if (txType !== 'income' && txPaymentMode === 'credit') {
      if (!txCounterparty.trim()) {
        setFormError('Ingresa el proveedor o acreedor para registrar la cuenta por pagar.');
        return;
      }
      const newAp: AccountPayable = {
        id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        supplierName: txCounterparty.trim(),
        documentRef: txDocRef.trim() || txDesc.trim(),
        category: txExpenseCategory,
        issueDate: effectiveDate,
        dueDate: txDueDate || effectiveDate,
        amount: amountNum,
        paidAmount: 0,
        priority: txExpenseCategory === 'impuestos' || txExpenseCategory === 'remuneraciones' ? 'alta' : 'media',
        payments: [],
        notes: txDesc.trim(),
      };
      onUpdateBusiness({
        payables: [newAp, ...(business.payables ?? [])],
      });
      setTxDesc('');
      setTxAmount('');
      setTxCounterparty('');
      setTxDocRef('');
      setFormError(null);
      setFormNotice('Obligación registrada en Cuentas por Pagar y flujo proyectado.');
      return;
    }

    // 3. Movimiento real al contado (entra o sale efectivamente de caja)
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let nextMovements = business.inventoryMovements ?? [];
    let linkedMovId: string | undefined;

    if (txType === 'income' && txProductId && cleanUnits && cleanUnits > 0) {
      const prod = business.products.find((p) => p.id === txProductId);
      if (prod) {
        linkedMovId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const mov: InventoryMovement = {
          id: linkedMovId,
          productId: prod.id,
          date: effectiveDate,
          type: 'sale',
          quantity: cleanUnits,
          unitCost: Math.max(0, Number(prod.variableCost) || 0),
          note: `Venta real: ${txDesc.trim()}`,
          linkedTransactionId: txId,
        };
        nextMovements = [mov, ...nextMovements];
      }
    }

    const newTx: ActualTransaction = {
      id: txId,
      date: effectiveDate,
      description: txDesc.trim(),
      type: txType,
      amount: amountNum,
      productId: txProductId || undefined,
      units: cleanUnits,
      expenseCategory: txType !== 'income' ? txExpenseCategory : undefined,
      linkedInventoryMovementId: linkedMovId,
    };

    onUpdateBusiness({
      actuals: {
        ...business.actuals,
        [selectedMonth]: {
          ...currentRecord,
          month: selectedMonth,
          transactions: [newTx, ...(currentRecord.transactions ?? [])],
        },
      },
      ...(linkedMovId ? { inventoryMovements: nextMovements } : {}),
    });

    setTxDesc('');
    setTxAmount('');
    setTxUnits('');
    setTxProductId('');
    setFormError(null);
    setFormNotice(
      linkedMovId
        ? 'Ingreso real guardado en caja y stock descontado en inventario.'
        : null
    );
  };

  const handleDeleteTx = (txId: string) => {
    const nextMovements = (business.inventoryMovements ?? []).filter(
      (m) => m.linkedTransactionId !== txId
    );
    onUpdateBusiness({
      actuals: {
        ...business.actuals,
        [selectedMonth]: {
          ...currentRecord,
          transactions: (currentRecord.transactions ?? []).filter((t) => t.id !== txId),
        },
      },
      inventoryMovements: nextMovements,
    });
  };

  const openArCount = arSummary.pendingCount + arSummary.upcomingCount + arSummary.overdueCount;
  const openApCount = apSummary.items.filter((i) => i.pendingBalance > 0.01).length;

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Secciones de Resultados Reales, Cuentas por Cobrar y por Pagar"
        className="growy-tab-track"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'cash'}
          onClick={() => setSubTab('cash')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'cash'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BookOpen className="w-4 h-4 text-[var(--accent-strong)]" />
          <span>Movimientos y caja</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'receivables'}
          onClick={() => setSubTab('receivables')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'receivables'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <UserCheck className="w-4 h-4 text-[var(--sec-text)]" />
          <span>
            Cuentas por cobrar
            {openArCount > 0 ? ` (${openArCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'payables'}
          onClick={() => setSubTab('payables')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'payables'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CreditCard className="w-4 h-4 text-[var(--warn-text)]" />
          <span>
            Cuentas por pagar
            {openApCount > 0 ? ` (${openApCount})` : ''}
          </span>
        </button>
      </div>

      {subTab === 'receivables' && (
        <ReceivablesPayablesPanel
          mode="receivables"
          business={business}
          onUpdateBusiness={onUpdateBusiness}
        />
      )}

      {subTab === 'payables' && (
        <ReceivablesPayablesPanel
          mode="payables"
          business={business}
          onUpdateBusiness={onUpdateBusiness}
        />
      )}

      {subTab === 'cash' && (
        <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            Bitácora mensual · Proyectado vs. Real
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Registro de{' '}
            <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
              resultados
            </em>{' '}
            reales
          </h1>
        </div>

        <label className="text-xs font-semibold text-[var(--text-secondary)]">
          Seleccionar mes
          <select
            value={selectedMonth}
            onChange={(e) => handleSelectMonth(e.target.value)}
            className="boho-input ml-2 font-semibold"
          >
            {projections.map((p) => (
              <option key={p.month} value={p.month}>
                {formatMonthLabel(p.month)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {/* Tarjeta de interpretación automática y semáforo */}
      {selectedComparison && (
        <section className="boho-card growy-hero-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Lectura de {selectedComparison.monthLabel}
              </p>
              <h2 className="font-display text-xl font-bold text-[var(--text-primary)] mt-0.5">
                {selectedComparison.interpretation}
              </h2>
            </div>
            <StatusIndicator
              status={selectedComparison.status}
              label={selectedComparison.statusLabel}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[var(--border-hairline)]">
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Ingresos reales vs. proy.</p>
              <p className="font-mono tabular-nums text-lg font-bold mt-1">
                {formatCurrency(selectedComparison.actual.income, business.currency)}{' '}
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  / {formatCurrency(selectedComparison.projected.projectedRevenue, business.currency)}
                </span>
              </p>
              {selectedComparison.actual.hasData && (
                <p
                  className={`text-xs font-mono tabular-nums mt-0.5 ${
                    selectedComparison.revenueDiffMoney >= 0
                      ? 'text-[var(--pos-text)]'
                      : 'text-[var(--danger-text)]'
                  }`}
                >
                  {selectedComparison.revenueDiffMoney >= 0 ? '+' : ''}
                  {formatCurrency(selectedComparison.revenueDiffMoney, business.currency)} (
                  {selectedComparison.revenueDiffPercent >= 0 ? '+' : ''}
                  {formatPercent(selectedComparison.revenueDiffPercent)})
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-[var(--text-secondary)]">Egresos reales vs. proy.</p>
              <p className="font-mono tabular-nums text-lg font-bold mt-1">
                {formatCurrency(selectedComparison.actual.totalExpense, business.currency)}{' '}
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  / {formatCurrency(selectedComparison.projected.projectedTotalCosts, business.currency)}
                </span>
              </p>
              {selectedComparison.actual.hasData && (
                <p className="text-xs font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
                  Fijos: {formatCurrency(selectedComparison.actual.fixedExpense, business.currency)} ·
                  Var: {formatCurrency(selectedComparison.actual.variableExpense, business.currency)}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs text-[var(--text-secondary)]">Utilidad real vs. proy.</p>
              <p
                className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                  selectedComparison.actual.profit >= 0
                    ? 'text-[var(--pos-text)]'
                    : 'text-[var(--danger-text)]'
                }`}
              >
                {formatCurrency(selectedComparison.actual.profit, business.currency)}{' '}
                <span className="text-xs font-normal text-[var(--text-secondary)]">
                  / {formatCurrency(selectedComparison.projected.projectedProfit, business.currency)}
                </span>
              </p>
              {selectedComparison.actual.hasData && (
                <p className="text-xs font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
                  Cobertura equilibrio: {formatPercent(selectedComparison.breakEvenCoveragePercent)}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Formulario para añadir transacción real + Totales rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleAddTransaction} className="lg:col-span-5 boho-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Agregar movimiento real en {formatMonthLabel(selectedMonth)}
          </h2>

          {formError && (
            <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] p-3 rounded-2xl">
              {formError}
            </p>
          )}

          {formNotice && (
            <p className="text-xs font-semibold text-[var(--pos-text)] bg-[var(--pos-soft)] p-3 rounded-2xl">
              {formNotice}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">Tipo de movimiento</label>
            <select
              value={txType}
              onChange={(e) => {
                setTxType(e.target.value as TransactionType);
                setFormError(null);
                setFormNotice(null);
              }}
              className="boho-input w-full"
            >
              {(Object.keys(TX_TYPE_LABELS) as TransactionType[]).map((key) => (
                <option key={key} value={key}>
                  {TX_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTxPaymentMode('cash')}
              className={`min-h-[40px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                txPaymentMode === 'cash'
                  ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-xs'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {txType === 'income' ? 'Contado (entra a caja)' : 'Pagado al contado'}
            </button>
            <button
              type="button"
              onClick={() => setTxPaymentMode('credit')}
              className={`min-h-[40px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                txPaymentMode === 'credit'
                  ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-xs'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {txType === 'income' ? 'A crédito (crea CxC)' : 'Por pagar (crea CxP)'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Descripción</label>
            <input
              type="text"
              placeholder="Ej. Feria fin de semana o pago arriendo"
              value={txDesc}
              onChange={(e) => setTxDesc(e.target.value)}
              className="boho-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">
                Monto ({business.currency.code})
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="boho-input w-full font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Fecha</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="boho-input w-full font-mono text-xs"
              />
            </div>
          </div>

          {txType !== 'income' && (
            <div>
              <label className="block text-xs font-semibold mb-1">
                Categoría operativa
              </label>
              <select
                value={txExpenseCategory}
                onChange={(e) =>
                  setTxExpenseCategory(e.target.value as OperationalObligationCategory)
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
          )}

          {txPaymentMode === 'credit' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
              <div>
                <label className="block text-[11px] font-semibold mb-1">
                  {txType === 'income' ? 'Cliente' : 'Proveedor / Acreedor'}
                </label>
                <input
                  type="text"
                  placeholder={txType === 'income' ? 'Nombre cliente' : 'Proveedor / SII'}
                  value={txCounterparty}
                  onChange={(e) => setTxCounterparty(e.target.value)}
                  className="boho-input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Documento</label>
                <input
                  type="text"
                  placeholder="Factura / Boleta"
                  value={txDocRef}
                  onChange={(e) => setTxDocRef(e.target.value)}
                  className="boho-input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Vencimiento</label>
                <input
                  type="date"
                  value={txDueDate}
                  onChange={(e) => setTxDueDate(e.target.value)}
                  className="boho-input w-full font-mono text-xs"
                />
              </div>
            </div>
          )}

          {txType === 'income' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {business.products.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Producto (desc. stock opc.)
                  </label>
                  <select
                    value={txProductId}
                    onChange={(e) => setTxProductId(e.target.value)}
                    className="boho-input w-full text-xs"
                  >
                    <option value="">Sin asociar producto</option>
                    {business.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Unidades vendidas (opcional)
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="Ej. 24"
                  value={txUnits}
                  onChange={(e) => setTxUnits(e.target.value)}
                  className="boho-input w-full font-mono tabular-nums"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>
              {txPaymentMode === 'credit'
                ? txType === 'income'
                  ? 'Registrar venta a crédito (CxC)'
                  : 'Registrar cuenta por pagar (CxP)'
                : 'Registrar movimiento en caja'}
            </span>
          </button>
        </form>

        {/* Lista de transacciones del mes */}
        <section className="lg:col-span-7 boho-card p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Detalle de transacciones ({currentRecord.transactions.length})
            </h2>
          </div>

          {currentRecord.transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              No hay transacciones detalladas en {formatMonthLabel(selectedMonth)}. Usa el
              formulario para registrar tus ingresos y egresos reales.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {currentRecord.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {tx.description}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      <span>{TX_TYPE_LABELS[tx.type]}</span>
                      {tx.expenseCategory && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span>{OBLIGATION_CATEGORY_LABELS[tx.expenseCategory]}</span>
                        </>
                      )}
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono">{tx.date}</span>
                      {tx.units ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono">{tx.units} u.</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-mono tabular-nums text-sm font-bold ${
                        tx.type === 'income'
                          ? 'text-[var(--pos-text)]'
                          : 'text-[var(--danger-text)]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, business.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTx(tx.id)}
                      aria-label={`Eliminar ${tx.description}`}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-[var(--text-secondary)] hover:text-[var(--danger-text)] hover:bg-[var(--danger-soft)] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Resumen comparativo de todos los meses */}
      <section className="boho-card p-6">
        <h2 className="font-display text-lg font-bold text-[var(--text-primary)] mb-4">
          Comparación histórica y futura: Proyectado vs. Real
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[740px]">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                <th className="py-2.5 pr-3 font-semibold">Mes</th>
                <th className="py-2.5 px-3 font-semibold text-right">Ing. Proyectado</th>
                <th className="py-2.5 px-3 font-semibold text-right">Ing. Real</th>
                <th className="py-2.5 px-3 font-semibold text-right">Dif. Ingresos</th>
                <th className="py-2.5 px-3 font-semibold text-right">Util. Real</th>
                <th className="py-2.5 pl-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr
                  key={c.month}
                  onClick={() => handleSelectMonth(c.month)}
                  className={`border-b border-[var(--border-hairline)] cursor-pointer transition-colors ${
                    c.month === selectedMonth
                      ? 'bg-[var(--accent-soft)]'
                      : 'hover:bg-[var(--bg-soft-alt)]'
                  }`}
                >
                  <td className="py-3 pr-3 font-semibold">{c.projected.monthLabel}</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {formatCurrency(c.projected.projectedRevenue, business.currency)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {c.actual.hasData ? formatCurrency(c.actual.income, business.currency) : '—'}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums ${
                      !c.actual.hasData
                        ? 'text-[var(--text-secondary)]'
                        : c.revenueDiffMoney >= 0
                        ? 'text-[var(--pos-text)]'
                        : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {c.actual.hasData
                      ? `${c.revenueDiffMoney >= 0 ? '+' : ''}${formatCurrency(
                          c.revenueDiffMoney,
                          business.currency
                        )} (${formatPercent(c.revenueDiffPercent)})`
                      : '—'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                    {c.actual.hasData ? formatCurrency(c.actual.profit, business.currency) : '—'}
                  </td>
                  <td className="py-3 pl-3">
                    <StatusIndicator status={c.status} label={c.statusLabel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
        </div>
      )}
    </div>
  );
};
