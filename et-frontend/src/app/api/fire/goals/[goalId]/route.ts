import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { goalId } = await params;
  const updates = await req.json();
  updates.updated_at = new Date();

  const goals = await getCollection("goals");
  await goals.updateOne(
    { _id: new ObjectId(goalId), user_id: new ObjectId(user._id) },
    { $set: updates }
  );
  return Response.json({ message: "Goal updated" });
}
