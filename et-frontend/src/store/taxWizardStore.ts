import { create } from "zustand";
import api from "@/lib/api";
import {
  type TaxAnalyzePayload,
  type TaxAnalysisResult,
} from "@/lib/engine/tax";

export interface TaxHistoryEntry {
  id: number;
  timestamp: string;
  gross_salary: number;
  recommended_regime: "old" | "new";
  savings: number;
  old_tax: number;
  new_tax: number;
  income: Record<string, unknown>;
  deductions: Record<string, unknown>;
  analysis: TaxAnalysisResult;
}

interface TaxWizardState {
  analysis: TaxAnalysisResult | null;
  isAnalyzing: boolean;
  history: TaxHistoryEntry[];
  analyze: (data: Record<string, unknown>) => Promise<void>;
  uploadForm16: (file: File) => Promise<Record<string, unknown>>;
  saveToHistory: (
    income: Record<string, unknown>,
    deductions: Record<string, unknown>,
  ) => void;
  loadHistory: () => void;
}

function parseCSVForm16(text: string): {
  parsed: boolean;
  income?: Record<string, number | boolean>;
  deductions?: Record<string, unknown>;
  message?: string;
} {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2)
    return { parsed: false, message: "CSV is too short to parse." };

  const fieldMap: Record<string, [string, string, string?]> = {
    "gross salary": ["income", "gross_salary"],
    "basic salary": ["income", "basic_salary"],
    "hra received": ["income", "hra_received"],
    "rent paid monthly": ["income", "rent_paid"],
    "rent paid": ["income", "rent_paid"],
    city: ["income", "is_metro"],
    "professional tax": ["income", "professional_tax"],
    "other income": ["income", "income_from_other_sources"],
    epf: ["deductions", "epf", "section_80c"],
    "epf (80c)": ["deductions", "epf", "section_80c"],
    ppf: ["deductions", "ppf", "section_80c"],
    "ppf (80c)": ["deductions", "ppf", "section_80c"],
    elss: ["deductions", "elss", "section_80c"],
    "elss (80c)": ["deductions", "elss", "section_80c"],
    "life insurance": ["deductions", "life_insurance", "section_80c"],
    "life insurance (80c)": ["deductions", "life_insurance", "section_80c"],
    "health insurance self": ["deductions", "self_premium", "section_80d"],
    "health insurance self (80d)": [
      "deductions",
      "self_premium",
      "section_80d",
    ],
    "health insurance parents": [
      "deductions",
      "parents_premium",
      "section_80d",
    ],
    "preventive health checkup": [
      "deductions",
      "preventive_health",
      "section_80d",
    ],
    "preventive health checkup (80d)": [
      "deductions",
      "preventive_health",
      "section_80d",
    ],
    nps: ["deductions", "nps_80ccd_1b"],
    "nps 80ccd1b": ["deductions", "nps_80ccd_1b"],
    "nps 80ccd(1b)": ["deductions", "nps_80ccd_1b"],
    "home loan interest": ["deductions", "home_loan_interest_24b"],
    "home loan interest 24b": ["deductions", "home_loan_interest_24b"],
    "home loan interest 24(b)": ["deductions", "home_loan_interest_24b"],
    "education loan 80e": ["deductions", "education_loan_80e"],
    "savings interest": ["deductions", "savings_interest_80tta"],
    "savings interest 80tta": ["deductions", "savings_interest_80tta"],
    "donations 80g": ["deductions", "donations_80g"],
  };

  const income: Record<string, number | boolean> = {};
  const section_80c: Record<string, number> = {};
  const section_80d: Record<string, number> = {};
  const dedFlat: Record<string, number> = {};

  for (const line of lines.slice(1)) {
    const match = line.match(/^(.+?)[,\t](.+)$/);
    if (!match) continue;
    const rawField = match[1]
      .trim()
      .toLowerCase()
      .replace(/[_\-]+/g, " ");
    const rawValue = match[2].trim();

    const mapping = fieldMap[rawField];
    if (!mapping) continue;

    const [target, key, sub] = mapping;

    if (key === "is_metro") {
      income.is_metro =
        rawValue.toLowerCase().includes("metro") &&
        !rawValue.toLowerCase().includes("non");
      continue;
    }

    const numVal = parseInt(rawValue.replace(/[₹,\s]/g, ""), 10);
    if (isNaN(numVal)) continue;

    if (target === "income") {
      income[key] = numVal;
    } else if (sub === "section_80c") {
      section_80c[key] = numVal;
    } else if (sub === "section_80d") {
      section_80d[key] = numVal;
    } else {
      dedFlat[key] = numVal;
    }
  }

  if (
    Object.keys(income).length === 0 &&
    Object.keys(section_80c).length === 0
  ) {
    return {
      parsed: false,
      message: "Could not recognize CSV fields. Please use the sample format.",
    };
  }

  const total80c = Object.values(section_80c).reduce((s, v) => s + v, 0);
  const total80d = Object.values(section_80d).reduce((s, v) => s + v, 0);

  return {
    parsed: true,
    income,
    deductions: {
      section_80c: { ...section_80c, total: total80c },
      section_80d: { ...section_80d, total: total80d },
      ...dedFlat,
    },
  };
}

export const useTaxWizardStore = create<TaxWizardState>((set, get) => ({
  analysis: null,
  isAnalyzing: false,
  history: [],

  analyze: async (data) => {
    set({ isAnalyzing: true });
    try {
      const res = await api.post<TaxAnalysisResult>("/tax/analyze", data);
      set({ analysis: res.data, isAnalyzing: false });
    } catch {
      set({ isAnalyzing: false });
      throw new Error("Tax analysis failed");
    }
  },

  uploadForm16: async (file) => {
    // For CSV files, parse locally (no backend needed)
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      const text = await file.text();
      const result = parseCSVForm16(text);
      return result as unknown as Record<string, unknown>;
    }
    // For PDFs, send to backend stub
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<Record<string, unknown>>(
      "/tax/upload-form16",
      formData,
    );
    return res.data;
  },

  saveToHistory: (income, deductions) => {
    const { analysis, history } = get();
    if (!analysis) return;
    const rc = analysis.regime_comparison;
    const entry: TaxHistoryEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      gross_salary: (income.gross_salary as number) || 0,
      recommended_regime: rc.recommended_regime,
      savings: rc.savings,
      old_tax: rc.old_regime.total_tax,
      new_tax: rc.new_regime.total_tax,
      income,
      deductions,
      analysis,
    };

    // Keep history in Zustand state (persisted to MongoDB via tax_records in analyze)
    const updated = [entry, ...history].slice(0, 10);
    set({ history: updated });
  },

  loadHistory: () => {
    // History is now derived from the last analysis in Zustand state.
    // No localStorage needed.
  },
}));
