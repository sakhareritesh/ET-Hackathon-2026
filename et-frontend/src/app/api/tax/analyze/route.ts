import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";
import { callAI } from "@/lib/ai-proxy";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  try {
    const data = await req.json();

    const profiles = await getCollection("financial_profiles");
    const profile = await profiles.findOne({ user_id: new ObjectId(user._id) });
    const riskProfile = profile?.risk_profile || "moderate";

    const aiResult = await callAI("/ai/tax/analyze", {
      ...data,
      risk_profile: riskProfile,
    });

    const result = aiResult as Record<string, unknown>;

    // Save to DB
    const taxRecords = await getCollection("tax_records");
    const now = new Date();
    await taxRecords.updateOne(
      {
        user_id: new ObjectId(user._id),
        financial_year: data.financial_year || "2025-26",
      },
      {
        $set: {
          user_id: new ObjectId(user._id),
          financial_year: data.financial_year || "2025-26",
          form16_uploaded: false,
          income_details: data.income_details,
          deductions: data.deductions,
          regime_comparison: result.regime_comparison,
          missed_deductions: result.missed_deductions || [],
          tax_saving_investments: result.tax_saving_investments || [],
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true }
    );

    return Response.json({
      id: user._id.toString(),
      financial_year: data.financial_year || "2025-26",
      ...result,
    });
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
