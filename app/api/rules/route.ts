import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const [whitelist, phishing, ruleVersion] = await Promise.all([
      db.getWhitelistRules(),
      db.getPhishingRules(),
      db.getRuleVersion()
    ]);

    return jsonWithCors({
      whitelist: whitelist || [],
      phishing: phishing || [],
      ruleVersion
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to load rules", message: err?.message }, { status: 500 });
  }
}
