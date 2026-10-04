import React from "react";
import ReactDOM from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/caveat/400.css";
import "./styles/laneboard.css";
import Editor from "./Editor";
import { exportJSON } from "./io/export";
import { hydrate, useStore } from "./store";
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
void hydrate();
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
