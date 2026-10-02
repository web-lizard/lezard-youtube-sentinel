import { build, context } from "esbuild";
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = resolve(".");
const outdir = resolve(root, "dist");
const watching = process.argv.includes("--watch");
if (basename(outdir) !== "dist") throw new Error(`Refusing to clean ${outdir}`);

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
if (packageJson.version !== manifest.version) throw new Error("Version mismatch");

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

const staticFiles = ["manifest.json", "popup.html", "options.html"];
for (const file of staticFiles) copyFileSync(resolve(root, file), resolve(outdir, file));
cpSync(resolve(root, "icons"), resolve(outdir, "icons"), { recursive: true });

const entries = ["background", "content", "popup", "options"];
const configs = entries.map((name) => ({
  entryPoints: [resolve(root, `src/${name}/${name}.ts`)],
  bundle: true,
  outfile: resolve(outdir, `${name}.js`),
  format: "iife",
  platform: "browser",
  target: "firefox121",
  sourcemap: true,
  minify: false,
  logLevel: "info",
}));

if (watching) {
  const contexts = await Promise.all(configs.map((config) => context(config)));
  await Promise.all(contexts.map((item) => item.watch()));
  console.log(`Watching ${entries.length} entry points. Load ${outdir} in Firefox.`);
} else {
  await Promise.all(configs.map((config) => build(config)));
  console.log(`Built Lizard Sentinel ${manifest.version} to ${outdir}`);
}
