import { defineConfig } from "vite";
export default defineConfig({ logLevel: "error", build: { outDir: "dist-valibot", target: "es2022", rollupOptions: { input: "valibot.html" } } });
