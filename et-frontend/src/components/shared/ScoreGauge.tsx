"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  size?: number;
  label?: string;
  grade?: string;
}

function strokeForScore(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export default function ScoreGauge({
  score,
  maxScore = 100,
  size = 120,
  label,
  grade,
}: ScoreGaugeProps) {
  const strokeWidth = 8;
  const r = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(Math.max(score / maxScore, 0), 1);
  const color = strokeForScore(score);

  return (
    <div className={cn("flex flex-col items-center gap-2")}>
      {label ? (
        <p className="text-xs font-medium text-slate-400">{label}</p>
      ) : null}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-700/80"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <motion.span
            className="text-2xl font-bold text-white tabular-nums"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {Math.round(score)}
          </motion.span>
          {grade ? (
            <motion.span
              className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wide"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {grade}
            </motion.span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
