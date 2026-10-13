import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const alerts = await db.getThreatAlerts(clientId && clientId !== "ALL" ? clientId : undefined);
    return jsonWithCors({ alerts: alerts || [] });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to fetch threat alerts", message: err?.message }, { status: 500 });
  }
}
