import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { pattern, severity, reason } = await req.json();
    if (!pattern) {
      return jsonWithCors({ error: "Pattern is required" }, { status: 400 });
    }

    const rule = await db.addPhishingRule(pattern, severity || "HIGH", reason || "Policy violation", "Admin");
    return jsonWithCors({ success: true, rule });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to add phishing rule", message: err?.message }, { status: 500 });
  }
}
