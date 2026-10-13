import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const clients = await db.getClients();
    return jsonWithCors({ clients: clients || [] });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to fetch clients", message: err?.message }, { status: 500 });
  }
}
