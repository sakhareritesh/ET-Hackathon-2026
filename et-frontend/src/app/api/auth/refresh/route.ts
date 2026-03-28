import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * With no JWT, "refresh" simply validates that the user_id still
 * belongs to an existing user.  This keeps the endpoint alive so
 * nothing breaks, but it does nothing token-related.
 */
export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return Response.json({ detail: "user_id required" }, { status: 400 });
    }

    const users = await getCollection("users");
    const user = await users.findOne({ _id: new ObjectId(user_id) });

    if (!user) {
      return Response.json({ detail: "User not found" }, { status: 401 });
    }

    return Response.json({
      user_id: user._id.toString(),
      email: user.email,
      full_name: user.full_name,
    });
  } catch {
    return Response.json(
      { detail: "Invalid user id" },
      { status: 401 }
    );
  }
}
