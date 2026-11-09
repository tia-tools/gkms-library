import { defineConfig } from "vite";
export default defineConfig({ logLevel: "error", build: { outDir: "dist-zod", target: "es2022", rollupOptions: { input: "zod.html" } } });
