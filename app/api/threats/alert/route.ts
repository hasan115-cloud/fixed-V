import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, clientName, url, domain, score, reasons, source } = body;

    if (!url) {
      return jsonWithCors({ error: "URL is required" }, { status: 400 });
    }

    const alert = await db.recordThreatAlert({
      clientId: clientId || "unknown-client",
      clientName: clientName || "Unknown Workstation",
      url,
      domain: domain || new URL(url).hostname,
      score: typeof score === "number" ? score : 0.9,
      reasons: Array.isArray(reasons) ? reasons : ["Phishing or malicious threat detected"],
      source: source || "agent-alert"
    });

    return jsonWithCors({ success: true, alert });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to record threat alert", message: err?.message }, { status: 500 });
  }
}
