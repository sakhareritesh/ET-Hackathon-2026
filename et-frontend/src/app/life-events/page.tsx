"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift,
  Heart,
  Baby,
  Home,
  Briefcase,
  Palmtree,
  Package,
  Rocket,
  Hospital,
  Calendar,
  Sparkles,
  Clock,
  Shield,
  ListChecks,
  Route,
  Loader2,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { callAI } from "@/lib/ai-proxy";
import { isLocalEngineMode } from "@/lib/config";
import { computeLifeEventAdvice, type LifeEventAdvice } from "@/lib/engine/lifeEvents";
import { formatCurrency, cn } from "@/lib/utils";
import { LIFE_EVENTS, RISK_PROFILES } from "@/lib/constants";
import { useProfileStore } from "@/store/profileStore";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";

const ICON_BY_KEY: Record<string, LucideIcon> = {
  Gift,
  Heart,
  Baby,
  Home,
  Briefcase,
  Palmtree,
  Package,
  Rocket,
  Hospital,
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  bonus: "One-time inflow; plan tax, liquidity, and long-term deployment.",
  marriage: "Align goals, joint cash flow, and protection for two incomes.",
  child_birth: "Higher fixed costs; insurance and education planning early.",
  home_purchase: "EMI stress-test, loan-linked cover, and tax treatment.",
  job_change: "Bridge benefits, PF, and new employer declarations.",
  retirement: "Drawdown planning, buckets, and post-employment cover.",
  inheritance: "Park, plan, and deploy without rushed concentration risk.",
  business_start: "Separate books, runway, and liability versus personal assets.",
  medical_emergency: "Liquidity, claims, and orderly liquidation order.",
};

const DESCRIPTION_PLACEHOLDERS: Record<string, string> = {
  bonus:
    "I received a ₹5 lakh annual bonus and want to maximize tax savings while building an emergency fund...",
  marriage:
    "We're planning our wedding in 6 months with a budget of ₹15 lakh. Need advice on joint financial planning...",
  child_birth:
    "Expecting our first child in 3 months. Need to plan for maternity costs, insurance updates, and education fund...",
  home_purchase:
    "Looking to buy a 2BHK apartment worth ₹80 lakh with 20% down payment. Need EMI planning and tax benefits guidance...",
  job_change:
    "Switching jobs with a 40% salary hike. Need help with PF transfer, new tax declarations, and notice period...",
  retirement:
    "Planning to retire in 5 years at age 55. Current corpus is ₹2 crore. Need drawdown strategy...",
  inheritance:
    "Received ₹30 lakh inheritance. Need advice on investment deployment without rushed decisions...",
  business_start:
    "Starting a consulting business while keeping my job. Need advice on structuring, compliance, and runway...",
  medical_emergency:
    "Unexpected surgery costing ₹8 lakh. Need guidance on insurance claims and managing emergency fund...",
};

const ALGORITHM_SECTIONS = [
  {
    title: "Agentic AI Pipeline",
    description:
      "LLM classifies intent, extracts event parameters, calls relevant calculators (tax, insurance, SIP), then formats a structured action plan with timelines and checklists.",
  },
  {
    title: "Context-Aware Advice",
    description:
      "Your financial profile (income, risk tolerance, existing insurance) is automatically factored into recommendations for personalized, actionable guidance.",
  },
];

function normalizeAdvice(raw: Partial<LifeEventAdvice> | null | undefined, fallback: LifeEventAdvice): LifeEventAdvice {
  return {
    summary: typeof raw?.summary === "string" ? raw.summary : fallback.summary,
    tax_implications: typeof raw?.tax_implications === "string" ? raw.tax_implications : fallback.tax_implications,
    investment_recommendations: Array.isArray(raw?.investment_recommendations)
      ? (raw.investment_recommendations as LifeEventAdvice["investment_recommendations"])
      : fallback.investment_recommendations,
    insurance_changes: Array.isArray(raw?.insurance_changes) ? raw.insurance_changes! : fallback.insurance_changes,
    action_checklist: Array.isArray(raw?.action_checklist)
      ? (raw.action_checklist as LifeEventAdvice["action_checklist"])
      : fallback.action_checklist,
    timeline: Array.isArray(raw?.timeline) ? raw.timeline! : fallback.timeline,
  };
}

function SampleResultPreviewSkeleton() {
  const bar = (w: string) => (
    <div className={cn("h-2.5 rounded-full bg-slate-600/40 animate-pulse", w)} />
  );
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-slate-600/50 bg-slate-900/25 p-6 backdrop-blur-sm"
      aria-hidden
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700/40">
          <Eye className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-400">Sample Result Preview</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Illustrative layout — your personalized sections appear here after you run the analysis.
          </p>
        </div>
      </div>
      <div className="pointer-events-none space-y-4 opacity-60">
        <div className="rounded-xl border border-slate-700/35 bg-slate-800/30 p-4">
          <div className="mb-2 h-3 w-24 rounded bg-slate-600/35" />
          {bar("w-full")}
          {bar("w-[92%]")}
          {bar("w-[78%]")}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700/35 bg-slate-800/30 p-4">
            <div className="mb-2 h-3 w-32 rounded bg-slate-600/35" />
            {bar("w-full")}
            {bar("w-[88%]")}
          </div>
          <div className="rounded-xl border border-slate-700/35 bg-slate-800/30 p-4">
            <div className="mb-2 h-3 w-36 rounded bg-slate-600/35" />
            <div className="space-y-2">
              {bar("w-full")}
              {bar("w-[95%]")}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/35 bg-slate-800/30 p-4">
          <div className="mb-3 h-3 w-48 rounded bg-slate-600/35" />
          <div className="space-y-3">
            <div className="flex flex-col gap-2 rounded-lg border border-slate-700/30 bg-slate-900/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 space-y-2">
                {bar("w-3/4")}
                {bar("w-1/2")}
              </div>
              <div className="h-6 w-20 shrink-0 rounded-md bg-slate-600/30" />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-700/30 bg-slate-900/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 space-y-2">
                {bar("w-2/3")}
                {bar("w-3/5")}
              </div>
              <div className="h-6 w-24 shrink-0 rounded-md bg-slate-600/30" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/35 bg-slate-800/30 p-4">
          <div className="mb-3 h-3 w-40 rounded bg-slate-600/35" />
          <div className="space-y-2">
            {bar("w-full")}
            {bar("w-[90%]")}
            {bar("w-[85%]")}
          </div>
        </div>
        <div className="rounded-xl border border-slate-700/35 bg-slate-800/30 p-4">
          <div className="mb-3 h-3 w-28 rounded bg-slate-600/35" />
          <ul className="space-y-3 border-l border-slate-700/40 pl-4">
            {[0, 1, 2].map((i) => (
              <li key={i} className="relative space-y-1.5">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-slate-600/50" />
                {bar("w-2/3")}
                {bar("w-1/3")}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-slate-600">
        Summary · Tax implications · Insurance · Investment recommendations · Action checklist · Timeline
      </p>
    </motion.section>
  );
}

export default function LifeEventsPage() {
  useAuth();
  const localMode = isLocalEngineMode();
  const { profile, fetchProfile } = useProfileStore();

  const [selectedEvent, setSelectedEvent] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [annualIncome, setAnnualIncome] = useState<number>(0);
  const [riskProfile, setRiskProfile] = useState<string>("moderate");
  const [advice, setAdvice] = useState<LifeEventAdvice | null>(null);
  const [checklistDone, setChecklistDone] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const g = profile?.annual_income?.gross ?? 0;
    const r = profile?.risk_profile;
    if (g > 0) setAnnualIncome(g);
    if (r && ["conservative", "moderate", "aggressive"].includes(r)) setRiskProfile(r);
  }, [profile]);

  const profileHasIncome = (profile?.annual_income?.gross ?? 0) > 0;
  const profileHasRisk = !!profile?.risk_profile && ["conservative", "moderate", "aggressive"].includes(profile.risk_profile);
  const showExtraDemographics = !profileHasIncome || !profileHasRisk;

  const contextLine = useMemo(() => {
    const inc = profileHasIncome ? (profile?.annual_income?.gross ?? annualIncome) : annualIncome;
    const risk = profileHasRisk ? profile!.risk_profile : riskProfile;
    if (!inc && !risk) return "";
    return ` Context: annual income ${formatCurrency(inc || 0)}, risk ${risk}.`;
  }, [profile, profileHasIncome, profileHasRisk, annualIncome, riskProfile]);

  const descriptionPlaceholder =
    DESCRIPTION_PLACEHOLDERS[selectedEvent] ?? "What happened, constraints, or goals…";

  const fillSampleData = useCallback(() => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedEvent("bonus");
    setEventDate(today);
    setAmount(500000);
    setDescription(
      "I received a ₹5 lakh annual performance bonus and want to maximize tax savings while building my emergency fund"
    );
    setAdvice(null);
    setChecklistDone({});
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    const dateStr = eventDate || new Date().toISOString().split("T")[0];
    const fallback = computeLifeEventAdvice({
      event_type: selectedEvent,
      event_date: dateStr,
      amount,
      description: description + contextLine,
    });

    try {
      if (localMode) {
        setAdvice(fallback);
        setChecklistDone({});
        return;
      }

      try {
        const ai = await callAI<Partial<LifeEventAdvice>>("/ai/events/advise", {
          event_type: selectedEvent,
          event_date: dateStr,
          amount,
          description: description + contextLine,
        });
        if (ai && typeof ai.summary === "string") {
          setAdvice(normalizeAdvice(ai, fallback));
          setChecklistDone({});
          return;
        }
      } catch {
        /* try API */
      }

      try {
        const createRes = await api.post<{ id: string }>("/events", {
          event_type: selectedEvent,
          event_date: dateStr,
          amount,
          description: description + contextLine,
        });
        const adviceRes = await api.post<Partial<LifeEventAdvice>>(`/events/${createRes.data.id}/advise`);
        setAdvice(normalizeAdvice(adviceRes.data, fallback));
      } catch {
        setAdvice(fallback);
      }
      setChecklistDone({});
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, eventDate, amount, description, contextLine, localMode]);

  return (
    <div className="min-h-full max-w-6xl space-y-10 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 ring-1 ring-emerald-500/30">
          <Calendar className="h-7 w-7 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Life Events</h1>
          <p className="text-sm text-slate-400">
            Plan taxes, investments, insurance, and milestones around major life transitions.
          </p>
        </div>
      </motion.div>

      {/* Event selector */}
      <section className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-xl shadow-black/20 backdrop-blur-md">
        <h2 className="mb-4 text-lg font-semibold text-white">Choose a life event</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LIFE_EVENTS.map((evt, i) => {
            const Icon = ICON_BY_KEY[evt.icon] ?? Gift;
            const selected = selectedEvent === evt.value;
            return (
              <motion.button
                key={evt.value}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => {
                  setSelectedEvent(evt.value);
                  setAdvice(null);
                  setChecklistDone({});
                }}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all",
                  selected
                    ? "border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_24px_-4px_rgba(52,211,153,0.45)]"
                    : "border-slate-700/50 bg-slate-900/30 hover:border-slate-600/80 hover:bg-slate-900/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      selected ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800/80 text-cyan-400/90"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-medium text-white">{evt.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {EVENT_DESCRIPTIONS[evt.value] ?? "Tailored guidance for this milestone."}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      <AnimatePresence mode="wait">
        {selectedEvent && (
          <motion.div
            key="form-block"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6 overflow-hidden"
          >
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-xl backdrop-blur-md"
            >
              <h2 className="mb-4 text-lg font-semibold text-white">Event details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Event date
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Amount involved
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={amount || ""}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 py-2.5 pl-8 pr-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder={descriptionPlaceholder}
                    className="w-full resize-y rounded-xl border border-slate-700/50 bg-slate-900/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
                {showExtraDemographics && (
                  <>
                    {!profileHasIncome && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Annual income (gross)
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                          <input
                            type="number"
                            min={0}
                            value={annualIncome || ""}
                            onChange={(e) => setAnnualIncome(Number(e.target.value))}
                            className="w-full rounded-xl border border-slate-700/50 bg-slate-900/60 py-2.5 pl-8 pr-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                    {!profileHasRisk && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                          Risk profile
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {RISK_PROFILES.map((r) => (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => setRiskProfile(r.value)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                riskProfile === r.value
                                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-300"
                                  : "border-slate-700/50 text-slate-400 hover:border-slate-600"
                              )}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <motion.button
                  type="button"
                  disabled={loading}
                  onClick={runAnalysis}
                  whileHover={{ scale: loading ? 1 : 1.02 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50 sm:min-w-[180px]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? "Analyzing…" : "Get AI Advice"}
                </motion.button>
                <button
                  type="button"
                  onClick={fillSampleData}
                  disabled={loading}
                  className="rounded-xl border border-slate-600/80 bg-slate-900/50 px-5 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-emerald-500/40 hover:bg-slate-800/60 hover:text-white disabled:opacity-50"
                >
                  Try Sample Data
                </button>
              </div>
            </motion.section>

            <AnimatePresence>
              {selectedEvent && !advice && <SampleResultPreviewSkeleton key="preview" />}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {advice && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-6 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2 text-emerald-400">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">Summary</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-200">{advice.summary}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-md">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="text-cyan-400">Tax implications</span>
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">{advice.tax_implications}</p>
              </div>
              <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-md">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Shield className="h-4 w-4 text-emerald-400" />
                  Insurance changes
                </h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  {advice.insurance_changes.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500/80" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
              <h3 className="mb-4 text-sm font-semibold text-white">Investment recommendations</h3>
              <div className="space-y-3">
                {advice.investment_recommendations.map((rec, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {rec.instrument}
                        {rec.amount > 0 ? ` — ${formatCurrency(rec.amount)}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{rec.reason}</p>
                    </div>
                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium",
                        rec.urgency === "immediate"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-amber-500/15 text-amber-200"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {rec.urgency}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <ListChecks className="h-4 w-4 text-emerald-400" />
                Action checklist
              </h3>
              <div className="space-y-2">
                {advice.action_checklist.map((item, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 transition-colors hover:border-slate-600/60"
                  >
                    <input
                      type="checkbox"
                      checked={!!checklistDone[i]}
                      onChange={() => setChecklistDone((d) => ({ ...d, [i]: !d[i] }))}
                      className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/40"
                    />
                    <span className="flex-1 text-sm text-slate-300">{item.item}</span>
                    {item.deadline && <span className="text-xs text-slate-500">{item.deadline}</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Route className="h-4 w-4 text-cyan-400" />
                Timeline
              </h3>
              <ul className="space-y-4 border-l border-slate-700/60 pl-4">
                {advice.timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 ring-4 ring-slate-900" />
                    <p className="text-sm font-medium text-white">{t.milestone}</p>
                    <p className="text-xs text-slate-500">{t.timeframe}</p>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AlgorithmExplanation sections={ALGORITHM_SECTIONS} />
    </div>
  );
}
