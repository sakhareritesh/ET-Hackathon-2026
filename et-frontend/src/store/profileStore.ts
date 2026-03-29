import { create } from "zustand";
<<<<<<< HEAD
import { supabase } from "@/lib/supabase";
import { LOCAL_KEYS } from "@/lib/localKeys";
=======
import api from "@/lib/api";
>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee

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
<<<<<<< HEAD
    monthly_expenses: {
      rent: 0, emi: 0, groceries: 0, utilities: 0,
      entertainment: 0, education: 0, other: 0, total: 0,
    },
    existing_investments: {
      ppf: 0, epf: 0, nps: 0, elss: 0, fd: 0,
      stocks: 0, mutual_funds: 0, real_estate: 0, gold: 0, crypto: 0, other: 0,
    },
=======
    monthly_expenses: { rent: 0, emi: 0, groceries: 0, utilities: 0, entertainment: 0, education: 0, other: 0, total: 0 },
    existing_investments: { ppf: 0, epf: 0, nps: 0, elss: 0, fd: 0, stocks: 0, mutual_funds: 0, real_estate: 0, gold: 0, crypto: 0, other: 0 },
>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee
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

<<<<<<< HEAD
async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

function writeLocal(profile: FinancialProfile) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_KEYS.profile, JSON.stringify(profile));
  }
}

function readLocal(): FinancialProfile | null {
  if (typeof window === "undefined") return null;
=======
const DEFAULT_USER_ID = "000000000000000000000000";

async function fetchFromDb(): Promise<{ connected: boolean; profile: FinancialProfile | null }> {
>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee
  try {
    const res = await fetch(`/api/profile/sync?user_id=${DEFAULT_USER_ID}`);
    if (!res.ok) return { connected: false, profile: null };
    const json = await res.json();
    if (json.error) return { connected: false, profile: null };
    if (json.found && json.profile) return { connected: true, profile: json.profile as FinancialProfile };
    // DB responded OK but no profile exists yet — still connected
    return { connected: true, profile: null };
  } catch {
    return { connected: false, profile: null };
  }
}

<<<<<<< HEAD
=======
async function saveToDb(profile: FinancialProfile): Promise<boolean> {
  const res = await fetch("/api/profile/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: DEFAULT_USER_ID, ...profile }),
  });
  return res.ok;
}

>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee
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
<<<<<<< HEAD
    const userId = await getUserId();

    if (userId) {
      try {
        const { data: row } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single();

        const { data: incomeRow } = await supabase
          .from("income")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (row) {
          const profile: FinancialProfile = {
            employment_type: row.employment_type || "salaried",
            annual_income: {
              gross: incomeRow?.gross_salary || 0,
              net: (incomeRow?.gross_salary || 0) - (incomeRow?.gross_salary || 0) * 0.1,
            },
            monthly_expenses: incomeRow?.expense_breakdown || getDefaultLocalProfile().monthly_expenses,
            salary_structure: {
              basic: incomeRow?.basic_salary || 0,
              hra: incomeRow?.hra_received || 0,
              special_allowance: incomeRow?.special_allowance || 0,
            },
            existing_investments: getDefaultLocalProfile().existing_investments,
            debts: [],
            insurance: getDefaultLocalProfile().insurance,
            emergency_fund: { current_amount: 0, months_covered: 0 },
            risk_profile: row.risk_profile || "moderate",
            tax_regime: row.tax_regime || "new",
          };

          const local = readLocal();
          const merged = local ? { ...profile, ...local, annual_income: profile.annual_income.gross > 0 ? profile.annual_income : (local.annual_income ?? profile.annual_income) } : profile;

          writeLocal(merged);
          set({ profile: merged, isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
          return;
        }
      } catch {
        /* Supabase unavailable, fall through */
      }
    }

    const local = readLocal();
    set({ profile: local, isLoading: false, dbConnected: false });
=======
    try {
      const { connected, profile: dbProfile } = await fetchFromDb();
      if (dbProfile) {
        set({ profile: dbProfile, isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
      } else {
        // No profile yet, but mark connection status correctly
        set({ profile: null, isLoading: false, dbConnected: connected });
      }
    } catch {
      set({ profile: null, isLoading: false, dbConnected: false });
    }
>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee
  },

  saveProfile: async (data) => {
    set({ isLoading: true });
    const existing = get().profile || getDefaultLocalProfile();
    const merged: FinancialProfile = { ...existing, ...data };
    
    set({ profile: merged });
<<<<<<< HEAD

    const userId = await getUserId();
    if (userId) {
      try {
        await supabase.from("profiles").upsert({
          id: userId,
          employment_type: merged.employment_type,
          risk_profile: merged.risk_profile,
          tax_regime: merged.tax_regime,
          updated_at: new Date().toISOString(),
        });

        await supabase.from("income").upsert({
          user_id: userId,
          gross_salary: merged.annual_income.gross,
          basic_salary: merged.salary_structure?.basic || 0,
          hra_received: merged.salary_structure?.hra || 0,
          special_allowance: merged.salary_structure?.special_allowance || 0,
          monthly_expenses: merged.monthly_expenses?.total || 0,
          rent_paid: merged.monthly_expenses?.rent || 0,
          expense_breakdown: merged.monthly_expenses,
          updated_at: new Date().toISOString(),
        });

        set({ isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
      } catch {
        set({ isLoading: false, dbConnected: false });
      }
    } else {
=======
    try {
      const ok = await saveToDb(merged);
      set({ isLoading: false, dbConnected: ok, lastSyncedAt: ok ? new Date().toISOString() : get().lastSyncedAt });
    } catch {
>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee
      set({ isLoading: false, dbConnected: false });
    }
  },

  saveFullProfile: async (full) => {
<<<<<<< HEAD
    set({ isLoading: true });
    writeLocal(full);
    set({ profile: full });

    const userId = await getUserId();
    if (userId) {
      try {
        await supabase.from("profiles").upsert({
          id: userId,
          employment_type: full.employment_type,
          risk_profile: full.risk_profile,
          tax_regime: full.tax_regime,
          updated_at: new Date().toISOString(),
        });
        await supabase.from("income").upsert({
          user_id: userId,
          gross_salary: full.annual_income.gross,
          basic_salary: full.salary_structure?.basic || 0,
          hra_received: full.salary_structure?.hra || 0,
          special_allowance: full.salary_structure?.special_allowance || 0,
          monthly_expenses: full.monthly_expenses?.total || 0,
          rent_paid: full.monthly_expenses?.rent || 0,
          expense_breakdown: full.monthly_expenses,
          updated_at: new Date().toISOString(),
        });
        set({ isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
      } catch {
        set({ isLoading: false, dbConnected: false });
      }
    } else {
=======
    set({ isLoading: true, profile: full });
    try {
      const res = await fetch("/api/profile/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: DEFAULT_USER_ID, ...full }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Profile sync error:", err);
        set({ isLoading: false, dbConnected: false });
        return;
      }
      set({ isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Profile sync failed:", err);
>>>>>>> 74419c7509aaff13f4859288cca62213d40a5aee
      set({ isLoading: false, dbConnected: false });
    }
  },
}));
