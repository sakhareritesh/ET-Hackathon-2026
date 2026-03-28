"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

const DEFAULT_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6"];

export interface DonutChartProps {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
}

export default function DonutChart({ data, centerLabel, centerValue }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  return (
    <div className="h-[min(22rem,55vh)] w-full rounded-xl bg-slate-900/80 p-4 text-white">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 108, bottom: 8, left: 8 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="82%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            stroke="#0f172a"
            strokeWidth={2}
            isAnimationActive
            animationDuration={750}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${entry.name}`}
                fill={entry.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f8fafc",
            }}
            formatter={(value, _name, item) => {
              const v = typeof value === "number" ? value : Number(value ?? 0);
              const pct = total ? ((v / total) * 100).toFixed(1) : "0";
              const label = (item.payload as DonutSlice)?.name ?? "";
              return [`${v.toLocaleString("en-IN")} (${pct}%)`, label];
            }}
          />
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            formatter={(_value, entry) => {
              const slice = entry.payload as DonutSlice;
              const v = slice?.value ?? 0;
              const pct = total ? ((v / total) * 100).toFixed(1) : "0";
              return `${slice?.name ?? ""} (${pct}%)`;
            }}
            wrapperStyle={{ paddingLeft: 12 }}
          />
          {(centerLabel != null || centerValue != null) && (
            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
              {centerLabel != null && (
                <tspan x="50%" dy={centerValue != null ? "-0.55em" : "0"} fill="#94a3b8" fontSize={11}>
                  {centerLabel}
                </tspan>
              )}
              {centerValue != null && (
                <tspan x="50%" dy={centerLabel != null ? "1.15em" : "0"} fill="#f8fafc" fontSize={17} fontWeight={600}>
                  {centerValue}
                </tspan>
              )}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
