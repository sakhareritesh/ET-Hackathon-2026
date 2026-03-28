import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";
import {
  hashPassword,
  createAccessToken,
  createRefreshToken,
} from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, full_name, phone, date_of_birth, gender, city } =
      body;

    if (!email || !password || password.length < 8 || !full_name) {
      return Response.json(
        { detail: "Email, password (min 8 chars), and full_name are required" },
        { status: 400 }
      );
    }

    const users = await getCollection("users");
    const existing = await users.findOne({ email });
    if (existing) {
      return Response.json(
        { detail: "Email already registered" },
        { status: 400 }
      );
    }

    const now = new Date();
    const result = await users.insertOne({
      email,
      password_hash: hashPassword(password),
      full_name,
      phone: phone || null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      city: city || null,
      avatar_url: null,
      is_verified: false,
      auth_provider: "local",
      partner_id: null,
      created_at: now,
      updated_at: now,
    });

    const userId = result.insertedId.toString();
    return Response.json(
      {
        access_token: createAccessToken(userId),
        refresh_token: createRefreshToken(userId),
        token_type: "bearer",
        user_id: userId,
      },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
