import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { invite_code } = await req.json();
  const couples = await getCollection("couples");
  const couple = await couples.findOne({ invite_code });

  if (!couple) {
    return Response.json({ error: "Invalid invite code" });
  }
  if (couple.partner_2_id.toString() !== user._id.toString()) {
    return Response.json({ error: "This invite is not for you" });
  }

  const now = new Date();
  await couples.updateOne(
    { _id: couple._id },
    { $set: { status: "active", updated_at: now } }
  );

  const users = await getCollection("users");
  await users.updateOne(
    { _id: couple.partner_1_id },
    { $set: { partner_id: couple.partner_2_id } }
  );
  await users.updateOne(
    { _id: couple.partner_2_id },
    { $set: { partner_id: couple.partner_1_id } }
  );

  return Response.json({ message: "Partnership activated" });
}
