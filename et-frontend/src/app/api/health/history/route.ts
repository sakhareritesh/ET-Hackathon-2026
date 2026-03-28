import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const reports = await getCollection("reports");
  const list = await reports
    .find(
      { user_id: new ObjectId(user._id), report_type: "money_health" },
      { projection: { overall_score: 1, generated_at: 1 } }
    )
    .sort({ generated_at: -1 })
    .limit(12)
    .toArray();

  const mapped = list.map((r) => ({
    id: r._id.toString(),
    overall_score: r.overall_score,
    generated_at: r.generated_at,
  }));
  return Response.json({ history: mapped });
}
