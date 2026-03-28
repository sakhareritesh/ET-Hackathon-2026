import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";
import { callAI } from "@/lib/ai-proxy";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  try {
    const profiles = await getCollection("financial_profiles");
    const profile = await profiles.findOne({ user_id: new ObjectId(user._id) });
    if (!profile) {
      return Response.json({ error: "Complete financial onboarding first" });
    }

    const investments = (profile.existing_investments || {}) as Record<string, number>;
    const totalInvestments = Object.values(investments).reduce(
      (sum, v) => sum + (typeof v === "number" ? v : 0),
      0
    );
    const monthlyIncome = ((profile.annual_income as Record<string, number>)?.net || 0) / 12;
    const debts = (profile.debts || []) as Array<Record<string, number>>;
    const totalEmi = debts.reduce((sum, d) => sum + (d.emi || 0), 0);
    const debtRatio = monthlyIncome > 0 ? (totalEmi / monthlyIncome) * 100 : 0;
    const emergency = (profile.emergency_fund || {}) as Record<string, number>;
    const insurance = (profile.insurance || {}) as Record<string, Record<string, unknown>>;

    const result = await callAI("/ai/health/score", {
      monthly_income: monthlyIncome,
      monthly_expenses: ((profile.monthly_expenses as Record<string, number>)?.total || 0),
      emergency_fund: emergency.current_amount || 0,
      emergency_months: emergency.months_covered || 0,
      has_life_insurance: insurance.life?.has_cover || false,
      life_cover: insurance.life?.sum_assured || 0,
      has_health_insurance: insurance.health?.has_cover || false,
      health_cover: insurance.health?.sum_assured || 0,
      total_investments: totalInvestments,
      investment_breakdown: investments,
      total_emi: totalEmi,
      debt_ratio: debtRatio,
      tax_regime: profile.tax_regime || "new",
      risk_profile: profile.risk_profile || "moderate",
    });

    const scoreResult = result as Record<string, unknown>;

    // Save report
    const reports = await getCollection("reports");
    const reportDoc = {
      user_id: new ObjectId(user._id),
      report_type: "money_health",
      overall_score: scoreResult.overall_score || 50,
      dimensions: scoreResult.dimensions || {},
      ai_summary: scoreResult.ai_summary || "",
      top_3_actions: scoreResult.top_3_actions || [],
      generated_at: new Date(),
    };
    const insertResult = await reports.insertOne(reportDoc);
    scoreResult.report_id = insertResult.insertedId.toString();

    return Response.json(scoreResult);
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
