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
    const { clientId, clientName, events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return jsonWithCors({ success: true, acknowledgedIds: [] });
    }

    const acknowledgedIds: string[] = [];

    for (const evt of events) {
      if (!evt.url) continue;

      let classification = evt.classification;
      let verdict = evt.verdict;
      let score = typeof evt.score === "number" ? evt.score : 0.05;
      let domain = evt.domain;
      let reason = evt.reason || (Array.isArray(evt.reasons) ? evt.reasons.join("; ") : "Extension telemetry");

      if (!classification || !domain) {
        const analyzed = await classifyUrl(evt.url);
        classification = analyzed.verdict;
        verdict = analyzed.action;
        score = analyzed.score;
        domain = analyzed.domain;
        if (!reason || reason === "Extension telemetry") {
          reason = analyzed.reasons.join("; ");
        }
      }

      const eventId = evt.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      await db.recordUrlEvent(
        {
          eventId,
          url: evt.url,
          domain: domain || new URL(evt.url).hostname,
          classification,
          verdict: verdict || (classification === "PHISHING" ? "BLOCKED" : classification === "SUSPICIOUS" ? "WARNING" : "ALLOWED"),
          score,
          reason,
          clientId: clientId || evt.clientId || "unknown-client",
          clientName: clientName || evt.clientName || "Unknown Workstation",
          source: evt.source || "extension-telemetry"
        },
        evt.observedAt || evt.timestamp
      );

      acknowledgedIds.push(eventId);

      if (classification === "PHISHING" || score >= 0.8) {
        await db.recordThreatAlert({
          clientId: clientId || evt.clientId || "unknown-client",
          clientName: clientName || evt.clientName || "Unknown Workstation",
          url: evt.url,
          domain: domain || new URL(evt.url).hostname,
          score,
          reasons: Array.isArray(evt.reasons) ? evt.reasons : [reason],
          source: evt.source || "extension-telemetry"
        });
      }
    }

    return jsonWithCors({
      success: true,
      acknowledgedIds
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to process URL events", message: err?.message }, { status: 500 });
  }
}
