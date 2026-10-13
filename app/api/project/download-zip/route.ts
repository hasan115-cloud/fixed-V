import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { CORS_HEADERS, handleCorsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return handleCorsOptions();
}

export async function GET(req: NextRequest) {
  try {
    const rootDir = process.cwd();
    const zip = new JSZip();

    const excludeList = new Set([
      "node_modules",
      ".next",
      ".git",
      ".aistudio",
      "phishguard-enterprise-fixed.zip"
    ]);

    function addDirectory(currentPath: string, zipFolder: any) {
      const items = fs.readdirSync(currentPath);

      for (const item of items) {
        if (excludeList.has(item)) continue;
        if (item.endsWith(".tmp") || item.startsWith(".DS_Store")) continue;

        const fullPath = path.join(currentPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const subFolder = zipFolder ? zipFolder.folder(item) : zip.folder(item);
          addDirectory(fullPath, subFolder);
        } else {
          const content = fs.readFileSync(fullPath);
          if (zipFolder) {
            zipFolder.file(item, content);
          } else {
            zip.file(item, content);
          }
        }
      }
    }

    addDirectory(rootDir, null);

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="phishguard-enterprise-fixed.zip"',
        "Content-Length": zipBuffer.length.toString()
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to generate project archive", message: err?.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
