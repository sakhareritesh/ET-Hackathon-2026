import type { FinancialProfile } from "@/store/profileStore";

export function profileCompleteness(profile: FinancialProfile | null): {
  percent: number;
  label: string;
  tips: string[];
} {
  if (!profile) {
    return { percent: 0, label: "No profile loaded", tips: ["Open Money Profile and save your details."] };
  }
  let points = 0;
  const max = 10;
  const tips: string[] = [];

  if (profile.annual_income?.gross > 0 || profile.annual_income?.net > 0) points += 1;
  else tips.push("Add annual income (gross or net).");

  const exp = profile.monthly_expenses || {};
  const expSum = Object.entries(exp).reduce((s, [k, v]) => (k === "total" ? s : s + (typeof v === "number" ? v : 0)), 0);
  if ((exp.total ?? 0) > 0 || expSum > 0) points += 1;
  else tips.push("Fill monthly expenses.");

  const inv = profile.existing_investments || {};
  const invSum = Object.values(inv).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0);
  if (invSum > 0) points += 2;
  else tips.push("Add investments (even rough numbers help FIRE & health score).");

  if ((profile.emergency_fund?.current_amount ?? 0) > 0) points += 1;
  else tips.push("Set emergency fund balance.");

  if ((profile.debts?.length ?? 0) > 0) points += 1;
  else tips.push("Add loans/EMIs if any (or note zero debt).");

  if (profile.insurance?.life?.has_cover || Number(profile.insurance?.life?.sum_assured ?? 0) > 0) points += 1;
  else tips.push("Record life cover (term plan).");

  if (profile.insurance?.health?.has_cover) points += 1;
  else tips.push("Record health insurance.");

  if (profile.risk_profile) points += 1;
  if (profile.tax_regime) points += 1;

  const percent = Math.round((points / max) * 100);
  let label = "Getting started";
  if (percent >= 90) label = "Strong profile";
  else if (percent >= 60) label = "Good progress";
  else if (percent >= 30) label = "Building up";

  return { percent, label, tips: tips.slice(0, 3) };
}
