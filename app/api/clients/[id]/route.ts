import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const client = await db.getClientById(id);
    if (!client) {
      return jsonWithCors({ error: "Client not found" }, { status: 404 });
    }

    const { events } = await db.getUrlEvents({ clientId: id, limit: 100 });
    const alerts = await db.getThreatAlerts(id);

    return jsonWithCors({ client, events, alerts });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to fetch client details", message: err?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const success = await db.deleteClient(id);
    return jsonWithCors({ success });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to delete client", message: err?.message }, { status: 500 });
  }
}
