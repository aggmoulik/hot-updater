// @ts-nocheck
import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["./src/index.ts"],
    format: ["esm", "cjs"],
    outDir: "dist",
    dts: true,
    failOnWarn: true,
  },
  {
    entry: ["functions/update-server/index.ts"],
    format: ["cjs"],
    dts: false,
    outDir: "dist/functions/update-server",
    external: ["node-appwrite", "jose"],
    failOnWarn: true,
    noExternal: ["@hot-updater/core", "@hot-updater/js"],
  },
]);
