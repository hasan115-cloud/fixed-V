import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, token } = await req.json();

    if (!clientId || !token) {
      return jsonWithCors({ authorized: false, error: "clientId and token are required" }, { status: 400 });
    }

    const result = await db.verifyAndConsumeRemovalToken(clientId, token);
    return jsonWithCors(result);
  } catch (err: any) {
    return jsonWithCors({ authorized: false, error: err?.message || "Token verification failed" }, { status: 500 });
  }
}
