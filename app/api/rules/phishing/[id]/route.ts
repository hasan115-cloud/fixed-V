import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await db.updatePhishingRule(id, body);
    if (!updated) {
      return jsonWithCors({ error: "Phishing rule not found" }, { status: 404 });
    }
    return jsonWithCors({ success: true, rule: updated });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to update phishing rule", message: err?.message }, { status: 500 });
  }
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
