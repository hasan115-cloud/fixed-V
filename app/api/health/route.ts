import { NextRequest, NextResponse } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET() {
  return jsonWithCors({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "PhishGuard Enterprise Security Hub"
  });
}
