import { NextRequest } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return unauthorized();

  // Form 16 parser is a placeholder stub
  return Response.json({
    message: "Form 16 parsed successfully",
    data: {
      gross_salary: 0,
      standard_deduction: 50000,
      net_taxable: 0,
      tax_paid: 0,
    },
  });
}
