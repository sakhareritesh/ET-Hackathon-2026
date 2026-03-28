import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";
import { callAI } from "@/lib/ai-proxy";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  try {
    const formData = await req.formData();
    const source = (formData.get("source") as string) || "cams";

    const profiles = await getCollection("financial_profiles");
    const profile = await profiles.findOne({ user_id: new ObjectId(user._id) });
    const riskProfile = profile?.risk_profile || "moderate";

    // Since parsers are stubs, send empty holdings for AI analysis
    const aiResult = await callAI("/ai/mf/analyze", {
      holdings: [],
      risk_profile: riskProfile,
    });

    const result = aiResult as Record<string, unknown>;

    // Save to DB
    const investments = await getCollection("investments");
    const now = new Date();
    const investmentDoc = {
      user_id: new ObjectId(user._id),
      source,
      holdings: result.holdings || [],
      portfolio_summary: result.portfolio_summary || {},
      overlap_analysis: result.overlap_analysis || [],
      rebalancing_plan: {
        generated_at: now,
        suggestions: result.rebalancing_suggestions || [],
      },
      created_at: now,
      updated_at: now,
    };
    const insertResult = await investments.insertOne(investmentDoc);

    return Response.json({
      id: insertResult.insertedId.toString(),
      user_id: user._id.toString(),
      source,
      ...result,
    });
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
