import { create } from "zustand";

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

const DEFAULT_USER: User = {
  id: "000000000000000000000000",
  email: "guest@example.com",
  full_name: "Guest User"
};

export const useAuthStore = create<AuthState>((set) => ({
  user: DEFAULT_USER,
  isAuthenticated: true,
  isLoading: false,

  login: async () => {
    // Disabled logic because auth is bypassed
    if (typeof window !== "undefined") window.location.href = "/dashboard";
  },

  register: async () => {
    // Disabled logic because auth is bypassed
    if (typeof window !== "undefined") window.location.href = "/dashboard";
  },

  logout: () => {
    // Disabled logic because auth is bypassed
    if (typeof window !== "undefined") window.location.href = "/login";
  },

  loadUser: async () => {
    // Automatically authenticated as guest
    set({
      user: DEFAULT_USER,
      isAuthenticated: true,
      isLoading: false,
    });
  },
}));
