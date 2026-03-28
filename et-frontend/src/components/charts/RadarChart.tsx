"use client";

import {
  Radar,
  RadarChart as ReRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export interface RadarDimension {
  label: string;
  score: number;
  fullMark?: number;
}

export interface RadarChartProps {
  dimensions: RadarDimension[];
}

export default function RadarChart({ dimensions }: RadarChartProps) {
  const data = dimensions.map((d) => ({
    subject: d.label,
    score: d.score,
    fullMark: d.fullMark ?? 100,
  }));
  const maxRadius = Math.max(
    ...data.map((d) => d.fullMark),
    ...data.map((d) => d.score),
    1
  );

  return (
    <div className="h-[min(28rem,70vh)] w-full rounded-xl bg-slate-900/80 p-4 text-white">
      <ResponsiveContainer width="100%" height="100%">
        <ReRadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <defs>
            <linearGradient id="radarScoreFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <PolarGrid stroke="#334155" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#f8fafc", fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, maxRadius]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
            tickCount={5}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#2dd4bf"
            strokeWidth={2}
            fill="url(#radarScoreFill)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
