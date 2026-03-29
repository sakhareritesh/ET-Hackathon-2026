import { NextResponse } from "next/server";

export async function GET() {
  // In a full deployment this would query MongoDB's tax_records collection.
  // For the hackathon demo, history is managed client-side via localStorage
  // and saved/loaded through the taxWizardStore.
  return NextResponse.json({
    history: [],
    message: "Use localStorage for demo mode",
  });
}
