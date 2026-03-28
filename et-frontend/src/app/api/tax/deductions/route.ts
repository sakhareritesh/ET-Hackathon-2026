import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  const taxRecords = await getCollection("tax_records");
  const record = await taxRecords.findOne(
    { user_id: new ObjectId(user._id) },
    { sort: { created_at: -1 } }
  );

  if (!record) {
    return Response.json({ error: "No tax analysis found" });
  }

  return Response.json({
    missed_deductions: record.missed_deductions || [],
    tax_saving_investments: record.tax_saving_investments || [],
  });
}
