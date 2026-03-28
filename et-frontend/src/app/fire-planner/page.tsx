"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useFirePlannerStore } from "@/store/firePlannerStore";
import { useProfileStore } from "@/store/profileStore";
import { fireDefaultsFromProfile } from "@/lib/fireProfileSync";
import { FIRE_USE_CASES, defaultTargetDateYearsAhead } from "@/lib/firePlannerGuide";
import { formatCurrency } from "@/lib/utils";
import { GOAL_CATEGORIES } from "@/lib/constants";
import {
  Flame,
  Plus,
  Trash2,
  Sparkles,
  Target,
  TrendingUp,
  Shield,
  Wallet,
  BookOpen,
  Table,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Circle,
  CheckCircle2,
} from "lucide-react";

const FIRE_PIPELINE_STEPS = [
  "Reading income, corpus, and life goals…",
  "Inflating expenses to your retirement age…",
  "Computing FIRE corpus (safe withdrawal rule)…",
  "Solving goal SIPs with horizon-matched returns (PMT)…",
  "Simulating glide path month-by-month…",
  "Preparing your roadmap & summary…",
] as const;

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

export default function FirePlannerPage() {
  useAuth();
  const { plan, isGenerating, generatePlan } = useFirePlannerStore();
  const { profile, fetchProfile } = useProfileStore();
  const [guideOpen, setGuideOpen] = useState(true);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [resultVisible, setResultVisible] = useState(false);
  const [resultKey, setResultKey] = useState(0);
  const [syncMsg, setSyncMsg] = useState<{ type: "ok" | "warn"; text: string } | null>(null);

  const [form, setForm] = useState({
    age: 28,
    retirement_age: 50,
    monthly_income: 100000,
    monthly_expenses: 50000,
    existing_corpus: 500000,
    expected_return_rate: 10,
    inflation_rate: 6,
  });

  const [goals, setGoals] = useState<GoalInput[]>([
    {
      name: "Home down payment",
      category: "home",
      target_amount: 2500000,
      current_savings: 150000,
      target_date: defaultTargetDateYearsAhead(7),
      priority: "high",
    },
    {
      name: "Optional: retirement tracker",
      category: "retirement",
      target_amount: 0,
      current_savings: 0,
      target_date: defaultTargetDateYearsAhead(22),
      priority: "low",
    },
  ]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (useFirePlannerStore.getState().plan) setResultVisible(true);
  }, []);

  const [isFilling, setIsFilling] = useState(false);

  const fillFromProfile = async () => {
    setIsFilling(true);
    setSyncMsg(null);
    try {
      await fetchProfile();
      const store = useProfileStore.getState();
      const p = store.profile;
      const d = fireDefaultsFromProfile(p);
      if (!d || (d.existing_corpus <= 0 && d.monthly_expenses <= 0 && d.monthly_income <= 0)) {
        setSyncMsg({
          type: "warn",
          text: "Money Profile is empty or not saved yet. Open Money Profile, fill the form, and save — then try again.",
        });
        return;
      }
      setForm((f) => ({
        ...f,
        existing_corpus: d.existing_corpus > 0 ? d.existing_corpus : f.existing_corpus,
        monthly_expenses: d.monthly_expenses > 0 ? d.monthly_expenses : f.monthly_expenses,
        monthly_income: d.monthly_income > 0 ? d.monthly_income : f.monthly_income,
        expected_return_rate: d.expected_return_rate,
      }));
      const src = store.dbConnected ? "MongoDB" : "local storage";
      setSyncMsg({
        type: "ok",
        text: `Pulled corpus ${formatCurrency(d.existing_corpus)}, income ₹${d.monthly_income.toLocaleString("en-IN")}/mo & expenses ₹${d.monthly_expenses.toLocaleString("en-IN")}/mo from ${src}. Edit any field before generating.`,
      });
      setTimeout(() => setSyncMsg(null), 6000);
    } catch {
      setSyncMsg({ type: "warn", text: "Failed to fetch profile. Check your connection and try again." });
    } finally {
      setIsFilling(false);
    }
  };

  const addGoal = () => setGoals((g) => [...g, emptyGoal()]);

  const addTemplate = (tpl: GoalInput) => setGoals((g) => [...g, { ...tpl }]);

  const removeGoal = (i: number) => setGoals((g) => g.filter((_, idx) => idx !== i));

  const updateGoal = (i: number, field: keyof GoalInput, value: string | number) => {
    setGoals((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      return updated;
    });
  };

  const handleGenerate = async () => {
    const hadPlan = !!useFirePlannerStore.getState().plan;
    setResultVisible(false);
    setPipelineActive(true);
    setPipelineStep(0);
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      for (let i = 0; i < FIRE_PIPELINE_STEPS.length; i++) {
        setPipelineStep(i);
        await delay(480 + i * 40);
      }
      setPipelineStep(FIRE_PIPELINE_STEPS.length);
      await delay(320);
      await generatePlan({ ...form, goals });
      setResultKey((k) => k + 1);
      setResultVisible(true);
    } catch {
      setSyncMsg({ type: "warn", text: "Could not generate plan. Check inputs and try again." });
      if (hadPlan) setResultVisible(true);
    } finally {
      setPipelineActive(false);
      setPipelineStep(0);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg">
          <Flame size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">FIRE Path Planner</h1>
          <p className="text-sm text-slate-500">
            Dated life goals get real SIPs; retirement uses the FIRE corpus (not double-counted).
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setGuideOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 text-left hover:border-slate-600/50 transition-all"
      >
        <span className="text-sm font-medium text-white flex items-center gap-2">
          <BookOpen size={16} className="text-emerald-400" />
          How to use this planner (3 example flows)
        </span>
        {guideOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {guideOpen && (
        <div className="space-y-4 p-5 rounded-2xl bg-slate-900/40 border border-slate-700/40">
          {FIRE_USE_CASES.map((uc) => (
            <div key={uc.title}>
              <p className="text-sm font-semibold text-emerald-400/90 mb-2">{uc.title}</p>
              <ol className="list-decimal list-inside text-sm text-slate-400 space-y-1.5">
                {uc.steps.map((s, i) => (
                  <li key={i} className="leading-relaxed">
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-white">Your profile</h3>
          <button
            type="button"
            onClick={fillFromProfile}
            disabled={isFilling}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            {isFilling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {isFilling ? "Fetching from DB…" : "Fill from Money Profile"}
          </button>
        </div>
        <p className="text-xs text-slate-500 -mt-2">
          Corpus = emergency fund + all investment buckets from{" "}
          <Link href="/money-profile" className="text-emerald-400 hover:underline">
            Money Profile
          </Link>
          . Save there first, then fill here.
        </p>
        {syncMsg && (
          <div
            className={`p-3 rounded-xl text-sm flex flex-wrap items-center gap-2 ${
              syncMsg.type === "ok"
                ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-200/90"
                : "bg-amber-500/10 border border-amber-500/25 text-amber-200/90"
            }`}
          >
            {syncMsg.text}
            {syncMsg.type === "warn" && (
              <Link href="/money-profile" className="text-white font-medium underline shrink-0">
                Open Money Profile
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Age", key: "age", prefix: "" },
            { label: "Retire at", key: "retirement_age", prefix: "" },
            { label: "Monthly income", key: "monthly_income", prefix: "₹" },
            { label: "Monthly expenses", key: "monthly_expenses", prefix: "₹" },
            { label: "Existing corpus", key: "existing_corpus", prefix: "₹" },
            { label: "Expected return %", key: "expected_return_rate", prefix: "" },
            { label: "Inflation %", key: "inflation_rate", prefix: "" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-xs text-slate-500 mb-1.5">{field.label}</label>
              <div className="relative">
                {field.prefix && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">{field.prefix}</span>
                )}
                <input
                  type="number"
                  min={field.key.includes("age") ? 18 : 0}
                  step={1}
                  value={Number.isFinite(form[field.key as keyof typeof form]) ? form[field.key as keyof typeof form] : 0}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm({ ...form, [field.key]: v === "" ? 0 : Number(v) });
                  }}
                  className={`w-full ${field.prefix ? "pl-7" : "pl-3"} pr-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50
                    text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Life goals</h3>
              <p className="text-xs text-slate-500 mt-1">
                Use <strong className="text-slate-400">Home / Education / …</strong> for dated targets. Category{" "}
                <strong className="text-slate-400">Retirement</strong> is informational only (FIRE math covers it).
              </p>
            </div>
            <button
              type="button"
              onClick={addGoal}
              className="flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 shrink-0"
            >
              <Plus size={16} /> Add blank goal
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[11px] text-slate-600 uppercase tracking-wide w-full sm:w-auto sm:mr-1">Quick add</span>
            <button
              type="button"
              onClick={() =>
                addTemplate({
                  name: "Home down payment",
                  category: "home",
                  target_amount: 2000000,
                  current_savings: 0,
                  target_date: defaultTargetDateYearsAhead(6),
                  priority: "high",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-xs text-slate-300 hover:bg-slate-700 border border-slate-600/40"
            >
              + Home
            </button>
            <button
              type="button"
              onClick={() =>
                addTemplate({
                  name: "Child education",
                  category: "education",
                  target_amount: 1500000,
                  current_savings: 0,
                  target_date: defaultTargetDateYearsAhead(12),
                  priority: "high",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-xs text-slate-300 hover:bg-slate-700 border border-slate-600/40"
            >
              + Education
            </button>
            <button
              type="button"
              onClick={() =>
                addTemplate({
                  name: "Wedding",
                  category: "wedding",
                  target_amount: 800000,
                  current_savings: 0,
                  target_date: defaultTargetDateYearsAhead(3),
                  priority: "medium",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-xs text-slate-300 hover:bg-slate-700 border border-slate-600/40"
            >
              + Wedding
            </button>
            <button
              type="button"
              onClick={() =>
                addTemplate({
                  name: "Vehicle",
                  category: "car",
                  target_amount: 1200000,
                  current_savings: 0,
                  target_date: defaultTargetDateYearsAhead(4),
                  priority: "medium",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-xs text-slate-300 hover:bg-slate-700 border border-slate-600/40"
            >
              + Car
            </button>
            <button
              type="button"
              onClick={() =>
                addTemplate({
                  name: "Retirement (tracker)",
                  category: "retirement",
                  target_amount: 0,
                  current_savings: 0,
                  target_date: defaultTargetDateYearsAhead(20),
                  priority: "low",
                })
              }
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-xs text-amber-400/90 hover:bg-amber-500/20 border border-amber-500/25"
            >
              + Retirement note
            </button>
          </div>

          <div className="space-y-3">
            {goals.map((goal, i) => (
              <div
                key={i}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end p-4 rounded-xl bg-slate-900/40 border border-slate-700/30"
              >
                <div className="lg:col-span-1">
                  <label className="block text-xs text-slate-500 mb-1">Goal name</label>
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => updateGoal(i, "name", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Category</label>
                  <select
                    value={goal.category}
                    onChange={(e) => updateGoal(i, "category", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    {GOAL_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Target (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={goal.target_amount}
                    onChange={(e) => updateGoal(i, "target_amount", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Saved (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={goal.current_savings}
                    onChange={(e) => updateGoal(i, "current_savings", Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Target date</label>
                  <input
                    type="date"
                    value={goal.target_date}
                    onChange={(e) => updateGoal(i, "target_date", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeGoal(i)}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all justify-self-start lg:justify-self-center"
                  aria-label="Remove goal"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || pipelineActive}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold
            flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/25 transition-all disabled:opacity-50"
        >
          {pipelineActive || isGenerating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Sparkles size={18} />
          )}
          {pipelineActive ? "Working…" : isGenerating ? "Finalising…" : "Generate FIRE plan"}
        </button>
      </div>

      {pipelineActive && (
        <div
          className="relative overflow-hidden rounded-2xl border border-orange-500/35 bg-slate-900/90 p-8 md:p-10 shadow-xl shadow-orange-500/10"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-red-600/5 fire-gen-core" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative w-28 h-28 mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-orange-400/50 fire-gen-ring opacity-80" />
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500/40 to-red-600/25 flex items-center justify-center border border-orange-400/20">
                <Flame className="text-orange-300 w-12 h-12 drop-shadow-lg" />
              </div>
            </div>
            <p className="text-lg font-semibold text-orange-200 mb-1">Building your plan</p>
            <p className="text-xs text-slate-500 mb-8 max-w-md">
              Deterministic financial engine: inflation, SWR-based FIRE target, goal PMTs, glide path, then roadmap sampling.
            </p>
            <ul className="text-left max-w-lg w-full space-y-3">
              {FIRE_PIPELINE_STEPS.map((label, i) => {
                const done = i < pipelineStep;
                const active = i === pipelineStep;
                return (
                  <li
                    key={label}
                    className={`flex items-start gap-3 text-sm transition-all duration-500 ${
                      done ? "text-emerald-400/95" : active ? "text-white" : "text-slate-600"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0">
                      {done ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : active ? (
                        <Loader2 size={18} className="animate-spin text-orange-400" />
                      ) : (
                        <Circle size={18} className="text-slate-600" />
                      )}
                    </span>
                    <span className={active ? "font-medium" : ""}>{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {plan && resultVisible && (
        <div key={resultKey} className="space-y-6 animate-result-reveal">
          <h3 className="text-xl font-bold text-white">Your FIRE plan</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "FIRE number", value: formatCurrency(plan.fire_number), icon: <Target size={20} />, color: "#f59e0b" },
              { label: "Years to FIRE", value: `${plan.years_to_fire} years`, icon: <TrendingUp size={20} />, color: "#10b981" },
              {
                label: "Total monthly SIP",
                value: formatCurrency(plan.monthly_sip_total ?? plan.monthly_sip_needed),
                icon: <Wallet size={20} />,
                color: "#6366f1",
              },
              { label: "Emergency fund target", value: formatCurrency(plan.emergency_fund_target), icon: <Shield size={20} />, color: "#ef4444" },
            ].map((m) => (
              <div key={m.label} className="p-5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${m.color}20`, color: m.color }}>
                    {m.icon}
                  </div>
                  <span className="text-xs text-slate-500">{m.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color: m.color }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {(plan.monthly_sip_retirement != null || plan.monthly_sip_goals_total != null) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/40">
                <p className="text-xs text-slate-500">Retirement bucket SIP</p>
                <p className="text-lg font-bold text-cyan-400">{formatCurrency(plan.monthly_sip_retirement ?? 0)}/mo</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/40">
                <p className="text-xs text-slate-500">Life goals SIP (non-retirement)</p>
                <p className="text-lg font-bold text-amber-400">{formatCurrency(plan.monthly_sip_goals_total ?? 0)}/mo</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/40">
                <p className="text-xs text-slate-500">SWR (rule-of-thumb)</p>
                <p className="text-lg font-bold text-slate-200">
                  {typeof plan.swr_percent === "number" ? plan.swr_percent.toFixed(2) : "3.50"}% · real ~{plan.real_return_rate_approx ?? "—"}%
                </p>
              </div>
            </div>
          )}

          {plan.methodology && (
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2 text-slate-400 text-sm font-medium">
                <BookOpen size={16} /> How this is calculated
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{plan.methodology}</p>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
            <h4 className="text-lg font-semibold text-white mb-4">Recommended asset allocation (start)</h4>
            <div className="flex gap-2 h-8 rounded-xl overflow-hidden">
              {Object.entries(plan.asset_allocation).map(([key, val]) => {
                const colors: Record<string, string> = {
                  equity: "#10b981",
                  debt: "#6366f1",
                  gold: "#f59e0b",
                  cash: "#64748b",
                };
                return val > 0 ? (
                  <div
                    key={key}
                    style={{ width: `${val}%`, backgroundColor: colors[key] || "#64748b" }}
                    className="flex items-center justify-center text-xs font-bold text-white"
                  >
                    {val}% {key}
                  </div>
                ) : null;
              })}
            </div>
          </div>

          {plan.glide_path_yearly && plan.glide_path_yearly.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-3">Equity glide path (yearly)</h4>
              <p className="text-xs text-slate-500 mb-3">
                Equity weight steps down toward retirement. Gold is part of the non-equity sleeve.
              </p>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 sticky top-0 bg-slate-900/90">
                    <tr>
                      <th className="py-2 pr-3">Age</th>
                      <th className="py-2 pr-3">Equity</th>
                      <th className="py-2 pr-3">Debt</th>
                      <th className="py-2">Gold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.glide_path_yearly.map((row) => (
                      <tr key={row.age} className="border-t border-slate-800/80 text-slate-300">
                        <td className="py-1.5 pr-3">{row.age}</td>
                        <td className="py-1.5 pr-3 text-emerald-400">{row.equity_pct}%</td>
                        <td className="py-1.5 pr-3">{row.debt_pct}%</td>
                        <td className="py-1.5">{row.gold_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {plan.goals && plan.goals.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <h4 className="text-lg font-semibold text-white mb-4">Goals & SIP breakdown</h4>
              <div className="space-y-2 text-sm">
                {plan.goals.map((g, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-700/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-white font-medium">{g.name || g.category}</span>
                        <span className="text-slate-600 text-xs ml-2">({g.category})</span>
                      </div>
                      <span className="text-emerald-400 font-semibold">
                        {g.category === "retirement" ? "—" : `SIP ${formatCurrency(g.sip_required || 0)}/mo`}
                      </span>
                    </div>
                    {g.category !== "retirement" && (
                      <p className="text-xs text-slate-500">
                        Model ~{g.assumed_annual_return_pct ?? "—"}% p.a. · {g.months_to_goal ?? "—"} months to target date
                      </p>
                    )}
                    {g.funding_note && <p className="text-xs text-amber-200/80 leading-relaxed">{g.funding_note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.roadmap && plan.roadmap.length > 0 && (
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-2">
                <Table size={18} className="text-orange-400" />
                <h4 className="text-lg font-semibold text-white">Month-by-month roadmap (sampled)</h4>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Portfolio after each month’s growth + SIP. Long horizons thin to every 3 months after month 36.
              </p>
              <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-slate-700/40">
                <table className="w-full text-xs text-left min-w-[640px]">
                  <thead className="text-slate-500 sticky top-0 bg-slate-950/95 z-10">
                    <tr>
                      <th className="py-2 px-2">Month</th>
                      <th className="py-2 px-2">Age</th>
                      <th className="py-2 px-2">Total</th>
                      <th className="py-2 px-2">Retirement pot</th>
                      <th className="py-2 px-2">SIP total</th>
                      <th className="py-2 px-2">Eq %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.roadmap.map((r) => (
                      <tr key={r.month_index} className="border-t border-slate-800/80 text-slate-300">
                        <td className="py-1.5 px-2 whitespace-nowrap">
                          {r.calendar_label}
                          {r.note && <span className="block text-[10px] text-slate-600">{r.note}</span>}
                        </td>
                        <td className="py-1.5 px-2">{r.age_years}</td>
                        <td className="py-1.5 px-2 text-emerald-400/90">{formatCurrency(r.total_portfolio)}</td>
                        <td className="py-1.5 px-2">{formatCurrency(r.retirement_bucket)}</td>
                        <td className="py-1.5 px-2">{formatCurrency(r.sip_total)}</td>
                        <td className="py-1.5 px-2">{r.recommended_equity_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Summary</span>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">{plan.ai_summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
