"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlgorithmSection {
  title: string;
  description: string;
}

interface AlgorithmExplanationProps {
  sections: AlgorithmSection[];
}

export default function AlgorithmExplanation({ sections }: AlgorithmExplanationProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Cpu size={18} className="text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">How This Works — Algorithms Used</span>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      <div className={cn("transition-all duration-300 overflow-hidden", open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="px-6 pb-5 space-y-4 border-t border-slate-700/40 pt-4">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-700/30 bg-slate-900/40 p-4">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">{s.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{s.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
