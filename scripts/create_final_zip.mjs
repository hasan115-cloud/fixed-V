import fs from "fs";
import path from "path";
import JSZip from "jszip";

const rootDir = process.cwd();
const outputFile = path.join(rootDir, "phishguard-enterprise-fixed.zip");

console.log("Packaging PhishGuard Enterprise project ZIP...");

const zip = new JSZip();

const excludeList = new Set([
  "node_modules",
  ".next",
  ".git",
  ".aistudio",
  "phishguard-enterprise-fixed.zip"
]);

function addDirectory(currentPath, zipFolder) {
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

const buffer = await zip.generateAsync({
  type: "nodebuffer",
  compression: "DEFLATE",
  compressionOptions: { level: 9 }
});

fs.writeFileSync(outputFile, buffer);
console.log(`✓ Generated ${outputFile} (${(buffer.length / 1024).toFixed(1)} KB)`);
