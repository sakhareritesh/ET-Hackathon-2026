"use client";

import { useCallback, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, Sparkles, Home, TrendingUp, Shield, Wallet, PieChart, Landmark, ArrowRightLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { callAI } from "@/lib/ai-proxy";
import { isLocalEngineMode } from "@/lib/config";
import {
  computeCouplesPlannerOptimization,
  type CouplesPartnerFields,
  type CouplesPlannerOptimization,
} from "@/lib/engine/couples";
import { formatCurrency, cn } from "@/lib/utils";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";

const defaultA: CouplesPartnerFields = {
  name: "Partner A",
  gross_salary: 1800000,
  basic_salary: 720000,
  hra_received: 360000,
  sec_80c: 120000,
  total_investments: 450000,
  total_debts: 80000,
};

const defaultB: CouplesPartnerFields = {
  name: "Partner B",
  gross_salary: 1400000,
  basic_salary: 560000,
  hra_received: 280000,
  sec_80c: 150000,
  total_investments: 320000,
  total_debts: 120000,
};

const samplePriyaArjunA: CouplesPartnerFields = {
  name: "Priya",
  gross_salary: 2200000,
  basic_salary: 880000,
  hra_received: 440000,
  sec_80c: 140000,
  total_investments: 650000,
  total_debts: 0,
};

const samplePriyaArjunB: CouplesPartnerFields = {
  name: "Arjun",
  gross_salary: 1600000,
  basic_salary: 640000,
  hra_received: 320000,
  sec_80c: 100000,
  total_investments: 380000,
  total_debts: 150000,
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function RupeeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
      <input
        {...props}
        className={cn(
          "w-full rounded-xl border border-slate-700/50 bg-slate-900/60 py-2.5 pl-8 pr-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none",
          props.className
        )}
      />
    </div>
  );
}

export default function CouplesPlannerPage() {
  useAuth();
  const localMode = isLocalEngineMode();
  const [a, setA] = useState<CouplesPartnerFields>(defaultA);
  const [b, setB] = useState<CouplesPartnerFields>(defaultB);
  const [monthlyRent, setMonthlyRent] = useState(35000);
  const [result, setResult] = useState<CouplesPlannerOptimization | null>(null);
  const [loading, setLoading] = useState(false);

  const optimize = useCallback(async () => {
    setLoading(true);
    const local = computeCouplesPlannerOptimization(a, b, monthlyRent);
    try {
      if (localMode) {
        setResult(local);
        return;
      }
      try {
        const ai = await callAI<CouplesPlannerOptimization>("/ai/couples/optimize", {
          partner_a: a,
          partner_b: b,
          monthly_rent: monthlyRent,
        });
        if (ai && typeof ai.combined_optimal_tax === "number") {
          setResult(ai);
          return;
        }
      } catch {
        /* API fallback */
      }
      try {
        const res = await api.post<CouplesPlannerOptimization>("/couples/planner/optimize", {
          partner_a: a,
          partner_b: b,
          monthly_rent: monthlyRent,
        });
        setResult(res.data);
      } catch {
        setResult(local);
      }
    } finally {
      setLoading(false);
    }
  }, [a, b, monthlyRent, localMode]);

  const nameA = a.name.trim() || "Partner A";
  const nameB = b.name.trim() || "Partner B";
  const pctA = result?.income_split_a_pct ?? 50;
  const pctB = 100 - pctA;

  const optCards = result
    ? [
        {
          key: "hra",
          title: "HRA optimization",
          icon: Home,
          savings: result.hra.savings,
          body: `${result.hra.claimant_label} should claim HRA on the shared rent for lower combined tax. ${result.hra.explanation}`,
        },
        {
          key: "80c",
          title: "80C split",
          icon: PieChart,
          savings: result.split_80c.potential_savings,
          body: result.split_80c.suggestion,
        },
        {
          key: "ins",
          title: "Insurance review",
          icon: Shield,
          savings: result.insurance.potential_savings,
          body: result.insurance.suggestion,
        },
        {
          key: "nps",
          title: "NPS strategy",
          icon: Landmark,
          savings: result.nps.potential_savings,
          body: result.nps.suggestion,
        },
        {
          key: "sip",
          title: "SIP split",
          icon: ArrowRightLeft,
          savings: result.sip.potential_savings,
          body: result.sip.suggestion,
        },
      ]
    : [];

  return (
    <div className="min-h-full max-w-6xl space-y-10 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 ring-1 ring-cyan-500/30">
          <Users className="h-7 w-7 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Couples Planner</h1>
          <p className="text-sm text-slate-400">
            Joint inputs for rent, HRA, 80C, and tax regime comparison. Illustrative model; verify with a tax professional.
          </p>
        </div>
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setA({ ...samplePriyaArjunA });
            setB({ ...samplePriyaArjunB });
            setMonthlyRent(40000);
          }}
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
        >
          Load Sample Couple (Priya & Arjun)
        </button>
        <button
          type="button"
          onClick={() => {
            setA({ ...defaultA });
            setB({ ...defaultB });
            setMonthlyRent(35000);
          }}
          className="rounded-xl border border-slate-600/60 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Partner setup */}
      <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-xl backdrop-blur-md">
        <h2 className="mb-6 text-lg font-semibold text-white">Partner setup</h2>
        <div className="grid gap-8 lg:grid-cols-2">
          {(
            [
              { key: "a" as const, label: "Partner A", data: a, set: setA },
              { key: "b" as const, label: "Partner B", data: b, set: setB },
            ] as const
          ).map(({ key, label, data, set }) => (
            <div key={key} className="space-y-3 rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
              <p className="text-sm font-semibold text-emerald-400/90">{label}</p>
              <Field label="Name">
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => set((d) => ({ ...d, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Gross salary (annual)">
                  <RupeeInput
                    type="number"
                    min={0}
                    value={data.gross_salary || ""}
                    onChange={(e) => set((d) => ({ ...d, gross_salary: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Basic salary (annual)">
                  <RupeeInput
                    type="number"
                    min={0}
                    value={data.basic_salary || ""}
                    onChange={(e) => set((d) => ({ ...d, basic_salary: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="HRA received (annual)">
                  <RupeeInput
                    type="number"
                    min={0}
                    value={data.hra_received || ""}
                    onChange={(e) => set((d) => ({ ...d, hra_received: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Section 80C (annual)">
                  <RupeeInput
                    type="number"
                    min={0}
                    value={data.sec_80c || ""}
                    onChange={(e) => set((d) => ({ ...d, sec_80c: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Total investments">
                  <RupeeInput
                    type="number"
                    min={0}
                    value={data.total_investments || ""}
                    onChange={(e) => set((d) => ({ ...d, total_investments: Number(e.target.value) }))}
                  />
                </Field>
                <Field label="Total debts">
                  <RupeeInput
                    type="number"
                    min={0}
                    value={data.total_debts || ""}
                    onChange={(e) => set((d) => ({ ...d, total_debts: Number(e.target.value) }))}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 max-w-md">
          <Field label="Monthly rent (shared)">
            <RupeeInput
              type="number"
              min={0}
              value={monthlyRent || ""}
              onChange={(e) => setMonthlyRent(Number(e.target.value))}
            />
          </Field>
        </div>
        <motion.button
          type="button"
          disabled={loading}
          onClick={optimize}
          whileHover={{ scale: loading ? 1 : 1.02 }}
          whileTap={{ scale: loading ? 1 : 0.98 }}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Optimizing…" : "Optimize Together"}
        </motion.button>
      </section>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Joint dashboard */}
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
                <div className="mb-2 flex items-center gap-2 text-slate-400">
                  <Wallet className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Combined net worth</span>
                </div>
                <p className="text-3xl font-bold tabular-nums text-white">
                  <AnimatedCounter value={Math.round(result.combined_net_worth)} prefix="₹" duration={1.1} />
                </p>
                <p className="mt-2 text-xs text-slate-500">Investments minus debts per partner, summed.</p>
              </div>
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
                <div className="mb-3 flex items-center gap-2 text-slate-400">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Income split (gross)</span>
                </div>
                <div className="flex h-11 overflow-hidden rounded-lg bg-slate-900/80 ring-1 ring-slate-700/50">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctA}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex min-w-0 items-center justify-center bg-gradient-to-r from-emerald-600/90 to-emerald-500/70 px-1 text-xs font-semibold tabular-nums text-white"
                  >
                    {pctA}%
                  </motion.div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctB}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="flex min-w-0 items-center justify-center bg-gradient-to-r from-cyan-600/80 to-cyan-500/60 px-1 text-xs font-semibold tabular-nums text-white"
                  >
                    {pctB}%
                  </motion.div>
                </div>
                <div className="mt-2 flex justify-between gap-2 text-xs text-slate-500">
                  <span className="truncate text-emerald-400/90">{nameA}</span>
                  <span className="truncate text-cyan-400/90">{nameB}</span>
                </div>
              </div>
            </section>

            {/* Optimization cards */}
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Optimization results</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {optCards.map((c, i) => (
                  <motion.div
                    key={c.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-md"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <c.icon className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-400">{c.body}</p>
                    <p className="mt-3 text-sm font-semibold text-cyan-300">
                      Potential savings ~ {formatCurrency(c.savings)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Tax summary */}
            <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
              <h2 className="mb-4 text-lg font-semibold text-white">Combined tax summary</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
                  <p className="text-sm font-medium text-emerald-300">{nameA}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Old regime: {formatCurrency(result.tax_a.old)} (taxable {formatCurrency(result.tax_a.taxable_old)})
                  </p>
                  <p className="text-xs text-slate-500">
                    New regime: {formatCurrency(result.tax_a.new)} (taxable {formatCurrency(result.tax_a.taxable_new)})
                  </p>
                  <p className="mt-2 text-sm text-white">
                    Best: <span className="text-cyan-400">{result.tax_a.best === "old" ? "Old" : "New"} regime</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
                  <p className="text-sm font-medium text-emerald-300">{nameB}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Old regime: {formatCurrency(result.tax_b.old)} (taxable {formatCurrency(result.tax_b.taxable_old)})
                  </p>
                  <p className="text-xs text-slate-500">
                    New regime: {formatCurrency(result.tax_b.new)} (taxable {formatCurrency(result.tax_b.taxable_new)})
                  </p>
                  <p className="mt-2 text-sm text-white">
                    Best: <span className="text-cyan-400">{result.tax_b.best === "old" ? "Old" : "New"} regime</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-slate-700/50 pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Combined optimal tax</p>
                  <p className="text-xl font-bold text-white">{formatCurrency(result.combined_optimal_tax)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Naive (both new regime, HRA on A)</p>
                  <p className="text-xl font-bold text-slate-300">{formatCurrency(result.naive_combined_tax)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total savings vs naive approach</p>
                  <p className="text-xl font-bold text-emerald-400">{formatCurrency(result.total_savings_vs_naive)}</p>
                </div>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <AlgorithmExplanation
        sections={[
          {
            title: "Joint Tax Optimization",
            description:
              "Compares HRA exemption for each partner, optimizes 80C split, evaluates old vs new regime independently, then combines for minimum total tax.",
          },
          {
            title: "Net Worth & Income Split",
            description:
              "Calculates combined net worth (investments minus debts) and visualizes income contribution percentages for informed joint financial decisions.",
          },
        ]}
      />
    </div>
  );
}
