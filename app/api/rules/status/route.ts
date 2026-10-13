import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const status = await db.getRuleSyncStatus();
    return jsonWithCors(status);
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to fetch rule status", message: err?.message }, { status: 500 });
  }
}
