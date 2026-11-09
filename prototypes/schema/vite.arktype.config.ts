import { defineConfig } from "vite";
export default defineConfig({ logLevel: "error", build: { outDir: "dist-arktype", target: "es2022", rollupOptions: { input: "arktype.html" } } });
