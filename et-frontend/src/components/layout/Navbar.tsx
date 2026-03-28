"use client";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { Bell, Search, Sparkles } from "lucide-react";
import { getGreeting } from "@/lib/utils";

export default function Navbar() {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-40 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {getGreeting()}, <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">{user?.full_name?.split(" ")[0] || "User"}</span>
        </h2>
        <p className="text-xs text-slate-500">Let&apos;s build your wealth today</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search features..."
            className="w-64 pl-10 pr-4 py-2 text-sm bg-slate-800/60 border border-slate-700/50 rounded-xl
              text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50
              focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        <Link href="/mentor"
          className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all
            bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border-emerald-500/30 text-emerald-400 hover:from-emerald-500/30 hover:to-cyan-500/30">
          <Sparkles size={16} />
          <span className="hidden sm:inline">AI Mentor</span>
        </Link>

        <button className="relative p-2 rounded-xl hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full"></span>
        </button>

        <Link href="/profile">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold cursor-pointer hover:ring-2 hover:ring-emerald-400/50 transition-all">
            {user?.full_name?.charAt(0) || "U"}
          </div>
        </Link>
      </div>
    </header>
  );
}
