import crypto from "crypto";
import { NextRequest } from "next/server";
import { jsonWithCors, handleCorsOptions } from "@/lib/cors";
import { hashPassword, verifyAdminAuth } from "@/lib/adminAuth";
import { db } from "@/lib/db";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function POST(req: NextRequest) {
  try {
    const { currentPassword, newUsername, newPassword } = await req.json();

    if (!newPassword || newPassword.length < 6) {
      return jsonWithCors({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const auth = await verifyAdminAuth(currentPassword);
    if (!auth.valid) {
      return jsonWithCors({ error: "Current password is incorrect" }, { status: 401 });
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(newPassword, salt);
    const username = (newUsername && newUsername.trim()) || auth.username || "admin";

    await db.updateAdminCredentials(username, passwordHash, salt);

    return jsonWithCors({
      success: true,
      message: "Admin credentials successfully updated"
    });
  } catch (err: any) {
    return jsonWithCors({ error: "Failed to update admin credentials", message: err?.message }, { status: 500 });
  }
}
