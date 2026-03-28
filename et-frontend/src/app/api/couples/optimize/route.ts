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

  if (!couple) {
    return Response.json({ error: "No active partnership found" });
  }

  const profiles = await getCollection("financial_profiles");
  const p1 = await profiles.findOne({ user_id: couple.partner_1_id });
  const p2 = await profiles.findOne({ user_id: couple.partner_2_id });

  if (!p1 || !p2) {
    return Response.json({ error: "Both partners need to complete financial onboarding" });
  }

  const sumInv = (p: Record<string, unknown>) => {
    const inv = (p.existing_investments || {}) as Record<string, number>;
    return Object.values(inv).reduce(
      (sum, v) => sum + (typeof v === "number" ? v : 0),
      0
    );
  };

  const p1Total = sumInv(p1);
  const p2Total = sumInv(p2);
  const p1Inv = (p1.existing_investments || {}) as Record<string, number>;
  const p2Inv = (p2.existing_investments || {}) as Record<string, number>;

  const p1Hra = ((p1.salary_structure as Record<string, number>) || {}).hra || 0;
  const p2Hra = ((p2.salary_structure as Record<string, number>) || {}).hra || 0;
  const p1Rent = ((p1.monthly_expenses as Record<string, number>) || {}).rent || 0;
  const p2Rent = ((p2.monthly_expenses as Record<string, number>) || {}).rent || 0;

  const hraSplit =
    p1Hra >= p2Hra
      ? { recommended_claimer: "partner_1", savings: Math.min(p1Hra, p1Rent + p2Rent) * 12 * 0.3, reason: "Partner 1 has higher HRA component" }
      : { recommended_claimer: "partner_2", savings: Math.min(p2Hra, p1Rent + p2Rent) * 12 * 0.3, reason: "Partner 2 has higher HRA component" };

  const optimization = {
    hra_split: hraSplit,
    nps_matching: { partner_1_contribution: 50000, partner_2_contribution: 50000, total_tax_benefit: 30000 },
    sip_splits: [],
    insurance_plan: { joint_vs_individual: "individual", recommendations: ["Both should have separate term plans"] },
    combined_net_worth: {
      total: p1Total + p2Total,
      partner_1_share: p1Total,
      partner_2_share: p2Total,
      breakdown: {
        equity: (p1Inv.stocks || 0) + (p1Inv.mutual_funds || 0) + (p2Inv.stocks || 0) + (p2Inv.mutual_funds || 0),
        debt: (p1Inv.fd || 0) + (p1Inv.ppf || 0) + (p2Inv.fd || 0) + (p2Inv.ppf || 0),
        real_estate: (p1Inv.real_estate || 0) + (p2Inv.real_estate || 0),
        gold: (p1Inv.gold || 0) + (p2Inv.gold || 0),
        cash: 0,
        other: (p1Inv.other || 0) + (p2Inv.other || 0),
      },
    },
  };

  await couples.updateOne(
    { _id: couple._id },
    { $set: { optimization, updated_at: new Date() } }
  );

  const users = await getCollection("users");
  const u1 = await users.findOne({ _id: couple.partner_1_id });
  const u2 = await users.findOne({ _id: couple.partner_2_id });

  return Response.json({
    id: couple._id.toString(),
    partner_1_name: u1?.full_name || "Partner 1",
    partner_2_name: u2?.full_name || "Partner 2",
    status: "active",
    optimization,
  });
}
