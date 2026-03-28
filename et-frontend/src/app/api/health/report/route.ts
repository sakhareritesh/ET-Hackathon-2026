import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const reports = await getCollection("reports");
  const report = await reports.findOne(
    { user_id: new ObjectId(user._id), report_type: "money_health" },
    { sort: { generated_at: -1 } }
  );

  if (!report) {
    return Response.json({ error: "No report found. Calculate your score first." });
  }

  return Response.json({
    ...report,
    id: report._id.toString(),
    user_id: report.user_id.toString(),
    _id: undefined,
  });
}
