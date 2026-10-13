import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { verifyAdminAuth } from "@/lib/adminAuth";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const result = await verifyAdminAuth(password);

    if (!result.valid) {
      return jsonWithCors({ valid: false, error: "Invalid password" }, { status: 401 });
    }

    return jsonWithCors({ valid: true, username: result.username });
  } catch (err: any) {
    return jsonWithCors({ valid: false, error: err?.message || "Verification failed" }, { status: 500 });
  }
}
