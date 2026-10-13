import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, clientName, reason } = await req.json();

    if (!clientId) {
      return jsonWithCors({ error: "clientId is required" }, { status: 400 });
    }

    const request = await db.createRemovalRequest({
      clientId,
      clientName: clientName || "Workstation",
      reason: reason || "Uninstallation requested"
    });

    return jsonWithCors({ success: true, request });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to create removal request", message: err?.message }, { status: 500 });
  }
}
