import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  Plus,
  Trash2,
  TrendingDown,
  Upload,
  UserCheck,
  X,
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
import { calculateMonthlyIvaEstimate } from '../finance/phase2Insights';
import {
  SALES_CSV_TEMPLATE,
  buildActualsTransactionsCsv,
  buildGuidedMonthCloseSummary,
  buildMonthlyExcelWorkbookXml,
  buildSalesCsvImportPatch,
  parseAndValidateSalesCsv,
} from '../finance/phase3Insights';
import { sendMonthlySummaryEmail } from '../firebase/services';
import { formatISODateSpanish, toISODateLocal } from '../finance/subscription';
import type {
  AccountPayable,
  ActualTransaction,
  BusinessWorkspace,
  InventoryMovement,
  MonthlyActualRecord,
  OperationalObligationCategory,
  TransactionType,
  UserProfile,
} from '../types/finance';
import { ReceivablesPayablesPanel } from './ReceivablesPayablesPanel';
import { downloadMonthlyFinancialReportPDF } from '../utils/monthlyPdfReport';
import {
  FloatingSearchBar,
  GlassCard,
  SectionTitle,
  SolidCard,
} from './design-system';

export type ActualsSubTab = 'cash' | 'receivables' | 'payables';

interface ActualsViewProps {
  business: BusinessWorkspace;
  profile?: UserProfile;
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
  profile,
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // 3.1 Cierre de mes guiado y 3.4 Resumen mensual por correo
  const [showGuidedClose, setShowGuidedClose] = useState(true);
  const [sendingEmailReport, setSendingEmailReport] = useState(false);
  const [emailReportFeedback, setEmailReportFeedback] = useState<string | null>(null);

  // 3.3 Importación de ventas CSV con vista previa
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvNotice, setCsvNotice] = useState<string | null>(null);
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [onlyIncomeFilter, setOnlyIncomeFilter] = useState(false);
  const txFormRef = useRef<HTMLFormElement>(null);

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

  const ivaEstimate = useMemo(
    () => calculateMonthlyIvaEstimate(business, selectedMonth),
    [business, selectedMonth]
  );

  const guidedClose = useMemo(
    () => buildGuidedMonthCloseSummary(business, selectedMonth),
    [business, selectedMonth]
  );

  const csvPreview = useMemo(
    () => (csvRawText.trim() ? parseAndValidateSalesCsv(csvRawText, business, selectedMonth) : null),
    [csvRawText, business, selectedMonth]
  );

  const currentRecord: MonthlyActualRecord = business.actuals[selectedMonth] ?? {
    month: selectedMonth,
    transactions: [],
  };

  const filteredTransactions = useMemo(() => {
    const q = txSearchQuery.trim().toLowerCase();
    return (currentRecord.transactions ?? []).filter((tx) => {
      if (onlyIncomeFilter && tx.type !== 'income') return false;
      if (!q) return true;
      const typeLabel = TX_TYPE_LABELS[tx.type]?.toLowerCase() ?? '';
      const catLabel = tx.expenseCategory
        ? OBLIGATION_CATEGORY_LABELS[tx.expenseCategory]?.toLowerCase() ?? ''
        : '';
      return (
        tx.description.toLowerCase().includes(q) ||
        typeLabel.includes(q) ||
        catLabel.includes(q)
      );
    });
  }, [currentRecord.transactions, txSearchQuery, onlyIncomeFilter]);

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleToggleCloseStep = (
    stepId: 'actualsChecked' | 'receivablesPayablesChecked' | 'comparedVsProjected' | 'deviationsReviewed'
  ) => {
    const current = guidedClose.checklist;
    const updatedChecklist = {
      ...current,
      month: selectedMonth,
      [stepId]: !current[stepId],
    };
    onUpdateBusiness({
      monthlyCloseChecklists: {
        ...(business.monthlyCloseChecklists ?? {}),
        [selectedMonth]: updatedChecklist,
      },
    });
  };

  const handleFinishGuidedClose = () => {
    const isCurrentlyClosed = guidedClose.isClosed;
    onUpdateBusiness({
      monthlyCloseChecklists: {
        ...(business.monthlyCloseChecklists ?? {}),
        [selectedMonth]: {
          ...guidedClose.checklist,
          month: selectedMonth,
          actualsChecked: true,
          receivablesPayablesChecked: true,
          comparedVsProjected: true,
          deviationsReviewed: true,
          closedAt: isCurrentlyClosed ? undefined : new Date().toISOString(),
        },
      },
    });
  };

  const handleConfirmCsvImport = () => {
    if (!csvPreview || csvPreview.validRows.length === 0) return;
    const patch = buildSalesCsvImportPatch(business, csvPreview.validRows);
    onUpdateBusiness(patch);
    setCsvNotice(
      `Importamos ${csvPreview.validRows.length} venta(s) por ${formatCurrency(csvPreview.totalValidAmount, business.currency)} correctamente.`
    );
    setCsvRawText('');
    setShowCsvImport(false);
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsvRawText(text);
      setCsvNotice(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleSendEmailSummary = async () => {
    if (!profile) return;
    setSendingEmailReport(true);
    setEmailReportFeedback(null);
    try {
      const res = await sendMonthlySummaryEmail({
        profile,
        business,
        month: selectedMonth,
      });
      setEmailReportFeedback(res.message);
    } finally {
      setSendingEmailReport(false);
    }
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
          style={
            subTab === 'cash'
              ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
              : undefined
          }
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'cash'
              ? 'shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BookOpen className={`w-4 h-4 ${subTab === 'cash' ? '' : 'text-[var(--accent-strong)]'}`} />
          <span>Movimientos y caja</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'receivables'}
          onClick={() => setSubTab('receivables')}
          style={
            subTab === 'receivables'
              ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
              : undefined
          }
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'receivables'
              ? 'shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <UserCheck className={`w-4 h-4 ${subTab === 'receivables' ? '' : 'text-[var(--sec-text)]'}`} />
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
          style={
            subTab === 'payables'
              ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
              : undefined
          }
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'payables'
              ? 'shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CreditCard className={`w-4 h-4 ${subTab === 'payables' ? '' : 'text-[var(--warn-text)]'}`} />
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
        <SectionTitle
          as="h1"
          eyebrow="Bitácora mensual · Proyectado vs. Real"
          title="Registro de *resultados* reales"
        />

        <div className="flex flex-wrap items-center gap-2.5">
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

          <button
            type="button"
            onClick={() =>
              triggerDownload(
                buildActualsTransactionsCsv(business),
                `growy-movimientos-${selectedMonth}.csv`,
                'text/csv;charset=utf-8'
              )
            }
            className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() =>
              triggerDownload(
                buildMonthlyExcelWorkbookXml(business),
                `growy-resumen-${selectedMonth}.xls`,
                'application/vnd.ms-excel;charset=utf-8'
              )
            }
            className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--pos-text)]" />
            <span>Excel (.xls)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCsvImport((prev) => !prev)}
            className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--sec-border)] bg-[var(--sec-soft)] hover:opacity-90 text-xs font-bold text-[var(--sec-text)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar ventas CSV</span>
          </button>

          {profile && (
            <button
              type="button"
              disabled={sendingEmailReport}
              onClick={handleSendEmailSummary}
              className="min-h-[42px] px-4 py-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Mail className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
              <span>{sendingEmailReport ? 'Enviando...' : 'Enviar resumen correo'}</span>
            </button>
          )}

          <button
            type="button"
            disabled={downloadingPdf}
            onClick={async () => {
              setDownloadingPdf(true);
              try {
                await downloadMonthlyFinancialReportPDF(business, selectedMonth);
              } finally {
                setDownloadingPdf(false);
              }
            }}
            style={{
              backgroundColor: 'var(--btn-navy-bg)',
              color: 'var(--btn-navy-text)',
            }}
            className="min-h-[42px] px-5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-2 hover:opacity-92 transition-opacity whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-xs"
          >
            <FileText className="w-4 h-4" />
            <span>{downloadingPdf ? 'Generando informe...' : 'Descargar informe'}</span>
          </button>
        </div>
      </header>

      {emailReportFeedback && (
        <p className="text-xs font-semibold p-3.5 rounded-2xl bg-[var(--sec-soft)] text-[var(--sec-text)] border border-[var(--sec-border)]">
          {emailReportFeedback}
        </p>
      )}

      {csvNotice && (
        <p className="text-xs font-semibold p-3.5 rounded-2xl bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)]">
          {csvNotice}
        </p>
      )}

      {/* 3.3 IMPORTACIÓN DE VENTAS POR CSV CON VISTA PREVIA Y VALIDACIÓN */}
      {showCsvImport && (
        <SolidCard as="section" className="p-6 space-y-4 border-2 border-[var(--sec-border)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Importar ventas desde archivo CSV (con vista previa)
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Sube un archivo <span className="font-mono">.csv</span> o pega filas desde Excel /
                tu punto de venta. Revisarás el detalle antes de guardar.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    SALES_CSV_TEMPLATE,
                    'plantilla-ventas-growy.csv',
                    'text/csv;charset=utf-8'
                  )
                }
                className="min-h-[36px] px-3.5 rounded-full border border-[var(--border-hairline)] text-xs font-semibold hover:bg-[var(--bg-soft)] cursor-pointer"
              >
                Descargar plantilla CSV
              </button>
              <button
                type="button"
                onClick={() => setShowCsvImport(false)}
                aria-label="Cerrar importador CSV"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full hover:bg-[var(--bg-soft)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-h-[40px] px-4 py-2 rounded-full bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] text-xs font-bold inline-flex items-center gap-2 cursor-pointer hover:bg-[var(--bg-soft)]">
              <Upload className="w-3.5 h-3.5" />
              <span>Elegir archivo .csv</span>
              <input
                type="file"
                accept=".csv,text/csv,.txt"
                onChange={handleCsvFileChange}
                className="hidden"
              />
            </label>
            <span className="text-[11px] text-[var(--text-secondary)]">
              Columnas esperadas: <span className="font-mono">fecha;descripcion;monto;unidades;producto</span>
            </span>
          </div>

          <textarea
            rows={4}
            placeholder="Pega aquí tus filas CSV, por ejemplo:&#10;fecha;descripcion;monto;unidades;producto&#10;2026-06-15;Ventas mostrador;89500;5;"
            value={csvRawText}
            onChange={(e) => {
              setCsvRawText(e.target.value);
              setCsvNotice(null);
            }}
            className="boho-input w-full py-2.5 font-mono text-xs"
          />

          {csvPreview && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p>
                  <strong className="text-[var(--pos-text)]">{csvPreview.validRows.length} válida(s)</strong>{' '}
                  ·{' '}
                  <strong className={csvPreview.invalidRows.length > 0 ? 'text-[var(--danger-text)]' : 'text-[var(--text-secondary)]'}>
                    {csvPreview.invalidRows.length} con error
                  </strong>{' '}
                  · Total válido:{' '}
                  <strong className="font-mono">
                    {formatCurrency(csvPreview.totalValidAmount, business.currency)}
                  </strong>
                </p>
                <button
                  type="button"
                  disabled={csvPreview.validRows.length === 0}
                  onClick={handleConfirmCsvImport}
                  style={{
                    backgroundColor: 'var(--btn-navy-bg)',
                    color: 'var(--btn-navy-text)',
                  }}
                  className="min-h-[40px] px-5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Confirmar e importar {csvPreview.validRows.length} venta(s)
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-2xl border border-[var(--border-hairline)]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[var(--bg-soft-alt)] text-[var(--text-secondary)]">
                    <tr>
                      <th className="py-2 px-3">Línea</th>
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Descripción</th>
                      <th className="py-2 px-3 text-right">Monto</th>
                      <th className="py-2 px-3">Validación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.allRows.slice(0, 30).map((row) => (
                      <tr key={row.lineNumber} className="border-t border-[var(--border-hairline)]">
                        <td className="py-2 px-3 font-mono">{row.lineNumber}</td>
                        <td className="py-2 px-3 font-mono">{row.date}</td>
                        <td className="py-2 px-3">{row.description || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono">
                          {formatCurrency(row.amount, business.currency)}
                        </td>
                        <td className="py-2 px-3">
                          {row.valid ? (
                            <span className="text-[var(--pos-text)] font-bold">Lista para guardar</span>
                          ) : (
                            <span className="text-[var(--danger-text)] font-semibold">{row.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SolidCard>
      )}

      {/* 3.1 CIERRE DE MES GUIADO */}
      <SolidCard as="section" className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--sec-soft)] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5 text-[var(--sec-text)]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Cierre de mes guiado · {guidedClose.monthLabel}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    guidedClose.isClosed
                      ? 'bg-[var(--pos-soft)] text-[var(--pos-text)]'
                      : 'bg-[var(--sec-soft)] text-[var(--sec-text)]'
                  }`}
                >
                  {guidedClose.isClosed
                    ? 'Mes cerrado'
                    : `${guidedClose.completedCount}/${guidedClose.totalSteps} pasos (${guidedClose.completionPercent}%)`}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Ordena tu mes en 4 pasos simples antes de proyectar el siguiente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGuidedClose((v) => !v)}
              className="min-h-[36px] px-4 rounded-full border border-[var(--border-hairline)] text-xs font-semibold hover:bg-[var(--bg-soft)] cursor-pointer"
            >
              {showGuidedClose ? 'Ocultar checklist' : 'Ver checklist'}
            </button>
            <button
              type="button"
              onClick={handleFinishGuidedClose}
              className={`min-h-[36px] px-4 rounded-full text-xs font-bold cursor-pointer ${
                guidedClose.isClosed
                  ? 'border border-[var(--border-hairline)] text-[var(--text-secondary)]'
                  : 'bg-[var(--pos-soft)] text-[var(--pos-text)] border border-[var(--pos-border)]'
              }`}
            >
              {guidedClose.isClosed ? 'Reabrir mes' : 'Marcar mes como cerrado'}
            </button>
          </div>
        </div>

        {showGuidedClose && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {guidedClose.steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleToggleCloseStep(step.id)}
                  className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                    step.completed
                      ? 'bg-[var(--pos-soft)] border-[var(--pos-border)]'
                      : 'bg-[var(--bg-soft-alt)] border-[var(--border-hairline)] hover:bg-[var(--bg-soft)]'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                      step.completed
                        ? 'bg-[var(--pos-text)] border-transparent text-white'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
                    }`}
                  >
                    {step.completed && <Check className="w-3 h-3" strokeWidth={2.8} />}
                  </span>
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)]">{step.title}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {step.description}
                    </p>
                    <p className="text-[11px] font-mono text-[var(--sec-text)]">{step.autoHint}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] space-y-1.5">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                Desviaciones explicadas en simple ({guidedClose.monthLabel})
              </p>
              <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc pl-5">
                {guidedClose.deviationExplanations.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </SolidCard>

      {/* Tarjeta de interpretación automática y semáforo */}
      {selectedComparison && (
        <GlassCard as="section" className="p-6">
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
        </GlassCard>
      )}

      {/* 2.4 ESTIMADOR REFERENCIAL DE IVA MENSUAL Y F29 */}
      {ivaEstimate.enabled && (
        <SolidCard as="section" className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                  Estimador mensual de IVA ({ivaEstimate.ivaRatePercent}%) y F29
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--warn-soft)] border border-[var(--warn-border)] text-[11px] font-bold text-[var(--warn-text)]">
                  {ivaEstimate.disclaimer}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {ivaEstimate.isProjectedReference
                  ? `Aún no registras movimientos en ${ivaEstimate.monthLabel}: mostrando referencia según tu proyección.`
                  : `Cálculo referencial sobre los movimientos reales de ${ivaEstimate.monthLabel}.`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  onUpdateBusiness({
                    ivaSettings: {
                      ...business.ivaSettings,
                      enabled: true,
                      pricesIncludeIva: true,
                      f29Day: ivaEstimate.f29Day,
                      ivaRatePercent: ivaEstimate.ivaRatePercent,
                    },
                  })
                }
                style={
                  ivaEstimate.pricesIncludeIva
                    ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                    : undefined
                }
                className={`min-h-[34px] px-3.5 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                  ivaEstimate.pricesIncludeIva
                    ? 'border-transparent'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Con IVA incluido
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateBusiness({
                    ivaSettings: {
                      ...business.ivaSettings,
                      enabled: true,
                      pricesIncludeIva: false,
                      f29Day: ivaEstimate.f29Day,
                      ivaRatePercent: ivaEstimate.ivaRatePercent,
                    },
                  })
                }
                style={
                  !ivaEstimate.pricesIncludeIva
                    ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                    : undefined
                }
                className={`min-h-[34px] px-3.5 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                  !ivaEstimate.pricesIncludeIva
                    ? 'border-transparent'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Precios netos (+IVA)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                IVA débito (ventas)
              </p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--text-primary)] mt-1">
                {formatCurrency(ivaEstimate.ivaDebito, business.currency)}
              </p>
              <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
                Neto: {formatCurrency(ivaEstimate.netSalesBase, business.currency)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                IVA crédito (compras/gastos)
              </p>
              <p className="font-mono tabular-nums text-lg font-bold text-[var(--pos-text)] mt-1">
                {formatCurrency(ivaEstimate.ivaCredito, business.currency)}
              </p>
              <p className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
                Neto: {formatCurrency(ivaEstimate.netPurchasesBase, business.currency)}
              </p>
            </div>

            <div
              className={`p-4 rounded-2xl border ${
                ivaEstimate.ivaToPay > 0
                  ? 'bg-[var(--warn-soft)] border-[var(--warn-border)]'
                  : 'bg-[var(--pos-soft)] border-[var(--pos-border)]'
              }`}
            >
              <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {ivaEstimate.ivaToPay > 0
                  ? 'IVA estimado a pagar (F29)'
                  : 'Remanente / crédito a favor'}
              </p>
              <p
                className={`font-mono tabular-nums text-lg font-bold mt-1 ${
                  ivaEstimate.ivaToPay > 0
                    ? 'text-[var(--warn-text)]'
                    : 'text-[var(--pos-text)]'
                }`}
              >
                {formatCurrency(
                  ivaEstimate.ivaToPay > 0
                    ? ivaEstimate.ivaToPay
                    : ivaEstimate.ivaFavorRemanente,
                  business.currency
                )}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Débito menos crédito del mes
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)]">
              <p className="text-[11px] font-semibold text-[var(--sec-muted)]">
                Recordatorio F29 (día {ivaEstimate.f29Day})
              </p>
              <p className="font-mono tabular-nums text-sm font-bold text-[var(--text-primary)] mt-1">
                {formatISODateSpanish(ivaEstimate.declarationDueDateISO)}
              </p>
              <p className="text-[11px] text-[var(--sec-muted)] mt-0.5">
                {ivaEstimate.daysUntilNextF29 === 0
                  ? 'Vence hoy tu próximo F29'
                  : `Próximo F29 calendario en ${ivaEstimate.daysUntilNextF29} día(s)`}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)]">
            {ivaEstimate.disclaimer}. Este selector no modifica tus precios ni montos ya guardados;
            puedes ajustar el día del F29 en Configuración.
          </p>
        </SolidCard>
      )}

      {/* Barra flotante de búsqueda de movimientos reales */}
      <FloatingSearchBar
        value={txSearchQuery}
        onChange={setTxSearchQuery}
        placeholder="Buscar venta, egreso o categoría..."
        label="Buscar movimientos del mes"
        onFilterClick={() => setOnlyIncomeFilter((v) => !v)}
        filterActive={onlyIncomeFilter}
        filterLabel="Mostrar solo ingresos por ventas"
        onAddClick={() =>
          txFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        addLabel="Ir al formulario de movimiento real"
      />

      {/* Formulario para añadir transacción real + Totales rápidos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SolidCard className="lg:col-span-5 p-6">
          <form ref={txFormRef} onSubmit={handleAddTransaction} className="space-y-4">
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
                style={
                  txPaymentMode === 'cash'
                    ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                    : undefined
                }
                className={`min-h-[40px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                  txPaymentMode === 'cash'
                    ? 'border-transparent shadow-xs'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {txType === 'income' ? 'Contado (entra a caja)' : 'Pagado al contado'}
              </button>
              <button
                type="button"
                onClick={() => setTxPaymentMode('credit')}
                style={
                  txPaymentMode === 'credit'
                    ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
                    : undefined
                }
                className={`min-h-[40px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                  txPaymentMode === 'credit'
                    ? 'border-transparent shadow-xs'
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
            style={{
              backgroundColor: 'var(--btn-navy-bg)',
              color: 'var(--btn-navy-text)',
            }}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold hover:opacity-92 transition-opacity cursor-pointer shadow-sm"
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
        </SolidCard>

        {/* Lista de transacciones del mes */}
        <SolidCard as="section" className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Detalle de transacciones ({filteredTransactions.length})
            </h2>
          </div>

          {currentRecord.transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              No hay transacciones detalladas en {formatMonthLabel(selectedMonth)}. Usa el
              formulario para registrar tus ingresos y egresos reales.
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              Ningún movimiento coincide con el filtro actual.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-hairline)]">
              {filteredTransactions.map((tx) => (
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
        </SolidCard>
      </div>

      {/* Resumen comparativo de todos los meses */}
      <SolidCard as="section" className="p-6">
        <SectionTitle
          as="h2"
          size="sm"
          title="Comparación *histórica* y futura: Proyectado vs. Real"
          className="mb-4"
        />
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
      </SolidCard>
        </div>
      )}
    </div>
  );
};
