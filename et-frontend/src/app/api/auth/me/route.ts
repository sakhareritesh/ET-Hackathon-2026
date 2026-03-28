import { NextRequest } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  return Response.json({
    id: user._id.toString(),
    email: user.email,
    full_name: user.full_name,
    phone: user.phone || null,
    avatar_url: user.avatar_url || null,
  });
}
