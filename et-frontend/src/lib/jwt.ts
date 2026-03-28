import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * Simple auth helpers — NO JWT tokens, NO authentication required.
 * We use a default dummy user to bypass login completely.
 */

const DEFAULT_USER_ID = "000000000000000000000000";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

/**
 * Reads user_id from `x-user-id` header or falls back to a dummy user.
 * Auto-creates the dummy user in MongoDB if it doesn't exist.
 */
export async function getCurrentUser(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || DEFAULT_USER_ID;
  try {
    const users = await getCollection("users");
    let user = await users.findOne({ _id: new ObjectId(userId) });
    
    // Auto-create default user if it doesn't exist
    if (!user && userId === DEFAULT_USER_ID) {
      await users.insertOne({
        _id: new ObjectId(DEFAULT_USER_ID),
        email: "guest@example.com",
        full_name: "Guest User",
        password_hash: hashPassword("password"), // dummy password
        created_at: new Date(),
        updated_at: new Date()
      });
      user = await users.findOne({ _id: new ObjectId(DEFAULT_USER_ID) });
    }
    
    return user;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json(
    { detail: "Not authenticated — missing or invalid user id" },
    { status: 401 }
  );
}
