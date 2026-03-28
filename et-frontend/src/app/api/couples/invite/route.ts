import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { randomBytes } from "crypto";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const { partner_email } = await req.json();
  const users = await getCollection("users");
  const partner = await users.findOne({ email: partner_email });
  if (!partner) {
    return Response.json({ error: "Partner not found. They need to register first." });
  }

  const inviteCode = randomBytes(16).toString("base64url");
  const couples = await getCollection("couples");
  const now = new Date();

  await couples.insertOne({
    partner_1_id: new ObjectId(user._id),
    partner_2_id: partner._id,
    invite_code: inviteCode,
    status: "pending",
    optimization: null,
    created_at: now,
    updated_at: now,
  });

  return Response.json({ invite_code: inviteCode, message: "Invite sent" });
}
