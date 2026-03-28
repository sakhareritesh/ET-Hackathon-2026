"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import {
  Calculator,
  FileText,
  Flame,
  Loader2,
  PieChart,
  Shield,
} from "lucide-react";
import { useProfileStore } from "@/store/profileStore";
import type { FinancialProfile } from "@/store/profileStore";
import { cn, formatCurrency } from "@/lib/utils";

type ReportDef = {
  id: string;
  title: string;
  description: string;
  icon: typeof FileText;
};

const REPORTS: ReportDef[] = [
  {
    id: "complete",
    title: "Complete Financial Plan",
    description: "Net worth, cash flow, goals, tax, insurance, and investments in one view.",
    icon: FileText,
  },
  {
    id: "tax",
    title: "Tax Optimization Report",
    description: "Old vs new regime comparison, HRA, and missed deduction opportunities.",
    icon: Calculator,
  },
  {
    id: "portfolio",
    title: "Portfolio Analysis Report",
    description: "MF allocation, overlap hints, and expense drag from your Money Profile.",
    icon: PieChart,
  },
  {
    id: "fire",
    title: "FIRE Roadmap",
    description: "FIRE number estimate, timeline, and savings gap vs retirement age.",
    icon: Flame,
  },
  {
    id: "insurance",
    title: "Insurance Gap Report",
    description: "Life and health cover vs income, dependents, and emergency fund.",
    icon: Shield,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function sumInvestments(inv: FinancialProfile["existing_investments"] | undefined): number {
  if (!inv) return 0;
  return Object.values(inv).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
}

function buildPreviewLines(
  reportId: string,
  profile: FinancialProfile | null,
): { headline: string; sections: { title: string; lines: string[] }[] } {
  const gross = profile?.annual_income.gross ?? 0;
  const net = profile?.annual_income.net ?? 0;
  const monthlyExp = profile?.monthly_expenses?.total ?? 0;
  const rent = profile?.monthly_expenses?.rent ?? 0;
  const emergency = profile?.emergency_fund?.current_amount ?? 0;
  const months = profile?.emergency_fund?.months_covered ?? 0;
  const inv = sumInvestments(profile?.existing_investments);
  const lifeCover =
    profile?.insurance?.life && typeof profile.insurance.life.sum_assured === "number"
      ? profile.insurance.life.sum_assured
      : 0;
  const healthCover =
    profile?.insurance?.health && typeof profile.insurance.health.sum_assured === "number"
      ? profile.insurance.health.sum_assured
      : 0;
  const hasLife =
    profile?.insurance?.life && profile.insurance.life.has_cover === true;
  const hasHealth =
    profile?.insurance?.health && profile.insurance.health.has_cover === true;
  const risk = profile?.risk_profile ?? "moderate";
  const regime = profile?.tax_regime ?? "new";

  const fireNumber = monthlyExp > 0 ? monthlyExp * 12 * 25 : 0;
  const surplus = net / 12 - monthlyExp;

  switch (reportId) {
    case "complete":
      return {
        headline: "Executive summary",
        sections: [
          {
            title: "Snapshot",
            lines: [
              `Annual gross income: ${formatCurrency(gross)}`,
              `Estimated net (annual): ${formatCurrency(net)}`,
              `Monthly expenses (total): ${formatCurrency(monthlyExp)}`,
              `Investments (aggregated): ${formatCurrency(inv)}`,
              `Emergency fund: ${formatCurrency(emergency)} (~${months.toFixed(1)} months of expenses)`,
            ],
          },
          {
            title: "Priorities",
            lines: [
              `Risk profile: ${risk} · Tax regime preference: ${regime}`,
              surplus > 0
                ? `Approx. monthly surplus: ${formatCurrency(surplus)} — prioritise goals and tax-advantaged buckets.`
                : "Surplus is tight — review discretionary spend and EMIs before adding risk.",
              !hasHealth
                ? "Action: add or upgrade health insurance for catastrophic cover."
                : `Health cover on file: ${formatCurrency(healthCover)}.`,
              !hasLife && gross > 8_00_000
                ? "Action: consider term life aligned to income replacement and liabilities."
                : hasLife
                  ? `Life cover on file: ${formatCurrency(lifeCover)}.`
                  : "Life cover: review once income or dependents change.",
            ],
          },
        ],
      };
    case "tax":
      return {
        headline: "Tax optimization",
        sections: [
          {
            title: "Regime lens",
            lines: [
              `Current preference: ${regime} regime (from Money Profile).`,
              "Compare old vs new in Tax Wizard for your exact salary break-up and 80C/80D.",
              rent > 0
                ? `Rent paid (monthly): ${formatCurrency(rent)} — HRA exemption may apply in old regime.`
                : "No rent in profile — HRA benefit may be limited.",
            ],
          },
          {
            title: "Deductions checklist",
            lines: [
              "80C: PPF, ELSS, EPF, principal repayment — track against ₹1.5 lakh cap.",
              "80D: health premium for self/parents — often missed if only employer cover.",
              "NPS 80CCD(1B): extra ₹50k if you need fixed-income tilt and tax room.",
            ],
          },
        ],
      };
    case "portfolio":
      return {
        headline: "Portfolio analysis (MF X-Ray style)",
        sections: [
          {
            title: "Allocation",
            lines: [
              `Total invested assets (from profile): ${formatCurrency(inv)}`,
              `Equity MF bucket (aggregated): ${formatCurrency(profile?.existing_investments?.mutual_funds ?? 0)}`,
              `PPF / debt anchors: ${formatCurrency((profile?.existing_investments?.ppf ?? 0) + (profile?.existing_investments?.fd ?? 0))}`,
            ],
          },
          {
            title: "Overlap & cost",
            lines: [
              "Large-cap heavy? Check overlap across Axis / Mirae-style peers on MF X-Ray.",
              "Expense ratio drag compounds — review active funds vs index core for long horizons.",
              `Risk setting: ${risk} — rebalance if equity drift exceeds band.`,
            ],
          },
        ],
      };
    case "fire":
      return {
        headline: "FIRE roadmap",
        sections: [
          {
            title: "Targets",
            lines: [
              monthlyExp > 0
                ? `Rule-of-thumb FIRE corpus (25× annual spend): ${formatCurrency(fireNumber)}`
                : "Add monthly expenses in Money Profile to estimate FIRE number.",
              `Investable corpus (from profile): ${formatCurrency(inv + emergency)}`,
              surplus > 0
                ? `Monthly surplus available to deploy: ${formatCurrency(surplus)}`
                : "Increase surplus or extend timeline to improve FIRE feasibility.",
            ],
          },
          {
            title: "Next steps",
            lines: [
              "Use FIRE Planner for Monte Carlo and retirement age scenarios.",
              "Increase emergency buffer to 6–12 months before maximising equity.",
            ],
          },
        ],
      };
    case "insurance":
      return {
        headline: "Insurance gap",
        sections: [
          {
            title: "Cover vs need",
            lines: [
              `Annual income (gross): ${formatCurrency(gross)}`,
              hasLife
                ? `Term life sum assured: ${formatCurrency(lifeCover)}`
                : "No term life recorded — for many families, 10–15× gross income is a starting benchmark.",
              hasHealth
                ? `Health sum assured (floater / individual as per profile): ${formatCurrency(healthCover)}`
                : "Health: aim for floater ₹10L+ for metros; super-top-up for tail risk.",
            ],
          },
          {
            title: "Liquidity",
            lines: [
              `Emergency fund: ${formatCurrency(emergency)}`,
              months >= 6
                ? "Emergency buffer looks adequate for short income shocks."
                : "Build emergency fund before raising insurance premiums or risky bets.",
            ],
          },
        ],
      };
    default:
      return { headline: "Report", sections: [{ title: "Preview", lines: ["Select a report type."] }] };
  }
}

function profileToCsvRows(reportType: string, profile: FinancialProfile | null): Record<string, string | number | boolean>[] {
  const ts = new Date().toISOString();
  const base: Record<string, string | number | boolean>[] = [
    { section: "meta", field: "report_type", value: reportType },
    { section: "meta", field: "generated_at", value: ts },
  ];
  if (!profile) {
    return [
      ...base,
      { section: "meta", field: "profile_loaded", value: false },
      {
        section: "meta",
        field: "note",
        value: "No Money Profile — fill Money Profile for a richer export.",
      },
    ];
  }
  const rows: Record<string, string | number | boolean>[] = [
    ...base,
    { section: "meta", field: "profile_loaded", value: true },
    { section: "income", field: "employment_type", value: profile.employment_type },
    { section: "income", field: "gross_annual", value: profile.annual_income.gross },
    { section: "income", field: "net_annual", value: profile.annual_income.net },
    { section: "expenses", field: "monthly_total", value: profile.monthly_expenses.total },
    { section: "expenses", field: "rent", value: profile.monthly_expenses.rent },
    { section: "expenses", field: "emi", value: profile.monthly_expenses.emi },
    { section: "fund", field: "emergency_amount", value: profile.emergency_fund.current_amount },
    { section: "fund", field: "emergency_months", value: profile.emergency_fund.months_covered },
    { section: "tax", field: "tax_regime", value: profile.tax_regime },
    { section: "risk", field: "risk_profile", value: profile.risk_profile },
  ];
  Object.entries(profile.existing_investments).forEach(([k, v]) => {
    rows.push({ section: "investments", field: k, value: v });
  });
  rows.push(
    {
      section: "insurance",
      field: "life_has_cover",
      value: Boolean(profile.insurance?.life?.has_cover),
    },
    {
      section: "insurance",
      field: "life_sum_assured",
      value: Number(profile.insurance?.life?.sum_assured ?? 0),
    },
    {
      section: "insurance",
      field: "health_has_cover",
      value: Boolean(profile.insurance?.health?.has_cover),
    },
    {
      section: "insurance",
      field: "health_sum_assured",
      value: Number(profile.insurance?.health?.sum_assured ?? 0),
    },
  );
  profile.debts.forEach((d, i) => {
    rows.push({ section: "debts", field: `row_${i}`, value: JSON.stringify(d) });
  });
  return rows;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { profile, fetchProfile } = useProfileStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfHint, setPdfHint] = useState(false);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const activeReport = useMemo(
    () => REPORTS.find((r) => r.id === activeId) ?? null,
    [activeId],
  );

  const preview = useMemo(
    () => (activeId ? buildPreviewLines(activeId, profile) : null),
    [activeId, profile],
  );

  const runGenerate = useCallback(
    (id: string) => {
      setActiveId(id);
      setLoading(true);
      setPdfHint(false);
      window.setTimeout(() => setLoading(false), 1400);
    },
    [],
  );

  const handleCsv = useCallback(() => {
    if (!activeId) return;
    const rows = profileToCsvRows(activeId, profile);
    const csv = Papa.unparse(rows);
    downloadBlob(`dhanguru-report-${activeId}.csv`, csv, "text/csv;charset=utf-8");
  }, [activeId, profile]);

  const handlePdf = useCallback(() => {
    setPdfHint(true);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          Reports
        </h1>
        <p className="text-slate-400 mt-2 max-w-2xl">
          Generate structured summaries from your Money Profile. Preview below; export CSV for spreadsheets.
        </p>
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5"
      >
        {REPORTS.map((r) => {
          const Icon = r.icon;
          const selected = activeId === r.id;
          return (
            <motion.div
              key={r.id}
              variants={item}
              className={cn(
                "rounded-2xl border p-5 backdrop-blur-xl transition-shadow",
                "bg-white/[0.06] border-white/10 shadow-lg shadow-black/20",
                selected && "ring-2 ring-emerald-500/50 border-emerald-500/30",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 p-3 border border-white/10">
                  <Icon className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-white text-lg leading-tight">{r.title}</h2>
                  <p className="text-sm text-slate-400 mt-1">{r.description}</p>
                </div>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => runGenerate(r.id)}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-cyan-500"
              >
                Generate
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        {(loading || (activeReport && preview)) && (
          <motion.div
            key={activeId ?? "none"}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-10 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {activeReport?.title ?? "Preview"}
                </h3>
                {loading && (
                  <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    Generating preview…
                  </p>
                )}
              </div>
              {!loading && activeId && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePdf}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleCsv}
                    className="rounded-lg bg-emerald-600/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Download CSV
                  </button>
                </div>
              )}
            </div>

            {pdfHint && !loading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              >
                PDF generation is coming soon. Your formatted preview below is ready to copy or export as CSV.
              </motion.div>
            )}

            {!loading && preview && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-slate-200"
              >
                <p className="text-emerald-300/90 font-medium">{preview.headline}</p>
                {preview.sections.map((sec) => (
                  <div key={sec.title} className="rounded-xl border border-white/5 bg-black/20 p-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      {sec.title}
                    </h4>
                    <ul className="list-disc list-inside space-y-1.5 text-sm leading-relaxed text-slate-300">
                      {sec.lines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </motion.div>
            )}

            {loading && (
              <div className="h-32 flex items-center justify-center text-slate-500 text-sm">
                Preparing sections from your profile…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
