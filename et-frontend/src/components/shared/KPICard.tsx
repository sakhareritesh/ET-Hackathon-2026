"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedCounter from "./AnimatedCounter";

export interface KPICardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  className?: string;
}

export default function KPICard({
  title,
  value,
  icon,
  trend,
  subtitle,
  className,
}: KPICardProps) {
  const isNumeric = typeof value === "number";

  return (
    <motion.div
      className={cn(
        "rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-md shadow-lg shadow-black/20",
        className,
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            {isNumeric ? (
              <AnimatedCounter
                value={value}
                className="text-2xl font-bold tracking-tight text-white"
              />
            ) : (
              <span className="text-2xl font-bold tracking-tight text-white">
                {value}
              </span>
            )}
            {trend ? (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-semibold",
                  trend.isPositive ? "text-emerald-400" : "text-red-400",
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                )}
                {Math.abs(trend.value)}%
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25"
          aria-hidden
        >
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
