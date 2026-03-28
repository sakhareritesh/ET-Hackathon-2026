"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, SendHorizontal, Sparkles } from "lucide-react";
import { isLocalEngineMode } from "@/lib/config";
import api from "@/lib/api";
import { useProfileStore } from "@/store/profileStore";
import { useTaxWizardStore } from "@/store/taxWizardStore";
import type { FinancialProfile } from "@/store/profileStore";
import type { TaxAnalysisResult } from "@/lib/engine/tax";
import { formatCurrency } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface MentorChatResponse {
  response: string;
  tool_used: string | null;
  tool_result: Record<string, unknown> | null;
  suggestions: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tool_used?: string | null;
  tool_result?: Record<string, unknown> | null;
  suggestions?: string[];
}

const QUICK_ACTIONS = [
  "Calculate my SIP",
  "Compare tax regimes",
  "Check my insurance gap",
  "Review my FIRE plan",
  "Asset allocation advice",
] as const;

/* -------------------------------------------------------------------------- */
/*  Context builder                                                           */
/* -------------------------------------------------------------------------- */

function buildMentorContext(
  profile: FinancialProfile | null,
  analysis: TaxAnalysisResult | null
): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  if (profile) {
    ctx.profile = {
      employment_type: profile.employment_type,
      annual_income: profile.annual_income,
      monthly_expenses: profile.monthly_expenses,
      existing_investments: profile.existing_investments,
      insurance: profile.insurance,
      emergency_fund: profile.emergency_fund,
      risk_profile: profile.risk_profile,
      tax_regime: profile.tax_regime,
      debts: profile.debts,
    };
  }

  if (analysis) {
    const rc = analysis.regime_comparison;
    ctx.tax_analysis = {
      recommended_regime: rc.recommended_regime,
      old_tax: rc.old_regime.total_tax,
      new_tax: rc.new_regime.total_tax,
      savings: rc.savings,
      old_taxable_income: rc.old_regime.taxable_income,
      new_taxable_income: rc.new_regime.taxable_income,
      missed_deductions_count: analysis.missed_deductions?.length ?? 0,
    };
  }

  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  Local engine responses                                                    */
/* -------------------------------------------------------------------------- */

function estimateSipCorpus(monthly: number, months: number, annualReturn: number): number {
  const r = annualReturn / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

function getMonthlyExpenseTotal(m: FinancialProfile["monthly_expenses"] | undefined): number {
  if (!m) return 0;
  if (m.total > 0) return m.total;
  return Object.entries(m)
    .filter(([k]) => k !== "total")
    .reduce((s, [, v]) => s + (typeof v === "number" ? v : 0), 0);
}

function getLocalMentorResponse(
  message: string,
  profile: FinancialProfile | null,
  analysis: TaxAnalysisResult | null
): MentorChatResponse {
  const lower = message.toLowerCase();
  const mf = profile?.existing_investments?.mutual_funds ?? 0;
  const gross = profile?.annual_income?.gross ?? 0;

  if (lower.includes("sip") || lower.includes("systematic")) {
    const monthly = gross > 0 ? Math.round(Math.min(gross / 12 / 5, 25000)) : 10000;
    const years = 15;
    const corpus = estimateSipCorpus(monthly, years * 12, 0.12 / 12);
    return {
      response: `**SIP (Systematic Investment Plan)** builds wealth through disciplined monthly investing.\n\nFor your profile, a starting point of **${formatCurrency(monthly)}/month** over **${years} years** at ~12% assumed return could grow to roughly **${formatCurrency(Math.round(corpus))}** before tax. Increase the amount by 10% yearly to offset inflation.\n\nPrefer **index or flexi-cap funds** aligned with your **${profile?.risk_profile ?? "moderate"}** risk profile. Review once a year, not daily.\n\n_Educational illustration, not advice._`,
      tool_used: "sip_projection",
      tool_result: {
        assumed_monthly_sip: monthly,
        horizon_years: years,
        assumed_annual_return_pct: 12,
        illustrative_corpus: Math.round(corpus),
        current_mf_exposure: mf,
      },
      suggestions: ["Compare tax regimes", "Review my FIRE plan", "Asset allocation advice"],
    };
  }

  if (lower.includes("tax") || lower.includes("regime") || lower.includes("old vs new")) {
    if (analysis) {
      const rc = analysis.regime_comparison;
      const rec = rc.recommended_regime === "old" ? "Old" : "New";
      return {
        response: `**Tax regime comparison** using your latest analysis:\n\n• **Recommended:** ${rec} Regime\n• **Old regime tax:** ${formatCurrency(rc.old_regime.total_tax)} (taxable ${formatCurrency(rc.old_regime.taxable_income)})\n• **New regime tax:** ${formatCurrency(rc.new_regime.total_tax)} (taxable ${formatCurrency(rc.new_regime.taxable_income)})\n• **Difference:** ${formatCurrency(rc.savings)} vs the alternative\n\n${rc.recommended_regime === "old" ? "Your deductions appear large enough to justify the Old regime slabs." : "Lower slabs and fewer deductions needed favor the New regime for your numbers."}\n\n_Open Tax Wizard for line-by-line detail._`,
        tool_used: "tax_regime_compare",
        tool_result: {
          recommended_regime: rc.recommended_regime,
          old_total_tax: rc.old_regime.total_tax,
          new_total_tax: rc.new_regime.total_tax,
          savings_amount: rc.savings,
        },
        suggestions: ["Check my insurance gap", "Calculate my SIP", "Review my FIRE plan"],
      };
    }
    return {
      response: `**Old vs New tax regime:** the New regime offers lower slab rates but limits most deductions; the Old regime keeps higher slabs but allows 80C, 80D, HRA, NPS, and more.\n\nRun the **Tax Wizard** with your salary and deductions to see which saves more for **your** case.\n\n_Educational summary._`,
      tool_used: null,
      tool_result: null,
      suggestions: ["Compare tax regimes", "Calculate my SIP", "Asset allocation advice"],
    };
  }

  if (lower.includes("insurance") || lower.includes("cover")) {
    const life = profile?.insurance?.life;
    const health = profile?.insurance?.health;
    const lifeCover = typeof life?.sum_assured === "number" ? life.sum_assured : 0;
    const healthCover = typeof health?.sum_assured === "number" ? health.sum_assured : 0;
    const targetLife = gross > 0 ? gross * 10 : 0;
    const targetHealth = 500000;
    const lifeGap = Math.max(0, targetLife - lifeCover);
    return {
      response: `**Insurance gap check (rule-of-thumb):**\n\n• **Life cover:** aim for ~**10x annual gross** (${formatCurrency(targetLife)} when income is known). Your declared cover: **${formatCurrency(lifeCover)}**${targetLife > 0 ? ` (gap ~**${formatCurrency(lifeGap)}**)` : ""}.\n• **Health:** family floater often **${formatCurrency(targetHealth)}+** for tier-1 cities; yours: **${formatCurrency(healthCover)}**.\n\nUse this to prompt a discussion with a licensed agent; needs vary by dependents and liabilities.\n\n_Not a underwriting opinion._`,
      tool_used: "insurance_gap",
      tool_result: {
        gross_annual_income: gross,
        life_sum_assured: lifeCover,
        health_sum_assured: healthCover,
        heuristic_life_target: targetLife,
      },
      suggestions: ["Review my FIRE plan", "Calculate my SIP", "Compare tax regimes"],
    };
  }

  if (lower.includes("fire") || lower.includes("retire")) {
    const exp = getMonthlyExpenseTotal(profile?.monthly_expenses);
    const annualNeed = exp * 12;
    const fireNumber = Math.round(annualNeed * 25);
    return {
      response: `**FIRE (Financial Independence)** means your investments can cover spending without earned income.\n\nA common starting point is **25x annual expenses** (4% rule illustration). With monthly expenses around **${formatCurrency(exp)}**, annual need ~**${formatCurrency(annualNeed)}**, a rough **FIRE number** to discuss is **${formatCurrency(fireNumber)}** before tax and inflation tweaks.\n\nBuild equity index exposure, tax-efficient wrappers, and rebalance as you approach the goal.\n\n_Illustrative math only._`,
      tool_used: "fire_heuristic",
      tool_result: {
        monthly_expenses_assumed: exp,
        annual_expenses_assumed: annualNeed,
        fire_number_25x: fireNumber,
      },
      suggestions: ["Asset allocation advice", "Calculate my SIP", "Check my insurance gap"],
    };
  }

  return {
    response: `**Financial wellness** covers cash flow, tax efficiency, investing discipline, insurance, and goals.\n\nBased on what we know, keep **3–6 months** expenses liquid, maximize tax-advantaged buckets you actually use, and align investments with your **${profile?.risk_profile ?? "stated"}** risk level.\n\nAsk about SIPs, regimes, insurance, FIRE, or allocation for tailored canned guidance in local mode.\n\n_Educational information._`,
    tool_used: null,
    tool_result: null,
    suggestions: ["Calculate my SIP", "Compare tax regimes", "Asset allocation advice"],
  };
}

/* -------------------------------------------------------------------------- */
/*  Rendering helpers                                                         */
/* -------------------------------------------------------------------------- */

function renderBoldLines(text: string) {
  return text.split("\n").map((line, j) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <p key={j} className={j > 0 ? "mt-1.5" : ""}>
        {parts.map((part, k) =>
          k % 2 === 1 ? (
            <strong key={k} className="font-semibold text-white">
              {part}
            </strong>
          ) : (
            <span key={k}>{part}</span>
          )
        )}
      </p>
    );
  });
}

function ToolResultCard({ data, toolUsed }: { data: Record<string, unknown>; toolUsed: string | null }) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-cyan-500/20 bg-slate-950/60 p-3 text-xs shadow-inner shadow-emerald-500/5">
      {toolUsed && (
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-cyan-400/90">{toolUsed}</div>
      )}
      <dl className="space-y-1.5">
        {entries.map(([key, val]) => (
          <div key={key} className="flex justify-between gap-3 border-b border-slate-700/40 pb-1.5 last:border-0 last:pb-0">
            <dt className="shrink-0 text-slate-500">{key.replace(/_/g, " ")}</dt>
            <dd className="text-right text-slate-200">
              {typeof val === "number" ? val.toLocaleString("en-IN") : String(val)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

interface AIMentorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AIMentor({ isOpen, onClose }: AIMentorProps) {
  const profile = useProfileStore((s) => s.profile);
  const analysis = useTaxWizardStore((s) => s.analysis);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi, I am **DhanGuru AI Mentor**. Ask about investments, tax, insurance, or retirement planning. Use the quick actions below or type your question.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const buildContext = useCallback(() => buildMentorContext(profile, analysis), [profile, analysis]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);

      try {
        let payload: MentorChatResponse;
        if (isLocalEngineMode()) {
          await new Promise((r) => setTimeout(r, 450));
          payload = getLocalMentorResponse(trimmed, profile, analysis);
        } else {
          const res = await api.post<MentorChatResponse>("/mentor/chat", {
            message: trimmed,
            context: buildContext(),
          });
          payload = res.data;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: payload.response,
            timestamp: new Date(),
            tool_used: payload.tool_used,
            tool_result: payload.tool_result ?? undefined,
            suggestions: payload.suggestions ?? [],
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again in a moment.",
            timestamp: new Date(),
            suggestions: ["Calculate my SIP", "Compare tax regimes"],
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [profile, analysis, buildContext]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const showQuickChips =
    !isTyping && (messages.length === 0 || messages[messages.length - 1]?.role === "assistant");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close mentor"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="dhanguru-mentor-title"
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-emerald-500/10 bg-slate-900/95 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl sm:w-96"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-linear-to-r from-emerald-500/10 via-slate-900/90 to-cyan-500/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/20">
                  <Sparkles className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                  <h2 id="dhanguru-mentor-title" className="text-base font-semibold tracking-tight text-white">
                    DhanGuru AI Mentor
                  </h2>
                  <p className="text-[11px] text-emerald-400/90">Context-aware guidance</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={`${msg.timestamp.getTime()}-${i}`}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-emerald-600/90 text-white shadow-md shadow-emerald-900/30"
                          : "border border-slate-700/50 bg-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <>
                          <div className="whitespace-pre-wrap">{renderBoldLines(msg.content)}</div>
                          {msg.tool_result && Object.keys(msg.tool_result).length > 0 && (
                            <ToolResultCard data={msg.tool_result} toolUsed={msg.tool_used ?? null} />
                          )}
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-700/50 pt-2">
                              {msg.suggestions.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => void sendMessage(s)}
                                  className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/20"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1 rounded-2xl border border-slate-700/50 bg-slate-800 px-4 py-3">
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          key={d}
                          className="h-2 w-2 rounded-full bg-emerald-400"
                          animate={{ opacity: [0.35, 1, 0.35], y: [0, -3, 0] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {showQuickChips && (
              <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/40 px-3 py-2.5">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">Quick actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ACTIONS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => void sendMessage(label)}
                      className="rounded-lg border border-cyan-500/20 bg-slate-800/80 px-2.5 py-1.5 text-left text-[11px] text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="shrink-0 border-t border-slate-800/80 bg-slate-950/60 p-3">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask DhanGuru anything..."
                  rows={2}
                  disabled={isTyping}
                  className="min-h-11 flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-900/80 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl bg-linear-to-br from-emerald-500 to-cyan-600 text-white shadow-md shadow-emerald-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SendHorizontal className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-[9px] text-slate-600">
                Educational information only. Consult a qualified professional for personal advice.
              </p>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
