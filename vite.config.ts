import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Tauri sets TAURI_DEV_HOST when developing against a device on the network.
const host = process.env.TAURI_DEV_HOST;

/**
 * The website's Content Security Policy: the page may load code only from
 * itself and Google's sign-in script, and talk only to Google's sign-in and
 * Drive APIs. (The desktop app has its own, stricter policy in tauri.conf.json.)
 */
const WEB_CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function websiteHead(): Plugin {
  return {
    name: "monogatari-website-head",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: WEB_CSP }, injectTo: "head-prepend" },
      { tag: "meta", attrs: { name: "referrer", content: "strict-origin-when-cross-origin" }, injectTo: "head" },
      {
        tag: "meta",
        attrs: {
          name: "description",
          content: "A private place to write the chapters of your life beside your own photos, saved to your own Google Drive.",
        },
        injectTo: "head",
      },
      { tag: "meta", attrs: { property: "og:title", content: "monogatari · tell your story" }, injectTo: "head" },
      {
        tag: "meta",
        attrs: {
          property: "og:description",
          content: "Write the chapters of your life beside your own photographs, placed by the day each was taken.",
        },
        injectTo: "head",
      },
      { tag: "link", attrs: { rel: "icon", href: "./icon.png" }, injectTo: "head" },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const web = mode === "web";
  return {
    plugins: [react(), ...(web ? [websiteHead()] : [])],
    // Relative paths, so the website works at any address (a domain root or a subfolder).
    base: web ? "./" : "/",
    // Keep Rust compiler errors visible in the terminal.
    clearScreen: false,
    server: {
      port: web ? 5173 : 1420,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
      watch: { ignored: ["**/src-tauri/**", "**/crates/**"] },
    },
    build: {
      outDir: web ? "dist-web" : "dist",
      // Oldest webviews we ship on: Safari 15 (macOS), WebView2 (Windows), WebKitGTK (Linux).
      target: ["es2021", "safari15", "chrome105"],
    },
  };
});
