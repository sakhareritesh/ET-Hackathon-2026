import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const investments = await getCollection("investments");
  const portfolio = await investments.findOne(
    { user_id: new ObjectId(user._id) },
    { sort: { created_at: -1 } }
  );

  if (!portfolio) {
    return Response.json({ error: "No portfolio found. Upload a statement first." });
  }

  return Response.json({
    ...portfolio,
    id: portfolio._id.toString(),
    user_id: portfolio.user_id.toString(),
    _id: undefined,
  });
}
