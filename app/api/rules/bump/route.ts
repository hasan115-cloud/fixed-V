import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST() {
  try {
    const ruleVersion = await db.bumpRuleVersion();
    return jsonWithCors({ success: true, ruleVersion });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to bump rule version", message: err?.message }, { status: 500 });
  }
}
