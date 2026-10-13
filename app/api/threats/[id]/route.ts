import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { status } = await req.json();

    if (status !== "ACKNOWLEDGED" && status !== "RESOLVED") {
      return jsonWithCors({ error: "Invalid status value" }, { status: 400 });
    }

    const success = await db.updateThreatAlertStatus(id, status);
    return jsonWithCors({ success });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to update threat alert", message: err?.message }, { status: 500 });
  }
}
