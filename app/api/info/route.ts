import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { getPublicServerUrl } from "@/lib/serverUrl";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  const serverUrl = getPublicServerUrl(req);
  const dbInfo = db.getDatabaseInfo ? db.getDatabaseInfo() : null;

  return jsonWithCors({
    serverUrl,
    version: "1.4.0",
    status: "operational",
    database: dbInfo ? (dbInfo.isSupabase ? "Supabase / PostgreSQL" : "Local File Engine") : "Local Resilient Engine",
    databaseHost: dbInfo?.host || "active",
    timestamp: new Date().toISOString()
  });
}
