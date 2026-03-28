export interface LifeEventAdviceInput {
  event_type: string;
  event_date: string;
  amount: number;
  description: string;
}

export interface LifeEventAdvice {
  summary: string;
  tax_implications: string;
  investment_recommendations: Array<{ instrument: string; amount: number; reason: string; urgency: string }>;
  insurance_changes: string[];
  action_checklist: Array<{ item: string; completed: boolean; deadline?: string }>;
  timeline: Array<{ milestone: string; timeframe: string }>;
}

const templates: Record<string, LifeEventAdvice> = {
  bonus: {
    summary:
      "Treat a bonus as three buckets: tax provision, short-term goals (12–18 months), and long-term investing. Avoid spending the full amount in one quarter.",
    tax_implications:
      "TDS is usually deducted at slab; if it pushes you to a higher bracket, plan ELSS/80C before March if on old regime.",
    investment_recommendations: [
      { instrument: "Liquid / arbitrage (parking)", amount: 0, reason: "Hold taxes + emergency top-up for 3–6 months.", urgency: "immediate" },
      { instrument: "Index SIPs (staggered)", amount: 0, reason: "Deploy in 3–6 tranches to reduce timing risk.", urgency: "medium" },
    ],
    insurance_changes: [
      "No immediate cover change unless bonus materially raises income replacement need.",
      "Revisit sum assured on term life at next annual review if investable surplus rises.",
    ],
    action_checklist: [
      { item: "Estimate incremental tax and set aside", completed: false, deadline: "2 weeks" },
      { item: "Pay down high-interest debt if any", completed: false },
      { item: "Increase SIP by 30–50% of net bonus", completed: false },
    ],
    timeline: [
      { milestone: "Net-of-tax amount confirmed in account", timeframe: "1–2 weeks" },
      { milestone: "Allocation across buckets agreed", timeframe: "2–4 weeks" },
      { milestone: "First tranche invested or debt paid", timeframe: "1–2 months" },
    ],
  },
  marriage: {
    summary:
      "Combine financial goals, disclose existing loans, and align insurance nominees. Start a joint emergency fund discussion.",
    tax_implications:
      "Update Form 12BB with spouse details if applicable; HRA/rent receipts; consider optional joint home loan benefits.",
    investment_recommendations: [
      { instrument: "Term cover + health floater", amount: 0, reason: "Protect both incomes and dependents.", urgency: "immediate" },
      { instrument: "Joint emergency fund (liquid)", amount: 0, reason: "6 months of combined fixed costs.", urgency: "high" },
    ],
    insurance_changes: [
      "Increase health floater sum insured or add top-up for two incomes under one roof.",
      "Align term life nominees and sums to cover shared liabilities and goals.",
    ],
    action_checklist: [
      { item: "Merge visibility: shared net-worth sheet", completed: false, deadline: "30 days" },
      { item: "Update nominees on MF/FD/EPF", completed: false },
      { item: "Discuss debt payoff order", completed: false },
    ],
    timeline: [
      { milestone: "Joint budget and account structure", timeframe: "30 days" },
      { milestone: "Insurance and nominees updated", timeframe: "45 days" },
      { milestone: "First joint emergency fund target", timeframe: "90 days" },
    ],
  },
  child_birth: {
    summary:
      "Cash-flow will tighten — front-load insurance and start education SIP early (small, automated).",
    tax_implications:
      "80C school fees (limits apply); update HRA if moving; Sukanya/SSY for girl child option.",
    investment_recommendations: [
      { instrument: "Health add-on / increase SI", amount: 0, reason: "Maternity and pediatric cover.", urgency: "immediate" },
      { instrument: "Index + PPF mix for education", amount: 0, reason: "Long horizon; keep costs low.", urgency: "medium" },
    ],
    insurance_changes: [
      "Add newborn to health policy within insurer window; increase SI for pediatric care.",
      "Review term cover for higher sum to reflect dependent expenses.",
    ],
    action_checklist: [
      { item: "Add child to health policy", completed: false },
      { item: "Write/update will & guardian", completed: false, deadline: "90 days" },
      { item: "Start ₹5–15k/mo education SIP if possible", completed: false },
    ],
    timeline: [
      { milestone: "Birth certificate and policy endorsement", timeframe: "2–4 weeks" },
      { milestone: "Education goal and SIP start", timeframe: "1–3 months" },
      { milestone: "Will and guardian documentation", timeframe: "90 days" },
    ],
  },
  home_purchase: {
    summary:
      "Stress-test EMI at +2% rates; keep emergency fund intact; prefer term insurance ≥ loan amount.",
    tax_implications:
      "24(b) interest, 80EEA if eligible, 80C principal — old regime; new regime may limit some breaks.",
    investment_recommendations: [
      { instrument: "Term plan covering loan", amount: 0, reason: "Cheap protection vs home loan size.", urgency: "immediate" },
      { instrument: "Avoid illiquid lumps in risky assets pre-closing", amount: 0, reason: "Preserve down payment buffer.", urgency: "high" },
    ],
    insurance_changes: [
      "Match term life cover to outstanding loan (or lender-mandated structure).",
      "Title and property insurance as required by lender.",
    ],
    action_checklist: [
      { item: "EMI ≤ 30–35% net income check", completed: false },
      { item: "Title + insurance documentation", completed: false },
      { item: "Prepayment plan (annual bonus)", completed: false },
    ],
    timeline: [
      { milestone: "Loan sanction and insurance binding", timeframe: "Pre-disbursal" },
      { milestone: "First EMI and cash-flow check", timeframe: "Month 1" },
      { milestone: "Annual tax proofs for interest and principal", timeframe: "Year-end" },
    ],
  },
  job_change: {
    summary:
      "Bridge PF/gratuity; compare CTC vs in-hand; restart 80C proofs with new employer in April window.",
    tax_implications:
      "Form 12B to new employer; settle perquisites; RSU/ESOP timing may shift tax years.",
    investment_recommendations: [
      { instrument: "Don’t cash PF unless emergency", amount: 0, reason: "Preserve retirement compounding.", urgency: "high" },
      { instrument: "Increase SIP if jump in net pay", amount: 0, reason: "Avoid lifestyle creep.", urgency: "medium" },
    ],
    insurance_changes: [
      "Port or replace group health if joining window ends; avoid coverage gap.",
      "Update employer life cover details in personal term plan review.",
    ],
    action_checklist: [
      { item: "Transfer or merge PF account", completed: false },
      { item: "Update tax declarations", completed: false },
      { item: "Re-run Tax Wizard on new salary", completed: false },
    ],
    timeline: [
      { milestone: "Last salary and joining formalities", timeframe: "Overlap week" },
      { milestone: "New employer declarations and proofs", timeframe: "First payroll" },
      { milestone: "PF transfer status check", timeframe: "2–3 months" },
    ],
  },
  retirement: {
    summary:
      "Shift from accumulation to drawdown: bucket strategy, SCSS/PMVVY where suitable, keep equity for longevity.",
    tax_implications:
      "Pension taxed; senior citizen slabs if 60+; optimize FD TDS with 15H/G.",
    investment_recommendations: [
      { instrument: "STP from equity to debt over 2–3 years pre-retirement", amount: 0, reason: "Reduce sequence risk.", urgency: "high" },
      { instrument: "Maintain 12–24m expenses in liquid/short debt", amount: 0, reason: "Cash bucket for volatility.", urgency: "immediate" },
    ],
    insurance_changes: [
      "Move to senior citizen health product or enhance floater before employer cover ends.",
      "Reduce duplicate covers; keep adequate super top-up.",
    ],
    action_checklist: [
      { item: "Health cover continuity (no employer)", completed: false },
      { item: "Annual withdrawal plan", completed: false },
      { item: "Estate basics: will, nominees", completed: false },
    ],
    timeline: [
      { milestone: "Last pay and gratuity settlement", timeframe: "Retirement month" },
      { milestone: "Bucket-wise corpus allocation", timeframe: "0–3 months" },
      { milestone: "First-year withdrawal and tax estimate", timeframe: "Year 1" },
    ],
  },
  inheritance: {
    summary:
      "Park in liquid funds while you plan; avoid rushed lumps into single stocks; clear high-cost debt first.",
    tax_implications:
      "Some inheritances have stamp/registration; income from inherited assets is taxable per rules — verify asset class.",
    investment_recommendations: [
      { instrument: "Liquid/short duration funds (temporary)", amount: 0, reason: "Time to plan without market timing pressure.", urgency: "immediate" },
      { instrument: "Diversified index funds (phased)", amount: 0, reason: "Deploy over 6–12 months if large equity allocation needed.", urgency: "medium" },
    ],
    insurance_changes: [
      "Update nominees on inherited accounts after legal transfer.",
      "Reassess life cover if liabilities or goals change post-inflow.",
    ],
    action_checklist: [
      { item: "List assets & liabilities received", completed: false },
      { item: "Pay off costly debt if any", completed: false },
      { item: "Update financial plan / FIRE model", completed: false },
    ],
    timeline: [
      { milestone: "Legal and tax characterization", timeframe: "0–8 weeks" },
      { milestone: "Parking in liquid instruments", timeframe: "Immediate" },
      { milestone: "Phased deployment plan", timeframe: "6–12 months" },
    ],
  },
  business_start: {
    summary:
      "Separate personal/business books; keep 9–12m personal runway; legal structure affects tax (LLP vs Pvt Ltd).",
    tax_implications:
      "Presumptive vs regular books; GST if applicable; pay yourself salary vs dividend trade-offs.",
    investment_recommendations: [
      { instrument: "Personal emergency fund untouched", amount: 0, reason: "Business risk ≠ personal ruin.", urgency: "immediate" },
      { instrument: "Term cover before signing personal guarantees", amount: 0, reason: "Lenders may require PGs.", urgency: "high" },
    ],
    insurance_changes: [
      "Add shop/office package or liability cover as per activity.",
      "Maintain personal health and term cover independent of firm.",
    ],
    action_checklist: [
      { item: "Current account + accounting tool", completed: false },
      { item: "CA consult for structure", completed: false },
      { item: "12m runway cash separate", completed: false },
    ],
    timeline: [
      { milestone: "Entity registration and bank account", timeframe: "0–4 weeks" },
      { milestone: "GST and compliance calendar", timeframe: "1–2 months" },
      { milestone: "Runway review vs burn", timeframe: "Quarterly" },
    ],
  },
  medical_emergency: {
    summary:
      "Liquidity first: emergency fund, insurance cashless, then liquidate least-tax-harsh investments.",
    tax_implications:
      "80DDB and specific reliefs may apply in severe cases — keep hospital records.",
    investment_recommendations: [
      { instrument: "Health claim + super top-up", amount: 0, reason: "Use coverage before selling long-term assets.", urgency: "immediate" },
      { instrument: "Break FDs / liquidate MF (capital gains vs need)", amount: 0, reason: "Map order of liquidation.", urgency: "high" },
    ],
    insurance_changes: [
      "File cashless or reimbursement with full documentation.",
      "After recovery, add super top-up or raise SI if underinsured.",
    ],
    action_checklist: [
      { item: "Inform insurer for cashless", completed: false },
      { item: "Track all bills for reimbursement", completed: false },
      { item: "Replenish emergency fund after recovery", completed: false },
    ],
    timeline: [
      { milestone: "Admission and insurer intimation", timeframe: "Day 0–1" },
      { milestone: "Discharge and claim submission", timeframe: "Discharge" },
      { milestone: "Replenish liquidity", timeframe: "Post-recovery" },
    ],
  },
};

export function computeLifeEventAdvice(input: LifeEventAdviceInput): LifeEventAdvice {
  const base = templates[input.event_type] || templates.job_change;
  const amt = input.amount > 0 ? ` Amount context: ₹${input.amount.toLocaleString("en-IN")}.` : "";
  const desc = input.description ? ` Note: ${input.description}` : "";
  return {
    summary: base.summary + amt + desc,
    tax_implications: base.tax_implications,
    investment_recommendations: base.investment_recommendations.map((r) => ({
      ...r,
      amount: input.amount > 0 && r.amount === 0 ? Math.round(input.amount * 0.2) : r.amount,
    })),
    insurance_changes: [...base.insurance_changes],
    action_checklist: base.action_checklist.map((c) => ({ ...c })),
    timeline: [...base.timeline],
  };
}
