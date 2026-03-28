import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const userOid = new ObjectId(user._id);
  const couples = await getCollection("couples");
  const couple = await couples.findOne({
    $or: [{ partner_1_id: userOid }, { partner_2_id: userOid }],
    status: "active",
  });

  if (!couple || !couple.optimization) {
    return Response.json({ error: "No optimization data. Run optimize first." });
  }

  return Response.json(couple.optimization.combined_net_worth);
}
