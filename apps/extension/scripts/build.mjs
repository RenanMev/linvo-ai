import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = resolve(root, "dist");
const configFile = resolve(root, "vite.config.ts");
const watch = process.argv.includes("--watch");

async function copyStatic() {
  await mkdir(outdir, { recursive: true });
  await copyFile(resolve(root, "public", "manifest.json"), resolve(outdir, "manifest.json"));
  await copyFile(resolve(root, "sidepanel.html"), resolve(outdir, "sidepanel.html"));
}

function assetFileNames(assetInfo) {
  return assetInfo.names?.some((name) => name.endsWith(".css")) || assetInfo.name?.endsWith(".css")
    ? "linvo-ui.css"
    : "assets/[name]-[hash][extname]";
}

async function buildEntry({ entry, fileName, format, name }) {
  return build({
    configFile,
    build: {
      cssCodeSplit: false,
      emptyOutDir: false,
      lib: {
        entry,
        fileName: () => fileName,
        formats: [format],
        name
      },
      outDir: outdir,
      rollupOptions: {
        output: {
          assetFileNames,
          entryFileNames: fileName
        }
      },
      watch: watch ? {} : null
    }
  });
}

async function run() {
  await copyStatic();

  await buildEntry({
    entry: resolve(root, "src", "sidepanel", "index.tsx"),
    fileName: "sidepanel.js",
    format: "es",
    name: "LinvoAiSidepanel"
  });
  await buildEntry({
    entry: resolve(root, "src", "content", "index.ts"),
    fileName: "content.js",
    format: "iife",
    name: "LinvoAiContent"
  });
  await buildEntry({
    entry: resolve(root, "src", "background", "index.ts"),
    fileName: "background.js",
    format: "es",
    name: "LinvoAiBackground"
  });
  await copyStatic();

  if (watch) {
    console.log("Linvo AI extension build watching...");
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
