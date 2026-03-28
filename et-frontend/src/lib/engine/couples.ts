import type { ProfileLike } from "@/lib/engine/health";
import { computeTaxAnalysis, type TaxAnalyzePayload } from "@/lib/engine/tax";

export interface CoupleOptimizeInput {
  profileSelf: ProfileLike;
  profilePartner: ProfileLike | null;
  partnerEmail?: string;
}

export interface CoupleOptimization {
  hra_split?: { recommended_claimer: string; savings: number; reason: string };
  insurance_plan?: { joint_vs_individual: string; recommendations: string[] };
  combined_net_worth?: { total: number; partner_1_share: number; partner_2_share: number };
  nps_note?: string;
  sip_split_note?: string;
}

function netWorthFromProfile(p: ProfileLike): number {
  if (!p) return 0;
  const inv = p.existing_investments || {};
  const invSum = Object.values(inv).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
  const efd = p.emergency_fund?.current_amount || 0;
  const debt = (p.debts || []).reduce((s, d) => s + (Number(d.outstanding) || 0), 0);
  return Math.max(0, invSum + efd - debt);
}

export function computeCoupleOptimization(input: CoupleOptimizeInput): { optimization: CoupleOptimization } {
  const nw1 = netWorthFromProfile(input.profileSelf);
  const nw2 = netWorthFromProfile(input.profilePartner);
  const total = nw1 + nw2;
  const p1s = total > 0 ? Math.round((nw1 / total) * 100) : 50;
  const p2s = 100 - p1s;

  const tax1 = input.profileSelf?.tax_regime === "new" ? "new" : "old";
  const tax2 = input.profilePartner?.tax_regime === "new" ? "new" : "old";

  const hra_split = {
    recommended_claimer:
      tax1 === "old" && tax2 !== "old" ? "Partner 1 (old regime)" : tax2 === "old" && tax1 !== "old" ? "Partner 2 (old regime)" : "Higher marginal slab partner",
    savings: Math.round((input.profileSelf?.annual_income?.net || 600000) * 0.06),
    reason:
      "HRA exemption usually helps more when claimed by the partner on old regime with higher taxable income. Verify rent agreement and landlord PAN rules.",
  };

  return {
    optimization: {
      combined_net_worth: { total: total, partner_1_share: p1s, partner_2_share: p2s },
      hra_split,
      insurance_plan: {
        joint_vs_individual: "floater_for_kids_individual_topup",
        recommendations: [
          "Family floater for shared household + super top-up for large SI.",
          "Term cover typically individual (income replacement), equal to 10–15× income each.",
        ],
      },
      nps_note: "If both salaried, each can use 80CCD(2) employer NPS — compare with take-home impact.",
      sip_split_note:
        "Route ELSS/80C via the partner with higher slab on old regime; automate SIPs from joint account for discipline.",
    },
  };
}

export function randomInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ------------------------------------------------------------------ */
/*  Couples Planner — salary inputs + rent (optimization demo)        */
/* ------------------------------------------------------------------ */

export interface CouplesPartnerFields {
  name: string;
  gross_salary: number;
  basic_salary: number;
  hra_received: number;
  sec_80c: number;
  total_investments: number;
  total_debts: number;
}

export interface CouplesPlannerOptimization {
  combined_net_worth: number;
  income_split_a_pct: number;
  hra: { claimant: "A" | "B"; claimant_label: string; savings: number; explanation: string };
  split_80c: { title: string; suggestion: string; potential_savings: number };
  insurance: { title: string; suggestion: string; potential_savings: number };
  nps: { title: string; suggestion: string; potential_savings: number };
  sip: { title: string; suggestion: string; potential_savings: number };
  tax_a: { old: number; new: number; best: "old" | "new"; taxable_old: number; taxable_new: number };
  tax_b: { old: number; new: number; best: "old" | "new"; taxable_old: number; taxable_new: number };
  combined_optimal_tax: number;
  naive_combined_tax: number;
  total_savings_vs_naive: number;
}

function taxPayload(p: CouplesPartnerFields, rentPaidMonthly: number | undefined): TaxAnalyzePayload {
  return {
    financial_year: "2025-26",
    income_details: {
      gross_salary: p.gross_salary,
      basic_salary: p.basic_salary,
      hra_received: p.hra_received,
      rent_paid: rentPaidMonthly && rentPaidMonthly > 0 ? rentPaidMonthly : undefined,
      is_metro: true,
      standard_deduction: 50000,
      professional_tax: 2400,
    },
    deductions: {
      section_80c: { total: Math.min(p.sec_80c, 150000) },
      section_80d: { total: 25000 },
    },
  };
}

function bestTax(rc: { old_regime: { total_tax: number }; new_regime: { total_tax: number }; recommended_regime: "old" | "new" }) {
  return rc.recommended_regime === "old" ? rc.old_regime.total_tax : rc.new_regime.total_tax;
}

function forcedNewTax(rc: { new_regime: { total_tax: number } }) {
  return rc.new_regime.total_tax;
}

export function computeCouplesPlannerOptimization(
  partnerA: CouplesPartnerFields,
  partnerB: CouplesPartnerFields,
  monthlyRent: number
): CouplesPlannerOptimization {
  const nw =
    Math.max(0, partnerA.total_investments - partnerA.total_debts) +
    Math.max(0, partnerB.total_investments - partnerB.total_debts);
  const g = partnerA.gross_salary + partnerB.gross_salary;
  const splitA = g > 0 ? Math.round((partnerA.gross_salary / g) * 100) : 50;

  const aClaims = {
    ta: computeTaxAnalysis(taxPayload(partnerA, monthlyRent)),
    tb: computeTaxAnalysis(taxPayload(partnerB, undefined)),
  };
  const bClaims = {
    ta: computeTaxAnalysis(taxPayload(partnerA, undefined)),
    tb: computeTaxAnalysis(taxPayload(partnerB, monthlyRent)),
  };

  const sumA =
    bestTax(aClaims.ta.regime_comparison) + bestTax(aClaims.tb.regime_comparison);
  const sumB =
    bestTax(bClaims.ta.regime_comparison) + bestTax(bClaims.tb.regime_comparison);

  const aBetter = sumA <= sumB;
  const savings = Math.abs(sumA - sumB);
  const claimant: "A" | "B" = aBetter ? "A" : "B";
  const active = aBetter ? aClaims : bClaims;
  const nameA = partnerA.name.trim() || "Partner A";
  const nameB = partnerB.name.trim() || "Partner B";

  const rcA = active.ta.regime_comparison;
  const rcB = active.tb.regime_comparison;

  const combinedOptimal = bestTax(rcA) + bestTax(rcB);

  const naiveA = computeTaxAnalysis(taxPayload(partnerA, monthlyRent));
  const naiveB = computeTaxAnalysis(taxPayload(partnerB, undefined));
  const naiveCombined = forcedNewTax(naiveA.regime_comparison) + forcedNewTax(naiveB.regime_comparison);

  const marginalA = rcA.old_regime.taxable_income > rcB.old_regime.taxable_income ? nameA : nameB;
  const c80a = Math.min(partnerA.sec_80c, 150000);
  const c80b = Math.min(partnerB.sec_80c, 150000);
  const gap = 150000 - Math.min(c80a + c80b, 300000);
  const split80 = {
    title: "80C split",
    suggestion: `${marginalA} likely benefits more from loading ELSS/PPF within the ₹1.5L cap on old regime, if that partner stays old; align proofs with employer before March.`,
    potential_savings: Math.min(45000, Math.round(gap * 0.3)),
  };

  return {
    combined_net_worth: nw,
    income_split_a_pct: splitA,
    hra: {
      claimant,
      claimant_label: claimant === "A" ? nameA : nameB,
      savings,
      explanation:
        "HRA exemption is modeled on rent paid versus basic and metro rules. The partner with the rent agreement should claim, subject to employer and landlord PAN rules; this comparison picks the lower combined tax under current inputs.",
    },
    split_80c: split80,
    insurance: {
      title: "Insurance review",
      suggestion:
        "Family floater for the household plus individual term cover for income replacement (roughly 10–15× annual income each) usually beats duplicate retail health policies.",
      potential_savings: Math.round((partnerA.gross_salary + partnerB.gross_salary) * 0.004),
    },
    nps: {
      title: "NPS strategy",
      suggestion:
        "If both employers offer 80CCD(2), compare take-home impact of employer NPS; additional deduction under 80CCD(1B) up to ₹50k each is outside the 80C cap.",
      potential_savings: Math.round(Math.min(50000, partnerA.gross_salary * 0.05) * 0.3),
    },
    sip: {
      title: "SIP split",
      suggestion:
        "Route ELSS and voluntary 80C investments via the partner on old regime with higher marginal rate; automate SIPs from a joint account for visibility.",
      potential_savings: Math.round(savings * 0.15),
    },
    tax_a: {
      old: rcA.old_regime.total_tax,
      new: rcA.new_regime.total_tax,
      best: rcA.recommended_regime,
      taxable_old: rcA.old_regime.taxable_income,
      taxable_new: rcA.new_regime.taxable_income,
    },
    tax_b: {
      old: rcB.old_regime.total_tax,
      new: rcB.new_regime.total_tax,
      best: rcB.recommended_regime,
      taxable_old: rcB.old_regime.taxable_income,
      taxable_new: rcB.new_regime.taxable_income,
    },
    combined_optimal_tax: combinedOptimal,
    naive_combined_tax: naiveCombined,
    total_savings_vs_naive: Math.max(0, naiveCombined - combinedOptimal),
  };
}
