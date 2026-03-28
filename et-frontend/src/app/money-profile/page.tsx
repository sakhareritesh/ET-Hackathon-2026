"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Database,
  Goal,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
  WifiOff,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  getDefaultLocalProfile,
  useProfileStore,
  type FinancialProfile as StoreFinancialProfile,
} from "@/store/profileStore";

const WIZARD_STORAGE_KEY = "et_finance_money_wizard_v1";

const METRO_KEYWORDS = [
  "mumbai",
  "delhi",
  "bengaluru",
  "bangalore",
  "chennai",
  "kolkata",
  "hyderabad",
  "pune",
];

const INVESTMENT_TYPES = [
  "mutual_fund",
  "ppf",
  "nps",
  "fd",
  "elss",
  "stocks",
  "real_estate",
  "gold",
] as const;

const GOAL_CATEGORIES = ["retirement", "education", "home", "travel", "emergency", "other"] as const;

export interface FinancialProfile {
  age: number;
  city: string;
  is_metro: boolean;
  marital_status: string;
  dependents: number;
  monthly_income: number;
  basic_salary: number;
  hra_received: number;
  other_income: number;
  monthly_expenses: number;
  rent_paid: number;
  expense_breakdown: {
    groceries: number;
    utilities: number;
    transport: number;
    entertainment: number;
    other: number;
  };
  investments: { type: string; name: string; value: number; monthly_sip?: number }[];
  emergency_fund: number;
  life_insurance_cover: number;
  health_insurance_cover: number;
  has_term_plan: boolean;
  total_debts: number;
  monthly_emi: number;
  risk_profile: string;
  retirement_age: number;
  goals: { name: string; category: string; target_amount: number; target_date: string }[];
}

function getDefaultWizardProfile(): FinancialProfile {
  return {
    age: 0,
    city: "",
    is_metro: false,
    marital_status: "single",
    dependents: 0,
    monthly_income: 0,
    basic_salary: 0,
    hra_received: 0,
    other_income: 0,
    monthly_expenses: 0,
    rent_paid: 0,
    expense_breakdown: {
      groceries: 0,
      utilities: 0,
      transport: 0,
      entertainment: 0,
      other: 0,
    },
    investments: [],
    emergency_fund: 0,
    life_insurance_cover: 0,
    health_insurance_cover: 0,
    has_term_plan: false,
    total_debts: 0,
    monthly_emi: 0,
    risk_profile: "moderate",
    retirement_age: 50,
    goals: [],
  };
}

function guessMetro(city: string): boolean {
  const c = city.trim().toLowerCase();
  if (!c) return false;
  return METRO_KEYWORDS.some((k) => c.includes(k));
}

function defaultRetirementAge(age: number): number {
  if (age <= 0) return 50;
  if (age <= 35) return 50;
  if (age <= 45) return 55;
  return 60;
}

function aggregateInvestments(
  items: FinancialProfile["investments"]
): StoreFinancialProfile["existing_investments"] {
  const base = getDefaultLocalProfile().existing_investments;
  const next = { ...base };
  const mapType = (t: string): keyof typeof next => {
    const x = t.toLowerCase();
    if (x === "mutual_fund") return "mutual_funds";
    if (x === "ppf") return "ppf";
    if (x === "nps") return "nps";
    if (x === "fd") return "fd";
    if (x === "elss") return "elss";
    if (x === "stocks") return "stocks";
    if (x === "real_estate") return "real_estate";
    if (x === "gold") return "gold";
    return "other";
  };
  for (const inv of items) {
    const key = mapType(inv.type);
    next[key] = (next[key] || 0) + (Number(inv.value) || 0);
  }
  return next;
}

function wizardToStoreProfile(w: FinancialProfile): StoreFinancialProfile {
  const grossAnnual = Math.max(0, w.monthly_income) * 12;
  const eb = w.expense_breakdown;
  const otherExp =
    eb.other +
    Math.max(0, w.monthly_expenses - w.rent_paid - w.monthly_emi - eb.groceries - eb.utilities - eb.transport - eb.entertainment);

  const debts: StoreFinancialProfile["debts"] = [];
  if (w.total_debts > 0 || w.monthly_emi > 0) {
    debts.push({
      type: "loans",
      outstanding: w.total_debts,
      emi: w.monthly_emi,
    });
  }

  const monthsCovered =
    w.monthly_expenses > 0 ? Math.round((w.emergency_fund / w.monthly_expenses) * 10) / 10 : 0;

  return {
    employment_type: "salaried",
    annual_income: {
      gross: grossAnnual,
      net: Math.round(grossAnnual * 0.85),
    },
    monthly_expenses: {
      rent: w.rent_paid,
      emi: w.monthly_emi,
      groceries: eb.groceries,
      utilities: eb.utilities,
      entertainment: eb.entertainment,
      education: 0,
      other: Math.max(0, otherExp),
      total: w.monthly_expenses,
    },
    existing_investments: aggregateInvestments(w.investments),
    debts,
    insurance: {
      life: {
        has_cover: w.has_term_plan || w.life_insurance_cover > 0,
        sum_assured: w.life_insurance_cover,
        premium: 0,
      },
      health: {
        has_cover: w.health_insurance_cover > 0,
        sum_assured: w.health_insurance_cover,
        premium: 0,
        family_floater: false,
      },
    },
    emergency_fund: {
      current_amount: w.emergency_fund,
      months_covered: monthsCovered,
    },
    risk_profile: w.risk_profile,
    tax_regime: "new",
    salary_structure: {
      basic_salary: w.basic_salary,
      hra_received: w.hra_received,
      other_income: w.other_income,
    },
  };
}

function loadWizardFromStorage(): FinancialProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinancialProfile>;
    const base = getDefaultWizardProfile();
    return {
      ...base,
      ...parsed,
      expense_breakdown: { ...base.expense_breakdown, ...parsed.expense_breakdown },
      investments: Array.isArray(parsed.investments) ? parsed.investments : base.investments,
      goals: Array.isArray(parsed.goals) ? parsed.goals : base.goals,
    };
  } catch {
    return null;
  }
}

function persistWizardLocal(w: FinancialProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(w));
}

function wizardCompletenessPercent(w: FinancialProfile): number {
  let ok = 0;
  const total = 13;
  if (w.age > 0) ok++;
  if (w.city.trim().length > 0) ok++;
  if (w.marital_status) ok++;
  if (w.dependents >= 0) ok++;
  if (w.monthly_income > 0) ok++;
  if (w.monthly_expenses >= 0 && w.rent_paid >= 0) ok++;
  if (w.total_debts >= 0 && w.monthly_emi >= 0) ok++;
  if (w.emergency_fund >= 0) ok++;
  if (w.investments.length > 0) ok++;
  if (w.life_insurance_cover >= 0 && w.health_insurance_cover >= 0) ok++;
  if (w.risk_profile) ok++;
  if (w.retirement_age > w.age && w.retirement_age <= 100) ok++;
  if (w.goals.length > 0 && w.goals.every((g) => g.name.trim() && g.target_amount > 0 && g.target_date)) ok++;
  return Math.round((ok / total) * 100);
}

const inputClass =
  "mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50";

const labelClass = "block text-xs font-medium text-slate-400";

export default function MoneyProfilePage() {
  useAuth();
  const router = useRouter();
  const { fetchProfile, saveFullProfile, isLoading, dbConnected, lastSyncedAt } = useProfileStore();

  const [draft, setDraft] = useState<FinancialProfile>(getDefaultWizardProfile);
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const stored = loadWizardFromStorage();
    if (stored) setDraft(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistWizardLocal(draft);
  }, [draft, hydrated]);

  const completeness = useMemo(() => wizardCompletenessPercent(draft), [draft]);

  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return draft.age > 0 && draft.city.trim().length > 0 && !!draft.marital_status && draft.dependents >= 0;
      case 2:
        return draft.monthly_income > 0;
      case 3:
        return (
          draft.monthly_expenses >= 0 &&
          draft.rent_paid >= 0 &&
          draft.total_debts >= 0 &&
          draft.monthly_emi >= 0
        );
      case 4:
        return draft.emergency_fund >= 0 && draft.investments.every((i) => i.type && i.name.trim() && i.value >= 0);
      case 5:
        return draft.life_insurance_cover >= 0 && draft.health_insurance_cover >= 0;
      case 6:
        return (
          ["conservative", "moderate", "aggressive"].includes(draft.risk_profile) &&
          draft.retirement_age > draft.age &&
          draft.retirement_age <= 100 &&
          draft.goals.length > 0 &&
          draft.goals.every((g) => g.name.trim().length > 0 && g.target_amount > 0 && g.target_date.length > 0)
        );
      default:
        return false;
    }
  }, [step, draft]);

  const setAgeSmartDefaults = useCallback((age: number) => {
    setDraft((d) => {
      const next = { ...d, age };
      if (age > 0) {
        next.retirement_age = defaultRetirementAge(age);
      }
      return next;
    });
  }, []);

  const onCityChange = useCallback((city: string) => {
    setDraft((d) => {
      const metro = guessMetro(city);
      return { ...d, city, is_metro: metro };
    });
  }, []);

  const addInvestment = () => {
    setDraft((d) => ({
      ...d,
      investments: [...d.investments, { type: "mutual_fund", name: "", value: 0 }],
    }));
  };

  const removeInvestment = (idx: number) => {
    setDraft((d) => ({
      ...d,
      investments: d.investments.filter((_, i) => i !== idx),
    }));
  };

  const updateInvestment = (idx: number, patch: Partial<FinancialProfile["investments"][0]>) => {
    setDraft((d) => {
      const next = [...d.investments];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, investments: next };
    });
  };

  const addGoal = () => {
    const y = new Date().getFullYear() + 5;
    setDraft((d) => ({
      ...d,
      goals: [
        ...d.goals,
        {
          name: "",
          category: "other",
          target_amount: 0,
          target_date: `${y}-12-31`,
        },
      ],
    }));
  };

  const removeGoal = (idx: number) => {
    setDraft((d) => ({
      ...d,
      goals: d.goals.filter((_, i) => i !== idx),
    }));
  };

  const updateGoal = (idx: number, patch: Partial<FinancialProfile["goals"][0]>) => {
    setDraft((d) => {
      const next = [...d.goals];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, goals: next };
    });
  };

  const handleSaveAndDashboard = async () => {
    setError(null);
    setIsSaving(true);
    persistWizardLocal(draft);
    try {
      const storeProfile = wizardToStoreProfile(draft);
      await saveFullProfile(storeProfile);
      setSavedFlash(true);
      router.push("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sync. Your answers are saved in this browser.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setError(null);
    await fetchProfile();
  };

  const syncLabel = dbConnected
    ? `Synced to database${lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ""}`
    : "Offline — saving to browser only";

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading Money Profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-600 text-white shadow-lg shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">DhanGuru Money Profile</h1>
            <p className="text-sm text-slate-400 mt-1">
              Step-by-step setup for your AI Money Mentor. Data is saved in this browser and can sync when the API is available.
            </p>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border",
            dbConnected ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300" : "bg-amber-500/10 border-amber-500/25 text-amber-300"
          )}
        >
          {dbConnected ? <Database className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {syncLabel}
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            className="ml-auto p-1 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-40"
            title="Refresh sync status"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/50 backdrop-blur border border-slate-700/50">
          <div
            className="relative w-16 h-16 rounded-full border-4 border-slate-700 flex items-center justify-center shrink-0"
            style={{
              background: `conic-gradient(rgb(52 211 153) ${completeness * 3.6}deg, rgb(30 41 59) 0deg)`,
            }}
          >
            <div className="absolute inset-1 rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-sm font-bold text-emerald-400">{completeness}%</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Profile completeness</p>
            <p className="text-sm font-medium text-white">Fill each step to improve accuracy of insights.</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-500">
            <span>
              Step {step} of 6
            </span>
            <span>{Math.round((step / 6) * 100)}% through</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/50">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              initial={false}
              animate={{ width: `${(step / 6) * 100}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}
        {savedFlash && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Opening dashboard…
          </div>
        )}

        <div className="relative min-h-[420px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              role="region"
              aria-label={`Step ${step}`}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 shadow-xl shadow-black/20"
            >
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <User className="w-5 h-5 text-cyan-400" />
                    Basics
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClass}>
                      Age
                      <input
                        type="number"
                        min={18}
                        max={100}
                        value={draft.age || ""}
                        onChange={(e) => setAgeSmartDefaults(Number(e.target.value))}
                        className={inputClass}
                        placeholder="e.g. 28"
                      />
                    </label>
                    <label className={labelClass}>
                      City
                      <input
                        type="text"
                        value={draft.city}
                        onChange={(e) => onCityChange(e.target.value)}
                        className={inputClass}
                        placeholder="Where you live"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-700/40">
                    <div>
                      <p className="text-sm font-medium text-white">Metro city</p>
                      <p className="text-xs text-slate-500">Auto-detected from common metros; you can override.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, is_metro: !d.is_metro }))}
                      className={cn(
                        "relative h-9 w-14 rounded-full transition-colors",
                        draft.is_metro ? "bg-emerald-600" : "bg-slate-700"
                      )}
                      aria-pressed={draft.is_metro}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform",
                          draft.is_metro ? "left-7" : "left-1"
                        )}
                      />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClass}>
                      Marital status
                      <div className="relative mt-1">
                        <select
                          value={draft.marital_status}
                          onChange={(e) => setDraft((d) => ({ ...d, marital_status: e.target.value }))}
                          className={cn(inputClass, "appearance-none pr-10")}
                        >
                          <option value="single">Single</option>
                          <option value="married">Married</option>
                          <option value="divorced">Divorced</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                      </div>
                    </label>
                    <label className={labelClass}>
                      Dependents
                      <input
                        type="number"
                        min={0}
                        value={draft.dependents}
                        onChange={(e) => setDraft((d) => ({ ...d, dependents: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    Income
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClass}>
                      Monthly income (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.monthly_income || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, monthly_income: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Basic salary (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.basic_salary || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, basic_salary: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      HRA received (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.hra_received || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, hra_received: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Other income (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.other_income || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, other_income: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Building2 className="w-5 h-5 text-amber-400" />
                    Expenses
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClass}>
                      Total monthly expenses (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.monthly_expenses || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, monthly_expenses: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Rent paid (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.rent_paid || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, rent_paid: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClass}>
                      Total outstanding debt (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.total_debts || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, total_debts: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Monthly EMI (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.monthly_emi || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, monthly_emi: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">Optional breakdown (helps planning; totals may differ from the headline expense figure).</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(
                      [
                        ["groceries", "Groceries"],
                        ["utilities", "Utilities"],
                        ["transport", "Transport"],
                        ["entertainment", "Entertainment"],
                        ["other", "Other"],
                      ] as const
                    ).map(([key, lab]) => (
                      <label key={key} className={labelClass}>
                        {lab}
                        <input
                          type="number"
                          min={0}
                          value={draft.expense_breakdown[key] || ""}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              expense_breakdown: {
                                ...d.expense_breakdown,
                                [key]: Number(e.target.value),
                              },
                            }))
                          }
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      Investments
                    </div>
                    <button
                      type="button"
                      onClick={addInvestment}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      <Plus className="w-4 h-4" />
                      Add investment
                    </button>
                  </div>
                  <label className={labelClass}>
                    Emergency fund (₹)
                    <input
                      type="number"
                      min={0}
                      value={draft.emergency_fund || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, emergency_fund: Number(e.target.value) }))}
                      className={inputClass}
                    />
                  </label>
                  <div className="space-y-3">
                    {draft.investments.length === 0 && (
                      <p className="text-sm text-slate-500">No rows yet. Add mutual funds, PPF, NPS, or other holdings.</p>
                    )}
                    {draft.investments.map((inv, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-700/40"
                      >
                        <label className={cn(labelClass, "sm:col-span-3")}>
                          Type
                          <div className="relative mt-1">
                            <select
                              value={inv.type}
                              onChange={(e) => updateInvestment(idx, { type: e.target.value })}
                              className={cn(inputClass, "appearance-none pr-8 text-xs")}
                            >
                              {INVESTMENT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t.replace(/_/g, " ")}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-[calc(50%+6px)] -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                          </div>
                        </label>
                        <label className={cn(labelClass, "sm:col-span-4")}>
                          Name
                          <input
                            type="text"
                            value={inv.name}
                            onChange={(e) => updateInvestment(idx, { name: e.target.value })}
                            className={inputClass}
                            placeholder="e.g. Index fund"
                          />
                        </label>
                        <label className={cn(labelClass, "sm:col-span-2")}>
                          Value (₹)
                          <input
                            type="number"
                            min={0}
                            value={inv.value || ""}
                            onChange={(e) => updateInvestment(idx, { value: Number(e.target.value) })}
                            className={inputClass}
                          />
                        </label>
                        <label className={cn(labelClass, "sm:col-span-2")}>
                          Monthly SIP (optional)
                          <input
                            type="number"
                            min={0}
                            value={inv.monthly_sip ?? ""}
                            onChange={(e) =>
                              updateInvestment(idx, { monthly_sip: Number(e.target.value) || undefined })
                            }
                            className={inputClass}
                          />
                        </label>
                        <div className="sm:col-span-1 flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeInvestment(idx)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            aria-label="Remove investment"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Shield className="w-5 h-5 text-violet-400" />
                    Insurance
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className={labelClass}>
                      Life insurance cover (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.life_insurance_cover || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, life_insurance_cover: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Health insurance cover (₹)
                      <input
                        type="number"
                        min={0}
                        value={draft.health_insurance_cover || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, health_insurance_cover: Number(e.target.value) }))}
                        className={inputClass}
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-700/40">
                    <div>
                      <p className="text-sm font-medium text-white">Term plan</p>
                      <p className="text-xs text-slate-500">I have an active term life policy.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, has_term_plan: !d.has_term_plan }))}
                      className={cn(
                        "relative h-9 w-14 rounded-full transition-colors",
                        draft.has_term_plan ? "bg-emerald-600" : "bg-slate-700"
                      )}
                      aria-pressed={draft.has_term_plan}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-transform",
                          draft.has_term_plan ? "left-7" : "left-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              )}

              {step === 6 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <Goal className="w-5 h-5 text-cyan-400" />
                    Goals and risk
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Risk profile</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(
                        [
                          { id: "conservative", title: "Conservative", desc: "Capital preservation" },
                          { id: "moderate", title: "Moderate", desc: "Balanced growth" },
                          { id: "aggressive", title: "Aggressive", desc: "Higher equity tilt" },
                        ] as const
                      ).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, risk_profile: r.id }))}
                          className={cn(
                            "text-left p-4 rounded-xl border transition-colors",
                            draft.risk_profile === r.id
                              ? "border-emerald-500/60 bg-emerald-500/10"
                              : "border-slate-700/50 bg-slate-900/30 hover:border-slate-600"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-white">{r.title}</span>
                            {draft.risk_profile === r.id && <Check className="w-4 h-4 text-emerald-400" />}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className={labelClass}>
                    Target retirement age
                    <input
                      type="number"
                      min={draft.age + 1}
                      max={100}
                      value={draft.retirement_age || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, retirement_age: Number(e.target.value) }))}
                      className={inputClass}
                    />
                    <span className="text-[11px] text-slate-600 mt-1 block">
                      Suggested from your age: {defaultRetirementAge(draft.age)} (you can change anytime).
                    </span>
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">Financial goals</p>
                    <button
                      type="button"
                      onClick={addGoal}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      <Plus className="w-4 h-4" />
                      Add goal
                    </button>
                  </div>
                  {draft.goals.length === 0 && (
                    <p className="text-sm text-slate-500">Add at least one goal to finish.</p>
                  )}
                  <div className="space-y-3">
                    {draft.goals.map((g, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-700/40"
                      >
                        <label className={cn(labelClass, "sm:col-span-4")}>
                          Name
                          <input
                            type="text"
                            value={g.name}
                            onChange={(e) => updateGoal(idx, { name: e.target.value })}
                            className={inputClass}
                            placeholder="e.g. Child education"
                          />
                        </label>
                        <label className={cn(labelClass, "sm:col-span-3")}>
                          Category
                          <div className="relative mt-1">
                            <select
                              value={g.category}
                              onChange={(e) => updateGoal(idx, { category: e.target.value })}
                              className={cn(inputClass, "appearance-none pr-8")}
                            >
                              {GOAL_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-[calc(50%+6px)] -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                          </div>
                        </label>
                        <label className={cn(labelClass, "sm:col-span-2")}>
                          Target (₹)
                          <input
                            type="number"
                            min={0}
                            value={g.target_amount || ""}
                            onChange={(e) => updateGoal(idx, { target_amount: Number(e.target.value) })}
                            className={inputClass}
                          />
                        </label>
                        <label className={cn(labelClass, "sm:col-span-2")}>
                          By date
                          <input
                            type="date"
                            value={g.target_date.slice(0, 10)}
                            onChange={(e) => updateGoal(idx, { target_date: e.target.value })}
                            className={inputClass}
                          />
                        </label>
                        <div className="sm:col-span-1 flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => removeGoal(idx)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            aria-label="Remove goal"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step <= 1}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-colors",
              step <= 1
                ? "border-slate-800 text-slate-600 cursor-not-allowed"
                : "border-slate-700 text-slate-200 hover:bg-slate-800/80"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end w-full sm:w-auto">
            {step < 6 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(6, s + 1))}
                disabled={!stepValid}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  stepValid
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                )}
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSaveAndDashboard()}
                disabled={!stepValid || isSaving}
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  stepValid && !isSaving
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 hover:shadow-lg hover:shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                )}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save and view dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
