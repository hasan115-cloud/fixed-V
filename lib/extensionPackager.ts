import fs from "fs";
import path from "path";
import JSZip from "jszip";

export async function generateExtensionZip(serverUrl: string): Promise<Buffer> {
  const zip = new JSZip();

  const configContent = `// PhishGuard Extension Configuration
// Automatically configured for: ${serverUrl}
const PHISHGUARD_DEFAULT_CONFIG = {
    SERVER_URL: ${JSON.stringify(serverUrl)}
};

if (typeof self !== "undefined") {
    self.PHISHGUARD_DEFAULT_CONFIG = PHISHGUARD_DEFAULT_CONFIG;
}
if (typeof window !== "undefined") {
    window.PHISHGUARD_DEFAULT_CONFIG = PHISHGUARD_DEFAULT_CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
    module.exports = PHISHGUARD_DEFAULT_CONFIG;
}
`;

  zip.file("config.js", configContent);

  const filesToInclude = [
    "manifest.json",
    "background.js",
    "content.js",
    "gmail_content.js",
    "popup.html",
    "popup.js",
    "warning.html",
    "warning.js",
    "qr_scanner.js",
    "jsqr.min.js",
    "styles.css",
    "icon16.png",
    "icon48.png",
    "icon128.png",
    "icon.png"
  ];

  for (const fileName of filesToInclude) {
    // Check candidate paths: extension/fileName or fileName in root
    const candidates = [
      path.resolve(process.cwd(), "extension", fileName),
      path.resolve(process.cwd(), fileName)
    ];

    let found = false;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const content = fs.readFileSync(candidate);
        zip.file(fileName, content);
        found = true;
        break;
      }
    }

    if (!found && fileName.endsWith(".js")) {
      // Fallback empty script if somehow missing
      zip.file(fileName, `// Placeholder for ${fileName}\n`);
    }
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  return buffer;
}
