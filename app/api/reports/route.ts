import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const report = await db.getReportData(
      clientId && clientId !== "ALL" ? clientId : undefined,
      startDate,
      endDate
    );

    return jsonWithCors(report);
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to generate report", message: err?.message }, { status: 500 });
  }
}
