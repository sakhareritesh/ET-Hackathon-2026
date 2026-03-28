"use client";

import { motion } from "framer-motion";

interface WaterfallStep {
  label: string;
  amount: number;
  type: string;
  running_total: number;
}

interface WaterfallChartProps {
  steps: WaterfallStep[];
  maxWidth?: number;
}

const typeColors: Record<string, string> = {
  income: "bg-blue-500",
  deduction: "bg-emerald-500",
  slab: "bg-red-400",
  tax: "bg-red-500",
  cess: "bg-orange-500",
  rebate: "bg-emerald-400",
  total: "bg-slate-400",
};

export default function WaterfallChart({ steps }: WaterfallChartProps) {
  const maxVal = Math.max(...steps.map((s) => Math.abs(s.running_total)), ...steps.map((s) => Math.abs(s.amount)));
  const scale = maxVal > 0 ? 100 / maxVal : 1;

  const formatAmount = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 10000000) return `₹${(abs / 10000000).toFixed(1)}Cr`;
    if (abs >= 100000) return `₹${(abs / 100000).toFixed(1)}L`;
    if (abs >= 1000) return `₹${(abs / 1000).toFixed(1)}K`;
    return `₹${abs.toFixed(0)}`;
  };

  return (
    <div className="space-y-2">
      {steps.map((step, i) => {
        const width = Math.max(Math.abs(step.running_total) * scale, 2);
        const color = typeColors[step.type] || "bg-slate-500";
        const isNegative = step.amount < 0;

        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-48 text-xs text-slate-400 text-right truncate flex-shrink-0">
              {step.label}
            </div>
            <div className="flex-1 relative h-7">
              <motion.div
                className={`h-full rounded-md ${color} flex items-center px-2`}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              >
                <span className="text-xs font-medium text-white whitespace-nowrap">
                  {isNegative ? "−" : ""}{formatAmount(step.amount)}
                </span>
              </motion.div>
            </div>
            <div className="w-20 text-xs text-slate-300 text-right flex-shrink-0">
              {formatAmount(step.running_total)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
