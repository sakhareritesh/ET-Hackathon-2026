"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { callAI } from "@/lib/ai-proxy";
import { isLocalEngineMode } from "@/lib/config";
import {
  computeHealthReport,
  mergeHealthInputs,
  profileToHealthInputs,
  type HealthInputs,
  type HealthReport,
} from "@/lib/engine/health";
import { useProfileStore } from "@/store/profileStore";
import { getScoreColor, cn } from "@/lib/utils";
import { HEALTH_DIMENSIONS } from "@/lib/constants";
import { getHealthHistory, saveHealthScore } from "@/lib/supabaseHistory";
import ScoreGauge from "@/components/shared/ScoreGauge";
import RadarChart from "@/components/charts/RadarChart";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";
import { Activity, RefreshCw, Sparkles, ListChecks, History } from "lucide-react";

const DIMENSION_TITLES: Record<string, string> = {
  emergency: "Emergency Preparedness",
  insurance: "Insurance Coverage",
  investments: "Investment Diversification",
  debt: "Debt Health",
  tax_efficiency: "Tax Efficiency",
  savings: "Retirement Readiness",
};

const RADAR_LABELS: Record<string, string> = {
  emergency: "Emergency",
  insurance: "Insurance",
  investments: "Diversification",
  debt: "Debt",
  tax_efficiency: "Tax",
  savings: "Retirement",
};

const DEMO_INPUTS: HealthInputs = {
  emergency_months: 3,
  has_term_insurance: false,
  health_insurance_ok: true,
  investment_types_count: 3,
  debt_to_income_pct: 38,
  uses_80c: true,
  retirement_savings_rate_pct: 14,
};

const SAMPLE_HEALTH_INPUTS: HealthInputs = {
  emergency_months: 5,
  has_term_insurance: true,
  health_insurance_ok: true,
  investment_types_count: 5,
  debt_to_income_pct: 22,
  uses_80c: true,
  retirement_savings_rate_pct: 18,
};

function letterGrade(score: number): string {
  if (score >= 85) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  if (score >= 45) return "D";
  return "F";
}

function peerPercentileBetter(score: number, age: number): number {
  const base = 18 + score * 0.62;
  const ageAdj = Math.max(-12, Math.min(12, (38 - age) * 0.45));
  return Math.min(94, Math.max(7, Math.round(base + ageAdj)));
}

function fallbackAiActions(report: HealthReport): string[] {
  const dims = HEALTH_DIMENSIONS.map((d) => {
    const x = report.dimensions[d.key];
    if (!x) return null;
    return { key: d.key, score: x.score, action: x.actions[0] };
  }).filter(Boolean) as { key: string; score: number; action: string }[];

  dims.sort((a, b) => a.score - b.score);
  const out: string[] = [];
  for (const d of dims) {
    if (d.action) out.push(d.action);
    if (out.length >= 5) break;
  }
  if (report.ai_summary) out.push(report.ai_summary.slice(0, 140) + (report.ai_summary.length > 140 ? "…" : ""));
  while (out.length < 5) {
    out.push("Review one money habit this week and automate the next contribution.");
  }
  return out.slice(0, 5);
}

async function fetchAiTopFive(report: HealthReport): Promise<string[]> {
  try {
    const res = await callAI<{ actions?: string[] }>("/health/top-actions", {
      overall_score: report.overall_score,
      dimensions: report.dimensions,
      summary: report.ai_summary,
    });
    if (Array.isArray(res?.actions) && res.actions.length > 0) {
      return res.actions.slice(0, 5).map(String);
    }
  } catch {
    /* AI service optional */
  }
  return fallbackAiActions(report);
}

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

type HealthScoreRow = {
  id?: string;
  calculated_at?: string;
  overall_score?: number;
};

export default function MoneyHealthPage() {
  useAuth();
  const localMode = isLocalEngineMode();
  const { profile, fetchProfile } = useProfileStore();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tweaks, setTweaks] = useState<Partial<HealthInputs>>({});
  const [aiActions, setAiActions] = useState<string[]>([]);
  const [scoreHistory, setScoreHistory] = useState<HealthScoreRow[]>([]);

  const derived = useMemo(() => profileToHealthInputs(profile), [profile]);

  const hasMeaningfulProfile = useMemo(() => {
    if (!profile) return false;
    const net = profile.annual_income?.net ?? 0;
    const inv = Object.values(profile.existing_investments || {}).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
    return net > 0 || inv > 0 || (profile.emergency_fund?.months_covered ?? 0) > 0;
  }, [profile]);

  const baseInputs = useMemo(() => {
    if (!hasMeaningfulProfile) return DEMO_INPUTS;
    return derived;
  }, [hasMeaningfulProfile, derived]);

  const mergedInputs = useMemo(
    () => mergeHealthInputs(baseInputs, tweaks),
    [baseInputs, tweaks]
  );

  const userAge = 34;

  const runLocalReport = useCallback(() => {
    setReport(computeHealthReport(mergedInputs));
  }, [mergedInputs]);

  const refreshHistory = useCallback(async () => {
    const rows = await getHealthHistory();
    setScoreHistory(rows as HealthScoreRow[]);
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    runLocalReport();
  }, [runLocalReport]);

  useEffect(() => {
    if (!report) return;
    const t = window.setTimeout(() => {
      void (async () => {
        await saveHealthScore(report as unknown as Record<string, unknown>);
        await refreshHistory();
      })();
    }, 600);
    return () => window.clearTimeout(t);
  }, [report, refreshHistory]);

  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    setAiLoading(true);
    void fetchAiTopFive(report)
      .then((actions) => {
        if (!cancelled) setAiActions(actions);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [report]);

  const recalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      if (localMode) {
        const next = computeHealthReport(mergedInputs);
        setReport(next);
        setAiLoading(true);
        try {
          const actions = await fetchAiTopFive(next);
          setAiActions(actions);
        } finally {
          setAiLoading(false);
        }
        return;
      }
      const res = await api.post<HealthReport>("/health/calculate");
      setReport(res.data);
    } catch {
      setError("Could not refresh from API. Using local engine.");
      setReport(computeHealthReport(mergedInputs));
    } finally {
      setLoading(false);
    }
  };

  const loadFromProfile = async () => {
    setTweaks({});
    await fetchProfile();
  };

  const trySampleData = () => {
    setTweaks(SAMPLE_HEALTH_INPUTS);
  };

  const radarDimensions = useMemo(() => {
    if (!report) return [];
    return HEALTH_DIMENSIONS.map((d) => ({
      label: RADAR_LABELS[d.key] ?? d.label,
      score: report.dimensions[d.key]?.score ?? 0,
      fullMark: 100,
    }));
  }, [report]);

  const comparisonPct = report ? peerPercentileBetter(report.overall_score, userAge) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-12">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-500/30 text-emerald-300">
            <Activity size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Money Health Score</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              DhanGuru AI Money Mentor — six pillars, one snapshot
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void recalculate()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
            bg-slate-800/50 border border-slate-700/50 text-white hover:border-emerald-500/40 hover:bg-slate-800/80
            transition-all disabled:opacity-50 shadow-lg shadow-black/20"
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Recalculate
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col sm:flex-row flex-wrap gap-3"
      >
        <button
          type="button"
          onClick={() => void loadFromProfile()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-emerald-500/20 to-cyan-500/15 border border-emerald-500/40 text-emerald-100
            hover:border-emerald-400/60 hover:from-emerald-500/30 hover:to-cyan-500/25 transition-all shadow-md shadow-emerald-950/30"
        >
          Load from Profile
        </button>
        <button
          type="button"
          onClick={trySampleData}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-sky-500/25 to-cyan-500/20 border border-cyan-400/45 text-cyan-100
            hover:border-sky-400/60 hover:from-sky-500/35 hover:to-cyan-500/30 transition-all shadow-md shadow-cyan-950/30"
        >
          <Sparkles size={16} className="text-cyan-300 shrink-0" />
          Try Sample Data
        </button>
      </motion.div>

      {localMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-5 space-y-4"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fine-tune (local engine)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
            <label className="block space-y-1.5">
              <span className="text-slate-400 text-xs">Emergency fund (months)</span>
              <input
                type="range"
                min={0}
                max={12}
                value={tweaks.emergency_months ?? mergedInputs.emergency_months}
                onChange={(e) => setTweaks((t) => ({ ...t, emergency_months: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <span className="text-slate-300 tabular-nums">
                {tweaks.emergency_months ?? mergedInputs.emergency_months} mo
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-slate-400 text-xs">Debt to income (annual %)</span>
              <input
                type="range"
                min={0}
                max={80}
                value={tweaks.debt_to_income_pct ?? mergedInputs.debt_to_income_pct}
                onChange={(e) => setTweaks((t) => ({ ...t, debt_to_income_pct: Number(e.target.value) }))}
                className="w-full accent-cyan-500"
              />
              <span className="text-slate-300 tabular-nums">
                {tweaks.debt_to_income_pct ?? mergedInputs.debt_to_income_pct}%
              </span>
            </label>
            <label className="block space-y-1.5">
              <span className="text-slate-400 text-xs">Investment buckets used</span>
              <input
                type="range"
                min={1}
                max={8}
                value={tweaks.investment_types_count ?? mergedInputs.investment_types_count}
                onChange={(e) => setTweaks((t) => ({ ...t, investment_types_count: Number(e.target.value) }))}
                className="w-full accent-amber-500"
              />
              <span className="text-slate-300 tabular-nums">
                {tweaks.investment_types_count ?? mergedInputs.investment_types_count}
              </span>
            </label>
          </div>
        </motion.div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">{error}</div>
      )}

      {report && (
        <motion.div variants={container} initial="hidden" animate="visible" className="space-y-10">
          <motion.div variants={item} className="flex flex-col items-center text-center gap-3">
            <ScoreGauge
              score={report.overall_score}
              size={168}
              grade={letterGrade(report.overall_score)}
            />
            <p className="text-sm text-slate-400 max-w-md">
              Overall score blends all six dimensions. Letter grade is a simple rubric, not advice.
            </p>
            <p className="text-sm text-cyan-300/90">
              You score better than{" "}
              <span className="font-semibold text-cyan-200">{comparisonPct}%</span> of users your age (model estimate).
            </p>
          </motion.div>

          <motion.div variants={item} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4 text-center">Dimension map</h2>
            <RadarChart dimensions={radarDimensions} />
          </motion.div>

          <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HEALTH_DIMENSIONS.map((dim) => {
              const data = report.dimensions[dim.key];
              if (!data) return null;
              const title = DIMENSION_TITLES[dim.key] ?? dim.label;
              const topRec = data.actions?.[0] ?? "Keep monitoring this area quarterly.";
              return (
                <motion.div
                  key={dim.key}
                  variants={item}
                  className={cn(
                    "rounded-2xl border border-slate-700/50 p-5",
                    "bg-slate-800/50 backdrop-blur-md shadow-xl shadow-black/20",
                    "hover:border-emerald-500/25 transition-colors"
                  )}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-white leading-snug">{title}</h3>
                    <span
                      className="text-lg font-bold tabular-nums shrink-0"
                      style={{ color: getScoreColor(data.score) }}
                    >
                      {data.score}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-900/80 overflow-hidden mb-2">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${data.score}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{ backgroundColor: getScoreColor(data.score) }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{data.status}</p>
                  <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-700/40 pt-3">
                    <span className="text-slate-500 block mb-1">Top recommendation</span>
                    {topRec}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div
            variants={item}
            className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-6 md:p-8"
          >
            <div className="flex items-center gap-2 mb-5">
              <ListChecks className="text-emerald-400" size={22} />
              <h2 className="text-lg font-semibold">Top 5 action plan</h2>
              {aiLoading && <Sparkles className="text-cyan-400 animate-pulse" size={18} />}
            </div>
            {aiLoading && aiActions.length === 0 ? (
              <p className="text-sm text-slate-500">Preparing suggestions…</p>
            ) : (
              <ol className="space-y-3 list-decimal list-inside text-sm text-slate-200 leading-relaxed">
                {aiActions.map((line, i) => (
                  <li key={i} className="marker:text-emerald-400 pl-1">
                    {line}
                  </li>
                ))}
              </ol>
            )}
          </motion.div>

          <motion.div variants={item} className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-6">
            <p className="text-xs font-medium text-emerald-400/90 mb-2">Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed">{report.ai_summary}</p>
          </motion.div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-md p-5 md:p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <History className="text-emerald-400" size={20} />
          <h2 className="text-lg font-semibold">Score History</h2>
        </div>
        {scoreHistory.length === 0 ? (
          <p className="text-sm text-slate-500">
            No saved scores yet. Sign in and run a calculation to build your history.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scoreHistory.map((row) => (
              <li
                key={row.id ?? String(row.calculated_at)}
                className="rounded-xl border border-slate-700/50 bg-slate-900/50 px-4 py-3 flex flex-col gap-1"
              >
                <span className="text-xs text-slate-500">
                  {row.calculated_at
                    ? new Date(row.calculated_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "—"}
                </span>
                <span
                  className="text-xl font-bold tabular-nums"
                  style={{ color: getScoreColor(row.overall_score ?? 0) }}
                >
                  {row.overall_score ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <AlgorithmExplanation
        sections={[
          {
            title: "Weighted Multi-Dimensional Scoring",
            description:
              "Six dimensions scored 0-100 with weights [0.20, 0.15, 0.20, 0.15, 0.10, 0.20]. Emergency: months/6. Insurance: life cover ratio + health flags. Investment: asset class count. Debt: 1 - DTI/0.5. Tax: deductions utilization. Retirement: corpus/target.",
          },
          {
            title: "Peer Comparison Model",
            description:
              "Your score is compared against a modeled distribution of users in your age bracket. The percentile is computed using a heuristic based on score and age offset.",
          },
        ]}
      />
    </div>
  );
}
