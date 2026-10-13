import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  try {
    const admin = await db.getAdminCredentials();
    return jsonWithCors({
      configured: true,
      username: admin.username || "admin"
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to get admin status", message: err?.message }, { status: 500 });
  }
}
