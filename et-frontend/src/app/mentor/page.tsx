"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { SendHorizontal, Sparkles, Zap, History, Trash2 } from "lucide-react";
import { isLocalEngineMode } from "@/lib/config";
import api from "@/lib/api";
import { useProfileStore } from "@/store/profileStore";
import { useTaxWizardStore } from "@/store/taxWizardStore";
import { useAuth } from "@/hooks/useAuth";
import type { FinancialProfile } from "@/store/profileStore";
import type { TaxAnalysisResult } from "@/lib/engine/tax";
import { formatCurrency } from "@/lib/utils";
import { saveChatMessage, getChatHistory } from "@/lib/supabaseHistory";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";

interface MentorChatResponse {
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
  "How to save more tax?",
  "Best mutual funds for beginners",
  "Emergency fund strategy",
] as const;

function estimateSipCorpus(
  monthly: number,
  months: number,
  annualReturn: number,
): number {
  const r = annualReturn / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

function getMonthlyExpenseTotal(
  m: FinancialProfile["monthly_expenses"] | undefined,
): number {
  if (!m) return 0;
  if (m.total > 0) return m.total;
  return Object.entries(m)
    .filter(([k]) => k !== "total")
    .reduce((s, [, v]) => s + (typeof v === "number" ? v : 0), 0);
}

function getLocalMentorResponse(
  message: string,
  profile: FinancialProfile | null,
  analysis: TaxAnalysisResult | null,
): MentorChatResponse {
  const lower = message.toLowerCase();
  const gross = profile?.annual_income?.gross ?? 0;

  if (lower.includes("sip") || lower.includes("systematic")) {
    const monthly =
      gross > 0 ? Math.round(Math.min(gross / 12 / 5, 25000)) : 10000;
    const corpus = estimateSipCorpus(monthly, 180, 0.01);
    return {
      response: `**SIP Projection**\n\nA starting SIP of **${formatCurrency(monthly)}/month** over **15 years** at ~12% return could grow to ~**${formatCurrency(Math.round(corpus))}**.\n\nIncrease by 10% annually to beat inflation. Prefer index or flexi-cap funds for your **${profile?.risk_profile ?? "moderate"}** risk profile.\n\n_Educational illustration._`,
      tool_used: "sip_projection",
      tool_result: {
        monthly_sip: monthly,
        horizon_years: 15,
        illustrative_corpus: Math.round(corpus),
      },
      suggestions: [
        "Compare tax regimes",
        "Review my FIRE plan",
        "Asset allocation advice",
      ],
    };
  }

  if (lower.includes("tax") || lower.includes("regime")) {
    if (analysis) {
      const rc = analysis.regime_comparison;
      return {
        response: `**Tax Regime Comparison**\n\n• Recommended: **${rc.recommended_regime === "old" ? "Old" : "New"} Regime**\n• Old: ${formatCurrency(rc.old_regime.total_tax)} | New: ${formatCurrency(rc.new_regime.total_tax)}\n• Savings: **${formatCurrency(rc.savings)}**\n\nOpen Tax Wizard for full detail.`,
        tool_used: "tax_regime_compare",
        tool_result: {
          recommended: rc.recommended_regime,
          old_tax: rc.old_regime.total_tax,
          new_tax: rc.new_regime.total_tax,
          savings: rc.savings,
        },
        suggestions: ["Check my insurance gap", "Calculate my SIP"],
      };
    }
    return {
      response:
        "Run the **Tax Wizard** with your salary details to get a personalized regime comparison.",
      tool_used: null,
      tool_result: null,
      suggestions: ["Calculate my SIP", "Asset allocation advice"],
    };
  }

  if (lower.includes("insurance") || lower.includes("cover")) {
    const lifeCover =
      typeof profile?.insurance?.life?.sum_assured === "number"
        ? Number(profile.insurance.life.sum_assured)
        : 0;
    const targetLife = gross > 0 ? gross * 10 : 0;
    return {
      response: `**Insurance Gap**\n\nLife cover should be ~10x gross (${formatCurrency(targetLife)}). Your declared: ${formatCurrency(lifeCover)}.\nHealth: aim for Rs 5L+ family floater in metro cities.\n\n_Consult a licensed agent._`,
      tool_used: "insurance_gap",
      tool_result: {
        target_life: targetLife,
        current_life: lifeCover,
        gap: Math.max(0, targetLife - lifeCover),
      },
      suggestions: ["Review my FIRE plan", "Calculate my SIP"],
    };
  }

  if (lower.includes("fire") || lower.includes("retire")) {
    const exp = getMonthlyExpenseTotal(profile?.monthly_expenses);
    const fireNumber = Math.round(exp * 12 * 25);
    return {
      response: `**FIRE Number**\n\n25x annual expenses = **${formatCurrency(fireNumber)}** (4% rule).\n\nBuild equity exposure, use tax-efficient wrappers, and rebalance as you approach the goal.`,
      tool_used: "fire_heuristic",
      tool_result: { monthly_expenses: exp, fire_number: fireNumber },
      suggestions: ["Asset allocation advice", "Calculate my SIP"],
    };
  }

  return {
    response:
      "I can help with **SIPs, tax regimes, insurance, FIRE planning, and asset allocation**. What would you like to explore?",
    tool_used: null,
    tool_result: null,
    suggestions: [
      "Calculate my SIP",
      "Compare tax regimes",
      "Asset allocation advice",
      "Check my insurance gap",
    ],
  };
}

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
          ),
        )}
      </p>
    );
  });
}

function ToolResultCard({
  data,
  toolUsed,
}: {
  data: Record<string, unknown>;
  toolUsed: string | null;
}) {
  const entries = Object.entries(data).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 rounded-lg border border-cyan-500/20 bg-slate-950/60 p-3 text-xs shadow-inner shadow-emerald-500/5">
      {toolUsed && (
        <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-cyan-400/90">
          {toolUsed}
        </div>
      )}
      <dl className="space-y-1.5">
        {entries.map(([key, val]) => (
          <div
            key={key}
            className="flex justify-between gap-3 border-b border-slate-700/40 pb-1.5 last:border-0 last:pb-0"
          >
            <dt className="shrink-0 text-slate-500">
              {key.replace(/_/g, " ")}
            </dt>
            <dd className="text-right text-slate-200">
              {typeof val === "number"
                ? val.toLocaleString("en-IN")
                : String(val)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const ALGO_SECTIONS = [
  {
    title: "Tool-Calling Agent",
    description:
      "Groq Mixtral classifies your question, selects a calculator (SIP, Tax, Insurance, Asset Allocation, XIRR), extracts parameters from natural language, executes the computation, then formats results conversationally.",
  },
  {
    title: "Context-Aware Pipeline",
    description:
      "Your financial profile and latest tax analysis are automatically injected as context, so responses are personalized without you re-entering data.",
  },
];

export default function MentorPage() {
  useAuth();
  const profile = useProfileStore((s) => s.profile);
  const analysis = useTaxWizardStore((s) => s.analysis);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm **DhanGuru AI Mentor**. Ask about investments, tax, insurance, or retirement planning. Use the quick actions or type your question.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (historyLoaded) return;
    setHistoryLoaded(true);
    void getChatHistory().then((rows) => {
      if (rows.length > 0) {
        const loaded: ChatMessage[] = rows.map((r) => ({
          role: r.role as "user" | "assistant",
          content: r.content,
          timestamp: new Date(r.created_at),
          tool_used: r.tool_used,
          tool_result: r.tool_result as Record<string, unknown> | undefined,
        }));
        setMessages((prev) => [...prev, ...loaded]);
      }
    });
  }, [historyLoaded]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMsg: ChatMessage = {
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      void saveChatMessage("user", trimmed);

      try {
        let payload: MentorChatResponse;
        if (isLocalEngineMode()) {
          await new Promise((r) => setTimeout(r, 400));
          payload = getLocalMentorResponse(trimmed, profile, analysis);
        } else {
          const res = await api.post<MentorChatResponse>("/mentor/chat", {
            message: trimmed,
            context: { profile, tax_analysis: analysis },
          });
          payload = res.data;
        }
        const aMsg: ChatMessage = {
          role: "assistant",
          content: payload.response,
          timestamp: new Date(),
          tool_used: payload.tool_used,
          tool_result: payload.tool_result ?? undefined,
          suggestions: payload.suggestions ?? [],
        };
        setMessages((prev) => [...prev, aMsg]);
        void saveChatMessage(
          "assistant",
          payload.response,
          payload.tool_used ?? undefined,
          payload.tool_result ?? undefined,
        );
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: new Date(),
            suggestions: ["Calculate my SIP", "Compare tax regimes"],
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [profile, analysis],
  );

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col flex-1 max-h-[calc(100vh-4rem)]">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-64 shrink-0 border-r border-slate-700/50 bg-slate-900/50 p-4 hidden lg:flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">DhanGuru AI</h2>
              <p className="text-[11px] text-emerald-400/90">
                Context-aware mentor
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">
              Quick Actions
            </p>
            <div className="space-y-1">
              {QUICK_ACTIONS.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void sendMessage(label)}
                  className="w-full text-left rounded-lg border border-slate-700/40 bg-slate-800/50 px-3 py-2 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-white"
                >
                  <Zap size={12} className="inline mr-1.5 text-cyan-400" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto">
            <button
              type="button"
              onClick={clearChat}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} /> Clear conversation
            </button>
            <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-600">
              <History size={12} /> Chat history auto-saved
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={`${msg.timestamp.getTime()}-${i}`}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-600/90 text-white shadow-md shadow-emerald-900/30"
                        : "border border-slate-700/50 bg-slate-800 text-slate-200"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        <div className="whitespace-pre-wrap">
                          {renderBoldLines(msg.content)}
                        </div>
                        {msg.tool_result &&
                          Object.keys(msg.tool_result).length > 0 && (
                            <ToolResultCard
                              data={msg.tool_result}
                              toolUsed={msg.tool_used ?? null}
                            />
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
                        transition={{
                          duration: 0.9,
                          repeat: Infinity,
                          delay: d * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-slate-700/50 bg-slate-900/60 px-4 md:px-8 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
              className="max-w-3xl mx-auto"
            >
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage(input);
                    }
                  }}
                  placeholder="Ask DhanGuru anything about finances..."
                  rows={2}
                  disabled={isTyping}
                  className="min-h-11 flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="flex h-11 w-11 shrink-0 items-center justify-center self-end rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-md shadow-emerald-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SendHorizontal className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-[9px] text-slate-600">
                Educational information only. Consult a qualified professional
                for personal advice.
              </p>
            </form>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-950/50">
        <AlgorithmExplanation sections={ALGO_SECTIONS} />
      </div>
    </div>
  );
}
