// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/jup-tokens": {
        target: "https://tokens.jup.ag",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/jup-tokens/, ""),
      },
      "/jup-quote": {
        target: "https://quote-api.jup.ag",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/jup-quote/, ""),
      },
      "/jup-lite": {
        target: "https://lite-api.jup.ag",
        changeOrigin: true,
        rewrite: path => path.replace(/^\/jup-lite/, ""),
      },
    },
  },
});
