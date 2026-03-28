"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import {
  TrendingUp, Percent, Calculator, Flame, Shield, AlertTriangle,
  ArrowUpRight, Sparkles, Receipt, PieChart, Heart, Wallet,
  ChevronRight, Activity, FileText, Users,
} from "lucide-react";
import KPICard from "@/components/shared/KPICard";
import DonutChart from "@/components/charts/DonutChart";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import { useAuthStore } from "@/store/authStore";
import { useProfileStore } from "@/store/profileStore";
import type { FinancialProfile } from "@/store/profileStore";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getLatestHealthScore, getLatestTaxAnalysis, getLatestFirePlan } from "@/lib/supabaseHistory";

function sumInvestments(inv: FinancialProfile["existing_investments"] | undefined): number {
  if (!inv) return 0;
  return Object.values(inv).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
}

function sumDebtApprox(debts: FinancialProfile["debts"]): number {
  if (!debts?.length) return 0;
  return debts.reduce((sum, row) => {
    const nums = Object.values(row).filter((v): v is number => typeof v === "number");
    return sum + (nums[0] ?? 0);
  }, 0);
}

function buildAllocation(profile: FinancialProfile | null) {
  if (!profile?.existing_investments) return null;
  const inv = profile.existing_investments;
  const equity = (inv.stocks || 0) + (inv.mutual_funds || 0) + (inv.elss || 0);
  const debt = (inv.ppf || 0) + (inv.epf || 0) + (inv.fd || 0) + (inv.nps || 0);
  const gold = inv.gold || 0;
  const realEstate = inv.real_estate || 0;
  const total = equity + debt + gold + realEstate;
  if (total === 0) return null;
  return [
    { name: "Equity", value: Math.round((equity / total) * 100), color: "#10b981" },
    { name: "Debt", value: Math.round((debt / total) * 100), color: "#06b6d4" },
    { name: "Gold", value: Math.round((gold / total) * 100), color: "#f59e0b" },
    { name: "Real Estate", value: Math.round((realEstate / total) * 100), color: "#8b5cf6" },
  ].filter((d) => d.value > 0);
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const ONBOARDING_STEPS = [
  { step: 1, href: "/money-profile", title: "Complete Money Profile", desc: "Add your income, expenses, and investments", icon: Wallet, color: "from-emerald-500 to-cyan-500" },
  { step: 2, href: "/money-health", title: "Check Health Score", desc: "See your six-dimension financial wellness", icon: Heart, color: "from-pink-500 to-rose-500" },
  { step: 3, href: "/tax-wizard", title: "Run Tax Wizard", desc: "Compare old vs new regime and find savings", icon: Calculator, color: "from-amber-500 to-orange-500" },
  { step: 4, href: "/fire-planner", title: "Plan FIRE Path", desc: "Set your target and build a roadmap", icon: Flame, color: "from-orange-500 to-rose-500" },
  { step: 5, href: "/mf-xray", title: "X-Ray Your Portfolio", desc: "Analyze MF overlap, costs, and allocation", icon: PieChart, color: "from-violet-500 to-indigo-500" },
  { step: 6, href: "/mentor", title: "Ask AI Mentor", desc: "Get personalized answers to any question", icon: Sparkles, color: "from-cyan-500 to-blue-500" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();

  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [taxSavings, setTaxSavings] = useState<number | null>(null);
  const [fireProgress, setFireProgress] = useState<number | null>(null);
  const [fireNumber, setFireNumber] = useState<number | null>(null);

  useEffect(() => { void loadUser(); }, [loadUser]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);
  useEffect(() => {
    if (isAuthenticated) {
      void fetchProfile();
      void getLatestHealthScore().then((r) => { if (r) setHealthScore(r.overall_score); });
      void getLatestTaxAnalysis().then((r) => { if (r) setTaxSavings(r.savings_potential); });
      void getLatestFirePlan().then((r) => {
        if (r) {
          setFireNumber(r.fire_number);
          const totalInv = sumInvestments(profile?.existing_investments);
          if (r.fire_number > 0) setFireProgress(Math.min(100, (totalInv / r.fire_number) * 100));
        }
      });
    }
  }, [fetchProfile, isAuthenticated, profile?.existing_investments]);

  const hasProfile = useMemo(() => {
    if (!profile) return false;
    return (profile.annual_income?.gross ?? 0) > 0 || sumInvestments(profile.existing_investments) > 0;
  }, [profile]);

  const netWorth = useMemo(() => {
    if (!profile) return 0;
    return Math.max(0, sumInvestments(profile.existing_investments) + (profile.emergency_fund?.current_amount ?? 0) - sumDebtApprox(profile.debts));
  }, [profile]);

  const savingsRate = useMemo(() => {
    if (!profile) return 0;
    const monthlyNet = (profile.annual_income?.net ?? 0) / 12;
    const expenses = profile.monthly_expenses?.total ?? 0;
    if (monthlyNet <= 0) return 0;
    return Math.min(100, Math.max(0, ((monthlyNet - expenses) / monthlyNet) * 100));
  }, [profile]);

  const emergencyMonths = profile?.emergency_fund?.months_covered ?? 0;

  const allocation = useMemo(() => buildAllocation(profile), [profile]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500/30 border-t-emerald-500" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const displayName = user?.full_name?.split(" ")[0] || "there";

  if (!hasProfile) {
    return (
      <div className="space-y-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-medium text-emerald-400/90">Welcome to DhanGuru</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
            Hey {displayName}, let&apos;s get started!
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Follow these steps to unlock your complete financial dashboard. Each step takes 2-5 minutes.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={containerVariants} initial="hidden" animate="show"
        >
          {ONBOARDING_STEPS.map((step) => (
            <motion.div key={step.step} variants={itemVariants}>
              <Link href={step.href}
                className="group flex flex-col gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md transition-all hover:border-emerald-500/30 hover:bg-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} text-white shadow-lg`}>
                    <step.icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/50 text-xs font-bold text-slate-400">
                    {step.step}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white transition-colors group-hover:text-emerald-400">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{step.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600 transition-colors group-hover:text-emerald-400 self-end" />
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-slate-800/50 to-slate-900/80 p-6 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Pro tip</p>
              <p className="mt-1 text-sm text-slate-300">
                Start with your <strong>Money Profile</strong> — it powers all other features with personalized data.
                You can also explore any tool with <strong>sample data</strong> to see how it works first!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="text-sm font-medium text-emerald-400/90">DhanGuru Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">Welcome back, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Your consolidated view of net worth, savings, risk gaps, and where AI can move the needle next.
        </p>
      </motion.div>

      <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants} initial="hidden" animate="show">
        <motion.div variants={itemVariants}>
          <KPICard title="Net Worth" value={formatCurrency(netWorth)} icon={<TrendingUp className="h-5 w-5" />}
            subtitle="Investments + emergency - debts" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KPICard title="Monthly Savings Rate" value={savingsRate > 0 ? formatPercent(savingsRate) : "—"} icon={<Percent className="h-5 w-5" />}
            subtitle="Of post-tax income" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KPICard title="Tax Savings Potential" value={taxSavings !== null ? formatCurrency(taxSavings) : "Run Tax Wizard"} icon={<Calculator className="h-5 w-5" />}
            subtitle="From latest tax analysis" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KPICard title="FIRE Progress" value={fireProgress !== null ? formatPercent(fireProgress) : "Run FIRE Planner"} icon={<Flame className="h-5 w-5" />}
            subtitle={fireNumber ? `Target: ${formatCurrency(fireNumber)}` : "Toward your target corpus"} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KPICard title="Health Score" value={healthScore !== null ? `${Math.round(healthScore)}/100` : "Check Health"} icon={<Activity className="h-5 w-5" />}
            subtitle="Six-dimension financial wellness" />
        </motion.div>
        <motion.div variants={itemVariants}>
          <KPICard title="Emergency Fund" value={emergencyMonths > 0 ? `${emergencyMonths.toFixed(1)} mo` : "—"} icon={<Shield className="h-5 w-5" />}
            subtitle="Months of expenses covered" />
        </motion.div>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-5">
        <motion.div className="lg:col-span-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-6 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Asset Allocation</h2>
                <p className="text-xs text-slate-500">{allocation ? "From your Money Profile" : "Complete your profile to see real allocation"}</p>
              </div>
              <PieChart className="h-5 w-5 text-emerald-400/80" aria-hidden />
            </div>
            <DonutChart
              data={allocation || [
                { name: "Equity", value: 48, color: "#10b981" },
                { name: "Debt", value: 28, color: "#06b6d4" },
                { name: "Gold", value: 14, color: "#f59e0b" },
                { name: "Cash", value: 10, color: "#94a3b8" },
              ]}
              centerLabel="Total"
              centerValue="100%"
            />
          </div>
        </motion.div>

        <motion.div className="flex flex-col gap-4 lg:col-span-2" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.45 }}>
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-slate-800/50 to-slate-900/80 p-6 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
                <Sparkles className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">Proactive insight</p>
                <p className="mt-1 text-sm font-medium leading-relaxed text-white">
                  {taxSavings && taxSavings > 0
                    ? `You could save ${formatCurrency(taxSavings)} more in taxes this year. Open Tax Wizard for details.`
                    : "Complete your profile and run the Tax Wizard to discover potential tax savings."}
                </p>
                <Link href="/mentor"
                  className="mt-4 inline-block w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-2.5 text-center text-sm font-semibold text-slate-900 transition-all hover:shadow-lg hover:shadow-emerald-500/25 sm:w-auto sm:px-5">
                  Open AI Mentor
                </Link>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-md">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quick Stats</p>
            <p className="mt-2 text-sm text-slate-400">
              Annual Income: <span className="font-semibold text-white">{profile?.annual_income?.gross ? formatCurrency(profile.annual_income.gross) : "—"}</span>
            </p>
            <p className="mt-1 text-sm text-slate-400">
              Risk Profile: <span className="font-semibold text-emerald-300 capitalize">{profile?.risk_profile || "—"}</span>
            </p>
          </div>
        </motion.div>
      </div>

      <motion.section initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }} transition={{ duration: 0.45 }}>
        <h2 className="mb-4 text-lg font-semibold text-white">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { href: "/tax-wizard", title: "Tax Wizard", desc: "Regime comparison and missed deductions", icon: Receipt, gradient: "from-amber-500 to-orange-600" },
            { href: "/fire-planner", title: "FIRE Planner", desc: "Path and milestones to independence", icon: Flame, gradient: "from-orange-500 to-rose-600" },
            { href: "/mf-xray", title: "MF X-Ray", desc: "Portfolio overlap and cost drag", icon: PieChart, gradient: "from-violet-500 to-indigo-600" },
            { href: "/money-health", title: "Money Health", desc: "Six-dimension financial wellness score", icon: Heart, gradient: "from-pink-500 to-rose-600" },
          ].map((card, i) => (
            <motion.div key={card.href} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.05 * i, duration: 0.4 }}>
              <Link href={card.href}
                className="group flex items-start gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-5 backdrop-blur-md transition-all hover:border-emerald-500/30 hover:bg-slate-800/80">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} text-white shadow-lg`}>
                  <card.icon className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-white transition-colors group-hover:text-emerald-400">{card.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{card.desc}</p>
                </div>
                <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-emerald-400" aria-hidden />
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
