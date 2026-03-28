"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import {
  getDefaultLocalProfile,
  useProfileStore,
  type FinancialProfile,
} from "@/store/profileStore";
import { profileCompleteness } from "@/lib/profileCompleteness";
import { investableCorpusFromProfile } from "@/lib/fireProfileSync";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet,
  Save,
  TrendingUp,
  PiggyBank,
  Shield,
  Landmark,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
  WifiOff,
  Loader2,
  RefreshCw,
} from "lucide-react";

const EXP_KEYS = ["rent", "emi", "groceries", "utilities", "entertainment", "education", "other"] as const;
const INV_KEYS = [
  "ppf",
  "epf",
  "nps",
  "elss",
  "fd",
  "stocks",
  "mutual_funds",
  "real_estate",
  "gold",
  "crypto",
  "other",
] as const;

function sumExpenses(m: FinancialProfile["monthly_expenses"]): number {
  return EXP_KEYS.reduce((s, k) => s + (Number(m[k]) || 0), 0);
}

export default function MoneyProfilePage() {
  useAuth();
  const { profile, fetchProfile, saveFullProfile, isLoading, dbConnected, lastSyncedAt } = useProfileStore();
  const [draft, setDraft] = useState<FinancialProfile>(getDefaultLocalProfile());
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    void fetchProfile().then(() => setInitialLoaded(true));
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setDraft({
        ...getDefaultLocalProfile(),
        ...profile,
        annual_income: { ...getDefaultLocalProfile().annual_income, ...profile.annual_income },
        monthly_expenses: { ...getDefaultLocalProfile().monthly_expenses, ...profile.monthly_expenses },
        existing_investments: { ...getDefaultLocalProfile().existing_investments, ...profile.existing_investments },
        emergency_fund: { ...getDefaultLocalProfile().emergency_fund, ...profile.emergency_fund },
        insurance: {
          life: { has_cover: false, sum_assured: 0, premium: 0, ...profile.insurance?.life },
          health: {
            has_cover: false,
            sum_assured: 0,
            premium: 0,
            family_floater: false,
            ...profile.insurance?.health,
          },
        },
        debts: profile.debts?.length ? [...profile.debts] : [],
      });
    }
  }, [profile]);

  const expenseSubtotal = useMemo(() => sumExpenses(draft.monthly_expenses), [draft.monthly_expenses]);
  const investable = useMemo(() => investableCorpusFromProfile(draft), [draft]);
  const complete = useMemo(() => profileCompleteness(draft), [draft]);

  const updateExpense = useCallback((key: (typeof EXP_KEYS)[number], v: number) => {
    setDraft((d) => {
      const monthly_expenses = { ...d.monthly_expenses, [key]: v };
      monthly_expenses.total = sumExpenses(monthly_expenses);
      return { ...d, monthly_expenses };
    });
  }, []);

  const updateInv = useCallback((key: (typeof INV_KEYS)[number], v: number) => {
    setDraft((d) => ({
      ...d,
      existing_investments: { ...d.existing_investments, [key]: v },
    }));
  }, []);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    const monthly_expenses = { ...draft.monthly_expenses, total: expenseSubtotal };
    const toSave: FinancialProfile = { ...draft, monthly_expenses };
    try {
      await saveFullProfile(toSave);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save. Try again.";
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
    ? `Synced to MongoDB${lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ""}`
    : "Offline — saving to browser only";

  if (!initialLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-600 text-white shadow-lg">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Money Profile</h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Your single source of truth — income, spending, investments, safety nets.
              Saved to MongoDB in real time. Used by FIRE planner, Money Health, and couple tools.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 shrink-0">
          <div
            className="relative w-16 h-16 rounded-full border-4 border-slate-700 flex items-center justify-center"
            style={{
              background: `conic-gradient(rgb(52 211 153) ${complete.percent * 3.6}deg, rgb(30 41 59) 0deg)`,
            }}
          >
            <div className="absolute inset-1 rounded-full bg-slate-900 flex items-center justify-center">
              <span className="text-sm font-bold text-emerald-400">{complete.percent}%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Profile strength</p>
            <p className="text-sm font-medium text-white">{complete.label}</p>
            {complete.tips.map((t) => (
              <p key={t} className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                <AlertCircle size={12} className="mt-0.5 text-amber-500 shrink-0" />
                {t}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* DB sync status bar */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium border ${
          dbConnected
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
            : "bg-amber-500/10 border-amber-500/25 text-amber-300"
        }`}
      >
        {dbConnected ? <Database size={14} /> : <WifiOff size={14} />}
        {syncLabel}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isLoading}
          className="ml-auto p-1 rounded hover:bg-white/5 transition-colors disabled:opacity-40"
          title="Re-fetch from database"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Investable corpus banner */}
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center gap-3">
        <Sparkles size={18} className="text-emerald-400" />
        <p className="text-sm text-slate-300 flex-1 min-w-[200px]">
          <strong className="text-emerald-400">Investable corpus (auto):</strong>{" "}
          {formatCurrency(investable)} — emergency + all investment buckets. Used when you tap{" "}
          <span className="text-white font-medium">Fill from Money Profile</span> on the FIRE planner.
        </p>
        <Link
          href="/fire-planner"
          className="text-sm px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
        >
          Open FIRE planner →
        </Link>
      </div>

      {/* Flash messages */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}
      {savedFlash && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 size={16} /> Profile saved to MongoDB. FIRE planner will auto-pick this up.
        </div>
      )}

      {/* Income */}
      <div className="space-y-6 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Landmark size={18} className="text-cyan-400" />
          Income & work
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block text-xs text-slate-500">
            Employment
            <select
              value={draft.employment_type}
              onChange={(e) => setDraft((d) => ({ ...d, employment_type: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            >
              <option value="salaried">Salaried</option>
              <option value="self_employed">Self-employed</option>
              <option value="freelancer">Freelancer</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500">
            Annual gross (₹)
            <input
              type="number"
              min={0}
              value={draft.annual_income.gross}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  annual_income: { ...d.annual_income, gross: Number(e.target.value) },
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Annual net (₹)
            <input
              type="number"
              min={0}
              value={draft.annual_income.net}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  annual_income: { ...d.annual_income, net: Number(e.target.value) },
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            />
          </label>
        </div>
      </div>

      {/* Expenses */}
      <div className="space-y-4 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <PiggyBank size={18} className="text-amber-400" />
          Monthly expenses
        </h2>
        <p className="text-xs text-slate-500">Total updates automatically from the rows below.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EXP_KEYS.map((k) => (
            <label key={k} className="block text-xs text-slate-500 capitalize">
              {k}
              <input
                type="number"
                min={0}
                value={Number(draft.monthly_expenses[k] ?? 0)}
                onChange={(e) => updateExpense(k, Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
              />
            </label>
          ))}
        </div>
        <p className="text-sm text-emerald-400 font-semibold">Computed monthly total: {formatCurrency(expenseSubtotal)}</p>
      </div>

      {/* Investments */}
      <div className="space-y-4 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp size={18} className="text-emerald-400" />
          Investments & assets (₹)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INV_KEYS.map((k) => (
            <label key={k} className="block text-xs text-slate-500 uppercase tracking-wide">
              {k.replace(/_/g, " ")}
              <input
                type="number"
                min={0}
                value={Number(draft.existing_investments[k] ?? 0)}
                onChange={(e) => updateInv(k, Number(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Emergency + Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">Emergency fund</h2>
          <label className="block text-xs text-slate-500">
            Current amount (₹)
            <input
              type="number"
              min={0}
              value={draft.emergency_fund.current_amount}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  emergency_fund: { ...d.emergency_fund, current_amount: Number(e.target.value) },
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Months of expenses covered
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft.emergency_fund.months_covered}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  emergency_fund: { ...d.emergency_fund, months_covered: Number(e.target.value) },
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            />
          </label>
        </div>

        <div className="space-y-4 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield size={18} className="text-violet-400" />
            Risk & tax
          </h2>
          <label className="block text-xs text-slate-500">
            Risk profile
            <select
              value={draft.risk_profile}
              onChange={(e) => setDraft((d) => ({ ...d, risk_profile: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            >
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
              <option value="very_aggressive">Very aggressive</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500">
            Tax regime
            <select
              value={draft.tax_regime}
              onChange={(e) => setDraft((d) => ({ ...d, tax_regime: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm"
            >
              <option value="old">Old</option>
              <option value="new">New</option>
            </select>
          </label>
        </div>
      </div>

      {/* Insurance */}
      <div className="space-y-4 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white">Insurance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30">
            <p className="text-sm font-medium text-white">Life (term)</p>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(draft.insurance.life?.has_cover)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    insurance: {
                      ...d.insurance,
                      life: { ...d.insurance.life, has_cover: e.target.checked },
                    },
                  }))
                }
              />
              I have active cover
            </label>
            <input
              type="number"
              placeholder="Sum assured"
              value={Number(draft.insurance.life?.sum_assured ?? 0)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  insurance: {
                    ...d.insurance,
                    life: { ...d.insurance.life, sum_assured: Number(e.target.value) },
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-white text-sm"
            />
          </div>
          <div className="space-y-3 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30">
            <p className="text-sm font-medium text-white">Health</p>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(draft.insurance.health?.has_cover)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    insurance: {
                      ...d.insurance,
                      health: { ...d.insurance.health, has_cover: e.target.checked },
                    },
                  }))
                }
              />
              I have health cover
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                checked={Boolean(draft.insurance.health?.family_floater)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    insurance: {
                      ...d.insurance,
                      health: { ...d.insurance.health, family_floater: e.target.checked },
                    },
                  }))
                }
              />
              Family floater
            </label>
            <input
              type="number"
              placeholder="Sum insured"
              value={Number(draft.insurance.health?.sum_assured ?? 0)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  insurance: {
                    ...d.insurance,
                    health: { ...d.insurance.health, sum_assured: Number(e.target.value) },
                  },
                }))
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-white text-sm"
            />
          </div>
        </div>
      </div>

      {/* Debts */}
      <div className="space-y-4 p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Debts / loans</h2>
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                debts: [
                  ...d.debts,
                  {
                    type: "loan",
                    principal: 0,
                    outstanding: 0,
                    interest_rate: 0,
                    emi: 0,
                    tenure_months: 0,
                    remaining_months: 0,
                  },
                ],
              }))
            }
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            + Add loan
          </button>
        </div>
        {draft.debts.length === 0 && (
          <p className="text-xs text-slate-600 italic">No debts added yet. Click "+ Add loan" above.</p>
        )}
        <div className="space-y-4">
          {draft.debts.map((debt, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-700/30">
              <input
                placeholder="Type"
                value={String(debt.type ?? "")}
                onChange={(e) => {
                  const next = [...draft.debts];
                  next[i] = { ...next[i], type: e.target.value };
                  setDraft((d) => ({ ...d, debts: next }));
                }}
                className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-xs"
              />
              <input
                type="number"
                placeholder="Outstanding"
                value={Number(debt.outstanding ?? 0)}
                onChange={(e) => {
                  const next = [...draft.debts];
                  next[i] = { ...next[i], outstanding: Number(e.target.value) };
                  setDraft((d) => ({ ...d, debts: next }));
                }}
                className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-xs"
              />
              <input
                type="number"
                placeholder="EMI"
                value={Number(debt.emi ?? 0)}
                onChange={(e) => {
                  const next = [...draft.debts];
                  next[i] = { ...next[i], emi: Number(e.target.value) };
                  setDraft((d) => ({ ...d, debts: next }));
                }}
                className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-xs"
              />
              <input
                type="number"
                placeholder="Rate %"
                value={Number(debt.interest_rate ?? 0)}
                onChange={(e) => {
                  const next = [...draft.debts];
                  next[i] = { ...next[i], interest_rate: Number(e.target.value) };
                  setDraft((d) => ({ ...d, debts: next }));
                }}
                className="px-2 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-white text-xs"
              />
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, debts: d.debts.filter((_, j) => j !== i) }))}
                className="text-xs text-red-400 hover:text-red-300 md:col-span-2"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isLoading}
        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 font-semibold
          flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50"
      >
        {isSaving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Save size={18} />
        )}
        {isSaving ? "Saving to database…" : "Save Money Profile"}
      </button>
    </div>
  );
}
