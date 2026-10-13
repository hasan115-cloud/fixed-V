import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { pattern, description } = await req.json();
    if (!pattern) {
      return jsonWithCors({ error: "Pattern is required" }, { status: 400 });
    }

    const rule = await db.addWhitelistRule(pattern, description || "", "Admin");
    return jsonWithCors({ success: true, rule });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to add whitelist rule", message: err?.message }, { status: 500 });
  }
}
