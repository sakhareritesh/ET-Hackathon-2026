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

    const aiResult = await callAI("/ai/fire/plan", {
      ...data,
      risk_profile: riskProfile,
    });

    const result = aiResult as Record<string, unknown>;

    // Save goals to DB
    const goals = await getCollection("goals");
    const goalList = (result.goals || []) as Record<string, unknown>[];
    for (const goal of goalList) {
      const goalDoc = {
        ...goal,
        user_id: new ObjectId(user._id),
        status: "active",
        monthly_roadmap: [],
        created_at: new Date(),
        updated_at: new Date(),
      };
      const insertResult = await goals.insertOne(goalDoc);
      goal.id = insertResult.insertedId.toString();
      goal.user_id = user._id.toString();
    }

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
