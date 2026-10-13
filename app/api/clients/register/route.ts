import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientName, os, browser, platform, extensionVersion, ruleVersion } = body;

    if (!clientId) {
      return jsonWithCors({ error: "clientId is required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    const client = await db.registerOrUpdateClient({
      clientId,
      clientName: clientName || `Workstation-${clientId.slice(0, 6)}`,
      os: os || "Unknown OS",
      browser: browser || "Chrome",
      platform: platform || "Desktop",
      extensionVersion: extensionVersion || "1.4.0",
      ruleVersion: typeof ruleVersion === "number" ? ruleVersion : 1,
      ip: ip.split(",")[0].trim()
    });

    const activeRuleVersion = await db.getRuleVersion();

    return jsonWithCors({
      success: true,
      client,
      ruleVersion: activeRuleVersion
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Enrollment failed", message: err?.message }, { status: 500 });
  }
}
