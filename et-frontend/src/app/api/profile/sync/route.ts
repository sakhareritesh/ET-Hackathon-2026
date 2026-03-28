import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";

/**
 * Profile sync endpoint — no auth required.
 *
 * Uses a simple `user_id` string field to key profiles in MongoDB.
 * Falls back to "default_local_user" when no id is supplied.
 *
 * GET  /api/profile/sync?user_id=xxx   → fetch profile
 * POST /api/profile/sync               → upsert profile { user_id, ...profile }
 */

function resolveUserId(raw: string | null | undefined): string {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "default_local_user";
}

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req.nextUrl.searchParams.get("user_id"));
    const col = await getCollection("financial_profiles");
    const doc = await col.findOne({ sync_user_id: userId });

    if (!doc) {
      return Response.json({ found: false, profile: null });
    }

    const { _id, sync_user_id, created_at, updated_at, ...profile } = doc;
    return Response.json({
      found: true,
      profile,
      meta: { id: _id.toString(), sync_user_id, updated_at },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "db_error", detail: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, ...profileData } = body as Record<string, unknown>;
    const userId = resolveUserId(user_id as string | undefined);
    const now = new Date();

    const col = await getCollection("financial_profiles");
    const existing = await col.findOne({ sync_user_id: userId });

    if (existing) {
      await col.updateOne(
        { sync_user_id: userId },
        { $set: { ...profileData, sync_user_id: userId, updated_at: now } }
      );
      return Response.json({
        ok: true,
        action: "updated",
        profile: profileData,
        meta: { id: existing._id.toString(), sync_user_id: userId, updated_at: now },
      });
    }

    const result = await col.insertOne({
      ...profileData,
      sync_user_id: userId,
      created_at: now,
      updated_at: now,
    });

    return Response.json({
      ok: true,
      action: "created",
      profile: profileData,
      meta: { id: result.insertedId.toString(), sync_user_id: userId, updated_at: now },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: "db_error", detail: message }, { status: 500 });
  }
}
