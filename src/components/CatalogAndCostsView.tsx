import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Package,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FIXED_COST_CATEGORY_LABELS,
  formatCurrency,
  formatMonthLabel,
  formatNumber,
  formatPercent,
  getCurrentYearMonth,
  getProductContributionMargin,
  getProductCostBreakdown,
  getProductMarginPercent,
  getProductTotalVariableCost,
  getTotalFixedCostsForMonth,
} from '../finance/formulas';
import { calculateProductProfitabilityRanking } from '../finance/phase1Insights';
import { calculateSuggestedProductPrice } from '../finance/phase2Insights';
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
import {
  FloatingSearchBar,
  ProductProfitabilityDoughnut,
  SectionTitle,
  SolidCard,
} from './design-system';

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
  const [prodPersonalMinutes, setProdPersonalMinutes] = useState('');
  const [targetMarginPctStr, setTargetMarginPctStr] = useState('45');
  const [prodError, setProdError] = useState<string | null>(null);
  const [showParetoHelp, setShowParetoHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowMarginOnly, setShowLowMarginOnly] = useState(false);
  const productFormRef = useRef<HTMLFormElement>(null);
  const [themeKey, setThemeKey] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.className : 'light'
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      setThemeKey(document.documentElement.className);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const totalFixedNow = useMemo(
    () => getTotalFixedCostsForMonth(business.fixedCosts, currentMonth),
    [business.fixedCosts, currentMonth]
  );

  const profitabilityRanking = useMemo(
    () => calculateProductProfitabilityRanking(business, currentMonth),
    [business, currentMonth]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFixedCosts = useMemo(() => {
    if (!normalizedQuery) return business.fixedCosts;
    return business.fixedCosts.filter((c) => {
      const catLabel = FIXED_COST_CATEGORY_LABELS[c.category]?.toLowerCase() ?? '';
      return (
        c.name.toLowerCase().includes(normalizedQuery) ||
        catLabel.includes(normalizedQuery) ||
        (c.notes ?? '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [business.fixedCosts, normalizedQuery]);

  const filteredProducts = useMemo(() => {
    return business.products.filter((p) => {
      if (showLowMarginOnly && getProductMarginPercent(p) >= 25) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        p.name.toLowerCase().includes(normalizedQuery) ||
        p.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [business.products, normalizedQuery, showLowMarginOnly]);

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
    setProdPersonalMinutes('');
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
    setProdPersonalMinutes(p.personalTimeMinutes ? String(p.personalTimeMinutes) : '');
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

  const suggestedPriceResult = useMemo(
    () =>
      calculateSuggestedProductPrice({
        variableCost: effectiveBaseVarCost,
        cardFeePercent: Math.max(0, Number(prodCardFeePct) || 0),
        taxPercent: Math.max(0, Number(prodTaxPct) || 0),
        shippingCost: Math.max(0, Number(prodShipping) || 0),
        personalTimeCost: Math.max(0, Number(prodPersonalTime) || 0),
        targetMarginPercent: Number(targetMarginPctStr),
        decimals: business.currency.decimals,
      }),
    [
      effectiveBaseVarCost,
      prodCardFeePct,
      prodTaxPct,
      prodShipping,
      prodPersonalTime,
      targetMarginPctStr,
      business.currency.decimals,
    ]
  );

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const price = Number(prodPrice);
    const cardFeePercent = prodCardFeePct === '' ? 0 : Number(prodCardFeePct);
    const taxPercent = prodTaxPct === '' ? 0 : Number(prodTaxPct);
    const shippingCost = prodShipping === '' ? 0 : Number(prodShipping);
    const personalTimeCost = prodPersonalTime === '' ? 0 : Number(prodPersonalTime);
    const personalTimeMinutes =
      prodPersonalMinutes.trim() === '' ? undefined : Number(prodPersonalMinutes);

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
    if (
      personalTimeMinutes !== undefined &&
      (!Number.isFinite(personalTimeMinutes) || personalTimeMinutes < 0)
    ) {
      setProdError('Los minutos de dedicación por unidad deben ser 0 o mayor.');
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
      personalTimeMinutes:
        personalTimeMinutes !== undefined && personalTimeMinutes > 0
          ? personalTimeMinutes
          : undefined,
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
          style={
            subTab === 'catalog'
              ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
              : undefined
          }
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'catalog'
              ? 'shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Package
            className={`w-4 h-4 ${
              subTab === 'catalog' ? '' : 'text-[var(--accent-strong)]'
            }`}
          />
          <span>Costos fijos y catálogo</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'inventory'}
          onClick={() => setSubTab('inventory')}
          style={
            subTab === 'inventory'
              ? { backgroundColor: 'var(--btn-navy-bg)', color: 'var(--btn-navy-text)' }
              : undefined
          }
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            subTab === 'inventory'
              ? 'shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Boxes
            className={`w-4 h-4 ${
              subTab === 'inventory' ? '' : 'text-[var(--sec-text)]'
            }`}
          />
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <FloatingSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar producto, categoría o costo fijo..."
          label="Buscar en costos fijos y catálogo"
          onFilterClick={() => setShowLowMarginOnly((v) => !v)}
          filterActive={showLowMarginOnly}
          filterLabel="Mostrar solo productos con margen bajo (<25%)"
          onAddClick={() =>
            productFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          addLabel="Ir al formulario para agregar producto"
        />
        {(searchQuery.trim() !== '' || showLowMarginOnly) && (
          <p className="text-xs font-semibold text-[var(--text-secondary)] shrink-0">
            Mostrando {filteredProducts.length} prod. · {filteredFixedCosts.length} c. fijos
            {showLowMarginOnly ? ' (margen <25%)' : ''}
          </p>
        )}
      </div>

      {/* SECCIÓN 1: COSTOS FIJOS */}
      <section className="space-y-4">
        <SectionTitle
          as="h1"
          eyebrow="Estructura mensual constante"
          title="Costos *fijos*"
          rightSlot={
            <div className="text-sm font-semibold">
              <span className="text-[var(--text-secondary)]">Total mes actual: </span>
              <span className="font-mono tabular-nums text-lg font-bold text-[var(--accent-strong)]">
                {formatCurrency(totalFixedNow, business.currency)}
              </span>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <SolidCard className="lg:col-span-5 p-6">
            <form onSubmit={handleSaveCost} className="space-y-4">
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
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold hover:opacity-92 transition-opacity cursor-pointer shadow-sm"
            >
              {editingCostId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingCostId ? 'Guardar cambios' : 'Agregar costo fijo'}</span>
            </button>
            </form>
          </SolidCard>

          <SolidCard className="lg:col-span-7 p-6">
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)] mb-3">
              Listado de costos fijos ({filteredFixedCosts.length})
            </h2>
            {business.fixedCosts.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                Aún no registras costos fijos. Agrega arriendo, sueldos, servicios o software.
              </p>
            ) : filteredFixedCosts.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                No encontramos costos fijos que coincidan con "{searchQuery}".
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)]">
                {filteredFixedCosts.map((cost) => (
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
          </SolidCard>
        </div>
      </section>

      <GrowyDivider />

      {/* SECCIÓN 2: PRODUCTOS Y SERVICIOS */}
      <section className="space-y-4">
        <SectionTitle
          as="h2"
          eyebrow="Precios y costos variables por unidad"
          title="Catálogo de *productos* y servicios"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <SolidCard className="lg:col-span-5 p-6">
            <form ref={productFormRef} onSubmit={handleSaveProduct} className="space-y-4">
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

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    Minutos de tu tiempo por unidad (para calcular margen por hora)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Ej. 30 (opcional, en minutos)"
                    value={prodPersonalMinutes}
                    onChange={(e) => setProdPersonalMinutes(e.target.value)}
                    className="boho-input w-full font-mono tabular-nums"
                  />
                  <span className="block text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Si ingresas los minutos que dedicas por unidad, veremos cuánta ganancia libre te deja cada hora trabajada en este producto.
                  </span>
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

            {/* 2.6 Precio sugerido según margen objetivo */}
            <div className="p-3.5 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  ¿Qué precio cobrar? (según margen deseado)
                </span>
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="target-margin-helper-input"
                    className="text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    Margen %
                  </label>
                  <input
                    id="target-margin-helper-input"
                    type="number"
                    min={0}
                    max={95}
                    step={1}
                    value={targetMarginPctStr}
                    onChange={(e) => setTargetMarginPctStr(e.target.value)}
                    className="boho-input w-20 py-1 text-xs font-mono tabular-nums text-right"
                  />
                </div>
              </div>

              {suggestedPriceResult.isValid ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text-secondary)]">Precio sugerido: </span>
                    <strong className="font-mono tabular-nums text-sm text-[var(--sec-text)]">
                      {formatCurrency(suggestedPriceResult.suggestedPrice, business.currency)}
                    </strong>
                    <span className="block text-[11px] text-[var(--text-secondary)]">
                      Deja aprox.{' '}
                      {formatCurrency(suggestedPriceResult.projectedUnitMargin, business.currency)}{' '}
                      libres por unidad ({suggestedPriceResult.targetMarginPercent}%).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProdPrice(String(suggestedPriceResult.suggestedPrice))}
                    className="min-h-[34px] px-3.5 rounded-full bg-[var(--bg-surface)] border border-[var(--sec-border)] text-xs font-bold text-[var(--sec-text)] hover:bg-[var(--bg-soft)] cursor-pointer shrink-0"
                  >
                    Usar este precio
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--danger-text)] font-medium">
                  {suggestedPriceResult.errorMessage}
                </p>
              )}
            </div>

            <button
              type="submit"
              style={{
                backgroundColor: 'var(--btn-navy-bg)',
                color: 'var(--btn-navy-text)',
              }}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full text-sm font-bold hover:opacity-92 transition-opacity cursor-pointer shadow-sm"
            >
              {editingProductId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingProductId ? 'Guardar producto' : 'Agregar al catálogo'}</span>
            </button>
            </form>
          </SolidCard>

          <SolidCard className="lg:col-span-7 p-6">
            <h3 className="font-display text-lg font-bold text-[var(--text-primary)] mb-3">
              Productos y servicios ({filteredProducts.length})
            </h3>
            {business.products.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                Aún no tienes productos en tu catálogo. Agrega al menos uno para comenzar a calcular.
              </p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
                Ningún producto coincide con el filtro actual.
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
                    {filteredProducts.map((p) => {
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
          </SolidCard>
        </div>
      </section>

      {/* SECCIÓN 3: RENTABILIDAD POR PRODUCTO, PARETO 80/20 Y MARGEN POR HORA */}
      {business.products.length > 0 && (
        <SolidCard as="section" className="p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--pos-text)] shrink-0" />
                <SectionTitle
                  as="h2"
                  size="sm"
                  title="Rentabilidad por *producto* · Pareto 80/20"
                />
                <button
                  type="button"
                  onClick={() => setShowParetoHelp((prev) => !prev)}
                  aria-label="¿Cómo se lee la vista Pareto 80/20?"
                  aria-expanded={showParetoHelp}
                  className="text-[var(--sec-text)] hover:opacity-80 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Ordenados por margen total del mes (
                {profitabilityRanking.volumeSourceUsed === 'actual'
                  ? 'según unidades reales vendidas en el mes'
                  : profitabilityRanking.volumeSourceUsed === 'mixed'
                    ? 'mezcla de ventas reales y proyección base'
                    : 'según volumen mensual proyectado'}
                ).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--pos-soft)] border border-[var(--pos-border)] font-semibold text-[var(--pos-text)]">
                Pareto 80/20: {profitabilityRanking.paretoCoreCount}{' '}
                {profitabilityRanking.paretoCoreCount === 1 ? 'producto clave' : 'productos clave'}
              </span>
              {profitabilityRanking.highVolumeLowMarginCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--warn-soft)] border border-[var(--warn-border)] font-semibold text-[var(--warn-text)]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>
                    {profitabilityRanking.highVolumeLowMarginCount} vende harto y deja poco
                  </span>
                </span>
              )}
            </div>
          </div>

          {showParetoHelp && (
            <div className="p-4 rounded-2xl bg-[var(--sec-soft)] border border-[var(--sec-border)] text-xs text-[var(--text-primary)] leading-relaxed space-y-1">
              <p>
                <strong>Vista Pareto 80/20:</strong> muestra qué productos generan cerca del 80% de tu ganancia libre total para que cuides su stock y tiempo.
              </p>
              <p>
                <strong>Vende harto pero deja poco:</strong> marca productos con muchas unidades vendidas, pero cuyo margen porcentual es bajo (&lt;25% o menos de la mitad del promedio de tu catálogo).
              </p>
            </div>
          )}

          <ProductProfitabilityDoughnut
            title="Aporte al margen por producto"
            items={profitabilityRanking.rows
              .filter((r) => r.totalMargin > 0)
              .slice(0, 8)
              .map((r) => ({ name: r.productName, amount: Math.round(r.totalMargin) }))}
            themeKey={themeKey}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse min-w-[740px]">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
                  <th className="py-2.5 pr-3 font-semibold"># · Producto</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Volumen/mes</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Margen unit.</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Margen total</th>
                  <th className="py-2.5 px-2 font-semibold text-right">Aporte / Pareto</th>
                  <th className="py-2.5 pl-2 font-semibold text-right">Margen / hora</th>
                </tr>
              </thead>
              <tbody>
                {profitabilityRanking.rows.map((row) => (
                  <tr
                    key={row.productId}
                    className={`border-b border-[var(--border-hairline)] last:border-0 ${
                      row.isHighVolumeLowMargin ? 'bg-[var(--warn-soft)]/45' : ''
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">
                          #{row.rank}
                        </span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {row.productName}
                        </span>
                        {row.isParetoTop80 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--pos-soft)] border border-[var(--pos-border)] text-[10px] font-bold text-[var(--pos-text)]">
                            Núcleo 80/20
                          </span>
                        )}
                        {row.isHighVolumeLowMargin && (
                          <span
                            title={row.highVolumeLowMarginReason ?? undefined}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--warn-soft)] border border-[var(--warn-border)] text-[10px] font-bold text-[var(--warn-text)]"
                          >
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>Vende harto, deja poco</span>
                          </span>
                        )}
                      </div>
                      {row.highVolumeLowMarginReason && (
                        <p className="text-[11px] text-[var(--warn-text)] mt-1">
                          {row.highVolumeLowMarginReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums">
                      {formatNumber(row.units)} u.
                      <span className="block text-[10px] font-sans text-[var(--text-secondary)]">
                        {row.volumeSource === 'actual' ? 'Real' : 'Proyectado'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums">
                      {formatCurrency(row.unitContributionMargin, business.currency)}
                      <span className="block text-[11px] text-[var(--text-secondary)]">
                        {formatPercent(row.contributionMarginPercent)}
                      </span>
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-mono tabular-nums font-bold ${
                        row.totalMargin >= 0 ? 'text-[var(--pos-text)]' : 'text-[var(--danger-text)]'
                      }`}
                    >
                      {formatCurrency(row.totalMargin, business.currency)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono tabular-nums">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {row.profitSharePercent.toFixed(1)}%
                      </span>
                      <span className="block text-[10px] text-[var(--text-secondary)]">
                        Acum. {row.cumulativeProfitSharePercent.toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 pl-2 text-right font-mono tabular-nums">
                      {row.marginPerHour !== null ? (
                        <div>
                          <span className="font-bold text-[var(--sec-text)]">
                            {formatCurrency(row.marginPerHour, business.currency)}/h
                          </span>
                          <span className="block text-[10px] font-sans text-[var(--text-secondary)]">
                            {row.personalTimeMinutes} min/u
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const target = business.products.find((p) => p.id === row.productId);
                            if (target) startEditProduct(target);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold text-[var(--sec-text)] hover:underline cursor-pointer"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Agregar min/u</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SolidCard>
      )}
        </div>
      )}
    </div>
  );
};
