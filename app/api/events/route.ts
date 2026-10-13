import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") || undefined;
    const classification = searchParams.get("classification") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : undefined;

    const result = await db.getUrlEvents({
      clientId: clientId !== "ALL" ? clientId : undefined,
      classification: classification !== "ALL" ? classification : undefined,
      search,
      limit,
      offset
    });

    return jsonWithCors(result);
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to fetch URL events", message: err?.message }, { status: 500 });
  }
}
