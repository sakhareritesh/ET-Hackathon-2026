import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";
import { callAI } from "@/lib/ai-proxy";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  try {
    const { eventId } = await params;
    const events = await getCollection("life_events");
    const event = await events.findOne({ _id: new ObjectId(eventId) });
    if (!event) {
      return Response.json({ error: "Event not found" });
    }

    const profiles = await getCollection("financial_profiles");
    const profile = await profiles.findOne({ user_id: new ObjectId(user._id) });

    const investments = (profile?.existing_investments || {}) as Record<string, number>;
    const debts = (profile?.debts || []) as Array<Record<string, number | string>>;
    const insurance = (profile?.insurance || {}) as Record<string, Record<string, unknown>>;

    const invSummary = Object.entries(investments)
      .filter(([, v]) => typeof v === "number" && v > 0)
      .map(([k, v]) => `${k}: ₹${(v as number).toLocaleString("en-IN")}`)
      .join(", ") || "None";

    const debtSummary = debts.length
      ? debts.map((d) => `${d.type}: ₹${Number(d.outstanding || 0).toLocaleString("en-IN")}`).join(", ")
      : "No debts";

    const advice = await callAI("/ai/events/advise", {
      event_type: event.event_type || "",
      event_date: String(event.event_date || ""),
      amount: event.event_data?.amount || 0,
      description: event.event_data?.description || "",
      annual_income: (profile?.annual_income as Record<string, number>)?.gross || 0,
      risk_profile: profile?.risk_profile || "moderate",
      tax_regime: profile?.tax_regime || "new",
      investments_summary: invSummary,
      debts_summary: debtSummary,
      life_cover: (insurance.life?.sum_assured as number) || 0,
      health_cover: (insurance.health?.sum_assured as number) || 0,
    });

    await events.updateOne(
      { _id: new ObjectId(eventId) },
      { $set: { ai_advice: advice, updated_at: new Date() } }
    );

    return Response.json(advice);
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
