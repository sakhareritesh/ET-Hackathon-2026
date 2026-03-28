import { create } from "zustand";
import api from "@/lib/api";
import { isLocalEngineMode } from "@/lib/config";
import { LOCAL_KEYS } from "@/lib/localKeys";

interface FinancialProfile {
  employment_type: string;
  annual_income: { gross: number; net: number };
  monthly_expenses: Record<string, number>;
  salary_structure?: Record<string, number>;
  existing_investments: Record<string, number>;
  debts: Array<Record<string, number | string>>;
  insurance: Record<string, Record<string, number | boolean>>;
  emergency_fund: { current_amount: number; months_covered: number };
  risk_profile: string;
  tax_regime: string;
}

export function getDefaultLocalProfile(): FinancialProfile {
  return {
    employment_type: "salaried",
    annual_income: { gross: 1200000, net: 900000 },
    monthly_expenses: {
      rent: 22000,
      emi: 18000,
      groceries: 14000,
      utilities: 4500,
      entertainment: 7000,
      education: 0,
      other: 5500,
      total: 80000,
    },
    existing_investments: {
      ppf: 200000,
      epf: 380000,
      nps: 60000,
      elss: 120000,
      fd: 280000,
      stocks: 50000,
      mutual_funds: 420000,
      real_estate: 0,
      gold: 60000,
      crypto: 0,
      other: 0,
    },
    debts: [
      {
        type: "home_loan",
        principal: 4500000,
        outstanding: 3600000,
        interest_rate: 8.4,
        emi: 38000,
        tenure_months: 240,
        remaining_months: 168,
      },
    ],
    insurance: {
      life: { has_cover: true, sum_assured: 10000000, premium: 14000 },
      health: { has_cover: true, sum_assured: 1000000, premium: 19500, family_floater: true },
    },
    emergency_fund: { current_amount: 280000, months_covered: 4 },
    risk_profile: "moderate",
    tax_regime: "old",
  };
}

interface ProfileState {
  profile: FinancialProfile | null;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
  saveProfile: (data: Partial<FinancialProfile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      if (isLocalEngineMode()) {
        const raw = typeof window !== "undefined" ? localStorage.getItem(LOCAL_KEYS.profile) : null;
        if (raw) {
          set({ profile: JSON.parse(raw) as FinancialProfile, isLoading: false });
        } else {
          const seed = getDefaultLocalProfile();
          localStorage.setItem(LOCAL_KEYS.profile, JSON.stringify(seed));
          set({ profile: seed, isLoading: false });
        }
        return;
      }
      const res = await api.get<FinancialProfile>("/profile");
      set({ profile: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveProfile: async (data) => {
    set({ isLoading: true });
    try {
      if (isLocalEngineMode()) {
        const next = { ...(get().profile || getDefaultLocalProfile()), ...data };
        localStorage.setItem(LOCAL_KEYS.profile, JSON.stringify(next));
        set({ profile: next, isLoading: false });
        return;
      }
      const res = await api.post<FinancialProfile>("/profile", data);
      set({ profile: res.data, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error("Failed to save profile");
    }
  },
}));
