import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { context, build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "dist");
const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  format: "esm",
  logLevel: "info",
  platform: "browser",
  sourcemap: true,
  target: "chrome120"
};

async function copyStatic() {
  await mkdir(outdir, { recursive: true });
  await copyFile(resolve(root, "public", "manifest.json"), resolve(outdir, "manifest.json"));
  await copyFile(resolve(root, "src", "sidepanel", "index.html"), resolve(outdir, "sidepanel.html"));
  await copyFile(resolve(root, "src", "styles", "globals.css"), resolve(outdir, "sidepanel.css"));
  await writeFile(resolve(outdir, "content.css"), "");
}

async function run() {
  await copyStatic();
  const entryPoints = {
    background: resolve(root, "src", "background", "index.ts"),
    content: resolve(root, "src", "content", "index.ts"),
    sidepanel: resolve(root, "src", "sidepanel", "index.tsx")
  };

  if (watch) {
    const buildContext = await context({
      ...shared,
      entryPoints,
      outdir
    });
    await buildContext.watch();
    console.log("Linvo AI extension build watching...");
    return;
  }

  await build({
    ...shared,
    entryPoints,
    outdir
  });
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
