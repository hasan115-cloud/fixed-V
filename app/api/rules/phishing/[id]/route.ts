import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = await db.deletePhishingRule(id);
    return jsonWithCors({ success });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to delete phishing rule", message: err?.message }, { status: 500 });
  }
}
