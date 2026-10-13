import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientName, ruleVersion, stats } = body;

    if (!clientId) {
      return jsonWithCors({ error: "clientId is required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    await db.heartbeatClient(
      clientId,
      stats,
      clientName,
      ip.split(",")[0].trim(),
      typeof ruleVersion === "number" ? ruleVersion : undefined
    );

    const activeRuleVersion = await db.getRuleVersion();

    return jsonWithCors({
      success: true,
      ruleVersion: activeRuleVersion,
      needsRuleUpdate: typeof ruleVersion === "number" ? ruleVersion < activeRuleVersion : false
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Heartbeat failed", message: err?.message }, { status: 500 });
  }
}
