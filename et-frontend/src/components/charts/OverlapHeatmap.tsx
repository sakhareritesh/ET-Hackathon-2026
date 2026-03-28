"use client";

import type { CSSProperties } from "react";

export interface OverlapHeatmapProps {
  funds: string[];
  matrix: number[][];
}

function cellClass(isDiagonal: boolean): string {
  if (isDiagonal) {
    return "text-white ring-1 ring-slate-500/80";
  }
  return "text-white";
}

function cellBackground(pct: number, isDiagonal: boolean): CSSProperties {
  if (isDiagonal) {
    return { backgroundColor: "rgb(51 65 85 / 0.95)" };
  }
  const t = Math.max(0, Math.min(100, pct)) / 100;
  const r = Math.round(71 + t * (220 - 71));
  const g = Math.round(85 + t * (38 - 85));
  const b = Math.round(105 + t * (38 - 105));
  return { backgroundColor: `rgb(${r} ${g} ${b})` };
}

export default function OverlapHeatmap({ funds, matrix }: OverlapHeatmapProps) {
  return (
    <div className="overflow-x-auto rounded-xl bg-slate-900/80 p-4 text-slate-100">
      <table className="w-full min-w-70 border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-700 bg-slate-950 px-2 py-2 text-left font-medium text-slate-400" />
            {funds.map((f) => (
              <th
                key={f}
                className="max-w-32 border border-slate-700 bg-slate-950 px-2 py-2 text-center text-xs font-medium text-slate-300"
              >
                <span className="line-clamp-2">{f}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {funds.map((rowLabel, i) => (
            <tr key={rowLabel}>
              <th className="max-w-40 border border-slate-700 bg-slate-950 px-2 py-2 text-left text-xs font-medium text-slate-300">
                <span className="line-clamp-2">{rowLabel}</span>
              </th>
              {funds.map((_, j) => {
                const raw = matrix[i]?.[j];
                const pct = typeof raw === "number" && !Number.isNaN(raw) ? raw : 0;
                const isDiagonal = i === j;
                return (
                  <td
                    key={`${i}-${j}`}
                    className={`border border-slate-700 px-2 py-2 text-center font-mono text-xs ${cellClass(isDiagonal)}`}
                    style={cellBackground(pct, isDiagonal)}
                  >
                    {pct.toFixed(0)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
