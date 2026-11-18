import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Check, ChevronDown, ChevronUp, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FIXED_COST_CATEGORY_LABELS,
  formatCurrency,
  formatMonthLabel,
  formatPercent,
  getCurrentYearMonth,
  getProductContributionMargin,
  getProductCostBreakdown,
  getProductMarginPercent,
  getProductTotalVariableCost,
  getTotalFixedCostsForMonth,
} from '../finance/formulas';
import { calculateInventorySummary } from '../finance/smeIntelligence';
import type {
  BusinessWorkspace,
  FixedCost,
  FixedCostCategory,
  ProductItem,
  ProductSupplyCostItem,
} from '../types/finance';
import { GrowyDivider } from './GrowyMotifs';
import { InventoryPanel } from './InventoryPanel';
import { GROWY_EASE } from './MotionPrimitives';

interface SupplyCostDraftRow {
  id: string;
  name: string;
  amountStr: string;
}

export type CatalogSubTab = 'catalog' | 'inventory';

interface CatalogAndCostsViewProps {
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
  initialSubTab?: CatalogSubTab;
}

export const CatalogAndCostsView: React.FC<CatalogAndCostsViewProps> = ({
  business,
  onUpdateBusiness,
  initialSubTab = 'catalog',
}) => {
  const [subTab, setSubTab] = useState<CatalogSubTab>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  const invAlertsCount = useMemo(() => {
    const inv = calculateInventorySummary(business);
    return inv.outOfStockProducts.length + inv.lowStockProducts.length;
  }, [business]);

  const currentMonth = getCurrentYearMonth();

  // Estado formulario Costo Fijo
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [costName, setCostName] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costCat, setCostCat] = useState<FixedCostCategory>('arriendo');
  const [costNotes, setCostNotes] = useState('');
  const [hasScheduledChange, setHasScheduledChange] = useState(false);
  const [changeMonth, setChangeMonth] = useState(currentMonth);
  const [changeAmount, setChangeAmount] = useState('');
  const [costError, setCostError] = useState<string | null>(null);

  // Estado formulario Producto
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCat, setProdCat] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodVarCost, setProdVarCost] = useState('');
  const [supplyRows, setSupplyRows] = useState<SupplyCostDraftRow[]>([]);
  const [showSupplyBreakdown, setShowSupplyBreakdown] = useState(false);
  const [prodCardFeePct, setProdCardFeePct] = useState('');
  const [prodTaxPct, setProdTaxPct] = useState('');
  const [prodShipping, setProdShipping] = useState('');
  const [prodPersonalTime, setProdPersonalTime] = useState('');
  const [prodError, setProdError] = useState<string | null>(null);

  const totalFixedNow = useMemo(
    () => getTotalFixedCostsForMonth(business.fixedCosts, currentMonth),
    [business.fixedCosts, currentMonth]
  );

  // CRUD Costos fijos
  const resetCostForm = () => {
    setEditingCostId(null);
    setCostName('');
    setCostAmount('');
    setCostCat('arriendo');
    setCostNotes('');
    setHasScheduledChange(false);
    setChangeMonth(currentMonth);
    setChangeAmount('');
    setCostError(null);
  };

  const startEditCost = (cost: FixedCost) => {
    setEditingCostId(cost.id);
    setCostName(cost.name);
    setCostAmount(String(cost.amount));
    setCostCat(cost.category);
    setCostNotes(cost.notes ?? '');
    if (cost.scheduledChange) {
      setHasScheduledChange(true);
      setChangeMonth(cost.scheduledChange.effectiveFromMonth);
      setChangeAmount(String(cost.scheduledChange.newAmount));
    } else {
      setHasScheduledChange(false);
      setChangeMonth(currentMonth);
      setChangeAmount('');
    }
    setCostError(null);
  };

  const handleSaveCost = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(costAmount);
    if (!costName.trim()) {
      setCostError('Ingresa el nombre del costo fijo.');
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      setCostError('El monto mensual debe ser un número mayor o igual a 0.');
      return;
    }
    if (hasScheduledChange) {
      const nextAmt = Number(changeAmount);
      if (!changeMonth || !Number.isFinite(nextAmt) || nextAmt < 0) {
        setCostError('Completa el mes y el nuevo monto para el cambio programado.');
        return;
      }
    }

    const nextCost: FixedCost = {
      id: editingCostId ?? `fc-${Date.now()}`,
      name: costName.trim(),
      amount: amt,
      category: costCat,
      notes: costNotes.trim() || undefined,
      scheduledChange: hasScheduledChange
        ? {
            effectiveFromMonth: changeMonth,
            newAmount: Number(changeAmount),
          }
        : null,
    };

    const nextList = editingCostId
      ? business.fixedCosts.map((c) => (c.id === editingCostId ? nextCost : c))
      : [...business.fixedCosts, nextCost];

    onUpdateBusiness({ fixedCosts: nextList });
    resetCostForm();
  };

  const handleDeleteCost = (id: string) => {
    onUpdateBusiness({
      fixedCosts: business.fixedCosts.filter((c) => c.id !== id),
    });
    if (editingCostId === id) resetCostForm();
  };

  const supplyBreakdownTotal = useMemo(
    () => supplyRows.reduce((sum, row) => sum + Math.max(0, Number(row.amountStr) || 0), 0),
    [supplyRows]
  );

  const isBreakdownActive = showSupplyBreakdown && supplyRows.length > 0;
  const effectiveBaseVarCost = isBreakdownActive
    ? supplyBreakdownTotal
    : Math.max(0, Number(prodVarCost) || 0);

  // CRUD Productos
  const resetProdForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdCat('');
    setProdPrice('');
    setProdVarCost('');
    setSupplyRows([]);
    setShowSupplyBreakdown(false);
    setProdCardFeePct('');
    setProdTaxPct('');
    setProdShipping('');
    setProdPersonalTime('');
    setProdError(null);
  };

  const startEditProduct = (p: ProductItem) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdCat(p.category);
    setProdPrice(String(p.price));
    setProdVarCost(String(p.variableCost));
    if (p.supplyCostItems && p.supplyCostItems.length > 0) {
      setSupplyRows(
        p.supplyCostItems.map((item) => ({
          id: item.id,
          name: item.name,
          amountStr: String(item.amount),
        }))
      );
      setShowSupplyBreakdown(true);
    } else {
      setSupplyRows([]);
      setShowSupplyBreakdown(false);
    }
    setProdCardFeePct(p.cardFeePercent ? String(p.cardFeePercent) : '');
    setProdTaxPct(p.taxPercent ? String(p.taxPercent) : '');
    setProdShipping(p.shippingCost ? String(p.shippingCost) : '');
    setProdPersonalTime(p.personalTimeCost ? String(p.personalTimeCost) : '');
    setProdError(null);
  };

  const makeSupplyRowId = () =>
    `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const handleToggleSupplyBreakdown = () => {
    setProdError(null);
    if (isBreakdownActive) {
      setProdVarCost(supplyBreakdownTotal > 0 ? String(supplyBreakdownTotal) : '');
      setSupplyRows([]);
      setShowSupplyBreakdown(false);
      return;
    }

    const baseAmt = Math.max(0, Number(prodVarCost) || 0);
    const initialRows: SupplyCostDraftRow[] =
      baseAmt > 0
        ? [
            { id: makeSupplyRowId(), name: 'Insumo principal', amountStr: String(baseAmt) },
            { id: makeSupplyRowId(), name: '', amountStr: '' },
          ]
        : [{ id: makeSupplyRowId(), name: '', amountStr: '' }];
    setSupplyRows(initialRows);
    setShowSupplyBreakdown(true);
  };

  const handleAddSupplyRow = () => {
    setSupplyRows((prev) => [
      ...prev,
      { id: makeSupplyRowId(), name: '', amountStr: '' },
    ]);
  };

  const handleUpdateSupplyRow = (
    id: string,
    patch: Partial<Pick<SupplyCostDraftRow, 'name' | 'amountStr'>>
  ) => {
    setSupplyRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleRemoveSupplyRow = (id: string) => {
    setSupplyRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      if (next.length === 0) {
        setShowSupplyBreakdown(false);
        setProdVarCost('');
      }
      return next;
    });
  };

  const draftProductPreview = useMemo(() => {
    const draft: ProductItem = {
      id: 'preview',
      name: prodName,
      category: prodCat,
      price: Math.max(0, Number(prodPrice) || 0),
      variableCost: effectiveBaseVarCost,
      cardFeePercent: Math.max(0, Number(prodCardFeePct) || 0),
      taxPercent: Math.max(0, Number(prodTaxPct) || 0),
      shippingCost: Math.max(0, Number(prodShipping) || 0),
      personalTimeCost: Math.max(0, Number(prodPersonalTime) || 0),
    };
    return {
      breakdown: getProductCostBreakdown(draft),
      margin: getProductContributionMargin(draft),
      marginPct: getProductMarginPercent(draft),
    };
  }, [
    prodName,
    prodCat,
    prodPrice,
    effectiveBaseVarCost,
    prodCardFeePct,
    prodTaxPct,
    prodShipping,
    prodPersonalTime,
  ]);

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(prodPrice);
    const cardFeePercent = prodCardFeePct === '' ? 0 : Number(prodCardFeePct);
    const taxPercent = prodTaxPct === '' ? 0 : Number(prodTaxPct);
    const shippingCost = prodShipping === '' ? 0 : Number(prodShipping);
    const personalTimeCost = prodPersonalTime === '' ? 0 : Number(prodPersonalTime);

    let supplyCostItems: ProductSupplyCostItem[] | undefined;
    let varCost = prodVarCost === '' ? 0 : Number(prodVarCost);

    if (isBreakdownActive) {
      const nonEmptyRows = supplyRows.filter(
        (r) => r.name.trim() !== '' || r.amountStr.trim() !== ''
      );
      for (const row of nonEmptyRows) {
        if (!row.name.trim()) {
          setProdError('Ingresa el nombre de cada insumo en el desglose.');
          return;
        }
        const amt = row.amountStr.trim() === '' ? 0 : Number(row.amountStr);
        if (!Number.isFinite(amt) || amt < 0) {
          setProdError('Cada costo por insumo debe ser un número mayor o igual a 0.');
          return;
        }
      }

      if (nonEmptyRows.length > 0) {
        supplyCostItems = nonEmptyRows.map((row) => ({
          id: row.id,
          name: row.name.trim(),
          amount: row.amountStr.trim() === '' ? 0 : Number(row.amountStr),
        }));
        varCost = supplyCostItems.reduce((sum, item) => sum + item.amount, 0);
      } else {
        varCost = 0;
        supplyCostItems = undefined;
      }
    }

    if (!prodName.trim()) {
      setProdError('Ingresa el nombre del producto o servicio.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setProdError('El precio de venta debe ser mayor a 0.');
      return;
    }
    if (!Number.isFinite(varCost) || varCost < 0) {
      setProdError('El costo variable base no puede ser negativo.');
      return;
    }
    if (!Number.isFinite(cardFeePercent) || cardFeePercent < 0 || cardFeePercent > 100) {
      setProdError('La comisión por pago con tarjeta debe estar entre 0% y 100%.');
      return;
    }
    if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      setProdError('El porcentaje de impuestos debe estar entre 0% y 100%.');
      return;
    }
    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      setProdError('El costo de envío o despacho no puede ser negativo.');
      return;
    }
    if (!Number.isFinite(personalTimeCost) || personalTimeCost < 0) {
      setProdError('El costo de tiempo personal involucrado no puede ser negativo.');
      return;
    }

    const nextProd: ProductItem = {
      id: editingProductId ?? `prod-${Date.now()}`,
      name: prodName.trim(),
      category: prodCat.trim() || 'General',
      price,
      variableCost: varCost,
      supplyCostItems,
      cardFeePercent,
      taxPercent,
      shippingCost,
      personalTimeCost,
    };

    const nextList = editingProductId
      ? business.products.map((p) => (p.id === editingProductId ? nextProd : p))
      : [...business.products, nextProd];

    onUpdateBusiness({ products: nextList });
    resetProdForm();
  };

  const handleDeleteProduct = (id: string) => {
    onUpdateBusiness({
      products: business.products.filter((p) => p.id !== id),
    });
    if (editingProductId === id) resetProdForm();
  };

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Secciones de Costos, Catálogo e Inventario"
        className="growy-tab-track"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'catalog'}
          onClick={() => setSubTab('catalog')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'catalog'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Package className="w-4 h-4 text-[var(--accent-strong)]" />
          <span>Costos fijos y catálogo</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'inventory'}
          onClick={() => setSubTab('inventory')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'inventory'
              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Boxes className="w-4 h-4 text-[var(--sec-text)]" />
          <span>
            Inventario inteligente
            {invAlertsCount > 0 ? ` · ${invAlertsCount} alerta${invAlertsCount === 1 ? '' : 's'}` : ''}
          </span>
        </button>
      </div>

      {subTab === 'inventory' ? (
        <InventoryPanel business={business} onUpdateBusiness={onUpdateBusiness} />
      ) : (
        <div className="space-y-8">
      {/* SECCIÓN 1: COSTOS FIJOS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              Estructura mensual constante
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
              Costos{' '}
              <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                fijos
              </em>
            </h1>
          </div>
          <div className="text-sm font-semibold">
            <span className="text-[var(--text-secondary)]">Total mes actual: </span>
            <span className="font-mono tabular-nums text-lg font-bold text-[var(--accent-strong)]">
              {formatCurrency(totalFixedNow, business.currency)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveCost} className="lg:col-span-5 boho-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {editingCostId ? 'Editar costo fijo' : 'Agregar costo fijo'}
              </h2>
              {editingCostId && (
                <button
                  type="button"
                  onClick={resetCostForm}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              )}
            </div>

            {costError && (
              <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] p-3 rounded-2xl">
                {costError}
              </p>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">Nombre del costo</label>
              <input
                type="text"
                placeholder="Ej. Arriendo taller o sueldos"
                value={costName}
                onChange={(e) => setCostName(e.target.value)}
                className="boho-input w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Monto mensual ({business.currency.code})
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  className="boho-input w-full font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Categoría</label>
                <select
                  value={costCat}
                  onChange={(e) => setCostCat(e.target.value as FixedCostCategory)}
                  className="boho-input w-full"
                >
                  {(Object.keys(FIXED_COST_CATEGORY_LABELS) as FixedCostCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {FIXED_COST_CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Notas (opcional)</label>
              <input
                type="text"
                placeholder="Detalles de contrato o vencimiento"
                value={costNotes}
                onChange={(e) => setCostNotes(e.target.value)}
                className="boho-input w-full"
              />
            </div>

            <div className="pt-2 border-t border-[var(--border-hairline)]">
              <label className="inline-flex items-center gap-2.5 text-xs font-semibold cursor-pointer min-h-[36px]">
                <input
                  type="checkbox"
                  checked={hasScheduledChange}
                  onChange={(e) => setHasScheduledChange(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-strong)]"
                />
                <span>Este costo cambia de monto a partir de cierto mes</span>
              </label>

              {hasScheduledChange && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Desde el mes</label>
                    <input
                      type="month"
                      value={changeMonth}
                      onChange={(e) => setChangeMonth(e.target.value)}
                      className="boho-input w-full font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Nuevo monto</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={changeAmount}
                      onChange={(e) => setChangeAmount(e.target.value)}
                      className="boho-input w-full font-mono tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors cursor-pointer shadow-sm"
            >
              {editingCostId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingCostId ? 'Guardar cambios' : 'Agregar costo fijo'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 boho-card p-6">
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)] mb-3">
              Listado de costos fijos ({business.fixedCosts.length})
            </h2>
            {business.fixedCosts.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                Aún no registras costos fijos. Agrega arriendo, sueldos, servicios o software.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {business.fixedCosts.map((cost) => (
                  <div
                    key={cost.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--text-primary)]">
                        {cost.name}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        <span>{FIXED_COST_CATEGORY_LABELS[cost.category]}</span>
                        {cost.notes ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{cost.notes}</span>
                          </>
                        ) : null}
                      </p>
                      {cost.scheduledChange && (
                        <p className="text-xs text-[var(--warn-text)] mt-1 font-medium">
                          Cambia a{' '}
                          <span className="font-mono tabular-nums">
                            {formatCurrency(cost.scheduledChange.newAmount, business.currency)}
                          </span>{' '}
                          desde {formatMonthLabel(cost.scheduledChange.effectiveFromMonth, true)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono tabular-nums font-bold text-sm mr-2">
                        {formatCurrency(cost.amount, business.currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditCost(cost)}
                        aria-label={`Editar ${cost.name}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl hover:bg-[var(--bg-soft)] cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCost(cost.id)}
                        aria-label={`Eliminar ${cost.name}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl hover:bg-[var(--danger-soft)] text-[var(--danger-text)] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <GrowyDivider />

      {/* SECCIÓN 2: PRODUCTOS Y SERVICIOS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)]">
              Precios y costos variables por unidad
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
              Catálogo de{' '}
              <em className="font-editorial italic font-semibold text-[var(--accent-strong)]">
                productos
              </em>{' '}
              y servicios
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={handleSaveProduct} className="lg:col-span-5 boho-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">
                {editingProductId ? 'Editar producto / servicio' : 'Agregar producto o servicio'}
              </h3>
              {editingProductId && (
                <button
                  type="button"
                  onClick={resetProdForm}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              )}
            </div>

            {prodError && (
              <p className="text-xs font-semibold text-[var(--danger-text)] bg-[var(--danger-soft)] p-3 rounded-2xl">
                {prodError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre</label>
                <input
                  type="text"
                  placeholder="Ej. Vela Soya & Lavanda"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="boho-input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Categoría</label>
                <input
                  type="text"
                  placeholder="Ej. Aromas o Servicios"
                  value={prodCat}
                  onChange={(e) => setProdCat(e.target.value)}
                  className="boho-input w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Precio venta</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="boho-input w-full font-mono tabular-nums"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold">Costo insumos / base</label>
                  <button
                    type="button"
                    onClick={handleToggleSupplyBreakdown}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-strong)] hover:underline cursor-pointer"
                  >
                    {isBreakdownActive ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Usar monto único</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Desglosar insumos</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={isBreakdownActive ? String(supplyBreakdownTotal) : prodVarCost}
                  readOnly={isBreakdownActive}
                  onChange={(e) => {
                    if (!isBreakdownActive) setProdVarCost(e.target.value);
                  }}
                  className={`boho-input w-full font-mono tabular-nums ${
                    isBreakdownActive ? 'opacity-80 bg-[var(--bg-soft-alt)] cursor-default' : ''
                  }`}
                />
                {isBreakdownActive && (
                  <span className="block text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Calculado automáticamente desde {supplyRows.length} insumo
                    {supplyRows.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>

            {/* Subsección opcional: Desglose de múltiples costos por insumo */}
            <AnimatePresence initial={false}>
              {isBreakdownActive && (
                <motion.div
                  key="supply-breakdown"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{
                    opacity: 1,
                    height: 'auto',
                    transition: { duration: 0.24, ease: GROWY_EASE },
                  }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    transition: { duration: 0.18, ease: GROWY_EASE },
                  }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        Desglose por insumo ({business.currency.code})
                      </p>
                      <span className="text-xs font-mono tabular-nums font-bold text-[var(--accent-strong)]">
                        Total: {formatCurrency(supplyBreakdownTotal, business.currency)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {supplyRows.map((row, idx) => (
                        <div key={row.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder={`Ej. Insumo ${idx + 1} (cera, envase...)`}
                            aria-label={`Nombre del insumo ${idx + 1}`}
                            value={row.name}
                            onChange={(e) =>
                              handleUpdateSupplyRow(row.id, { name: e.target.value })
                            }
                            className="boho-input flex-1 min-w-0 py-1.5 text-xs"
                          />
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0"
                            aria-label={`Costo del insumo ${idx + 1}`}
                            value={row.amountStr}
                            onChange={(e) =>
                              handleUpdateSupplyRow(row.id, { amountStr: e.target.value })
                            }
                            className="boho-input w-24 sm:w-28 py-1.5 text-xs font-mono tabular-nums text-right"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveSupplyRow(row.id)}
                            aria-label={`Eliminar insumo ${row.name || idx + 1}`}
                            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-xl hover:bg-[var(--danger-soft)] text-[var(--danger-text)] cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleAddSupplyRow}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-[var(--accent-strong)]" />
                        <span>Agregar otro insumo</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Desglose adicional por unidad */}
            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Costos adicionales por unidad (opcional)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Pago con tarjeta débito/crédito (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="Ej. 2.9"
                    value={prodCardFeePct}
                    onChange={(e) => setProdCardFeePct(e.target.value)}
                    className="boho-input w-full font-mono tabular-nums"
                  />
                  {Number(prodPrice) > 0 && Number(prodCardFeePct) > 0 && (
                    <span className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5 block">
                      Equivale a{' '}
                      {formatCurrency(draftProductPreview.breakdown.cardFeeAmount, business.currency)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Impuestos (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="Ej. 19"
                    value={prodTaxPct}
                    onChange={(e) => setProdTaxPct(e.target.value)}
                    className="boho-input w-full font-mono tabular-nums"
                  />
                  {Number(prodPrice) > 0 && Number(prodTaxPct) > 0 && (
                    <span className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5 block">
                      Equivale a{' '}
                      {formatCurrency(draftProductPreview.breakdown.taxAmount, business.currency)}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Envío o despacho ({business.currency.code})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={prodShipping}
                    onChange={(e) => setProdShipping(e.target.value)}
                    className="boho-input w-full font-mono tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Tiempo personal involucrado ({business.currency.code})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={prodPersonalTime}
                    onChange={(e) => setProdPersonalTime(e.target.value)}
                    className="boho-input w-full font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {Number(prodPrice) > 0 && (
              <div className="p-3.5 rounded-2xl bg-[var(--pos-soft)] text-xs space-y-1.5">
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <span>Costo variable total unitario:</span>
                  <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                    {formatCurrency(
                      draftProductPreview.breakdown.totalUnitVariableCost,
                      business.currency
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Margen de contribución unitario:</span>
                  <span
                    className={`font-mono tabular-nums font-bold ${
                      draftProductPreview.margin > 0
                        ? 'text-[var(--pos-text)]'
                        : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {formatCurrency(draftProductPreview.margin, business.currency)} (
                    {formatPercent(draftProductPreview.marginPct)})
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-sm font-bold transition-colors cursor-pointer shadow-sm"
            >
              {editingProductId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingProductId ? 'Guardar producto' : 'Agregar al catálogo'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 boho-card p-6">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-3">
              Productos y servicios ({business.products.length})
            </h3>
            {business.products.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                Aún no tienes productos en tu catálogo. Agrega al menos uno para comenzar a calcular.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse min-w-[480px]">
                  <thead>
                    <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                      <th className="py-2 pr-3 font-semibold">Producto</th>
                      <th className="py-2 px-2 font-semibold text-right">Precio</th>
                      <th className="py-2 px-2 font-semibold text-right">Costo var. total</th>
                      <th className="py-2 px-2 font-semibold text-right">Margen</th>
                      <th className="py-2 pl-2 font-semibold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {business.products.map((p) => {
                      const breakdown = getProductCostBreakdown(p);
                      const totalVarCost = getProductTotalVariableCost(p);
                      const mc = getProductContributionMargin(p);
                      const mcPct = getProductMarginPercent(p);
                      const details: string[] = [];
                      if (breakdown.baseVariableCost > 0) {
                        const supplyCount = p.supplyCostItems?.length ?? 0;
                        details.push(
                          supplyCount > 0
                            ? `Insumos (${supplyCount}) ${formatCurrency(breakdown.baseVariableCost, business.currency)}`
                            : `Base ${formatCurrency(breakdown.baseVariableCost, business.currency)}`
                        );
                      }
                      if (breakdown.cardFeePercent > 0) {
                        details.push(`Tarj. ${breakdown.cardFeePercent}%`);
                      }
                      if (breakdown.taxPercent > 0) {
                        details.push(`Imp. ${breakdown.taxPercent}%`);
                      }
                      if (breakdown.shippingCost > 0) {
                        details.push(`Envío ${formatCurrency(breakdown.shippingCost, business.currency)}`);
                      }
                      if (breakdown.personalTimeCost > 0) {
                        details.push(`Tiempo ${formatCurrency(breakdown.personalTimeCost, business.currency)}`);
                      }
                      const supplyTooltip =
                        p.supplyCostItems && p.supplyCostItems.length > 0
                          ? p.supplyCostItems
                              .map((i) => `${i.name}: ${formatCurrency(i.amount, business.currency)}`)
                              .join(' · ')
                          : undefined;

                      return (
                        <tr
                          key={p.id}
                          className="border-b border-[var(--border-hairline)] last:border-0"
                        >
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {p.name}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {p.category}
                            </p>
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums">
                            {formatCurrency(p.price, business.currency)}
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {formatCurrency(totalVarCost, business.currency)}
                            </span>
                            {details.length > 0 && (
                              <span
                                title={supplyTooltip}
                                className="block text-[10px] font-sans text-[var(--text-secondary)] max-w-[200px] ml-auto leading-tight mt-0.5"
                              >
                                {details.join(' · ')}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-mono tabular-nums text-[var(--pos-text)] font-bold">
                            {formatCurrency(mc, business.currency)}
                            <span className="block text-[11px] font-normal">
                              {formatPercent(mcPct)}
                            </span>
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <div className="inline-flex items-center">
                              <button
                                type="button"
                                onClick={() => startEditProduct(p)}
                                aria-label={`Editar ${p.name}`}
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl hover:bg-[var(--bg-soft)] cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id)}
                                aria-label={`Eliminar ${p.name}`}
                                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl hover:bg-[var(--danger-soft)] text-[var(--danger-text)] cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
        </div>
      )}
    </div>
  );
};
