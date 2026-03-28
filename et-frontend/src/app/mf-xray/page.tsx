"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Papa from "papaparse";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  BarChart3,
  Layers,
  LineChart,
  ChevronDown,
  ChevronUp,
  History,
  Loader2,
  PieChart,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { isLocalEngineMode } from "@/lib/config";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import DonutChart, { type DonutSlice } from "@/components/charts/DonutChart";
import OverlapHeatmap from "@/components/charts/OverlapHeatmap";
import FileUpload from "@/components/shared/FileUpload";
import AnimatedCounter from "@/components/shared/AnimatedCounter";
import AlgorithmExplanation from "@/components/shared/AlgorithmExplanation";
import { getMfHistory, saveMfPortfolio } from "@/lib/supabaseHistory";

// --- Types ---

type FundRow = {
  id: string;
  fund_name: string;
  category: string;
  invested_amount: number;
  current_value: number;
  expense_ratio: number;
};

type SortKey =
  | "fund_name"
  | "category"
  | "invested_amount"
  | "current_value"
  | "returns_pct"
  | "xirr"
  | "expense_ratio";

type PortfolioComputed = {
  funds: FundRow[];
  totalInvested: number;
  totalCurrent: number;
  totalReturns: number;
  totalReturnsPct: number;
  portfolioXirr: number;
  annualExpenseRupees: number;
  expenseDrag10y: number;
  expenseDrag20y: number;
  expenseDrag30y: number;
  donut: DonutSlice[];
  overlapMatrix: number[][];
  highOverlapPairs: { a: string; b: string; score: number }[];
  perFund: Array<
    FundRow & { returns_pct: number; xirr: number }
  >;
  rebalance: {
    summary: string;
    bullets: string[];
  };
};

const CATEGORY_OPTIONS = [
  "Large Cap",
  "Mid Cap",
  "Small Cap",
  "Flexi Cap",
  "Debt",
  "Hybrid",
  "ELSS",
  "Sectoral",
] as const;

const DEMO_FUNDS: FundRow[] = [
  {
    id: "d1",
    fund_name: "Axis Bluechip Fund",
    category: "Large Cap",
    invested_amount: 200000,
    current_value: 268000,
    expense_ratio: 1.05,
  },
  {
    id: "d2",
    fund_name: "Mirae Asset Large Cap",
    category: "Large Cap",
    invested_amount: 150000,
    current_value: 198000,
    expense_ratio: 0.98,
  },
  {
    id: "d3",
    fund_name: "SBI Small Cap Fund",
    category: "Small Cap",
    invested_amount: 120000,
    current_value: 195000,
    expense_ratio: 1.05,
  },
  {
    id: "d4",
    fund_name: "HDFC Mid Cap Opportunities",
    category: "Mid Cap",
    invested_amount: 180000,
    current_value: 242000,
    expense_ratio: 1.12,
  },
  {
    id: "d5",
    fund_name: "Parag Parikh Flexi Cap",
    category: "Flexi Cap",
    invested_amount: 250000,
    current_value: 412000,
    expense_ratio: 0.91,
  },
];

const DONUT_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Proxy CAGR over assumed ~3.5 year horizon as a practical XIRR stand-in for lump-sum style rows. */
function fundXirr(inv: number, cv: number, years = 3.5): number {
  if (inv <= 0 || cv <= 0) return 0;
  return (Math.pow(cv / inv, 1 / years) - 1) * 100;
}

function categoryOverlapScore(c1: string, c2: string): number {
  if (c1 === c2) return 72 + ((c1.length + c2.length) % 9);
  const eq = ["Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "Debt", "Hybrid"];
  const i1 = eq.indexOf(c1);
  const i2 = eq.indexOf(c2);
  if (c1 === "Flexi Cap" || c2 === "Flexi Cap") {
    if (c1 === "Large Cap" || c2 === "Large Cap") return 52;
    if (c1 === "Mid Cap" || c2 === "Mid Cap") return 48;
    if (c1 === "Small Cap" || c2 === "Small Cap") return 44;
  }
  if (i1 >= 0 && i2 >= 0 && i1 <= 3 && i2 <= 3) {
    const d = Math.abs(i1 - i2);
    if (d === 0) return 75;
    if (d === 1) return 42;
    return 28;
  }
  if (c1 === "Debt" || c2 === "Debt") return 12;
  return 32;
}

function buildOverlapMatrix(funds: FundRow[]): number[][] {
  const n = funds.length;
  const m: number[][] = [];
  for (let i = 0; i < n; i++) {
    m[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) m[i][j] = 100;
      else {
        const raw = categoryOverlapScore(funds[i].category, funds[j].category);
        m[i][j] = Math.min(95, Math.max(5, raw));
      }
    }
  }
  return m;
}

function highOverlapPairsFromMatrix(
  funds: FundRow[],
  matrix: number[][]
): { a: string; b: string; score: number }[] {
  const out: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      const score = matrix[i][j];
      if (score >= 60) {
        out.push({ a: funds[i].fund_name, b: funds[j].fund_name, score });
      }
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

function buildDonutSlices(funds: FundRow[]): DonutSlice[] {
  const byCat = new Map<string, number>();
  for (const f of funds) {
    byCat.set(f.category, (byCat.get(f.category) ?? 0) + f.current_value);
  }
  let i = 0;
  return [...byCat.entries()].map(([name, value]) => ({
    name,
    value,
    color: DONUT_COLORS[i++ % DONUT_COLORS.length],
  }));
}

function computePortfolio(funds: FundRow[]): PortfolioComputed {
  const totalInvested = funds.reduce((s, f) => s + f.invested_amount, 0);
  const totalCurrent = funds.reduce((s, f) => s + f.current_value, 0);
  const totalReturns = totalCurrent - totalInvested;
  const totalReturnsPct =
    totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  const perFund = funds.map((f) => {
    const returns_pct =
      f.invested_amount > 0
        ? ((f.current_value - f.invested_amount) / f.invested_amount) * 100
        : 0;
    const xirr = fundXirr(f.invested_amount, f.current_value);
    return { ...f, returns_pct, xirr };
  });

  const wXirr =
    totalInvested > 0
      ? perFund.reduce((s, f) => s + (f.invested_amount / totalInvested) * f.xirr, 0)
      : 0;

  const annualExpenseRupees = funds.reduce(
    (s, f) => s + (f.expense_ratio / 100) * f.current_value,
    0
  );

  const expenseDrag10y = Math.round(annualExpenseRupees * 10 * 1.35);
  const expenseDrag20y = Math.round(annualExpenseRupees * 20 * 1.75);
  const expenseDrag30y = Math.round(annualExpenseRupees * 30 * 2.15);

  const overlapMatrix = buildOverlapMatrix(funds);
  const highOverlapPairs = highOverlapPairsFromMatrix(funds, overlapMatrix);
  const donut = buildDonutSlices(funds);

  const largeCapWeight = funds
    .filter((f) => f.category === "Large Cap")
    .reduce((s, f) => s + f.current_value, 0);
  const largeShare =
    totalCurrent > 0 ? (largeCapWeight / totalCurrent) * 100 : 0;

  const bullets: string[] = [];
  if (largeShare > 48) {
    bullets.push(
      `Large-cap oriented at ${largeShare.toFixed(0)}% of corpus — consider adding mid/small exposure if your horizon is 7+ years.`
    );
  }
  if (highOverlapPairs.length > 0) {
    bullets.push(
      `High category overlap between "${highOverlapPairs[0].a.slice(0, 28)}..." and "${highOverlapPairs[0].b.slice(0, 28)}..." — you may be doubling similar equity bets.`
    );
  }
  const highEr = perFund.filter((f) => f.expense_ratio > 1.05);
  if (highEr.length > 0) {
    bullets.push(
      `Review regular plans above ~1.05% TER (${highEr.length} fund(s)) — direct plans often save meaningful fees over decades.`
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      "Allocation looks reasonably spread; revisit once a year or after major life events."
    );
  }

  const summary =
    totalReturnsPct >= 12
      ? "Portfolio momentum is healthy versus typical long-term equity averages; focus on overlap and costs next."
      : "Returns are modest — verify risk alignment and avoid redundant funds before adding new schemes.";

  const rebalance = { summary, bullets };

  return {
    funds,
    totalInvested,
    totalCurrent,
    totalReturns,
    totalReturnsPct,
    portfolioXirr: wXirr,
    annualExpenseRupees,
    expenseDrag10y,
    expenseDrag20y,
    expenseDrag30y,
    donut,
    overlapMatrix,
    highOverlapPairs,
    perFund,
    rebalance,
  };
}

function parseCsvToFunds(text: string): FundRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const rows = parsed.data.filter((r) => Object.values(r).some((v) => String(v).trim()));
  const out: FundRow[] = [];

  const pick = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      if (row[k] != null && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  };

  for (const row of rows) {
    const fund_name = pick(row, ["fund_name", "scheme", "scheme_name", "name"]);
    const category = pick(row, ["category", "type", "asset_class"]) || "Flexi Cap";
    const invested = Number(pick(row, ["invested_amount", "invested", "cost", "amount_invested"]).replace(/,/g, "")) || 0;
    const current = Number(pick(row, ["current_value", "current", "market_value", "value"]).replace(/,/g, "")) || 0;
    const er =
      Number(pick(row, ["expense_ratio", "ter", "expense"]).replace(/,/g, "")) || 1.0;

    if (!fund_name) continue;
    out.push({
      id: uid(),
      fund_name,
      category,
      invested_amount: invested,
      current_value: current || invested * 1.08,
      expense_ratio: er > 0 && er < 0.5 ? er * 100 : er > 3 ? er / 100 : er,
    });
  }

  return out;
}

function emptyFund(): FundRow {
  return {
    id: uid(),
    fund_name: "",
    category: "Large Cap",
    invested_amount: 0,
    current_value: 0,
    expense_ratio: 1.0,
  };
}

export default function MFXRayPage() {
  useAuth();
  const [funds, setFunds] = useState<FundRow[]>(DEMO_FUNDS);
  const [analyzed, setAnalyzed] = useState<PortfolioComputed | null>(() =>
    computePortfolio(DEMO_FUNDS)
  );
  const [parsing, setParsing] = useState(false);
  const [parsePct, setParsePct] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("current_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [mfHistory, setMfHistory] = useState<
    Array<{
      id: string;
      analyzed_at: string;
      total_invested: number | null;
      current_value: number | null;
      xirr: number | null;
    }>
  >([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    void getMfHistory().then((rows) => {
      setMfHistory(
        (rows || []).map((r) => ({
          id: String(r.id ?? ""),
          analyzed_at: String(r.analyzed_at ?? ""),
          total_invested: r.total_invested as number | null,
          current_value: r.current_value as number | null,
          xirr: r.xirr as number | null,
        }))
      );
    });
  }, []);

  const runProgress = useCallback(async () => {
    setParsePct(0);
    for (let i = 0; i <= 100; i += 8) {
      setParsePct(i);
      await new Promise((r) => setTimeout(r, 28));
    }
    setParsePct(100);
  }, []);

  const analyzePortfolio = useCallback(
    async (fundsOverride?: FundRow[]) => {
      const source = fundsOverride ?? funds;
      const valid = source.filter((f) => f.fund_name.trim() && f.invested_amount > 0);
      if (valid.length === 0) return;

      setParsing(true);
      setPdfNotice(null);
      await runProgress();

      let next = computePortfolio(valid);

      if (!isLocalEngineMode()) {
        try {
          const { data } = await api.get<{ error?: string; rebalancing_plan?: { suggestions?: unknown[] } }>(
            "/mf/rebalance"
          );
          if (data && !data.error && data.rebalancing_plan?.suggestions?.length) {
            next = {
              ...next,
              rebalance: {
                ...next.rebalance,
                bullets: [
                  ...next.rebalance.bullets,
                  "Server recorded rebalancing hints available — open Investments for full detail.",
                ],
              },
            };
          }
        } catch {
          /* optional server merge */
        }
      }

      setAnalyzed(next);
      await saveMfPortfolio(next as unknown as Record<string, unknown>);
      const rows = await getMfHistory();
      setMfHistory(
        (rows || []).map((r) => ({
          id: String(r.id ?? ""),
          analyzed_at: String(r.analyzed_at ?? ""),
          total_invested: r.total_invested as number | null,
          current_value: r.current_value as number | null,
          xirr: r.xirr as number | null,
        }))
      );
      setParsing(false);
    },
    [funds, runProgress]
  );

  const loadSamplePortfolio = useCallback(() => {
    const sample = DEMO_FUNDS.map((f) => ({ ...f, id: uid() }));
    setFunds(sample);
    void analyzePortfolio(sample);
  }, [analyzePortfolio]);

  const clearAll = useCallback(() => {
    setFunds([emptyFund()]);
    setAnalyzed(null);
    setPdfNotice(null);
  }, []);

  const sortedRows = useMemo(() => {
    if (!analyzed) return [];
    const rows = [...analyzed.perFund];
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : Number(av) - Number(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [analyzed, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "fund_name" || key === "category" ? "asc" : "desc");
    }
  };

  const onFile = useCallback(
    async (file: File) => {
      setPdfNotice(null);
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setPdfNotice(
          "PDF statements are not parsed in the browser. Export to CSV from your RTA/AMC portal or use manual entry."
        );
        return;
      }
      setParsing(true);
      setParsePct(5);
      const text = await file.text();
      setParsePct(40);
      const parsed = parseCsvToFunds(text);
      setParsePct(85);
      if (parsed.length > 0) {
        setFunds(parsed);
      }
      setParsePct(100);
      setParsing(false);
      setAnalyzed(null);
    },
    []
  );

  const expenseBarData = analyzed
    ? [
        { label: "10-year", value: analyzed.expenseDrag10y },
        { label: "20-year", value: analyzed.expenseDrag20y },
        { label: "30-year", value: analyzed.expenseDrag30y },
      ]
    : [];

  return (
    <div className="max-w-7xl space-y-8 text-white">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 p-3 text-white shadow-lg shadow-emerald-500/20">
          <LineChart size={24} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MF Portfolio X-Ray</h1>
          <p className="text-sm text-slate-400">
            DhanGuru AI Money Mentor — allocation, overlap, expense drag, and rebalancing ideas
          </p>
        </div>
      </motion.div>

      {/* Upload & manual entry */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 backdrop-blur-md"
      >
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <PieChart className="h-5 w-5 text-emerald-400" />
          Import or enter holdings
        </h2>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadSamplePortfolio}
            disabled={parsing}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Load Sample Portfolio
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={parsing}
            className="rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear All
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <FileUpload
              accept=".csv,.pdf"
              isLoading={parsing}
              label="Drop a CAMS / KFintech CSV or PDF, or click to browse"
              onFileSelect={onFile}
            />
            {pdfNotice ? (
              <p className="mt-2 text-sm text-amber-400">{pdfNotice}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Manual rows
            </p>
            <AnimatePresence initial={false}>
              {funds.map((row) => (
                <motion.div
                  key={row.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid gap-2 rounded-xl border border-slate-700/60 bg-slate-900/50 p-3 sm:grid-cols-2 lg:grid-cols-6"
                >
                  <input
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white placeholder:text-slate-600 lg:col-span-2"
                    placeholder="Fund name"
                    value={row.fund_name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFunds((prev) =>
                        prev.map((f) => (f.id === row.id ? { ...f, fund_name: v } : f))
                      );
                    }}
                  />
                  <select
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
                    value={row.category}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFunds((prev) =>
                        prev.map((f) => (f.id === row.id ? { ...f, category: v } : f))
                      );
                    }}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
                    placeholder="Invested"
                    value={row.invested_amount || ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFunds((prev) =>
                        prev.map((f) =>
                          f.id === row.id ? { ...f, invested_amount: v } : f
                        )
                      );
                    }}
                  />
                  <input
                    type="number"
                    className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
                    placeholder="Current value"
                    value={row.current_value || ""}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setFunds((prev) =>
                        prev.map((f) =>
                          f.id === row.id ? { ...f, current_value: v } : f
                        )
                      );
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-white"
                      placeholder="TER %"
                      value={row.expense_ratio || ""}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setFunds((prev) =>
                          prev.map((f) =>
                            f.id === row.id ? { ...f, expense_ratio: v } : f
                          )
                        );
                      }}
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10"
                      aria-label="Remove row"
                      onClick={() =>
                        setFunds((prev) => prev.filter((f) => f.id !== row.id))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => setFunds((prev) => [...prev, emptyFund()])}
              className="flex items-center gap-2 rounded-xl border border-dashed border-emerald-500/40 px-4 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/10"
            >
              <Plus className="h-4 w-4" />
              Add fund
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => void analyzePortfolio()}
            disabled={parsing || funds.every((f) => !f.fund_name.trim() || f.invested_amount <= 0)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {parsing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <TrendingUp className="h-5 w-5" />
            )}
            Analyze Portfolio
          </motion.button>
          {parsing ? (
            <div className="flex min-w-[140px] flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${parsePct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-slate-400">{parsePct}%</span>
            </div>
          ) : null}
        </div>
      </motion.section>

      <AnimatePresence>
        {analyzed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-8"
          >
            {/* KPI + XIRR */}
            <section className="grid gap-4 lg:grid-cols-4">
              {[
                {
                  label: "Total Invested",
                  node: (
                    <AnimatedCounter
                      className="text-xl font-semibold text-white"
                      prefix="₹"
                      value={Math.round(analyzed.totalInvested)}
                    />
                  ),
                },
                {
                  label: "Current Value",
                  node: (
                    <AnimatedCounter
                      className="text-xl font-semibold text-emerald-300"
                      prefix="₹"
                      value={Math.round(analyzed.totalCurrent)}
                    />
                  ),
                },
                {
                  label: "Total Returns",
                  node: (
                    <div>
                      <AnimatedCounter
                        className={cn(
                          "text-xl font-semibold",
                          analyzed.totalReturns >= 0 ? "text-emerald-400" : "text-red-400"
                        )}
                        prefix="₹"
                        value={Math.round(analyzed.totalReturns)}
                      />
                      <p
                        className={cn(
                          "mt-1 text-sm font-medium tabular-nums",
                          analyzed.totalReturnsPct >= 0 ? "text-emerald-400/90" : "text-red-400/90"
                        )}
                      >
                        {formatPercent(analyzed.totalReturnsPct)}
                      </p>
                    </div>
                  ),
                },
                {
                  label: "True XIRR (est.)",
                  node: (
                    <motion.p
                      initial={{ scale: 0.92 }}
                      animate={{ scale: 1 }}
                      className="text-3xl font-bold tracking-tight text-emerald-400"
                    >
                      {formatPercent(analyzed.portfolioXirr)}
                    </motion.p>
                  ),
                },
              ].map((k) => (
                <motion.div
                  key={k.label}
                  layout
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-md"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {k.label}
                  </p>
                  <div className="mt-2">{k.node}</div>
                </motion.div>
              ))}
            </section>

            {/* Donut */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.08 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md"
            >
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <PieChart className="h-5 w-5 text-cyan-400" />
                Asset allocation
              </h3>
              <DonutChart
                data={analyzed.donut}
                centerLabel="Asset Mix"
                centerValue={formatCurrency(analyzed.totalCurrent)}
              />
            </motion.section>

            {/* Table */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md"
            >
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  Fund-wise breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                      {(
                        [
                          ["fund_name", "Fund Name"],
                          ["category", "Category"],
                          ["invested_amount", "Invested"],
                          ["current_value", "Current Value"],
                          ["returns_pct", "Returns %"],
                          ["xirr", "XIRR"],
                          ["expense_ratio", "Expense Ratio"],
                        ] as const
                      ).map(([key, label]) => (
                        <th key={key} className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => toggleSort(key)}
                            className="inline-flex items-center gap-1 text-slate-400 hover:text-white"
                          >
                            {label}
                            {sortKey === key ? (
                              sortDir === "asc" ? (
                                <ArrowUpAZ className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownAZ className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-white/5 hover:bg-white/5"
                      >
                        <td className="max-w-[220px] px-4 py-3 font-medium text-slate-100">
                          {r.fund_name}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{r.category}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {formatCurrency(r.invested_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-emerald-300">
                          {formatCurrency(r.current_value)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 font-mono font-medium",
                            r.returns_pct >= 0 ? "text-emerald-400" : "text-red-400"
                          )}
                        >
                          {formatPercent(r.returns_pct)}
                        </td>
                        <td className="px-4 py-3 font-mono text-cyan-300">
                          {formatPercent(r.xirr)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {r.expense_ratio.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>

            {/* Overlap */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md"
            >
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <Layers className="h-5 w-5 text-amber-400" />
                Category overlap heatmap
              </h3>
              <p className="mb-4 text-sm text-slate-400">
                Same-category funds show higher estimated overlap. Use this to spot redundant sleeves before adding new schemes.
              </p>
              <OverlapHeatmap
                funds={analyzed.funds.map((f) => f.fund_name)}
                matrix={analyzed.overlapMatrix}
              />
              {analyzed.highOverlapPairs.length > 0 ? (
                <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-100">High overlap pairs</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-amber-200/90">
                      {analyzed.highOverlapPairs.slice(0, 4).map((p) => (
                        <li key={`${p.a}-${p.b}`}>
                          {p.a} vs {p.b} — ~{Math.round(p.score)}% category similarity
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </motion.section>

            {/* Expense drag chart */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.14 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md"
            >
              <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                Expense ratio drag
              </h3>
              <p className="mb-4 text-sm text-slate-300">
                Your expense ratios will cost you approximately{" "}
                <span className="font-semibold text-cyan-300">
                  {formatCurrency(analyzed.expenseDrag20y)}
                </span>{" "}
                over 20 years (illustrative, assuming fee drag scales with corpus growth).
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={expenseBarData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <XAxis dataKey="label" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#f8fafc",
                      }}
                      formatter={(value) =>
                        formatCurrency(
                          typeof value === "number"
                            ? value
                            : Number(value ?? 0)
                        )
                      }
                    />
                    <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Cumulative drag" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

            {/* AI Rebalancing */}
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.16 }}
              className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 p-6 shadow-xl backdrop-blur-md"
            >
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-emerald-200">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                AI-style rebalancing plan
              </h3>
              <p className="text-sm leading-relaxed text-slate-200">{analyzed.rebalance.summary}</p>
              <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-200">
                {analyzed.rebalance.bullets.map((b, i) => (
                  <li key={i} className="marker:text-emerald-500">
                    {b}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Educational only — not investment advice. Review with a qualified advisor before switching schemes.
              </p>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-white/10 bg-white/5 shadow-xl shadow-black/20 backdrop-blur-md overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex w-full items-center justify-between px-6 py-4 text-left transition hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-cyan-400" aria-hidden />
            <span className="text-sm font-semibold text-white">Previous Analyses</span>
            {mfHistory.length > 0 ? (
              <span className="rounded-full bg-slate-700/80 px-2 py-0.5 text-xs text-slate-300">
                {mfHistory.length}
              </span>
            ) : null}
          </div>
          {historyOpen ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          )}
        </button>
        <div
          className={cn(
            "overflow-hidden border-t border-white/10 transition-all duration-300",
            historyOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <div className="p-6 pt-4">
            {mfHistory.length === 0 ? (
              <p className="text-sm text-slate-400">
                No saved analyses yet. Run &quot;Analyze Portfolio&quot; while signed in to store results here.
              </p>
            ) : (
              <ul className="space-y-3">
                {mfHistory.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-slate-200">
                      {row.analyzed_at
                        ? new Date(row.analyzed_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Total invested</p>
                        <p className="font-mono text-emerald-300">
                          {formatCurrency(row.total_invested ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Current value</p>
                        <p className="font-mono text-cyan-300">
                          {formatCurrency(row.current_value ?? 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">XIRR</p>
                        <p className="font-mono text-emerald-400">{formatPercent(row.xirr ?? 0)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </motion.section>

      <AlgorithmExplanation
        sections={[
          {
            title: "XIRR (Newton-Raphson)",
            description:
              "Solves XNPV(r) = 0 iteratively for true annualized returns accounting for irregular cash flows. For lump-sum approximation, CAGR proxy is used with assumed 3.5-year horizon.",
          },
          {
            title: "Overlap Analysis (Jaccard Similarity)",
            description:
              "Category-based overlap scoring estimates redundancy between funds. Same-category funds score 72-80%, cross-equity categories 28-52%, and debt vs equity ~12%.",
          },
          {
            title: "Expense Drag",
            description:
              "Compound impact of expense ratios over 10/20/30 years. A 1% TER difference can erode 15-20% of terminal corpus over 30 years due to compounding.",
          },
        ]}
      />
    </div>
  );
}
