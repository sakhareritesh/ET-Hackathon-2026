import { create } from "zustand";
import { LOCAL_KEYS } from "@/lib/localKeys";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

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
    monthly_expenses: {
      rent: 0,
      emi: 0,
      groceries: 0,
      utilities: 0,
      entertainment: 0,
      education: 0,
      other: 0,
      total: 0,
    },
    existing_investments: {
      ppf: 0,
      epf: 0,
      nps: 0,
      elss: 0,
      fd: 0,
      stocks: 0,
      mutual_funds: 0,
      real_estate: 0,
      gold: 0,
      crypto: 0,
      other: 0,
    },
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

/* ------------------------------------------------------------------ */
/*  Helpers — sync API + localStorage                                 */
/* ------------------------------------------------------------------ */

function getUserId(): string {
  if (typeof window === "undefined") return "default_local_user";
  return localStorage.getItem("user_id") || "default_local_user";
}

function writeLocal(profile: FinancialProfile) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_KEYS.profile, JSON.stringify(profile));
  }
}

function readLocal(): FinancialProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.profile);
    return raw ? (JSON.parse(raw) as FinancialProfile) : null;
  } catch {
    return null;
  }
}

async function fetchFromDb(userId: string): Promise<FinancialProfile | null> {
  const res = await fetch(`/api/profile/sync?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) return null;
  const json = await res.json();
  if (json.found && json.profile) return json.profile as FinancialProfile;
  return null;
}

async function saveToDb(userId: string, profile: FinancialProfile): Promise<boolean> {
  const res = await fetch("/api/profile/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, ...profile }),
  });
  return res.ok;
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

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
    const userId = getUserId();

    try {
      const dbProfile = await fetchFromDb(userId);
      if (dbProfile) {
        writeLocal(dbProfile);
        set({ profile: dbProfile, isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
        return;
      }
    } catch {
      /* MongoDB unreachable — fall through to localStorage */
    }

    const local = readLocal();
    if (local) {
      set({ profile: local, isLoading: false, dbConnected: false });
    } else {
      set({ profile: null, isLoading: false, dbConnected: false });
    }
  },

  saveProfile: async (data) => {
    set({ isLoading: true });
    const existing = get().profile || getDefaultLocalProfile();
    const merged: FinancialProfile = { ...existing, ...data };
    writeLocal(merged);
    set({ profile: merged });

    const userId = getUserId();
    try {
      const ok = await saveToDb(userId, merged);
      set({ isLoading: false, dbConnected: ok, lastSyncedAt: ok ? new Date().toISOString() : get().lastSyncedAt });
    } catch {
      set({ isLoading: false, dbConnected: false });
    }
  },

  saveFullProfile: async (full) => {
    set({ isLoading: true });
    writeLocal(full);
    set({ profile: full });

    const userId = getUserId();
    try {
      const ok = await saveToDb(userId, full);
      if (!ok) throw new Error("DB write failed");
      set({ isLoading: false, dbConnected: true, lastSyncedAt: new Date().toISOString() });
    } catch {
      set({ isLoading: false, dbConnected: false });
      throw new Error("Profile saved locally but MongoDB sync failed. Check your MONGODB_URI in .env.local.");
    }
  },
}));
