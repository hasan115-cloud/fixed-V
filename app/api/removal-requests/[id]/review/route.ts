import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { verifyAdminAuth } from "@/lib/adminAuth";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { decision, username, password, note } = body;

    if (decision !== "APPROVE" && decision !== "DENY") {
      return jsonWithCors({ error: "Invalid review decision. Must be APPROVE or DENY" }, { status: 400 });
    }

    const auth = await verifyAdminAuth(password, username);
    if (!auth.valid) {
      return jsonWithCors({ error: "Invalid administrator credentials" }, { status: 401 });
    }

    const request = await db.reviewRemovalRequest(id, decision, username || auth.username, note);
    if (!request) {
      return jsonWithCors({ error: "Removal request not found" }, { status: 404 });
    }

    return jsonWithCors({ success: true, request });
  } catch (err: any) {
    return jsonWithCors({ error: "Review failed", message: err?.message }, { status: 500 });
  }
}
