import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const events = await getCollection("life_events");
  const list = await events
    .find({ user_id: new ObjectId(user._id) })
    .sort({ created_at: -1 })
    .limit(50)
    .toArray();

  const mapped = list.map((e) => ({
    ...e,
    id: e._id.toString(),
    user_id: e.user_id.toString(),
    _id: undefined,
  }));
  return Response.json({ events: mapped });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const data = await req.json();
  const now = new Date();
  const events = await getCollection("life_events");

  const eventDoc = {
    ...data,
    user_id: new ObjectId(user._id),
    event_data: {
      amount: data.amount || 0,
      description: data.description || "",
    },
    ai_advice: null,
    chat_history: [],
    created_at: now,
    updated_at: now,
  };

  const result = await events.insertOne(eventDoc);
  return Response.json({ id: result.insertedId.toString(), message: "Event created" });
}
