import { NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import { getCurrentUser, unauthorized } from "@/lib/jwt";
import { computeTaxAnalysis, type TaxAnalyzePayload } from "@/lib/engine/tax";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  try {
    const data = (await req.json()) as TaxAnalyzePayload;

    // Run tax calculation directly — no external AI backend needed
    const result = computeTaxAnalysis(data);

    // Save to DB
    const taxRecords = await getCollection("tax_records");
    const now = new Date();
    await taxRecords.updateOne(
      {
        user_id: new ObjectId(user._id),
        financial_year: data.financial_year || "2025-26",
      },
      {
        $set: {
          user_id: new ObjectId(user._id),
          financial_year: data.financial_year || "2025-26",
          form16_uploaded: false,
          income_details: data.income_details,
          deductions: data.deductions,
          regime_comparison: result.regime_comparison,
          missed_deductions: result.missed_deductions || [],
          tax_saving_investments: result.tax_saving_investments || [],
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true }
    );

    return Response.json({
      ...result,
      id: user._id.toString(),
    });
  } catch (err) {
    return Response.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
