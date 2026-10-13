import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const requests = await db.getRemovalRequests();
    return jsonWithCors({ requests: requests || [] });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to fetch removal requests", message: err?.message }, { status: 500 });
  }
}
