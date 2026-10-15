import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { verifyAdminAuth } from "@/lib/adminAuth";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, clientId, clientName } = await req.json();

    if (!username || !password) {
      return jsonWithCors({ authorized: false, error: "Username and password are required" }, { status: 400 });
    }

    const auth = await verifyAdminAuth(password, username);
    if (!auth.valid) {
      return jsonWithCors({ authorized: false, error: "Invalid administrator credentials" }, { status: 401 });
    }

    // Authorized! If clientId provided, unenroll the workstation
    if (clientId) {
      await db.deleteClient(clientId);

      // If there is any pending removal request for this client, mark it consumed/approved
      const requests = await db.getRemovalRequests();
      const clientReq = requests.find(r => r.clientId === clientId && r.status === "PENDING");
      if (clientReq) {
        await db.reviewRemovalRequest(clientReq.id, "APPROVE", username, "Direct admin on-device authorization");
        await db.verifyAndConsumeRemovalToken(clientId, clientReq.authorizationToken || "");
      }
    }

    return jsonWithCors({
      authorized: true,
      success: true,
      message: "Administrator identity verified. Uninstallation authorized."
    });
  } catch (err: any) {
    return jsonWithCors({ authorized: false, error: err?.message || "Verification failed" }, { status: 500 });
  }
}
