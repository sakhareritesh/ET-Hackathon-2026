"use client";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Users, Send, Sparkles, Heart, TrendingUp, Shield, Wallet } from "lucide-react";

interface HRASplit {
  recommended_claimer: string;
  savings: number;
  reason: string;
}
interface InsurancePlan {
  joint_vs_individual: string;
  recommendations: string[];
}
interface CombinedNetWorth {
  total: number;
  partner_1_share: number;
  partner_2_share: number;
}
interface Optimization {
  hra_split?: HRASplit;
  insurance_plan?: InsurancePlan;
  combined_net_worth?: CombinedNetWorth;
  nps_note?: string;
  sip_split_note?: string;
}
interface CoupleData {
  optimization?: Optimization;
}

export default function CouplesPlannerPage() {
  useAuth();
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [data, setData] = useState<CoupleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"invite" | "accept" | "results">("invite");

  const sendInvite = async () => {
    try {
      const res = await api.post<{ invite_code: string }>("/couples/invite", { partner_email: partnerEmail });
      setInviteCode(res.data.invite_code);
    } catch {
      /* silent */
    }
  };

  const acceptInvite = async () => {
    try {
      await api.post("/couples/accept", { invite_code: inviteCode });
      await fetchOptimizations();
    } catch {
      /* silent */
    }
  };

  const fetchOptimizations = async () => {
    setLoading(true);
    try {
      const res = await api.get<CoupleData>("/couples/optimize");
      setData(res.data);
      setTab("results");
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const opt = data?.optimization;

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg">
          <Users size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Couple&apos;s Money Planner</h1>
          <p className="text-sm text-slate-500">
            Joint planning with HRA, insurance, and net worth
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(
          [
            { key: "invite" as const, label: "Invite Partner" },
            { key: "accept" as const, label: "Accept Invite" },
            { key: "results" as const, label: "Optimization Results" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.key ? "bg-violet-500/20 text-violet-400 border border-violet-500/30" : "text-slate-500 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "invite" && (
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Heart size={18} className="text-pink-400" /> Invite Your Partner
          </h3>
            Your partner needs an account to link profiles together.
          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={partnerEmail}
              onChange={(e) => setPartnerEmail(e.target.value)}
              placeholder="partner@example.com"
              className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={sendInvite}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white font-semibold flex items-center gap-2 text-sm"
            >
              <Send size={16} /> Send Invite
            </button>
          </div>
          {inviteCode && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-400">
                Invite code: <span className="font-mono font-bold">{inviteCode}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "accept" && (
        <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 space-y-4">
          <h3 className="text-lg font-semibold text-white">Accept Partner Invite</h3>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Paste invite code..."
              className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-white text-sm focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={acceptInvite}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white font-semibold text-sm"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      {tab === "results" && !opt && (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-slate-700 mb-4" />
          <p className="text-slate-500">Run optimization to see joint HRA, insurance, and net worth</p>
          <button
            onClick={fetchOptimizations}
            disabled={loading}
            className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white font-semibold text-sm flex items-center gap-2 mx-auto"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Load Optimizations
          </button>
        </div>
      )}

      {tab === "results" && opt && (
        <div className="space-y-6">
          {opt.combined_net_worth && (
            <div className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Wallet size={18} className="text-emerald-400" /> Combined Net Worth (illustrative)
              </h3>
              <p className="text-3xl font-black text-emerald-400">
                {formatCurrency(opt.combined_net_worth.total)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Split ~{opt.combined_net_worth.partner_1_share}% / {opt.combined_net_worth.partner_2_share}%
              </p>
            </div>
          )}

          {opt.hra_split && (
            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-400" /> HRA Optimization
              </h4>
              <p className="text-sm text-slate-400">{opt.hra_split.reason}</p>
              <p className="text-lg font-bold text-emerald-400 mt-2">
                Save up to {formatCurrency(opt.hra_split.savings)} (model)
              </p>
              <p className="text-xs text-slate-600 mt-1">Claimant: {opt.hra_split.recommended_claimer}</p>
            </div>
          )}

          {opt.insurance_plan && (
            <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50">
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Shield size={16} className="text-amber-400" /> Insurance Recommendation
              </h4>
              <p className="text-xs text-slate-500 mb-2">{opt.insurance_plan.joint_vs_individual}</p>
              {opt.insurance_plan.recommendations?.map((r, i) => (
                <p key={i} className="text-sm text-slate-400">
                  • {r}
                </p>
              ))}
            </div>
          )}

          {(opt.nps_note || opt.sip_split_note) && (
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-700/40 text-sm text-slate-400 space-y-2">
              {opt.nps_note && <p>{opt.nps_note}</p>}
              {opt.sip_split_note && <p>{opt.sip_split_note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
