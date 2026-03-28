import { create } from "zustand";
import api from "@/lib/api";

export interface FinancialProfile {
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
    annual_income: { gross: 0, net: 0 },
    monthly_expenses: { rent: 0, emi: 0, groceries: 0, utilities: 0, entertainment: 0, education: 0, other: 0, total: 0 },
    existing_investments: { ppf: 0, epf: 0, nps: 0, elss: 0, fd: 0, stocks: 0, mutual_funds: 0, real_estate: 0, gold: 0, crypto: 0, other: 0 },
    debts: [],
    insurance: {
      life: { has_cover: false, sum_assured: 0, premium: 0 },
      health: { has_cover: false, sum_assured: 0, premium: 0, family_floater: false },
    },
    emergency_fund: { current_amount: 0, months_covered: 0 },
    risk_profile: "moderate",
    tax_regime: "new",
  };
}

const DEFAULT_USER_ID = "000000000000000000000000";

async function fetchFromDb(): Promise<FinancialProfile | null> {
  const res = await fetch(`/api/profile/sync?user_id=${DEFAULT_USER_ID}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.found && json.profile) return json.profile as FinancialProfile;
  return null;
}

async function saveToDb(profile: FinancialProfile): Promise<boolean> {
  const res = await fetch("/api/profile/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: DEFAULT_USER_ID, ...profile }),
  });
  return res.ok;
}

interface ProfileState {
  profile: FinancialProfile | null;
  isLoading: boolean;
  lastSyncedAt: string | null;
  dbConnected: boolean;
  fetchProfile: () => Promise<void>;
  saveProfile: (data: Partial<FinancialProfile>) => Promise<void>;
  saveFullProfile: (full: FinancialProfile) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  lastSyncedAt: null,
  dbConnected: false,

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const dbProfile = await fetchFromDb();
      if (dbProfile) {
        set({ profile: dbProfile, isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
      } else {
        set({ profile: null, isLoading: false, dbConnected: false });
      }
    } catch {
      set({ profile: null, isLoading: false, dbConnected: false });
    }
  },

  saveProfile: async (data) => {
    set({ isLoading: true });
    const existing = get().profile || getDefaultLocalProfile();
    const merged: FinancialProfile = { ...existing, ...data };
    
    set({ profile: merged });
    try {
      const ok = await saveToDb(merged);
      set({ isLoading: false, dbConnected: ok, lastSyncedAt: ok ? new Date().toISOString() : get().lastSyncedAt });
    } catch {
      set({ isLoading: false, dbConnected: false });
    }
  },

  saveFullProfile: async (full) => {
    set({ isLoading: true, profile: full });
    try {
      const ok = await saveToDb(full);
      if (!ok) throw new Error("DB write failed");
      set({ isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
    } catch {
      set({ isLoading: false, dbConnected: false });
      throw new Error("MongoDB sync failed. Check your connection.");
    }
  },
}));
