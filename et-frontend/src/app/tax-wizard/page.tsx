"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  Sparkles,
  Scale,
  MessageSquare,
  Check,
  AlertTriangle,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTaxWizardStore } from "@/store/taxWizardStore";
import { useRouter } from "next/navigation";
import { useProfileStore } from "@/store/profileStore";
import { computeHRA } from "@/lib/engine/tax";
import type { TaxStep } from "@/lib/engine/tax";
import { formatCurrency, cn } from "@/lib/utils";
import { callAI } from "@/lib/ai-proxy";
import { getTaxHistory, saveTaxAnalysis } from "@/lib/supabaseHistory";
import WaterfallChart from "@/components/charts/WaterfallChart";
import FileUpload from "@/components/shared/FileUpload";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";

const FY = "2025-26";

const DEMO_INCOME = {
  gross_salary: 1_800_000,
  basic_salary: 900_000,
  hra_received: 360_000,
  special_allowance: 200_000,
  other_income: 0,
  rent_paid: 25_000,
  is_metro: true,
  professional_tax: 2400,
  standard_deduction: 50_000,
};

const DEMO_DEDUCTIONS = {
  section_80c: { epf: 21_600, ppf: 50_000, elss: 50_000, life_insurance: 28_400, total: 150_000 },
  section_80d: { self_premium: 15_000, parents_premium: 0, preventive_health: 5000, total: 20_000 },
  nps_80ccd_1b: 50_000,
  home_loan_interest_24b: 40_000,
  education_loan_80e: 0,
  donations_80g: 0,
  savings_interest_80tta: 8000,
  hra_exemption: 0,
};

const TAX_ALGORITHM_SECTIONS = [
  {
    title: "Deterministic Tax Engine",
    description:
      "Old regime: applies HRA, 80C (cap ₹1.5L), 80D, NPS 80CCD(1B), home loan 24(b), then slabs 0/5/20/30% with 87A rebate and 4% cess. New regime: ₹75K standard deduction, Budget 2025 slabs, 87A up to ₹60K if taxable ≤ ₹12L.",
  },
  {
    title: "Missed Deduction Finder",
    description:
      "Compares your claimed deductions against section-wise limits and flags underutilized sections with severity levels and potential tax savings.",
  },
  {
    title: "Investment Ranker",
    description:
      "Tax-saving instruments are scored based on fit with your risk profile, then ranked. ELSS, PPF, and NPS are highlighted for profiles they best match.",
  },
];

const PDF_EXTRACT_PREVIEW: Array<{ key: string; label: string; sample: string }> = [
  { key: "gross_salary", label: "Gross salary", sample: "₹18,00,000" },
  { key: "basic_salary", label: "Basic salary", sample: "₹9,00,000" },
  { key: "hra", label: "HRA", sample: "₹3,60,000" },
  { key: "80c", label: "80C (EPF, ELSS, etc.)", sample: "₹1,50,000" },
  { key: "80d", label: "80D (health)", sample: "₹20,000" },
  { key: "nps", label: "NPS 80CCD(1B)", sample: "₹50,000" },
  { key: "home_loan", label: "Home loan 24(b)", sample: "₹40,000" },
];

type RiskProfile = "conservative" | "moderate" | "aggressive";

const INVESTMENT_RANKS: Array<{
  investment: string;
  section: string;
  maxLimit: number;
  lockIn: string;
  expectedReturn: string;
  riskLevel: string;
  profiles: RiskProfile[];
  highlight: boolean;
}> = [
  {
    investment: "ELSS",
    section: "80C",
    maxLimit: 150_000,
    lockIn: "3 years",
    expectedReturn: "12–15% (market-linked)",
    riskLevel: "Moderate–High",
    profiles: ["moderate", "aggressive"],
    highlight: true,
  },
  {
    investment: "PPF",
    section: "80C",
    maxLimit: 150_000,
    lockIn: "15 years",
    expectedReturn: "~7.1% (guaranteed)",
    riskLevel: "Low",
    profiles: ["conservative", "moderate"],
    highlight: true,
  },
  {
    investment: "NPS Tier-1",
    section: "80CCD(1B)",
    maxLimit: 50_000,
    lockIn: "Till age 60",
    expectedReturn: "9–12% (market-linked)",
    riskLevel: "Moderate",
    profiles: ["conservative", "moderate", "aggressive"],
    highlight: true,
  },
  {
    investment: "Tax-saver FD",
    section: "80C",
    maxLimit: 150_000,
    lockIn: "5 years",
    expectedReturn: "7–7.5%",
    riskLevel: "Low",
    profiles: ["conservative"],
    highlight: false,
  },
  {
    investment: "Sukanya Samriddhi",
    section: "80C",
    maxLimit: 150_000,
    lockIn: "21 years",
    expectedReturn: "~8.2%",
    riskLevel: "Low",
    profiles: ["conservative", "moderate"],
    highlight: false,
  },
  {
    investment: "ULIP",
    section: "80C",
    maxLimit: 150_000,
    lockIn: "5 years",
    expectedReturn: "Varies (market-linked)",
    riskLevel: "Moderate–High",
    profiles: ["moderate", "aggressive"],
    highlight: false,
  },
  {
    investment: "Life Insurance",
    section: "80C",
    maxLimit: 150_000,
    lockIn: "Policy term",
    expectedReturn: "Cover-first (not return-focused)",
    riskLevel: "N/A",
    profiles: ["conservative", "moderate", "aggressive"],
    highlight: false,
  },
];

const LIMITS: Record<string, number> = {
  "80C": 150_000,
  "80D": 100_000,
  "80CCD(1B)": 50_000,
  "24(b)": 200_000,
  "80TTA": 10_000,
  "80E": Infinity,
};

function sectionToLimit(section: string): number {
  const k = section.replace(/\s/g, "");
  if (k.includes("80C")) return LIMITS["80C"];
  if (k.includes("80D")) return LIMITS["80D"];
  if (k.includes("80CCD")) return LIMITS["80CCD(1B)"];
  if (k.includes("24")) return LIMITS["24(b)"];
  if (k.includes("80TTA")) return LIMITS["80TTA"];
  if (k.includes("80E")) return LIMITS["80E"];
  return 150_000;
}

function utilizationTone(pct: number): "red" | "amber" | "green" {
  if (pct < 50) return "red";
  if (pct <= 80) return "amber";
  return "green";
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const { getDocument, GlobalWorkerOptions, version } = pdfjs;
  GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  let full = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (item && typeof item === "object" && "str" in item && typeof (item as { str: string }).str === "string") {
        full += `${(item as { str: string }).str} `;
      }
    }
    full += "\n";
  }
  return full;
}

const glass = "rounded-2xl border border-white/10 bg-slate-900/35 backdrop-blur-xl shadow-xl shadow-black/20";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

type TaxHistoryRow = Awaited<ReturnType<typeof getTaxHistory>>[number];

export default function TaxWizardPage() {
  useAuth();

  const { analysis, isAnalyzing, analyze } = useTaxWizardStore();
  const taxRouter = useRouter();
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const profileLoading = useProfileStore((s) => s.isLoading);

  const [income, setIncome] = useState({
    gross_salary: 0,
    basic_salary: 0,
    hra_received: 0,
    special_allowance: 0,
    other_income: 0,
    rent_paid: 0,
    is_metro: true,
    professional_tax: 2400,
    standard_deduction: 50_000,
  });

  const [deductions, setDeductions] = useState({
    section_80c: { epf: 0, ppf: 0, elss: 0, life_insurance: 0, total: 0 },
    section_80d: { self_premium: 0, parents_premium: 0, preventive_health: 0, total: 0 },
    nps_80ccd_1b: 0,
    home_loan_interest_24b: 0,
    education_loan_80e: 0,
    donations_80g: 0,
    savings_interest_80tta: 0,
    hra_exemption: 0,
  });

  const [riskProfile, setRiskProfile] = useState<RiskProfile>("moderate");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [taxHistory, setTaxHistory] = useState<TaxHistoryRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    void getTaxHistory().then(setTaxHistory);
  }, []);

  const hraCalc = useMemo(
    () => computeHRA(income.basic_salary, income.hra_received, income.rent_paid * 12, income.is_metro),
    [income.basic_salary, income.hra_received, income.rent_paid, income.is_metro],
  );

  const update80CTotal = useCallback((total: number) => {
    setDeductions((prev) => ({
      ...prev,
      section_80c: { ...prev.section_80c, epf: 0, ppf: 0, elss: 0, life_insurance: 0, total },
    }));
  }, []);

  const update80DTotal = useCallback((total: number) => {
    setDeductions((prev) => ({
      ...prev,
      section_80d: {
        ...prev.section_80d,
        self_premium: total,
        parents_premium: 0,
        preventive_health: 0,
        total,
      },
    }));
  }, []);

  const buildPayload = useCallback(
    (inc: typeof income, ded: typeof deductions) => ({
      financial_year: FY,
      income_details: {
        gross_salary: inc.gross_salary,
        basic_salary: inc.basic_salary,
        hra_received: inc.hra_received,
        rent_paid: inc.rent_paid,
        is_metro: inc.is_metro,
        standard_deduction: inc.standard_deduction,
        professional_tax: inc.professional_tax,
        income_from_other_sources: inc.other_income,
        rental_income: 0,
        capital_gains: { short_term: 0, long_term: 0 },
      },
      deductions: { ...ded, hra_exemption: hraCalc.exemption },
    }),
    [hraCalc.exemption],
  );

  const handleLoadFromProfile = async () => {
    await fetchProfile();
    const p = useProfileStore.getState().profile;
    if (!p) return;
    const gross = p.annual_income?.gross ?? 0;
    const ss = p.salary_structure;
    setIncome((prev) => ({
      ...prev,
      gross_salary: gross > 0 ? gross : prev.gross_salary,
      basic_salary: ss?.basic != null && ss.basic > 0 ? ss.basic : prev.basic_salary,
      hra_received: ss?.hra != null && ss.hra > 0 ? ss.hra : prev.hra_received,
      special_allowance:
        ss?.special_allowance != null && ss.special_allowance > 0 ? ss.special_allowance : prev.special_allowance,
      rent_paid: p.monthly_expenses?.rent != null && p.monthly_expenses.rent > 0 ? p.monthly_expenses.rent : prev.rent_paid,
    }));
  };

  const handleTrySampleData = () => {
    setIncome((prev) => ({ ...prev, ...DEMO_INCOME }));
    setDeductions(DEMO_DEDUCTIONS);
  };

  const handleTrySampleForm16 = () => {
    setIncome((prev) => ({ ...prev, ...DEMO_INCOME }));
    setDeductions(DEMO_DEDUCTIONS);
    setUploadNote("Sample Form 16 data loaded");
  };

  const handleAnalyze = async () => {
    const useDemo = income.gross_salary <= 0;
    const inc = useDemo ? { ...income, ...DEMO_INCOME } : income;
    const ded = useDemo ? DEMO_DEDUCTIONS : deductions;
    if (useDemo) {
      setIncome((prev) => ({ ...prev, ...DEMO_INCOME }));
      setDeductions(DEMO_DEDUCTIONS);
    }
    const payload = buildPayload(inc, ded);
    try {
      await analyze({ ...payload, risk_profile: riskProfile } as Record<string, unknown>);
      const result = useTaxWizardStore.getState().analysis;
      if (result) {
        await saveTaxAnalysis(result as unknown as Record<string, unknown>);
        const rows = await getTaxHistory();
        setTaxHistory(rows);
      }
    } catch {
      /* store surfaces error via isAnalyzing */
    }
  };

  const handleForm16 = async (file: File) => {
    setUploadNote(null);
    setUploadLoading(true);
    try {
      let text = "";
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else {
        text = await file.text();
      }
      if (!text.trim()) {
        setUploadNote("Could not read text from this file.");
        return;
      }
      const parsed = await callAI<Record<string, unknown>>("/ai/tax/parse-form16", { text });
      const g = typeof parsed.gross_salary === "number" ? parsed.gross_salary : Number(parsed.gross_salary) || 0;
      if (g > 0) {
        setIncome((prev) => ({
          ...prev,
          gross_salary: g,
          basic_salary: Number(parsed.basic_salary) || prev.basic_salary,
          hra_received: Number(parsed.hra_received) || prev.hra_received,
          standard_deduction: Number(parsed.standard_deduction) || prev.standard_deduction,
        }));
      }
      const s80c = Number(parsed.section_80c) || 0;
      const s80d = Number(parsed.section_80d) || 0;
      const nps = Number(parsed.nps_80ccd) || Number(parsed.nps_80ccd_1b) || 0;
      const hl = Number(parsed.home_loan_interest) || 0;
      if (s80c > 0) update80CTotal(s80c);
      if (s80d > 0) update80DTotal(s80d);
      if (nps > 0) setDeductions((d) => ({ ...d, nps_80ccd_1b: nps }));
      if (hl > 0) setDeductions((d) => ({ ...d, home_loan_interest_24b: hl }));
      setUploadNote(
        `Form 16 text parsed (${String(parsed.parse_confidence || "medium")} confidence). Review figures before analyzing.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const unreachable = msg.includes("503") || msg.includes("Cannot reach") || msg.includes("fetch failed");
      setUploadNote(
        unreachable
          ? "Could not reach the FastAPI backend. Open a terminal, cd into the et-backend folder, then run: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload (or double-click et-backend/run.bat on Windows). If you see 'No module named app', you are not inside et-backend. Match AI_SERVICE_URL in et-frontend/.env.local to that port, or enter salary manually."
          : `Form 16 parsing failed: ${msg || "check backend logs."}`,
      );
    } finally {
      setUploadLoading(false);
    }
  };

  const openAdvisor = () => {
    taxRouter.push("/mentor");
  };

  const rc = analysis?.regime_comparison;
  const rec = rc?.recommended_regime;
  const oldR = rc?.old_regime;
  const newR = rc?.new_regime;

  const rankedInvestments = useMemo(() => {
    const scored = INVESTMENT_RANKS.map((row, i) => ({
      row,
      score: row.profiles.includes(riskProfile) ? 100 - i : 50 - i,
      recommended: row.highlight && row.profiles.includes(riskProfile),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [riskProfile]);

  const missedCards = useMemo(() => {
    if (!analysis?.missed_deductions?.length) return [];
    return analysis.missed_deductions.map((m) => {
      const max = sectionToLimit(m.section);
      let current = 0;
      if (m.section.includes("80C")) current = Math.min(deductions.section_80c.total, max);
      else if (m.section.includes("80D")) current = Math.min(deductions.section_80d.total, max);
      else if (m.section.includes("80CCD")) current = Math.min(deductions.nps_80ccd_1b, max);
      else if (m.section.includes("24")) current = Math.min(deductions.home_loan_interest_24b, max);
      else if (m.section.includes("80TTA")) current = Math.min(deductions.savings_interest_80tta, max);
      else current = max * 0.5;
      const pct = max === Infinity || max === 0 ? 100 : Math.min(100, (current / max) * 100);
      return { ...m, current, max: max === Infinity ? current : max, pct, tone: utilizationTone(pct) };
    });
  }, [analysis?.missed_deductions, deductions]);

  const stepsOld: TaxStep[] = oldR?.steps ?? [];
  const stepsNew: TaxStep[] = newR?.steps ?? [];

  const formatHistoryDate = (row: TaxHistoryRow) => {
    const raw = row.analyzed_at;
    if (!raw) return "—";
    try {
      return new Date(raw).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return String(raw);
    }
  };

  return (
    <div className="text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <motion.header
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 p-3 ring-1 ring-emerald-500/30">
              <Calculator className="h-7 w-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Tax Wizard</h1>
              <p className="text-sm text-slate-400">DhanGuru AI Money Mentor — Old vs New regime (FY {FY})</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openAdvisor}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <MessageSquare className="h-4 w-4" />
            AI Tax Advisor
          </button>
        </motion.header>

        {/* Input */}
        <motion.section {...fadeIn} transition={{ duration: 0.35 }} className={cn(glass, "p-6 md:p-8")}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Inputs</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleLoadFromProfile()}
                disabled={profileLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {profileLoading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-300" />
                ) : null}
                Load from Profile
              </button>
              <button
                type="button"
                onClick={handleTrySampleData}
                className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
              >
                Try Sample Data
              </button>
            </div>
          </div>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/90">Salary structure</p>
              {(
                [
                  ["gross_salary", "Gross salary"],
                  ["basic_salary", "Basic salary"],
                  ["hra_received", "HRA received"],
                  ["special_allowance", "Special allowance"],
                  ["other_income", "Other income"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-xs text-slate-400">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={income[key] === 0 ? "" : income[key]}
                    onChange={(e) => {
                      const v = e.target.value === "" ? 0 : Number(e.target.value);
                      setIncome((prev) => ({ ...prev, [key]: v }));
                    }}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    placeholder="0"
                  />
                </label>
              ))}
              <p className="text-[11px] text-slate-500">
                Special allowance is for your reference; tax math uses gross salary as declared CTC.
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-cyan-400/90">Deductions and rent</p>
              {(
                [
                  ["section_80c", "Section 80C (total)"],
                  ["section_80d", "Section 80D (total)"],
                  ["nps_80ccd_1b", "NPS 80CCD(1B)"],
                  ["home_loan_interest_24b", "Home loan interest 24(b)"],
                  ["rent_paid", "Rent paid (monthly)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-xs text-slate-400">{label}</span>
                  <input
                    type="number"
                    min={0}
                    value={
                      key === "section_80c"
                        ? deductions.section_80c.total || ""
                        : key === "section_80d"
                          ? deductions.section_80d.total || ""
                          : key === "rent_paid"
                            ? income.rent_paid || ""
                            : (deductions[key as "nps_80ccd_1b" | "home_loan_interest_24b"] as number) || ""
                    }
                    onChange={(e) => {
                      const v = e.target.value === "" ? 0 : Number(e.target.value);
                      if (key === "section_80c") update80CTotal(v);
                      else if (key === "section_80d") update80DTotal(v);
                      else if (key === "rent_paid") setIncome((p) => ({ ...p, rent_paid: v }));
                      else setDeductions((d) => ({ ...d, [key]: v }));
                    }}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    placeholder="0"
                  />
                </label>
              ))}
              <div>
                <span className="mb-1.5 block text-xs text-slate-400">Metro city</span>
                <div className="flex gap-2">
                  {[true, false].map((m) => (
                    <button
                      key={String(m)}
                      type="button"
                      onClick={() => setIncome((p) => ({ ...p, is_metro: m }))}
                      className={cn(
                        "flex-1 rounded-xl border py-2.5 text-sm font-medium transition",
                        income.is_metro === m
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                          : "border-slate-700/60 text-slate-400 hover:border-slate-600",
                      )}
                    >
                      {m ? "Metro" : "Non-metro"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">Form 16 (PDF)</p>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              <div className="min-w-0 flex-1">
                <FileUpload
                  accept="application/pdf,.pdf"
                  label="Upload Form 16 PDF — text is extracted and sent for parsing"
                  isLoading={uploadLoading}
                  onFileSelect={handleForm16}
                />
              </div>
              <button
                type="button"
                onClick={handleTrySampleForm16}
                className="shrink-0 self-stretch rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 lg:w-48"
              >
                Try Sample Form 16
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-5 ring-1 ring-cyan-500/10">
              <p className="mb-4 text-sm font-semibold text-cyan-200/95">What PDF analysis extracts:</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PDF_EXTRACT_PREVIEW.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-left"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{row.label}</p>
                    <p className="mt-1 font-mono text-sm text-emerald-300/90">{row.sample}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Parsed values populate salary and deduction fields above; always verify against your Form 16 before filing.
              </p>
            </div>

            {uploadNote && (
              <p
                className={cn(
                  "mt-3 text-sm",
                  uploadNote.includes("parsed") || uploadNote.includes("Sample Form 16")
                    ? "text-emerald-400/90"
                    : "text-amber-400/90",
                )}
              >
                {uploadNote}
              </p>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze
            </button>
            <span className="text-xs text-slate-500">
              Leave gross salary empty to run a full demo scenario.
            </span>
          </div>
        </motion.section>

        {/* Results */}
        {analysis && rc && oldR && newR && (
          <>
            <motion.section {...fadeIn} transition={{ duration: 0.4 }} className={cn(glass, "p-6 md:p-8")}>
              <div className="mb-6 flex items-center gap-2">
                <Scale className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-semibold">Regime comparison</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {(
                  [
                    ["old", "Old Regime", oldR],
                    ["new", "New Regime", newR],
                  ] as const
                ).map(([id, title, data]) => {
                  const isBest = rec === id;
                  return (
                    <motion.div
                      key={id}
                      className={cn(
                        "rounded-xl border p-5 transition-colors",
                        isBest
                          ? "border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                          : "border-slate-700/50 bg-slate-950/40",
                      )}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-white">{title}</h3>
                        {isBest && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                            <Check className="h-3 w-3" /> Recommended
                          </span>
                        )}
                      </div>
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Taxable income</dt>
                          <dd className="font-mono text-white">{formatCurrency(data.taxable_income)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Tax payable</dt>
                          <dd className="font-mono text-slate-200">{formatCurrency(data.tax_payable)}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-400">Cess</dt>
                          <dd className="font-mono text-slate-200">{formatCurrency(data.cess)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                          <dt className="text-slate-300">Total tax</dt>
                          <dd className="font-mono text-lg font-semibold text-white">
                            <AnimatedCounter value={data.total_tax} prefix="₹" className="text-white" />
                          </dd>
                        </div>
                      </dl>
                    </motion.div>
                  );
                })}
              </div>

              <motion.p
                className="mt-6 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-200"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                You save{" "}
                <span className="font-semibold text-white">
                  <AnimatedCounter value={rc.savings} prefix="₹" />
                </span>{" "}
                with the {rec === "old" ? "Old" : "New"} Regime
              </motion.p>

              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                    <TrendingDown className="h-4 w-4 text-cyan-400" />
                    Old regime waterfall
                  </h4>
                  <WaterfallChart
                    steps={stepsOld.map((s) => ({
                      label: s.label,
                      amount: s.amount,
                      type: s.type,
                      running_total: s.running_total,
                    }))}
                  />
                </div>
                <div>
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                    <TrendingDown className="h-4 w-4 text-cyan-400" />
                    New regime waterfall
                  </h4>
                  <WaterfallChart
                    steps={stepsNew.map((s) => ({
                      label: s.label,
                      amount: s.amount,
                      type: s.type,
                      running_total: s.running_total,
                    }))}
                  />
                </div>
              </div>
            </motion.section>

            {/* Missed deductions */}
            {missedCards.length > 0 && (
              <motion.section {...fadeIn} className={cn(glass, "p-6 md:p-8")}>
                <div className="mb-6 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <h2 className="text-lg font-semibold">Missed deduction opportunities</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {missedCards.map((m, i) => (
                    <div
                      key={`${m.section}-${i}`}
                      className="rounded-xl border border-slate-700/50 bg-slate-950/30 p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-white">Section {m.section}</span>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase",
                            m.severity === "high"
                              ? "text-red-400"
                              : m.severity === "medium"
                                ? "text-amber-400"
                                : "text-slate-500",
                          )}
                        >
                          {m.severity}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">{m.description}</p>
                      <div className="mt-3 text-xs text-slate-500">
                        Utilized: {formatCurrency(m.current)} / {formatCurrency(m.max)}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            m.tone === "red" && "bg-red-500",
                            m.tone === "amber" && "bg-amber-500",
                            m.tone === "green" && "bg-emerald-500",
                          )}
                          style={{ width: `${Math.min(100, m.pct)}%` }}
                        />
                      </div>
                      {m.potential_saving > 0 && (
                        <p className="mt-2 text-xs font-medium text-emerald-400/90">
                          Potential tax saving: {formatCurrency(m.potential_saving)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Investment ranker */}
            <motion.section {...fadeIn} className={cn(glass, "p-6 md:p-8")}>
              <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">Tax-saving investment ranker</h2>
                <div className="flex gap-2">
                  {(["conservative", "moderate", "aggressive"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setRiskProfile(p)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium capitalize",
                        riskProfile === p
                          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200"
                          : "border-slate-700 text-slate-400 hover:border-slate-600",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Ranked by fit for your selected risk profile; highlighted rows match your profile best.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-3 pr-4 font-medium">Investment</th>
                      <th className="pb-3 pr-4 font-medium">Section</th>
                      <th className="pb-3 pr-4 font-medium">Max limit</th>
                      <th className="pb-3 pr-4 font-medium">Lock-in</th>
                      <th className="pb-3 pr-4 font-medium">Expected return</th>
                      <th className="pb-3 font-medium">Risk level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedInvestments.map(({ row, recommended }) => (
                      <tr
                        key={row.investment}
                        className={cn(
                          "border-b border-slate-800/80",
                          recommended && "bg-emerald-500/5",
                        )}
                      >
                        <td className="py-3 pr-4 font-medium text-white">
                          {row.investment}
                          {recommended && (
                            <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              Match
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-400">{row.section}</td>
                        <td className="py-3 pr-4 font-mono text-slate-300">{formatCurrency(row.maxLimit)}</td>
                        <td className="py-3 pr-4 text-slate-400">{row.lockIn}</td>
                        <td className="py-3 pr-4 text-slate-400">{row.expectedReturn}</td>
                        <td className="py-3 text-slate-300">{row.riskLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>

            {analysis.ai_summary && (
              <motion.section {...fadeIn} className={cn(glass, "border-amber-500/20 bg-amber-500/5 p-6")}>
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-400/90">Summary</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{analysis.ai_summary}</p>
              </motion.section>
            )}
          </>
        )}

        {/* Previous analyses (Supabase) */}
        <div className={cn(glass, "overflow-hidden p-0")}>
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left transition hover:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-200">Previous Analyses</span>
              {taxHistory.length > 0 && (
                <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {taxHistory.length}
                </span>
              )}
            </div>
            {historyOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
          </button>
          <div
            className={cn(
              "overflow-hidden border-t border-white/10 transition-all duration-300",
              historyOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="space-y-3 px-6 pb-6 pt-2">
              {taxHistory.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Sign in and run an analysis to see saved history here (or none saved yet).
                </p>
              ) : (
                taxHistory.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-700/50 bg-slate-950/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs text-slate-500">{formatHistoryDate(row)}</p>
                      <p className="mt-0.5 text-sm font-medium text-white">
                        Recommended:{" "}
                        <span className="text-emerald-300">{row.recommended_regime === "old" ? "Old" : "New"} regime</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Savings vs other regime</p>
                      <p className="font-mono text-sm font-semibold text-cyan-200">
                        {formatCurrency(row.savings_potential ?? 0)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <AlgorithmExplanation sections={TAX_ALGORITHM_SECTIONS} />
      </div>
    </div>
  );
}
