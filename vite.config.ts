import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri sets TAURI_DEV_HOST when developing against a device on the network.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // Keep Rust compiler errors visible in the terminal.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**", "**/crates/**"] },
  },
  build: {
    // Oldest system webviews we ship on: Safari 15 (macOS), WebView2 (Windows), WebKitGTK (Linux).
    target: ["es2021", "safari15", "chrome105"],
  },
});
