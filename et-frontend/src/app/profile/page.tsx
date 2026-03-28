"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, Mail, Phone, Calendar, Shield, Heart, TrendingUp, Wallet, Edit, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";
import { formatCurrency } from "@/lib/utils";
import { getLatestHealthScore, getLatestTaxAnalysis, getLatestFirePlan } from "@/lib/supabaseHistory";
import { supabase } from "@/lib/supabase";

function sumInvestments(inv: Record<string, number> | undefined): number {
  if (!inv) return 0;
  return Object.values(inv).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
}

export default function ProfilePage() {
  useAuth();
  const { user } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [lastTaxDate, setLastTaxDate] = useState<string | null>(null);
  const [firePlanNumber, setFirePlanNumber] = useState<number | null>(null);

  useEffect(() => {
    void fetchProfile();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.created_at) setCreatedAt(session.user.created_at);
    });
    void getLatestHealthScore().then((r) => { if (r) setHealthScore(r.overall_score); });
    void getLatestTaxAnalysis().then((r) => { if (r) setLastTaxDate(new Date(r.analyzed_at).toLocaleDateString()); });
    void getLatestFirePlan().then((r) => { if (r) setFirePlanNumber(r.fire_number); });
  }, [fetchProfile]);

  const netWorth = useMemo(() => {
    if (!profile) return 0;
    const investments = sumInvestments(profile.existing_investments);
    const emergency = profile.emergency_fund?.current_amount ?? 0;
    return investments + emergency;
  }, [profile]);

  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-sm font-medium text-emerald-400/90">Your Profile</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Account & Financial Summary</h1>
      </motion.div>

      {/* User info card */}
      <motion.div variants={item} initial="hidden" animate="show"
        className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg shrink-0">
            {user?.full_name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{user?.full_name || "User"}</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Mail size={15} className="text-slate-500" />
                <span>{user?.email}</span>
              </div>
              {user?.phone && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Phone size={15} className="text-slate-500" />
                  <span>{user.phone}</span>
                </div>
              )}
              {createdAt && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Calendar size={15} className="text-slate-500" />
                  <span>Member since {new Date(createdAt).toLocaleDateString()}</span>
                </div>
              )}
              {profile?.employment_type && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <MapPin size={15} className="text-slate-500" />
                  <span className="capitalize">{profile.employment_type}</span>
                </div>
              )}
            </div>
          </div>
          <Link href="/money-profile"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-sm font-medium hover:bg-emerald-500/20 transition-colors">
            <Edit size={14} /> Edit Profile
          </Link>
        </div>
      </motion.div>

      {/* Financial quick stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Net Worth", value: netWorth > 0 ? formatCurrency(netWorth) : "—", icon: Wallet, color: "text-emerald-400" },
          { label: "Health Score", value: healthScore !== null ? `${Math.round(healthScore)}/100` : "—", icon: Heart, color: "text-pink-400" },
          { label: "Last Tax Analysis", value: lastTaxDate || "Not run yet", icon: Shield, color: "text-amber-400" },
          { label: "FIRE Number", value: firePlanNumber ? formatCurrency(firePlanNumber) : "—", icon: TrendingUp, color: "text-cyan-400" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={16} className={stat.color} />
              <span className="text-xs text-slate-500 uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-lg font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Financial profile summary */}
      {profile && (profile.annual_income?.gross > 0 || sumInvestments(profile.existing_investments) > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User size={18} className="text-emerald-400" /> Financial Profile Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Income & Expenses</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Annual Gross Income</span><span className="text-white font-medium">{formatCurrency(profile.annual_income?.gross || 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Monthly Expenses</span><span className="text-white font-medium">{formatCurrency(profile.monthly_expenses?.total || 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Risk Profile</span><span className="text-emerald-300 font-medium capitalize">{profile.risk_profile}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Tax Regime</span><span className="text-cyan-300 font-medium capitalize">{profile.tax_regime}</span></div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Emergency & Insurance</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Emergency Fund</span><span className="text-white font-medium">{formatCurrency(profile.emergency_fund?.current_amount || 0)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Months Covered</span><span className="text-white font-medium">{profile.emergency_fund?.months_covered || 0} mo</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Total Investments</span><span className="text-emerald-300 font-medium">{formatCurrency(sumInvestments(profile.existing_investments))}</span></div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick links */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
        className="rounded-2xl border border-slate-700/50 bg-slate-800/50 backdrop-blur-md p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/money-profile", label: "Edit Money Profile", color: "from-emerald-500 to-cyan-500" },
            { href: "/money-health", label: "Check Health Score", color: "from-pink-500 to-rose-500" },
            { href: "/tax-wizard", label: "Run Tax Wizard", color: "from-amber-500 to-orange-500" },
            { href: "/fire-planner", label: "FIRE Planner", color: "from-violet-500 to-indigo-500" },
          ].map((link) => (
            <Link key={link.href} href={link.href}
              className={`rounded-xl bg-gradient-to-r ${link.color} p-3 text-center text-sm font-semibold text-white shadow-lg transition-all hover:opacity-90 hover:shadow-xl`}>
              {link.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
