import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  PackageCheck,
  PackageMinus,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../finance/formulas';
import {
  buildInventoryPurchasePatch,
  calculateInventorySummary,
} from '../finance/smeIntelligence';
import { toISODateLocal } from '../finance/subscription';
import type { BusinessWorkspace, InventoryMovement } from '../types/finance';

interface InventoryPanelProps {
  business: BusinessWorkspace;
  onUpdateBusiness: (patch: Partial<BusinessWorkspace>) => void;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({
  business,
  onUpdateBusiness,
}) => {
  const summary = useMemo(() => calculateInventorySummary(business), [business]);
  const todayISO = toISODateLocal(new Date());

  // Compra de inventario
  const [buyProductId, setBuyProductId] = useState(business.products[0]?.id ?? '');
  const [buyDate, setBuyDate] = useState(todayISO);
  const [buyQty, setBuyQty] = useState('10');
  const [buyUnitCost, setBuyUnitCost] = useState('');
  const [buyPaymentMode, setBuyPaymentMode] = useState<'cash' | 'credit'>('cash');
  const [buySupplier, setBuySupplier] = useState('');
  const [buyDocRef, setBuyDocRef] = useState('');
  const [buyDueDate, setBuyDueDate] = useState(todayISO);
  const [buyFeedback, setBuyFeedback] = useState<string | null>(null);

  // Ajuste / Merma
  const [adjProductId, setAdjProductId] = useState(business.products[0]?.id ?? '');
  const [adjDate, setAdjDate] = useState(todayISO);
  const [adjType, setAdjType] = useState<'damage_loss' | 'adjustment_in'>('damage_loss');
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjFeedback, setAdjFeedback] = useState<string | null>(null);

  const effectiveBuyProdId =
    business.products.find((p) => p.id === buyProductId)?.id ?? business.products[0]?.id ?? '';
  const effectiveAdjProdId =
    business.products.find((p) => p.id === adjProductId)?.id ?? business.products[0]?.id ?? '';

  const selectedBuyProduct = business.products.find((p) => p.id === effectiveBuyProdId);

  const handleToggleProductTracking = (productId: string, nextTrack: boolean) => {
    onUpdateBusiness({
      products: business.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              trackInventory: nextTrack,
              initialStock: p.initialStock ?? 0,
              minStock: p.minStock ?? 5,
            }
          : p
      ),
    });
  };

  const handleUpdateProductStockParam = (
    productId: string,
    field: 'initialStock' | 'minStock',
    val: number
  ) => {
    const clean = Math.max(0, Math.round(Number(val) || 0));
    onUpdateBusiness({
      products: business.products.map((p) =>
        p.id === productId ? { ...p, trackInventory: true, [field]: clean } : p
      ),
    });
  };

  const handlePurchaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveBuyProdId) return;
    const qty = Math.round(Number(buyQty));
    const unitCostNum =
      buyUnitCost.trim() !== ''
        ? Number(buyUnitCost)
        : Math.max(0, Number(selectedBuyProduct?.variableCost) || 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      setBuyFeedback('La cantidad comprada debe ser mayor a 0.');
      return;
    }
    if (!Number.isFinite(unitCostNum) || unitCostNum < 0) {
      setBuyFeedback('Ingresa un costo unitario válido.');
      return;
    }

    const patch = buildInventoryPurchasePatch(business, {
      productId: effectiveBuyProdId,
      date: buyDate || todayISO,
      quantity: qty,
      unitCost: unitCostNum,
      paymentMode: buyPaymentMode,
      supplierName: buySupplier,
      documentRef: buyDocRef,
      dueDate: buyDueDate || buyDate || todayISO,
    });
    onUpdateBusiness(patch);
    setBuyQty('10');
    setBuyUnitCost('');
    setBuySupplier('');
    setBuyDocRef('');
    setBuyFeedback(
      buyPaymentMode === 'credit'
        ? 'Compra ingresada a inventario y registrada en Cuentas por Pagar.'
        : 'Compra ingresada a inventario y descontada de caja real.'
    );
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveAdjProdId) return;
    const prod = business.products.find((p) => p.id === effectiveAdjProdId);
    if (!prod) return;
    const qty = Math.round(Number(adjQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      setAdjFeedback('Ingresa una cantidad mayor a 0.');
      return;
    }

    const mov: InventoryMovement = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.id,
      date: adjDate || todayISO,
      type: adjType,
      quantity: qty,
      unitCost: Math.max(0, Number(prod.variableCost) || 0),
      note:
        adjNote.trim() ||
        (adjType === 'damage_loss' ? 'Producto dañado o perdido' : 'Ajuste positivo de conteo'),
    };

    onUpdateBusiness({
      products: business.products.map((p) =>
        p.id === prod.id ? { ...p, trackInventory: true } : p
      ),
      inventoryMovements: [mov, ...(business.inventoryMovements ?? [])],
    });
    setAdjQty('');
    setAdjNote('');
    setAdjFeedback('Movimiento de inventario registrado correctamente.');
  };

  if (business.products.length === 0) {
    return (
      <div data-tour="inventory-purchase-form" className="boho-card p-8 text-center space-y-2">
        <Boxes className="w-8 h-8 text-[var(--accent-strong)] mx-auto" />
        <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">
          Primero agrega productos en Costos y Catálogo
        </h2>
        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
          El módulo de inventario inteligente se conecta automáticamente con tus productos, compras
          y ventas sin duplicar registros.
        </p>
      </div>
    );
  }

  const recentMovements = (business.inventoryMovements ?? []).slice(0, 20);

  return (
    <div className="space-y-6">
      {/* KPIs DE INVENTARIO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-[28px] p-5 bg-[var(--sec-soft)] border border-[var(--sec-border)]">
          <p className="text-xs font-semibold text-[var(--sec-muted)]">
            Valor total inventario actual
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2">
            {summary.hasTrackedProducts
              ? formatCurrency(summary.totalCurrentValue, business.currency)
              : 'Sin activar'}
          </p>
          <p className="text-[11px] text-[var(--sec-muted)] mt-1">
            {summary.trackedCount} de {business.products.length} productos con control de stock
          </p>
        </div>

        <div className="rounded-[28px] p-5 bg-[var(--pos-soft)] border border-[var(--pos-border)]">
          <p className="text-xs font-semibold text-[var(--pos-muted)]">
            Rotación de inventario
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--pos-text)] mt-2">
            {summary.globalTurnoverRatio !== null
              ? `${summary.globalTurnoverRatio.toFixed(2)}x`
              : 'Datos insuficientes'}
          </p>
          <p className="text-[11px] text-[var(--pos-muted)] mt-1">
            Costo de ventas: {formatCurrency(summary.totalCostOfGoodsSold, business.currency)}
          </p>
        </div>

        <div className="rounded-[28px] p-5 bg-[var(--warn-soft)] border border-[var(--warn-border)]">
          <p className="text-xs font-semibold text-[var(--warn-muted)]">
            Alertas de reposición
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--warn-text)] mt-2">
            {summary.outOfStockProducts.length + summary.lowStockProducts.length}
          </p>
          <p className="text-[11px] text-[var(--warn-muted)] mt-1">
            {summary.outOfStockProducts.length} agotado(s) · {summary.lowStockProducts.length} bajo
            mínimo
          </p>
        </div>

        <div className="rounded-[28px] p-5 bg-[var(--accent-soft)] border border-[var(--accent-soft-border)]">
          <p className="text-xs font-semibold text-[var(--accent-soft-muted)]">
            Baja rotación y mermas
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)] mt-2">
            {summary.slowMovingProducts.length}
            <span className="text-xs font-normal text-[var(--text-secondary)] ml-1.5">
              lentos
            </span>
          </p>
          <p className="text-[11px] text-[var(--accent-soft-muted)] mt-1">
            Mermas/daños: {formatNumber(summary.totalDamageLossUnits)} u. (
            {formatCurrency(summary.totalDamageLossValue, business.currency)})
          </p>
        </div>
      </div>

      {/* FORMULARIOS INTEGRADOS: COMPRA DE INVENTARIO Y AJUSTE/MERMA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          data-tour="inventory-purchase-form"
          onSubmit={handlePurchaseSubmit}
          className="lg:col-span-7 boho-card p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[var(--pos-text)] shrink-0" />
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Registrar compra de inventario
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Suma stock automáticamente y registra el pago al contado en caja o a crédito en
                Cuentas por Pagar.
              </p>
            </div>
          </div>

          {buyFeedback && (
            <p className="text-xs font-semibold p-3 rounded-2xl bg-[var(--pos-soft)] text-[var(--pos-text)]">
              {buyFeedback}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Producto</label>
              <select
                value={effectiveBuyProdId}
                onChange={(e) => setBuyProductId(e.target.value)}
                className="boho-input w-full text-xs font-semibold"
              >
                {business.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Fecha compra</label>
              <input
                type="date"
                value={buyDate}
                onChange={(e) => setBuyDate(e.target.value)}
                className="boho-input w-full font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Cantidad (u.)</label>
              <input
                type="number"
                min={1}
                value={buyQty}
                onChange={(e) => setBuyQty(e.target.value)}
                className="boho-input w-full font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Costo unitario ({business.currency.code})
              </label>
              <input
                type="number"
                min={0}
                step="any"
                placeholder={String(selectedBuyProduct?.variableCost ?? 0)}
                value={buyUnitCost}
                onChange={(e) => setBuyUnitCost(e.target.value)}
                className="boho-input w-full font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setBuyPaymentMode('cash')}
              className={`min-h-[42px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                buyPaymentMode === 'cash'
                  ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-xs'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Pagado al contado (Caja)
            </button>
            <button
              type="button"
              onClick={() => setBuyPaymentMode('credit')}
              className={`min-h-[42px] px-3 rounded-full border text-xs font-bold cursor-pointer transition-colors ${
                buyPaymentMode === 'credit'
                  ? 'bg-[var(--accent-btn)] text-[var(--accent-btn-text)] border-transparent shadow-xs'
                  : 'border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Crédito proveedor (CxP)
            </button>
          </div>

          {buyPaymentMode === 'credit' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Proveedor</label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora Sur"
                  value={buySupplier}
                  onChange={(e) => setBuySupplier(e.target.value)}
                  className="boho-input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">N° Factura / Guía</label>
                <input
                  type="text"
                  placeholder="F-1042"
                  value={buyDocRef}
                  onChange={(e) => setBuyDocRef(e.target.value)}
                  className="boho-input w-full text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">Vencimiento pago</label>
                <input
                  type="date"
                  value={buyDueDate}
                  onChange={(e) => setBuyDueDate(e.target.value)}
                  className="boho-input w-full font-mono text-xs"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-full bg-[var(--accent-btn)] hover:bg-[var(--accent-btn-hover)] text-[var(--accent-btn-text)] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar compra en inventario</span>
          </button>
        </form>

        <form onSubmit={handleAdjustSubmit} className="lg:col-span-5 boho-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-[var(--warn-text)] shrink-0" />
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
                Mermas, daños o ajuste manual
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Registra pérdidas o diferencias de conteo físico sin afectar ventas.
              </p>
            </div>
          </div>

          {adjFeedback && (
            <p className="text-xs font-semibold p-3 rounded-2xl bg-[var(--pos-soft)] text-[var(--pos-text)]">
              {adjFeedback}
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">Producto</label>
            <select
              value={effectiveAdjProdId}
              onChange={(e) => setAdjProductId(e.target.value)}
              className="boho-input w-full text-xs font-semibold"
            >
              {business.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Tipo</label>
              <select
                value={adjType}
                onChange={(e) =>
                  setAdjType(e.target.value as 'damage_loss' | 'adjustment_in')
                }
                className="boho-input w-full text-xs font-semibold"
              >
                <option value="damage_loss">Dañado / Perdido (-)</option>
                <option value="adjustment_in">Ajuste conteo (+)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Unidades</label>
              <input
                type="number"
                min={1}
                placeholder="0"
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                className="boho-input w-full font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Fecha</label>
              <input
                type="date"
                value={adjDate}
                onChange={(e) => setAdjDate(e.target.value)}
                className="boho-input w-full font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Motivo</label>
              <input
                type="text"
                placeholder="Ej. Envase roto"
                value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                className="boho-input w-full text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-full border border-[var(--border-hairline)] bg-[var(--bg-soft-alt)] hover:bg-[var(--bg-soft)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>Guardar ajuste de stock</span>
          </button>
        </form>
      </div>

      {/* TABLA DETALLADA POR PRODUCTO */}
      <section className="boho-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Control de stock, valorización y rotación por producto
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Activa el control en los productos físicos e ingresa su stock inicial y mínimo de
              alerta. Las ventas reales y ventas a crédito vinculadas descuentan stock
              automáticamente.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-[var(--text-secondary)]">
                <th className="py-2.5 pr-3">Control</th>
                <th className="py-2.5 px-2">Producto</th>
                <th className="py-2.5 px-2 text-right">Inv. Inicial</th>
                <th className="py-2.5 px-2 text-right">Stock Mín.</th>
                <th className="py-2.5 px-2 text-right">Entradas</th>
                <th className="py-2.5 px-2 text-right">Salidas</th>
                <th className="py-2.5 px-2 text-right">Stock Actual</th>
                <th className="py-2.5 px-2 text-right">Valorizado</th>
                <th className="py-2.5 px-2 text-right">Rotación</th>
                <th className="py-2.5 pl-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr
                  key={row.product.id}
                  className="border-b border-[var(--border-hairline)] last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <input
                      type="checkbox"
                      checked={row.trackInventory}
                      onChange={(e) =>
                        handleToggleProductTracking(row.product.id, e.target.checked)
                      }
                      aria-label={`Controlar inventario de ${row.product.name}`}
                      className="w-4 h-4 accent-[var(--accent-strong)] cursor-pointer"
                    />
                  </td>
                  <td className="py-2.5 px-2">
                    <p className="font-semibold text-[var(--text-primary)]">{row.product.name}</p>
                    <p className="text-[11px] text-[var(--text-secondary)] font-mono">
                      Costo u.: {formatCurrency(row.unitCost, business.currency)}
                    </p>
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={row.initialStock}
                      onChange={(e) =>
                        handleUpdateProductStockParam(
                          row.product.id,
                          'initialStock',
                          Number(e.target.value)
                        )
                      }
                      className="w-16 text-right font-mono px-2 py-1 rounded-xl border border-[var(--border-hairline)] bg-transparent"
                    />
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={row.minStock}
                      onChange={(e) =>
                        handleUpdateProductStockParam(
                          row.product.id,
                          'minStock',
                          Number(e.target.value)
                        )
                      }
                      className="w-16 text-right font-mono px-2 py-1 rounded-xl border border-[var(--border-hairline)] bg-transparent"
                    />
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[var(--pos-text)]">
                    +{formatNumber(row.purchasesIn + row.adjustmentsIn)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-[var(--danger-text)]">
                    -{formatNumber(row.salesOut + row.damageLossOut)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-sm">
                    {row.trackInventory ? formatNumber(row.currentStock) : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    {row.trackInventory
                      ? formatCurrency(row.currentInventoryValue, business.currency)
                      : '—'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    {row.turnoverRatio !== null ? `${row.turnoverRatio.toFixed(2)}x` : '—'}
                  </td>
                  <td className="py-2.5 pl-2">
                    <span
                      className={`font-bold ${
                        row.status === 'agotado'
                          ? 'text-[var(--danger-text)]'
                          : row.status === 'bajo_minimo' || row.status === 'baja_rotacion'
                            ? 'text-[var(--warn-text)]'
                            : row.status === 'saludable'
                              ? 'text-[var(--pos-text)]'
                              : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {row.statusLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DESTACADOS DE ALTA Y BAJA ROTACIÓN */}
        {summary.hasTrackedProducts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[var(--pos-soft)] border border-[var(--pos-border)] space-y-1.5">
              <p className="text-xs font-bold text-[var(--pos-text)] inline-flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Productos de alta rotación</span>
              </p>
              {summary.fastMovingProducts.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  Aún no hay suficientes ventas registradas con inventario activo para identificar
                  alta rotación.
                </p>
              ) : (
                <ul className="text-xs space-y-1">
                  {summary.fastMovingProducts.slice(0, 4).map((r) => (
                    <li key={r.product.id} className="flex justify-between font-medium">
                      <span>{r.product.name}</span>
                      <span className="font-mono font-bold text-[var(--pos-text)]">
                        {r.turnoverRatio?.toFixed(2)}x ({r.salesOut} u. vendidas)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-[var(--warn-soft)] border border-[var(--warn-border)] space-y-1.5">
              <p className="text-xs font-bold text-[var(--warn-text)] inline-flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Stock crítico o bajo movimiento</span>
              </p>
              {summary.outOfStockProducts.length === 0 &&
              summary.lowStockProducts.length === 0 &&
              summary.slowMovingProducts.length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">
                  No se detectan quiebres de stock ni productos inmovilizados en este momento.
                </p>
              ) : (
                <ul className="text-xs space-y-1">
                  {[
                    ...summary.outOfStockProducts,
                    ...summary.lowStockProducts,
                    ...summary.slowMovingProducts,
                  ]
                    .slice(0, 4)
                    .map((r) => (
                      <li key={r.product.id} className="flex justify-between font-medium">
                        <span>{r.product.name}</span>
                        <span className="font-mono font-bold text-[var(--warn-text)]">
                          {r.statusLabel} ({r.currentStock} u.)
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      {/* BITÁCORA DE MOVIMIENTOS */}
      {recentMovements.length > 0 && (
        <section className="boho-card p-6 space-y-3">
          <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
            Últimos movimientos de inventario ({recentMovements.length})
          </h3>
          <div className="divide-y divide-[var(--border-hairline)]">
            {recentMovements.map((m) => {
              const prod = business.products.find((p) => p.id === m.productId);
              const isIn = m.type === 'purchase' || m.type === 'adjustment_in';
              return (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)] truncate">
                      {prod?.name ?? 'Producto'} ·{' '}
                      <span className="font-normal text-[var(--text-secondary)]">
                        {m.type === 'purchase'
                          ? 'Compra'
                          : m.type === 'sale'
                            ? 'Salida por venta'
                            : m.type === 'damage_loss'
                              ? 'Merma / daño'
                              : 'Ajuste positivo'}
                      </span>
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {m.date} {m.note ? `· ${m.note}` : ''}
                    </p>
                  </div>
                  <span
                    className={`font-mono font-bold inline-flex items-center gap-1 shrink-0 ${
                      isIn ? 'text-[var(--pos-text)]' : 'text-[var(--danger-text)]'
                    }`}
                  >
                    {isIn ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {isIn ? '+' : '-'}
                    {m.quantity} u.
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
