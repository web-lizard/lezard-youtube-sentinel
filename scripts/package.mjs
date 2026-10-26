import { zipSync, strToU8 } from "fflate";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const root = resolve("dist");
const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const output = resolve(`artifacts/lizard-sentinel-${packageJson.version}.zip`);
const files = {};
function visit(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) visit(path);
    else files[relative(root, path).replaceAll("\\", "/")] = new Uint8Array(readFileSync(path));
  }
}
visit(root);
mkdirSync(resolve("artifacts"), { recursive: true });
writeFileSync(output, zipSync(files, { level: 9 }));
console.log(`Created ${output} (${Object.keys(files).length} files, ${strToU8("ok").length > 0 ? "ready" : "error"})`);
