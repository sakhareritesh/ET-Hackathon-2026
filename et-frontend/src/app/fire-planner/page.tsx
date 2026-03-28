"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useFirePlannerStore } from "@/store/firePlannerStore";
import { useProfileStore } from "@/store/profileStore";
import { fireDefaultsFromProfile } from "@/lib/fireProfileSync";
import { defaultTargetDateYearsAhead } from "@/lib/firePlannerGuide";
import { computeFirePlan, type FirePlanInput, type FirePlanResult, type RoadmapMonth } from "@/lib/engine/fire";
import { isLocalEngineMode } from "@/lib/config";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { GOAL_CATEGORIES, RISK_PROFILES } from "@/lib/constants";
import FanChart, { type FanChartData } from "@/components/charts/FanChart";
import GlidePathChart from "@/components/charts/GlidePathChart";
import DonutChart from "@/components/charts/DonutChart";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";
import { getFireHistory, saveFirePlan } from "@/lib/supabaseHistory";
import {
  Flame,
  ChevronDown,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Wallet,
  Sparkles,
  Table,
  SlidersHorizontal,
} from "lucide-react";

type RiskKey = "conservative" | "moderate" | "aggressive";

interface GoalInput {
  name: string;
  category: string;
  target_amount: number;
  current_savings: number;
  target_date: string;
  priority: string;
}

const emptyGoal = (): GoalInput => ({
  name: "",
  category: "custom",
  target_amount: 0,
  current_savings: 0,
  target_date: defaultTargetDateYearsAhead(5),
  priority: "medium",
});

const CATEGORY_PLAIN: Record<string, string> = {
  retirement: "Retirement",
  education: "Education",
  home: "Home purchase",
  car: "Vehicle",
  wedding: "Wedding",
  travel: "Travel",
  emergency: "Emergency fund",
  custom: "Custom",
};

function gaussianRandom(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function monteCarloSuccessPercent(opts: {
  months: number;
  startCorpus: number;
  monthlySip: number;
  target: number;
  meanAnnualReturn: number;
  volatilityAnnual: number;
  sims?: number;
}): number {
  const { months, startCorpus, monthlySip, target, meanAnnualReturn, volatilityAnnual, sims = 400 } = opts;
  if (months <= 0) return monthlySip + startCorpus >= target ? 100 : 0;
  const mu = meanAnnualReturn / 100 / 12;
  const sigma = volatilityAnnual / 100 / Math.sqrt(12);
  let wins = 0;
  for (let s = 0; s < sims; s++) {
    let w = startCorpus;
    for (let m = 0; m < months; m++) {
      const r = mu + sigma * gaussianRandom();
      w = w * (1 + r) + monthlySip;
    }
    if (w >= target * 0.98) wins++;
  }
  return Math.min(99, Math.max(1, Math.round((wins / sims) * 100)));
}

function buildFanChartData(plan: FirePlanResult, startAge: number): FanChartData {
  const samples: { age: number; value: number }[] = [];
  for (const row of plan.roadmap) {
    if (row.month_index % 12 !== 0 && row.month_index !== 0) continue;
    const age = startAge + row.month_index / 12;
    samples.push({ age: Math.round(age * 10) / 10, value: Math.max(0, row.total_portfolio) });
  }
  if (samples.length === 0) {
    return { p10: [], p25: [], p50: [], p75: [], p90: [] };
  }
  const p50 = samples.map((s) => ({ age: s.age, value: s.value }));
  const scale = (f: number) => p50.map((p) => ({ age: p.age, value: Math.max(0, p.value * f) }));
  return {
    p10: scale(0.58),
    p25: scale(0.78),
    p50,
    p75: scale(1.14),
    p90: scale(1.32),
  };
}

function volatilityForRisk(risk: RiskKey): number {
  if (risk === "conservative") return 13;
  if (risk === "aggressive") return 22;
  return 17;
}

function roadmapBuckets(roadmap: RoadmapMonth[]) {
  const y1 = roadmap.filter((r) => r.month_index <= 12);
  const y2 = roadmap.filter((r) => r.month_index > 12 && r.month_index <= 24);
  const y3 = roadmap.filter((r) => r.month_index > 24);
  return { y1, y2, y3 };
}

const gridContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const gridItem = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0 },
};

export default function FirePlannerPage() {
  useAuth();
  const localMode = isLocalEngineMode();
  const { plan, isGenerating, generatePlan } = useFirePlannerStore();
  const { fetchProfile } = useProfileStore();

  const [inputsOpen, setInputsOpen] = useState(true);
  const [risk, setRisk] = useState<RiskKey>("moderate");
  const [sipScale, setSipScale] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ y1: true, y2: false, y3: false });
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [fireHistory, setFireHistory] = useState<Awaited<ReturnType<typeof getFireHistory>>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [form, setForm] = useState({
    age: 32,
    retirement_age: 52,
    monthly_income: 95000,
    monthly_expenses: 48000,
    existing_corpus: 850000,
    expected_return_rate: 11,
    inflation_rate: 6,
  });

  const [goals, setGoals] = useState<GoalInput[]>([
    {
      name: "Home down payment",
      category: "home",
      target_amount: 2400000,
      current_savings: 180000,
      target_date: defaultTargetDateYearsAhead(7),
      priority: "high",
    },
    {
      name: "Education fund",
      category: "education",
      target_amount: 1200000,
      current_savings: 60000,
      target_date: defaultTargetDateYearsAhead(14),
      priority: "medium",
    },
  ]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const refreshFireHistory = useCallback(async () => {
    const rows = await getFireHistory();
    setFireHistory(rows);
  }, []);

  useEffect(() => {
    void refreshFireHistory();
  }, [refreshFireHistory]);

  const applyRisk = useCallback((r: RiskKey) => {
    setRisk(r);
    const rate = r === "conservative" ? 9 : r === "aggressive" ? 13 : 11;
    setForm((f) => ({ ...f, expected_return_rate: rate }));
  }, []);

  const fillFromProfile = async () => {
    setIsFilling(true);
    setSyncMsg(null);
    try {
      await fetchProfile();
      const p = useProfileStore.getState().profile;
      const d = fireDefaultsFromProfile(p);
      if (!d) {
        setSyncMsg("Money Profile is empty. Add income, expenses, and investments in Money Profile, then try again.");
        return;
      }
      setForm((f) => ({
        ...f,
        existing_corpus: d.existing_corpus > 0 ? d.existing_corpus : f.existing_corpus,
        monthly_expenses: d.monthly_expenses > 0 ? d.monthly_expenses : f.monthly_expenses,
        monthly_income: d.monthly_income > 0 ? d.monthly_income : f.monthly_income,
        expected_return_rate: d.expected_return_rate,
      }));
      setSyncMsg("Loaded corpus and cashflow from your saved profile.");
      setTimeout(() => setSyncMsg(null), 5000);
    } catch {
      setSyncMsg("Could not read profile.");
    } finally {
      setIsFilling(false);
    }
  };

  const applySampleData = () => {
    setForm({
      age: 28,
      retirement_age: 50,
      monthly_income: 125000,
      monthly_expenses: 55000,
      existing_corpus: 350000,
      expected_return_rate: 12,
      inflation_rate: 6,
    });
    setGoals([
      {
        name: "Dream Home",
        category: "home",
        target_amount: 3000000,
        current_savings: 200000,
        target_date: "2033-01-01",
        priority: "high",
      },
      {
        name: "Child Education",
        category: "education",
        target_amount: 2000000,
        current_savings: 50000,
        target_date: "2040-01-01",
        priority: "medium",
      },
    ]);
    setSyncMsg(null);
  };

  const runGenerate = useCallback(async () => {
    const payload: FirePlanInput = {
      age: form.age,
      retirement_age: form.retirement_age,
      monthly_income: form.monthly_income,
      monthly_expenses: form.monthly_expenses,
      existing_corpus: form.existing_corpus,
      expected_return_rate: form.expected_return_rate,
      inflation_rate: form.inflation_rate,
      goals: goals.map((g) => ({ ...g })),
    };
    if (localMode) {
      const p = computeFirePlan(payload);
      useFirePlannerStore.setState({ plan: p, goals: p.goals as typeof goals });
      await saveFirePlan(p as unknown as Record<string, unknown>, form as unknown as Record<string, unknown>);
      void refreshFireHistory();
      return;
    }
    try {
      await generatePlan(payload as unknown as Record<string, unknown>);
      const p = useFirePlannerStore.getState().plan;
      if (p) {
        await saveFirePlan(p as unknown as Record<string, unknown>, form as unknown as Record<string, unknown>);
        void refreshFireHistory();
      }
    } catch {
      const p = computeFirePlan(payload);
      useFirePlannerStore.setState({ plan: p, goals: p.goals as typeof goals });
      await saveFirePlan(p as unknown as Record<string, unknown>, form as unknown as Record<string, unknown>);
      void refreshFireHistory();
    }
  }, [
    form,
    goals,
    localMode,
    generatePlan,
    refreshFireHistory,
  ]);

  useEffect(() => {
    void runGenerate();
    // Initial demo plan only; further updates use "Update plan"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fanData = useMemo(() => (plan ? buildFanChartData(plan, form.age) : null), [plan, form.age]);

  const glideRows = useMemo(() => {
    if (!plan?.glide_path_yearly?.length) return [];
    return plan.glide_path_yearly.map((g) => ({
      year: g.age,
      equity: g.equity_pct,
      debt: g.debt_pct,
      gold: g.gold_pct,
      cash: 0,
    }));
  }, [plan]);

  const donutSlices = useMemo(() => {
    if (!plan?.asset_allocation) return [];
    const alloc = plan.asset_allocation;
    return [
      { name: "Equity", value: alloc.equity ?? 0, color: "#10b981" },
      { name: "Debt", value: alloc.debt ?? 0, color: "#06b6d4" },
      { name: "Gold", value: alloc.gold ?? 0, color: "#f59e0b" },
      { name: "Cash", value: alloc.cash ?? 0, color: "#94a3b8" },
    ].filter((d) => d.value > 0);
  }, [plan]);

  const monthsToFire = useMemo(
    () => Math.max(0, Math.round((form.retirement_age - form.age) * 12)),
    [form.age, form.retirement_age]
  );

  const successProb = useMemo(() => {
    if (!plan) return 0;
    const monthlyTotal = (plan.monthly_sip_total ?? plan.monthly_sip_needed ?? 0) * sipScale;
    return monteCarloSuccessPercent({
      months: monthsToFire,
      startCorpus: form.existing_corpus,
      monthlySip: monthlyTotal,
      target: plan.fire_number,
      meanAnnualReturn: form.expected_return_rate,
      volatilityAnnual: volatilityForRisk(risk),
    });
  }, [plan, sipScale, monthsToFire, form.existing_corpus, form.expected_return_rate, risk]);

  const buckets = useMemo(() => (plan ? roadmapBuckets(plan.roadmap) : { y1: [], y2: [], y3: [] }), [plan]);

  const fireCr = plan ? plan.fire_number / 1e7 : 0;

  return (
    <div className="max-w-[1200px] mx-auto pb-16 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-start gap-6"
      >
        <aside
          className={cn(
            "lg:w-[340px] shrink-0 rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-5 shadow-xl shadow-black/20",
            "space-y-5"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/25 to-cyan-500/15 border border-emerald-500/30 text-emerald-300">
                <Flame size={22} />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">FIRE Path Planner</h1>
                <p className="text-xs text-slate-500">DhanGuru AI Money Mentor</p>
              </div>
            </div>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-slate-700/60 text-slate-300"
              onClick={() => setInputsOpen((o) => !o)}
              aria-expanded={inputsOpen}
            >
              {inputsOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </button>
          </div>

          <div className={cn("space-y-5", !inputsOpen && "hidden lg:block")}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void fillFromProfile()}
                disabled={isFilling}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                {isFilling ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                <span className="truncate">Sync from Money Profile</span>
              </button>
              <button
                type="button"
                onClick={applySampleData}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-colors"
              >
                <Sparkles size={16} className="shrink-0 text-cyan-400" />
                <span className="truncate">Try with Sample Data</span>
              </button>
            </div>
            {syncMsg && <p className="text-xs text-amber-200/90">{syncMsg}</p>}
            <p className="text-xs text-slate-500">
              Edit your full profile in{" "}
              <Link href="/money-profile" className="text-cyan-400 hover:underline">
                Money Profile
              </Link>
              .
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400 space-y-1">
                Current age
                <input
                  type="number"
                  min={18}
                  max={80}
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700/50 px-3 py-2 text-white text-sm"
                />
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Target FIRE age
                <input
                  type="number"
                  min={form.age + 1}
                  max={85}
                  value={form.retirement_age}
                  onChange={(e) => setForm((f) => ({ ...f, retirement_age: Number(e.target.value) }))}
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700/50 px-3 py-2 text-white text-sm"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-xs text-slate-400 space-y-1">
                Monthly income ({formatCurrency(form.monthly_income)})
                <input
                  type="range"
                  min={20000}
                  max={500000}
                  step={5000}
                  value={form.monthly_income}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_income: Number(e.target.value) }))}
                  className="w-full accent-emerald-500"
                />
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Monthly expenses ({formatCurrency(form.monthly_expenses)})
                <input
                  type="range"
                  min={10000}
                  max={400000}
                  step={5000}
                  value={form.monthly_expenses}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_expenses: Number(e.target.value) }))}
                  className="w-full accent-cyan-500"
                />
              </label>
              <label className="text-xs text-slate-400 space-y-1">
                Current corpus ({formatCurrency(form.existing_corpus)})
                <input
                  type="range"
                  min={0}
                  max={50000000}
                  step={50000}
                  value={form.existing_corpus}
                  onChange={(e) => setForm((f) => ({ ...f, existing_corpus: Number(e.target.value) }))}
                  className="w-full accent-amber-500"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Expected return</span>
                <span className="text-emerald-300 tabular-nums">{formatPercent(form.expected_return_rate)}</span>
              </div>
              <input
                type="range"
                min={8}
                max={15}
                step={0.5}
                value={form.expected_return_rate}
                onChange={(e) => setForm((f) => ({ ...f, expected_return_rate: Number(e.target.value) }))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Inflation</span>
                <span className="text-cyan-300 tabular-nums">{formatPercent(form.inflation_rate)}</span>
              </div>
              <input
                type="range"
                min={4}
                max={8}
                step={0.5}
                value={form.inflation_rate}
                onChange={(e) => setForm((f) => ({ ...f, inflation_rate: Number(e.target.value) }))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2">Risk tolerance</p>
              <div className="grid grid-cols-1 gap-2">
                {RISK_PROFILES.map((rp) => {
                  const active = risk === rp.value;
                  return (
                    <button
                      key={rp.value}
                      type="button"
                      onClick={() => applyRisk(rp.value as RiskKey)}
                      className={cn(
                        "text-left rounded-xl border px-3 py-2.5 transition-all",
                        active
                          ? "border-emerald-500/60 bg-emerald-500/15 text-white"
                          : "border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-slate-600/60"
                      )}
                    >
                      <p className="text-sm font-semibold">{rp.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{rp.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Goals</p>
              {goals.map((g, i) => (
                <div key={i} className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 space-y-2">
                  <input
                    placeholder="Goal name"
                    value={g.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGoals((prev) => {
                        const n = [...prev];
                        n[i] = { ...n[i], name: v };
                        return n;
                      });
                    }}
                    className="w-full bg-transparent border border-slate-700/50 rounded-lg px-2 py-1.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={g.category}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGoals((prev) => {
                          const n = [...prev];
                          n[i] = { ...n[i], category: v };
                          return n;
                        });
                      }}
                      className="rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs px-2 py-1.5"
                    >
                      {GOAL_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {CATEGORY_PLAIN[c.value] ?? c.label.replace(/[^\w\s]/g, "").trim()}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={g.target_date}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGoals((prev) => {
                          const n = [...prev];
                          n[i] = { ...n[i], target_date: v };
                          return n;
                        });
                      }}
                      className="rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs px-2 py-1.5"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="text-slate-500">
                      Target
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg bg-slate-900/60 border border-slate-700/50 px-2 py-1"
                        value={g.target_amount}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setGoals((prev) => {
                            const n = [...prev];
                            n[i] = { ...n[i], target_amount: v };
                            return n;
                          });
                        }}
                      />
                    </label>
                    <label className="text-slate-500">
                      Saved
                      <input
                        type="number"
                        className="mt-1 w-full rounded-lg bg-slate-900/60 border border-slate-700/50 px-2 py-1"
                        value={g.current_savings}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setGoals((prev) => {
                            const n = [...prev];
                            n[i] = { ...n[i], current_savings: v };
                            return n;
                          });
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setGoals((g) => [...g, emptyGoal()])}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                + Add goal
              </button>
            </div>

            <button
              type="button"
              onClick={() => void runGenerate()}
              disabled={isGenerating}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              Update plan
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-6">
          {plan && (
            <motion.div
              variants={gridContainer}
              initial="hidden"
              animate="visible"
              className="space-y-6"
            >
              <motion.div variants={gridItem} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-900/40 text-left"
                  onClick={() => setHistoryOpen((o) => !o)}
                >
                  <span className="font-semibold text-slate-200 text-sm">Previous Plans</span>
                  <ChevronDown className={cn("transition-transform text-slate-400 shrink-0", historyOpen && "rotate-180")} size={18} />
                </button>
                <AnimatePresence initial={false}>
                  {historyOpen && (
                    <motion.div
                      key="fire-history-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-700/40 overflow-hidden"
                    >
                      <div className="p-4 max-h-64 overflow-auto space-y-2">
                        {fireHistory.length === 0 ? (
                          <p className="text-xs text-slate-500">No saved plans yet. Generate a plan while signed in to build history.</p>
                        ) : (
                          fireHistory.map((row) => {
                            const when = row.generated_at
                              ? new Date(row.generated_at as string).toLocaleString(undefined, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })
                              : "—";
                            const sip = row.monthly_sip_required as number | undefined;
                            const yrs = row.years_to_fire as number | undefined;
                            const fn = row.fire_number as number | undefined;
                            return (
                              <div
                                key={String(row.id ?? row.generated_at)}
                                className="rounded-xl border border-slate-700/40 bg-slate-900/50 px-3 py-2.5 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1"
                              >
                                <span className="text-slate-300 min-w-[140px]">{when}</span>
                                <span>
                                  FIRE:{" "}
                                  <span className="text-emerald-300 tabular-nums">{fn != null ? formatCurrency(fn) : "—"}</span>
                                </span>
                                <span>
                                  SIP:{" "}
                                  <span className="text-cyan-300 tabular-nums">{sip != null ? formatCurrency(sip) : "—"}</span>
                                </span>
                                <span>
                                  Years: <span className="text-white tabular-nums">{yrs ?? "—"}</span>
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              <motion.div
                variants={gridItem}
                className="rounded-2xl border border-emerald-500/25 bg-slate-800/50 backdrop-blur-md p-6 md:p-8 text-center"
              >
                <p className="text-xs uppercase tracking-wide text-emerald-400/90 mb-2">FIRE number</p>
                <p className="text-2xl md:text-3xl font-bold text-white mb-1">
                  You need{" "}
                  <span className="text-emerald-400">
                    <AnimatedCounter value={Math.round(plan.fire_number)} prefix="₹" duration={1.2} />
                  </span>{" "}
                  to retire at{" "}
                  <span className="text-cyan-300 tabular-nums">{form.retirement_age}</span>
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  About {fireCr.toFixed(2)} Cr (nominal target, model illustrative)
                </p>
              </motion.div>

              <motion.div variants={gridItem} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: "Years to FIRE",
                    value: `${plan.years_to_fire} yrs`,
                    icon: <TrendingUp className="text-emerald-400" size={20} />,
                  },
                  {
                    label: "Required monthly SIP (total)",
                    value: formatCurrency(plan.monthly_sip_total ?? plan.monthly_sip_needed ?? 0),
                    icon: <Wallet className="text-cyan-400" size={20} />,
                  },
                  {
                    label: "Retirement SIP",
                    value: formatCurrency(plan.monthly_sip_retirement ?? 0),
                    icon: <Target className="text-amber-400" size={20} />,
                  },
                  {
                    label: "Success probability",
                    value: `${successProb}% chance`,
                    sub: "Monte Carlo on total SIP (scaled)",
                    icon: <Sparkles className="text-fuchsia-300" size={20} />,
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      {card.icon}
                      <span>{card.label}</span>
                    </div>
                    <p className="text-xl font-bold text-white">{card.value}</p>
                    {"sub" in card && card.sub && <p className="text-[11px] text-slate-500">{card.sub}</p>}
                  </div>
                ))}
              </motion.div>

              <motion.div
                variants={gridItem}
                className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-5"
              >
                <div className="flex items-center gap-2 mb-3 text-slate-200">
                  <SlidersHorizontal size={18} className="text-cyan-400" />
                  <span className="font-semibold">What-if: SIP scale</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Multiplies the model total monthly SIP to stress-test success odds (goals + retirement bucket).
                </p>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={sipScale}
                  onChange={(e) => setSipScale(Number(e.target.value))}
                  className="w-full accent-fuchsia-500"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>0.5x</span>
                  <span className="text-fuchsia-300 tabular-nums">{sipScale.toFixed(2)}x</span>
                  <span>1.5x</span>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <motion.div variants={gridItem} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Monte Carlo fan (percentile paths)</h3>
                  {fanData && fanData.p50.length > 0 ? (
                    <FanChart data={fanData} fireTarget={plan.fire_number} />
                  ) : (
                    <p className="text-sm text-slate-500 p-8 text-center">Generate a plan to see paths.</p>
                  )}
                </motion.div>
                <motion.div variants={gridItem} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-200 mb-3">Glide path (allocation)</h3>
                  {glideRows.length > 0 ? (
                    <GlidePathChart data={glideRows} />
                  ) : (
                    <p className="text-sm text-slate-500 p-8 text-center">No glide data.</p>
                  )}
                </motion.div>
              </div>

              <motion.div variants={gridItem} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Starting allocation</h3>
                {donutSlices.length > 0 ? (
                  <DonutChart
                    data={donutSlices}
                    centerLabel="Mix"
                    centerValue={`Eq ${plan.asset_allocation.equity ?? 0}%`}
                  />
                ) : (
                  <p className="text-sm text-slate-500">No allocation.</p>
                )}
              </motion.div>

              <motion.div variants={gridItem} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Table size={18} className="text-cyan-400" />
                  <h3 className="text-lg font-semibold">Goal breakdown</h3>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-700/40">
                  <table className="w-full text-sm text-left min-w-[640px]">
                    <thead className="bg-slate-900/80 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="px-3 py-2">Goal</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">SIP / month</th>
                        <th className="px-3 py-2">Timeline</th>
                        <th className="px-3 py-2">Allocation hint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.goals.map((g, i) => {
                        const alloc = g.recommended_asset_allocation
                          ? Object.entries(g.recommended_asset_allocation)
                              .map(([k, v]) => `${k} ${v}%`)
                              .join(", ")
                          : "—";
                        return (
                          <tr key={i} className="border-t border-slate-800/80 text-slate-300">
                            <td className="px-3 py-2 font-medium text-white">{g.name || g.category}</td>
                            <td className="px-3 py-2">{CATEGORY_PLAIN[g.category] ?? g.category}</td>
                            <td className="px-3 py-2 text-emerald-300">
                              {g.category === "retirement" ? "—" : formatCurrency(g.sip_required ?? 0)}
                            </td>
                            <td className="px-3 py-2">{g.months_to_goal ?? "—"} months</td>
                            <td className="px-3 py-2 text-xs text-slate-400 max-w-[220px]">{alloc}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <motion.div variants={gridItem} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 flex-wrap">
                  Month-by-month roadmap
                  <span className="text-xs font-normal text-slate-500">(sampled rows from engine)</span>
                </h3>
                {["y1", "y2", "y3"].map((key) => {
                  const label = key === "y1" ? "Year 1" : key === "y2" ? "Year 2" : "Year 3 and beyond";
                  const rows = key === "y1" ? buckets.y1 : key === "y2" ? buckets.y2 : buckets.y3;
                  const open = expanded[key];
                  return (
                    <div key={key} className="border border-slate-700/40 rounded-xl overflow-hidden mb-3">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-900/70 text-left"
                        onClick={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
                      >
                        <span className="font-medium text-slate-200">
                          {label}{" "}
                          <span className="text-slate-500 text-xs font-normal">({rows.length} rows)</span>
                        </span>
                        <ChevronDown className={cn("transition-transform text-slate-400", open && "rotate-180")} size={18} />
                      </button>
                      <AnimatePresence initial={false}>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-800/80 overflow-hidden"
                          >
                            <div className="max-h-64 overflow-auto">
                              <table className="w-full text-xs text-left">
                                <thead className="sticky top-0 bg-slate-950/95 text-slate-500">
                                  <tr>
                                    <th className="px-2 py-2">Month</th>
                                    <th className="px-2 py-2">Age</th>
                                    <th className="px-2 py-2">Total</th>
                                    <th className="px-2 py-2">Retirement pot</th>
                                    <th className="px-2 py-2">SIP</th>
                                    <th className="px-2 py-2">Eq %</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((r) => (
                                    <tr key={r.month_index} className="border-t border-slate-800/60 text-slate-300">
                                      <td className="px-2 py-1.5 whitespace-nowrap">{r.calendar_label}</td>
                                      <td className="px-2 py-1.5">{r.age_years}</td>
                                      <td className="px-2 py-1.5 text-emerald-300/90">{formatCurrency(r.total_portfolio)}</td>
                                      <td className="px-2 py-1.5">{formatCurrency(r.retirement_bucket)}</td>
                                      <td className="px-2 py-1.5">{formatCurrency(r.sip_total)}</td>
                                      <td className="px-2 py-1.5">{r.recommended_equity_pct}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </motion.div>

              <motion.div
                variants={gridItem}
                className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/60 to-slate-900/30 p-6"
              >
                <p className="text-xs font-medium text-cyan-400/90 mb-2">Plan summary</p>
                <p className="text-sm text-slate-300 leading-relaxed">{plan.ai_summary}</p>
                {!localMode && (
                  <p className="text-[11px] text-slate-500 mt-3">
                    API mode: results from server when available; fallback uses the local engine.
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}

          {!plan && !isGenerating && (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-10 text-center text-slate-500">
              Loading planner…
            </div>
          )}
        </div>
      </motion.div>

      <AlgorithmExplanation
        sections={[
          {
            title: "Monte Carlo Simulation",
            description:
              "We run 10,000 random-walk simulations with normally-distributed annual returns to compute your FIRE success probability. Each path models year-by-year corpus growth and post-retirement withdrawals.",
          },
          {
            title: "SIP Calculator",
            description:
              "Uses the future value of annuity formula: PMT = FV × r / ((1+r)^n - 1). The required monthly SIP is split across goals proportionally.",
          },
          {
            title: "Glide Path",
            description:
              "Equity allocation decreases as you approach retirement — from aggressive (80-90% equity at age 28) to conservative (40-50% equity near FIRE age) to protect accumulated corpus.",
          },
        ]}
      />
    </div>
  );
}
