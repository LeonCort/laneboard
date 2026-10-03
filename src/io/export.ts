import { toPng, toSvg } from "html-to-image";
import regular from "@fontsource/geist/files/geist-latin-400-normal.woff2?inline";
import mono from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?inline";
import hand from "@fontsource/caveat/files/caveat-latin-400-normal.woff2?inline";
import { useStore, currentJourney } from "../store";
import { evaluateService } from "../rules";
import type { FileData, Journey } from "../model/schema";
const fontEmbedCSS = `@font-face{font-family:Geist;src:url('${regular}') format('woff2');font-weight:100 900}@font-face{font-family:'Geist Mono';src:url('${mono}') format('woff2')}@font-face{font-family:Caveat;src:url('${hand}') format('woff2')}`;
export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportJSON(whole = false) {
  const s = useStore.getState();
  const data: FileData = {
    ...structuredClone(s.workspace),
    exportedAt: new Date().toISOString(),
    journeys: whole
      ? s.workspace.journeys
      : [currentJourney(s)!].filter(Boolean),
  };
  download(
    whole
      ? "workspace.laneboard.json"
      : `${data.journeys[0]?.id || "journey"}.laneboard.json`,
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  if (whole)
    s.edit((w) => {
      w.settings.lastExport = new Date().toISOString();
    });
}
const csvCell = (s: unknown) => {
  let value = String(s ?? "");
  if (/^[=+@\-\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replaceAll('"', '""')}"`;
};
export function csvContent(rows: unknown[][]) {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export function exportCSV(
  kind: "services" | "frictions",
  j: Journey,
  mode: "now" | "target",
) {
  const digital = j.lanes.filter((l) => l.channel?.type === "digital");
  const rows =
    kind === "services"
      ? [
          [
            "Name",
            "Description",
            "Isolated",
            "Links to",
            ...digital.map((l) => l.name),
            "Severity",
            "Rules",
            "Capabilities",
          ],
          ...j.services.map((s) => {
            const r = evaluateService(s, j, mode);
            return [
              s.name,
              s.description,
              s.isolated,
              s.linksTo.join("; "),
              ...digital.map((l) => s.status[mode][l.id] ?? "na"),
              r.severity,
              r.notes.map((n) => `${n.rule}: ${n.message}`).join("; "),
              r.capabilities.join("; "),
            ];
          }),
        ]
      : [
          [
            "ID",
            "Title",
            "Phase",
            "Lane",
            "State",
            "Others pattern",
            "Owner",
            "Assumption",
          ],
          ...j.frictions.map((f) => [
            f.id,
            f.title,
            f.phase,
            f.lane,
            mode === "now" ? f.now : f.recommendation,
            f.othersPattern,
            f.owner,
            f.assumption,
          ]),
        ];
  download(
    `${j.id}-${kind}-${mode}.csv`,
    new Blob([csvContent(rows)], { type: "text/csv;charset=utf-8" }),
  );
}
export async function exportImage(type: "png" | "svg", scale: number) {
  await document.fonts.ready;
  const target = document.querySelector<HTMLElement>(".react-flow");
  if (!target) throw new Error("Open a journey first.");
  const options = {
    pixelRatio: scale,
    fontEmbedCSS,
    backgroundColor: getComputedStyle(document.documentElement)
      .getPropertyValue("--bg-canvas")
      .trim(),
    filter: (n: HTMLElement) =>
      !n.classList?.contains("react-flow__panel") &&
      !n.classList?.contains("react-flow__minimap") &&
      !n.classList?.contains("lb-canvas-ui") &&
      !n.classList?.contains("lb-island"),
  };
  let url: string;
  if (type === "png") url = await toPng(target, options);
  else {
    const source = await toSvg(target, options);
    const svg = new DOMParser().parseFromString(
      decodeURIComponent(source.slice(source.indexOf(",") + 1)),
      "image/svg+xml",
    ).documentElement;
    svg.setAttribute("width", String(target.clientWidth * scale));
    svg.setAttribute("height", String(target.clientHeight * scale));
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }
  const a = document.createElement("a");
  a.download = `laneboard-${useStore.getState().workspace.ui.mode}.${type}`;
  a.href = url;
  a.click();
}
export async function saveToDisk() {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (o: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (x: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;
  if (!picker) {
    exportJSON(true);
    return;
  }
  const handle = await picker({
    suggestedName: "workspace.laneboard.json",
    types: [
      {
        description: "Laneboard JSON",
        accept: { "application/json": [".json"] },
      },
    ],
  });
  const file = await handle.createWritable();
  await file.write(
    JSON.stringify(
      {
        ...useStore.getState().workspace,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  await file.close();
  useStore.getState().edit((w) => {
    w.settings.lastExport = new Date().toISOString();
  });
}
