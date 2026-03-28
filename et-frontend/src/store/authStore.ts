import { create } from "zustand";
import { supabase } from "@/lib/supabase";

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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message || "Login failed");

    const user: User = {
      id: data.user.id,
      email: data.user.email ?? email,
      full_name: data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "User",
      phone: data.user.user_metadata?.phone,
      avatar_url: data.user.user_metadata?.avatar_url,
    };
    set({ user, isAuthenticated: true, isLoading: false });
  },

  register: async (formData) => {
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name,
          phone: formData.phone,
          city: formData.city,
          gender: formData.gender,
        },
      },
    });
    if (error || !data.user) throw new Error(error?.message || "Registration failed");

    const user: User = {
      id: data.user.id,
      email: data.user.email ?? formData.email,
      full_name: formData.full_name || data.user.email?.split("@")[0] || "User",
      phone: formData.phone,
    };
    set({ user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    void supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
    if (typeof window !== "undefined") window.location.href = "/login";
  },

  loadUser: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const u = session.user;
      set({
        user: {
          id: u.id,
          email: u.email ?? "",
          full_name: u.user_metadata?.full_name ?? u.email?.split("@")[0] ?? "User",
          phone: u.user_metadata?.phone,
          avatar_url: u.user_metadata?.avatar_url,
        },
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
