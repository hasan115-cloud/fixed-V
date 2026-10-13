import { NextRequest, NextResponse } from "next/server";
import { generateExtensionZip } from "@/lib/extensionPackager";
import { getPublicServerUrl } from "@/lib/serverUrl";
import { CORS_HEADERS, handleCorsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  const serverUrl = getPublicServerUrl(req);

  try {
    const zipBuffer = await generateExtensionZip(serverUrl);
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="phishguard-extension.zip"',
        "Content-Length": zipBuffer.length.toString(),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate extension package", message: err?.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
