import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const profiles = await getCollection("financial_profiles");
  const profile = await profiles.findOne({ user_id: new ObjectId(user._id) });
  if (!profile) {
    return Response.json(
      { detail: "Profile not found. Complete onboarding first." },
      { status: 404 }
    );
  }
  return Response.json({
    ...profile,
    id: profile._id.toString(),
    user_id: profile.user_id.toString(),
    _id: undefined,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const data = await req.json();
  const userId = new ObjectId(user._id);
  const profiles = await getCollection("financial_profiles");
  const now = new Date();

  const profileDoc = { ...data, user_id: userId, updated_at: now };

  const existing = await profiles.findOne({ user_id: userId });
  if (existing) {
    await profiles.updateOne({ user_id: userId }, { $set: profileDoc });
    return Response.json({
      ...profileDoc,
      id: existing._id.toString(),
      user_id: userId.toString(),
    });
  }

  profileDoc.created_at = now;
  const result = await profiles.insertOne(profileDoc);
  return Response.json({
    ...profileDoc,
    id: result.insertedId.toString(),
    user_id: userId.toString(),
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const data = await req.json();
  const userId = new ObjectId(user._id);
  const profiles = await getCollection("financial_profiles");
  await profiles.updateOne(
    { user_id: userId },
    { $set: { ...data, updated_at: new Date() } }
  );
  return Response.json({ message: "Profile updated successfully" });
}
