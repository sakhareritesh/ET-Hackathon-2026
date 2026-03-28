import { NextRequest } from "next/server";

/**
 * Profile sync endpoint — works without JWT auth.
 *
 * Uses a simple `user_id` field (from localStorage in local-auth mode)
 * to key profiles in MongoDB.  Falls back to a fixed "default" user
 * when no id is supplied, so a single-user local setup just works.
 *
 * GET  /api/profile/sync?user_id=xxx   → fetch profile
 * POST /api/profile/sync               → upsert profile { user_id, ...profile }
 */

async function getCollection() {
  const { MongoClient } = await import("mongodb");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/et_finance";
  const dbName = process.env.MONGODB_DB_NAME || "et_finance";
  const client = new MongoClient(uri, { maxPoolSize: 3 });
  await client.connect();
  return client.db(dbName).collection("financial_profiles");
}

function resolveUserId(raw: string | null | undefined): string {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "default_local_user";
}

export async function GET(req: NextRequest) {
  try {
    const userId = resolveUserId(req.nextUrl.searchParams.get("user_id"));
    const col = await getCollection();
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

    const col = await getCollection();
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
