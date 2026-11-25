import React, { useState } from 'react';
import { SolidCard } from './design-system/GlassCard';

const FIXED_COSTS = 300000;
const VARIABLE_COST_PER_UNIT = 3000;
const PRICE_PER_UNIT = 9000;
const BREAKEVEN_UNITS = 50; // 300.000 / (9.000 - 3.000) = 50 velas
const MAX_UNITS = 100;

function formatClp(val: number): string {
  return `$${Math.round(val).toLocaleString('es-CL')}`;
}

export const BreakEvenExampleChart: React.FC = () => {
  const [units, setUnits] = useState<number>(68);

  const totalRevenue = units * PRICE_PER_UNIT;
  const totalCost = FIXED_COSTS + units * VARIABLE_COST_PER_UNIT;
  const netResult = totalRevenue - totalCost;
  const isProfit = netResult > 0;
  const isExactBreakEven = netResult === 0;

  // Coordenadas del gráfico SVG (viewBox 540x290)
  const padL = 62;
  const padR = 24;
  const padT = 26;
  const padB = 42;
  const plotW = 540 - padL - padR;
  const plotH = 290 - padT - padB;
  const maxMoney = MAX_UNITS * PRICE_PER_UNIT; // $900.000

  const xFor = (u: number) => padL + (u / MAX_UNITS) * plotW;
  const yFor = (money: number) => padT + plotH - (money / maxMoney) * plotH;

  const x0 = xFor(0);
  const xBe = xFor(BREAKEVEN_UNITS);
  const xMax = xFor(MAX_UNITS);
  const xCurrent = xFor(units);

  const yRev0 = yFor(0);
  const yBe = yFor(BREAKEVEN_UNITS * PRICE_PER_UNIT); // $450.000
  const yRevMax = yFor(MAX_UNITS * PRICE_PER_UNIT); // $900.000
  const yCost0 = yFor(FIXED_COSTS); // $300.000
  const yCostMax = yFor(FIXED_COSTS + MAX_UNITS * VARIABLE_COST_PER_UNIT); // $600.000

  const yCurrentRev = yFor(totalRevenue);
  const yCurrentCost = yFor(totalCost);

  return (
    <SolidCard radius="lg" className="p-5 sm:p-7 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.04em] uppercase text-[var(--sec-text)]">
            Taller de velas artesanales · Ejemplo interactivo
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-mono tabular-nums">
            Fijos {formatClp(FIXED_COSTS)} · Variable {formatClp(VARIABLE_COST_PER_UNIT)}/vela ·
            Precio {formatClp(PRICE_PER_UNIT)}/vela
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setUnits(30)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
              units === 30
                ? 'bg-[var(--accent-soft)] border-[var(--accent-soft-border)] text-[var(--accent-strong)] font-bold'
                : 'bg-[var(--bg-soft-alt)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            30 velas
          </button>
          <button
            type="button"
            onClick={() => setUnits(50)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
              units === 50
                ? 'bg-[var(--warn-soft)] border-[var(--warn-border)] text-[var(--warn-text)] font-bold'
                : 'bg-[var(--bg-soft-alt)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            50 velas (cruce)
          </button>
          <button
            type="button"
            onClick={() => setUnits(75)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
              units === 75
                ? 'bg-[var(--pos-soft)] border-[var(--pos-border)] text-[var(--pos-text)] font-bold'
                : 'bg-[var(--bg-soft-alt)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            75 velas
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)] p-3 sm:p-4">
        <svg
          viewBox="0 0 540 290"
          className="w-full h-auto block"
          role="img"
          aria-label="Gráfico de punto de equilibrio para velas artesanales mostrando zona cubriendo costos hasta 50 unidades y zona de ganancia desde 51 unidades en adelante"
        >
          {/* Zona 1: Cubriendo costos (0 a 50 velas) */}
          <polygon
            points={`${x0},${yRev0} ${x0},${yCost0} ${xBe},${yBe}`}
            fill="var(--accent-soft)"
            fillOpacity="0.85"
          />

          {/* Zona 2: Ganancia (50 a 100 velas) */}
          <polygon
            points={`${xBe},${yBe} ${xMax},${yRevMax} ${xMax},${yCostMax}`}
            fill="var(--pos-soft)"
            fillOpacity="0.95"
          />

          {/* Cuadrícula horizontal sutil */}
          {[0, 300000, 450000, 600000, 900000].map((val) => {
            const y = yFor(val);
            return (
              <g key={val}>
                <line
                  x1={padL}
                  y1={y}
                  x2={xMax}
                  y2={y}
                  stroke="var(--border-hairline)"
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? undefined : '3 4'}
                />
                <text
                  x={padL - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary)"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {val === 0 ? '$0' : `$${val / 1000}k`}
                </text>
              </g>
            );
          })}

          {/* Eje vertical */}
          <line
            x1={padL}
            y1={padT}
            x2={padL}
            y2={yRev0}
            stroke="var(--border-hairline)"
            strokeWidth="1.2"
          />

          {/* Etiquetas de zona sobre las áreas */}
          <text
            x={xFor(18)}
            y={yFor(215000)}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--accent-strong)"
            fontFamily="DM Sans, sans-serif"
          >
            Cubriendo costos
          </text>
          <text
            x={xFor(82)}
            y={yFor(660000)}
            textAnchor="middle"
            fontSize="11.5"
            fontWeight="700"
            fill="var(--pos-text)"
            fontFamily="DM Sans, sans-serif"
          >
            Ganancia
          </text>

          {/* Línea punteada del punto de equilibrio (50 velas) */}
          <line
            x1={xBe}
            y1={yBe}
            x2={xBe}
            y2={yRev0}
            stroke="var(--gold-motif)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Línea de Costos totales */}
          <line
            x1={x0}
            y1={yCost0}
            x2={xMax}
            y2={yCostMax}
            stroke="var(--accent-strong)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Línea de Ingresos por ventas */}
          <line
            x1={x0}
            y1={yRev0}
            x2={xMax}
            y2={yRevMax}
            stroke="var(--pos-text)"
            strokeWidth="2.6"
            strokeLinecap="round"
          />

          {/* Indicador del punto de equilibrio exacto */}
          <circle
            cx={xBe}
            cy={yBe}
            r="5.5"
            fill="var(--gold-motif)"
            stroke="var(--bg-surface)"
            strokeWidth="2"
          />
          <rect
            x={xBe - 68}
            y={yBe - 34}
            width="136"
            height="24"
            rx="8"
            fill="var(--bg-surface)"
            stroke="var(--warn-border)"
            strokeWidth="1"
          />
          <text
            x={xBe}
            y={yBe - 18.5}
            textAnchor="middle"
            fontSize="10.5"
            fontWeight="600"
            fill="var(--text-primary)"
            fontFamily="DM Sans, sans-serif"
          >
            Equilibrio: 50 velas
          </text>

          {/* Indicador interactivo actual */}
          <line
            x1={xCurrent}
            y1={Math.min(yCurrentRev, yCurrentCost)}
            x2={xCurrent}
            y2={yRev0}
            stroke="var(--sec-text)"
            strokeWidth="1.2"
            strokeOpacity="0.45"
          />
          <circle
            cx={xCurrent}
            cy={yCurrentRev}
            r="4.2"
            fill="var(--pos-text)"
            stroke="var(--bg-surface)"
            strokeWidth="1.5"
          />
          <circle
            cx={xCurrent}
            cy={yCurrentCost}
            r="4.2"
            fill="var(--accent-strong)"
            stroke="var(--bg-surface)"
            strokeWidth="1.5"
          />

          {/* Etiquetas de líneas al final */}
          <text
            x={xMax - 4}
            y={yRevMax - 8}
            textAnchor="end"
            fontSize="10.5"
            fontWeight="600"
            fill="var(--pos-text)"
            fontFamily="DM Sans, sans-serif"
          >
            Ingresos
          </text>
          <text
            x={xMax - 4}
            y={yCostMax + 14}
            textAnchor="end"
            fontSize="10.5"
            fontWeight="600"
            fill="var(--accent-strong)"
            fontFamily="DM Sans, sans-serif"
          >
            Costos totales
          </text>

          {/* Eje X: unidades */}
          {[0, 25, 50, 75, 100].map((u) => (
            <text
              key={u}
              x={xFor(u)}
              y={274}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={u === 50 ? '700' : '500'}
              fill={u === 50 ? 'var(--warn-text)' : 'var(--text-secondary)'}
              fontFamily="IBM Plex Mono, monospace"
            >
              {u} u.
            </text>
          ))}
        </svg>
      </div>

      {/* Deslizador simple para probar el cruce */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <label htmlFor="candle-units-slider" className="font-semibold text-[var(--text-primary)]">
            Simula tus ventas del mes:{' '}
            <span className="font-mono tabular-nums text-[var(--sec-text)]">
              {units} velas
            </span>
          </label>
          <span
            className={`font-semibold ${
              isExactBreakEven
                ? 'text-[var(--warn-text)]'
                : isProfit
                  ? 'text-[var(--pos-text)]'
                  : 'text-[var(--accent-strong)]'
            }`}
          >
            {isExactBreakEven
              ? 'Punto exacto: cubres tus costos ($0 pérdida)'
              : isProfit
                ? `Zona de ganancia: +${formatClp(netResult)} sobre tus costos`
                : `Cubriendo costos: faltan ${BREAKEVEN_UNITS - units} velas para equilibrar`}
          </span>
        </div>

        <input
          id="candle-units-slider"
          type="range"
          min={0}
          max={MAX_UNITS}
          step={1}
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          className="boho-slider w-full"
        />

        <div className="grid grid-cols-3 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
            <p className="text-[var(--text-secondary)]">Ingresos</p>
            <p className="font-mono tabular-nums text-sm sm:text-base font-semibold text-[var(--text-primary)] mt-0.5">
              {formatClp(totalRevenue)}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-[var(--bg-soft-alt)] border border-[var(--border-hairline)]">
            <p className="text-[var(--text-secondary)]">Costos totales</p>
            <p className="font-mono tabular-nums text-sm sm:text-base font-semibold text-[var(--text-primary)] mt-0.5">
              {formatClp(totalCost)}
            </p>
          </div>
          <div
            className={`p-3 rounded-2xl border ${
              isProfit
                ? 'bg-[var(--pos-soft)] border-[var(--pos-border)]'
                : isExactBreakEven
                  ? 'bg-[var(--warn-soft)] border-[var(--warn-border)]'
                  : 'bg-[var(--accent-soft)] border-[var(--accent-soft-border)]'
            }`}
          >
            <p className="text-[var(--text-secondary)]">
              {isProfit ? 'Ganancia del mes' : isExactBreakEven ? 'Equilibrio' : 'Por cubrir'}
            </p>
            <p
              className={`font-mono tabular-nums text-sm sm:text-base font-semibold mt-0.5 ${
                isProfit
                  ? 'text-[var(--pos-text)]'
                  : isExactBreakEven
                    ? 'text-[var(--warn-text)]'
                    : 'text-[var(--accent-strong)]'
              }`}
            >
              {isProfit ? `+${formatClp(netResult)}` : formatClp(netResult)}
            </p>
          </div>
        </div>
      </div>
    </SolidCard>
  );
};
