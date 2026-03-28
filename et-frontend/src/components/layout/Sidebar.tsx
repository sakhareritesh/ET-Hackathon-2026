"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, Flame, Heart, Calendar, Calculator,
  Users, PieChart, LogOut, X, ChevronRight, Wallet,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/money-profile", label: "Money Profile", icon: Wallet },
  { href: "/fire-planner", label: "FIRE Planner", icon: Flame },
  { href: "/money-health", label: "Money Health", icon: Heart },
  { href: "/life-events", label: "Life Events", icon: Calendar },
  { href: "/tax-wizard", label: "Tax Wizard", icon: Calculator },
  { href: "/couples-planner", label: "Couples Planner", icon: Users },
  { href: "/mf-xray", label: "MF X-Ray", icon: PieChart },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
        border-r border-slate-700/50 transition-all duration-300 z-50
        ${collapsed ? "w-20" : "w-64"} flex flex-col`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-slate-900 font-black text-sm">
              ET
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Finance
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${isActive
                  ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/40"
                }`}
            >
              <Icon size={20} className={isActive ? "text-emerald-400" : "text-slate-500 group-hover:text-slate-300"} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-slate-700/50">
        {!collapsed && user && (
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400
            hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
