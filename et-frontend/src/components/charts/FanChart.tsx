"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

export interface FanPoint {
  age: number;
  value: number;
}

export interface FanChartData {
  p10: FanPoint[];
  p25: FanPoint[];
  p50: FanPoint[];
  p75: FanPoint[];
  p90: FanPoint[];
}

export interface FanChartProps {
  data: FanChartData;
  fireTarget?: number;
}

function mergeFanSeries(input: FanChartData) {
  const map = new Map<
    number,
    { age: number; p10?: number; p25?: number; p50?: number; p75?: number; p90?: number }
  >();
  const ingest = (points: FanPoint[], key: "p10" | "p25" | "p50" | "p75" | "p90") => {
    for (const p of points) {
      const row = map.get(p.age) ?? { age: p.age };
      row[key] = p.value;
      map.set(p.age, row);
    }
  };
  ingest(input.p10, "p10");
  ingest(input.p25, "p25");
  ingest(input.p50, "p50");
  ingest(input.p75, "p75");
  ingest(input.p90, "p90");

  return Array.from(map.values())
    .map((row) => {
      const p10 = row.p10 ?? 0;
      const p25 = row.p25 ?? 0;
      const p50 = row.p50 ?? 0;
      const p75 = row.p75 ?? 0;
      const p90 = row.p90 ?? 0;
      return {
        age: row.age,
        v0: p10,
        v1: Math.max(0, p25 - p10),
        v2: Math.max(0, p50 - p25),
        v3: Math.max(0, p75 - p50),
        v4: Math.max(0, p90 - p75),
      };
    })
    .sort((a, b) => a.age - b.age);
}

export default function FanChart({ data, fireTarget }: FanChartProps) {
  const merged = mergeFanSeries(data);

  return (
    <div className="h-[min(24rem,60vh)] w-full rounded-xl bg-slate-900/80 p-4 text-slate-100">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={merged} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="fanV0" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#b91c1c" stopOpacity={0.75} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="fanV1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.65} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="fanV2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fb923c" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#eab308" stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="fanV3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#facc15" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#4ade80" stopOpacity={0.45} />
            </linearGradient>
            <linearGradient id="fanV4" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            dataKey="age"
            tick={{ fill: "#cbd5e1", fontSize: 11 }}
            tickLine={{ stroke: "#475569" }}
          />
          <YAxis
            tick={{ fill: "#cbd5e1", fontSize: 11 }}
            tickLine={{ stroke: "#475569" }}
            tickFormatter={(v) =>
              v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : `${v}`
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f8fafc",
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(value) => [
              (typeof value === "number" ? value : Number(value)).toLocaleString("en-IN"),
              "",
            ]}
          />
          {fireTarget != null && (
            <ReferenceLine
              y={fireTarget}
              stroke="#f472b6"
              strokeDasharray="6 4"
              label={{
                value: "FIRE target",
                fill: "#fbcfe8",
                fontSize: 11,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="v0"
            stackId="fan"
            stroke="none"
            fill="url(#fanV0)"
            isAnimationActive
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="v1"
            stackId="fan"
            stroke="none"
            fill="url(#fanV1)"
            isAnimationActive
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="v2"
            stackId="fan"
            stroke="none"
            fill="url(#fanV2)"
            isAnimationActive
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="v3"
            stackId="fan"
            stroke="none"
            fill="url(#fanV3)"
            isAnimationActive
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="v4"
            stackId="fan"
            stroke="none"
            fill="url(#fanV4)"
            isAnimationActive
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
