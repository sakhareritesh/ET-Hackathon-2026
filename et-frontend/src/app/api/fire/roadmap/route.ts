import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const goals = await getCollection("goals");
  const list = await goals
    .find({ user_id: new ObjectId(user._id), status: "active" })
    .limit(100)
    .toArray();

  const mapped = list.map((g) => ({
    ...g,
    id: g._id.toString(),
    user_id: g.user_id.toString(),
    _id: undefined,
  }));
  return Response.json({ goals: mapped });
}
