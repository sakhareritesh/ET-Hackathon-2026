import { NextRequest } from "next/server";
import {
  verifyToken,
  createAccessToken,
  createRefreshToken,
} from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const { refresh_token } = await req.json();
    const payload = verifyToken(refresh_token);

    if (payload.type !== "refresh") {
      return Response.json(
        { detail: "Invalid token type" },
        { status: 401 }
      );
    }

    const userId = payload.sub;
    return Response.json({
      access_token: createAccessToken(userId),
      refresh_token: createRefreshToken(userId),
      token_type: "bearer",
      user_id: userId,
    });
  } catch {
    return Response.json(
      { detail: "Invalid refresh token" },
      { status: 401 }
    );
  }
}
