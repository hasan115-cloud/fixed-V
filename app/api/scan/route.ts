import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { classifyUrl } from "@/lib/detector";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, source = "manual-scan", clientId = "live-workstation", clientName = "Active System", eventId } = body;

    if (!url || typeof url !== "string") {
      return jsonWithCors({ error: "URL is required" }, { status: 400 });
    }

    const result = await classifyUrl(url.trim());

    // Record URL event in real-time history
    const recordPayload = {
      eventId: eventId || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      url: url.trim(),
      domain: result.domain,
      classification: result.verdict,
      verdict: result.action,
      score: result.score,
      reason: result.reasons?.length ? result.reasons.join("; ") : "Analyzed",
      clientId,
      clientName,
      source,
      ruleTriggered: result.ruleTriggered || false,
      ruleType: result.ruleType || null
    };

    const { wasNew } = await db.recordUrlEvent(recordPayload);

    // If phishing or suspicious high threat score, record active threat alert (prevent duplicates if retried)
    if (wasNew && (result.verdict === "PHISHING" || result.score >= 0.8)) {
      await db.recordThreatAlert({
        clientId,
        clientName,
        url: url.trim(),
        domain: result.domain,
        score: result.score,
        reasons: result.reasons,
        source
      });
    }

    return jsonWithCors({
      ...result,
      recordedEventId: recordPayload.eventId
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Scan failed", message: err?.message }, { status: 500 });
  }
}
