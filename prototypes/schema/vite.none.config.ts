import { defineConfig } from "vite";
export default defineConfig({ logLevel: "error", build: { outDir: "dist-none", target: "es2022", rollupOptions: { input: "none.html" } } });
