import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { getCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const SECRET = process.env.JWT_SECRET_KEY || "change-me";
const ALGORITHM = "HS256";
const ACCESS_EXPIRE_MIN = 30;
const REFRESH_EXPIRE_DAYS = 7;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function createAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, {
    algorithm: ALGORITHM,
    expiresIn: `${ACCESS_EXPIRE_MIN}m`,
  });
}

export function createRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, SECRET, {
    algorithm: ALGORITHM,
    expiresIn: `${REFRESH_EXPIRE_DAYS}d`,
  });
}

export function verifyToken(token: string): { sub: string; type?: string } {
  return jwt.verify(token, SECRET, { algorithms: [ALGORITHM] }) as {
    sub: string;
    type?: string;
  };
}

export async function getCurrentUser(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const payload = verifyToken(auth.slice(7));
    const users = await getCollection("users");
    const user = await users.findOne({ _id: new ObjectId(payload.sub) });
    return user;
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ detail: "Could not validate credentials" }, { status: 401 });
}
