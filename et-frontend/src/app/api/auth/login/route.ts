import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";
import {
  verifyPassword,
  createAccessToken,
  createRefreshToken,
} from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const users = await getCollection("users");
    const user = await users.findOne({ email });

    if (!user || !verifyPassword(password, user.password_hash)) {
      return Response.json(
        { detail: "Invalid email or password" },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    return Response.json({
      access_token: createAccessToken(userId),
      refresh_token: createRefreshToken(userId),
      token_type: "bearer",
      user_id: userId,
    });
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
