import { supabase } from "@/lib/supabase";

async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

export async function saveTaxAnalysis(result: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return;
  const rc = result.regime_comparison as Record<string, unknown> | undefined;
  await supabase.from("tax_analyses").insert({
    user_id: userId,
    financial_year: (result.financial_year as string) || "2025-26",
    old_regime_tax: (rc?.old_regime as Record<string, number>)?.total_tax || 0,
    new_regime_tax: (rc?.new_regime as Record<string, number>)?.total_tax || 0,
    recommended_regime: (rc?.recommended_regime as string) || "new",
    missed_deductions: result.missed_deductions || [],
    savings_potential: (rc?.savings as number) || 0,
    full_result: result,
  });
}

export async function getTaxHistory() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from("tax_analyses")
    .select("*").eq("user_id", userId)
    .order("analyzed_at", { ascending: false }).limit(10);
  return data || [];
}

export async function saveHealthScore(report: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from("health_scores").insert({
    user_id: userId,
    overall_score: report.overall_score,
    recommendations: report.dimensions || {},
  });
}

export async function getHealthHistory() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from("health_scores")
    .select("*").eq("user_id", userId)
    .order("calculated_at", { ascending: false }).limit(10);
  return data || [];
}

export async function saveFirePlan(plan: Record<string, unknown>, inputParams: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from("fire_plans").insert({
    user_id: userId,
    fire_number: plan.fire_number,
    years_to_fire: plan.years_to_fire,
    monthly_sip_required: plan.monthly_sip_total || plan.monthly_sip_needed,
    success_probability: plan.success_probability || 0,
    allocation: plan.asset_allocation || {},
    glide_path: plan.glide_path_yearly || [],
    input_params: inputParams,
  });
}

export async function getFireHistory() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from("fire_plans")
    .select("*").eq("user_id", userId)
    .order("generated_at", { ascending: false }).limit(10);
  return data || [];
}

export async function saveMfPortfolio(analysis: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from("mf_portfolios").insert({
    user_id: userId,
    total_invested: analysis.totalInvested,
    current_value: analysis.totalCurrent,
    xirr: analysis.portfolioXirr,
    holdings: analysis.perFund || [],
    overlap_matrix: analysis.overlapMatrix || [],
    rebalancing_plan: analysis.rebalance || {},
  });
}

export async function getMfHistory() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from("mf_portfolios")
    .select("*").eq("user_id", userId)
    .order("analyzed_at", { ascending: false }).limit(10);
  return data || [];
}

export async function saveChatMessage(role: string, content: string, toolUsed?: string, toolResult?: Record<string, unknown>) {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from("chat_messages").insert({
    user_id: userId,
    role,
    content,
    tool_used: toolUsed || null,
    tool_result: toolResult || null,
  });
}

export async function getChatHistory() {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase.from("chat_messages")
    .select("*").eq("user_id", userId)
    .order("created_at", { ascending: true }).limit(100);
  return data || [];
}

export async function getLatestHealthScore() {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase.from("health_scores")
    .select("*").eq("user_id", userId)
    .order("calculated_at", { ascending: false }).limit(1).single();
  return data;
}

export async function getLatestTaxAnalysis() {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase.from("tax_analyses")
    .select("*").eq("user_id", userId)
    .order("analyzed_at", { ascending: false }).limit(1).single();
  return data;
}

export async function getLatestFirePlan() {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase.from("fire_plans")
    .select("*").eq("user_id", userId)
    .order("generated_at", { ascending: false }).limit(1).single();
  return data;
}
