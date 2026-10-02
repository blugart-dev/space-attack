// Generate Sites deployment assets without modifying the source files.
// Run with: node scripts/prepare-site.mjs
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputDirectory = resolve(projectRoot, "dist");

if (dirname(outputDirectory) !== resolve(projectRoot)) {
  throw new Error("Deployment output must stay inside the project directory.");
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory);

for (const entry of ["index.html", "styles.css", "src"]) {
  cpSync(join(projectRoot, entry), join(outputDirectory, entry), {
    recursive: true,
  });
}
