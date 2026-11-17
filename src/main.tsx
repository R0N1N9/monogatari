import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { insideDesktopApp, PlatformProvider } from "./platform";
import { previewPlatform } from "./platform/preview";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const render = (node: ReactNode) => root.render(<StrictMode>{node}</StrictMode>);

if (insideDesktopApp) {
  // The desktop app: Tauri, the Rust engines, encrypted storage on disk.
  void import("./platform/desktop").then(({ desktopPlatform }) =>
    render(
      <PlatformProvider platform={desktopPlatform}>
        <App />
      </PlatformProvider>
    )
  );
} else if (import.meta.env.MODE === "web") {
  // The website: Google sign-in and Drive saving, or an example story.
  void import("./web/WebRoot").then(({ WebRoot }) => render(<WebRoot />));
} else {
  // `npm run dev` in a browser: the interface with example data.
  render(
    <PlatformProvider platform={previewPlatform}>
      <App />
    </PlatformProvider>
  );
}
