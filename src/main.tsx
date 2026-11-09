import React from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "@fontsource/geist/latin-400.css";
import "@fontsource/geist/latin-500.css";
import "@fontsource/geist/latin-600.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/caveat/latin-400.css";
import "./styles/laneboard.css";
import Editor from "./Editor";
import { exportJSON } from "./io/export";
import { hydrate, useStore } from "./store";
import { restoreFileLink } from "./io/file";
function App() {
  const ready = useStore((s) => s.ready);
  return ready ? (
    <Editor />
  ) : (
    <div className="lb-loading" role="status">
      Opening your local workspace…
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="lb-recovery">
        <h1>Laneboard could not display this workspace.</h1>
        <p>
          Export the current workspace before reloading. Reload restores the
          last successfully saved version; recent unsaved edits may be missing.
        </p>
        <button
          className="lb-btn lb-btn--primary"
          onClick={() => exportJSON(true)}
        >
          Export recovery copy
        </button>
        <details>
          <summary>Error details</summary>
          <pre>{this.state.error}</pre>
        </details>
        <button className="lb-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
void hydrate().then(restoreFileLink);
// The same single HTML file runs from a web host and from disk (file://). Only a
// web origin can install the offline worker and the app manifest.
if (import.meta.env.PROD && /^https?:$/.test(location.protocol)) {
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "manifest.webmanifest";
  document.head.append(manifest);
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () => {
      void navigator.serviceWorker.register("sw.js").catch(() => {});
    });
}
