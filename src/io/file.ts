// Open and save Laneboard files on disk. Each .laneboard.json file is one
// Laneboard (a whole workspace). Where the File System Access API exists
// (Chrome and Edge, also from file://), Save writes back to the same file.
// Elsewhere, Open reads a chosen file and Save downloads a new copy.
import { create } from "zustand";
import { useStore } from "../store";
import {
  blankWorkspace,
  workspaceSchema,
  type FileData,
  type Workspace,
} from "../model/schema";
import { parseImport, MAX_IMPORT_SIZE } from "./import";
import { download } from "./export";
import { loadFileLink, saveFileLink } from "../persistence/db";

interface Writable {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}
interface Handle {
  name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<Writable>;
  queryPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: "readwrite" }) => Promise<PermissionState>;
}
type PickerOptions = {
  suggestedName?: string;
  types: { description: string; accept: Record<string, string[]> }[];
  excludeAcceptAllOption?: boolean;
};
type FSWindow = Window & {
  showOpenFilePicker?: (o: PickerOptions) => Promise<Handle[]>;
  showSaveFilePicker?: (o: PickerOptions) => Promise<Handle>;
};
const fsWindow = () => window as FSWindow;
export const canSaveInPlace = () =>
  typeof window !== "undefined" &&
  !!fsWindow().showOpenFilePicker &&
  !!fsWindow().showSaveFilePicker;

const types = [
  {
    description: "Laneboard file",
    accept: { "application/json": [".laneboard.json", ".json"] },
  },
];
export const DEFAULT_NAME = "laneboard.laneboard.json";

export interface FileState {
  /** File name, or null when the workspace is not linked to a file. */
  name: string | null;
  /** Whether the workspace changed since it was opened or saved. */
  dirty: boolean;
  /** Whether Save can write back to the file without asking where. */
  inPlace: boolean;
}
export const useFile = create<FileState>(() => ({
  name: null,
  dirty: false,
  inPlace: false,
}));
let handle: Handle | null = null;

// Content that belongs to the Laneboard itself. UI state (selection, viewport),
// personal preferences and the backup timestamp change without making the file
// out of date. Immer keeps unchanged parts identical, so references suffice,
// and undoing back to the saved state counts as saved again.
const fileSettings = ["name", "accent", "logo"] as const;
type Saved = Pick<Workspace, "journeys" | "owners" | "capabilities"> & {
  settings: Pick<Workspace["settings"], (typeof fileSettings)[number]>;
};
let saved: Saved | null = null;
const snapshot = (w: Workspace): Saved => ({
  journeys: w.journeys,
  owners: w.owners,
  capabilities: w.capabilities,
  settings: {
    name: w.settings.name,
    accent: w.settings.accent,
    logo: w.settings.logo,
  },
});
const sameContent = (w: Workspace, s: Saved) =>
  w.journeys === s.journeys &&
  w.owners === s.owners &&
  w.capabilities === s.capabilities &&
  fileSettings.every((k) => w.settings[k] === s.settings[k]);

function persist() {
  const { name, dirty } = useFile.getState();
  void saveFileLink(
    name ? { name, dirty, handle: handle ?? undefined } : null,
  ).catch(() => {});
}
function setLinked(name: string | null, h: Handle | null) {
  handle = h;
  saved = snapshot(useStore.getState().workspace);
  useFile.setState({ name, dirty: false, inPlace: !!h });
  persist();
}

let watching = false;
/** Restores the link to the last file and starts tracking unsaved changes. */
export async function restoreFileLink() {
  try {
    const link = await loadFileLink();
    if (link) {
      handle = (link.handle as Handle | undefined) ?? null;
      useFile.setState({
        name: link.name,
        dirty: link.dirty,
        inPlace: !!handle && canSaveInPlace(),
      });
    }
  } catch {
    // Storage can be unavailable; the workspace still works without a link.
  }
  if (watching) return;
  watching = true;
  useStore.subscribe((state, prev) => {
    const { name, dirty } = useFile.getState();
    if (!name || state.workspace === prev.workspace) return;
    const next = saved
      ? !sameContent(state.workspace, saved)
      : dirty || !sameContent(state.workspace, snapshot(prev.workspace));
    if (next !== dirty) {
      useFile.setState({ dirty: next });
      persist();
    }
  });
}

function fileContent(): string {
  const w = useStore.getState().workspace;
  const data: FileData = {
    ...structuredClone(w),
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}
function markBackedUp() {
  const history = useStore.temporal.getState(),
    wasTracking = history.isTracking;
  history.pause();
  try {
    useStore.getState().edit((w) => {
      w.settings.lastExport = new Date().toISOString();
    });
  } finally {
    if (wasTracking) history.resume();
  }
}

/** Replaces the workspace with a parsed file and clears undo history. */
export function loadIntoWorkspace(data: FileData) {
  const current = useStore.getState().workspace;
  const workspace = workspaceSchema.parse({
    ...data,
    // Theme, language and the backup reminder belong to this browser; the
    // name, accent and logo belong to the Laneboard.
    settings: {
      ...current.settings,
      ...Object.fromEntries(
        fileSettings
          .filter((k) => data.settings?.[k] !== undefined)
          .map((k) => [k, data.settings![k]]),
      ),
    },
    ui: data.ui,
  });
  if (!workspace.journeys.some((j) => j.id === workspace.ui.selectedJourney))
    workspace.ui.selectedJourney = workspace.journeys[0]?.id ?? "";
  useStore.setState({ workspace, selection: null, selectedIds: [] });
  useStore.temporal.getState().clear();
  const j = workspace.journeys.find(
    (x) => x.id === workspace.ui.selectedJourney,
  );
  if (j) useStore.getState().select({ kind: "journey", id: j.id });
}

async function readFile(file: File) {
  if (file.size > MAX_IMPORT_SIZE)
    throw new Error("File exceeds the 5 MB limit.");
  return parseImport(await file.text());
}

/** Asks for a file with a plain file input, for browsers without pickers. */
export function pickWithInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.laneboard.json,application/json";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

/** Opens a chosen file as the current Laneboard. */
export async function openFile(
  fallbackPick: () => Promise<File | null> = pickWithInput,
): Promise<{ name: string; warnings: string[] } | null> {
  const picker = fsWindow().showOpenFilePicker;
  if (picker) {
    const [h] = await picker({ types });
    const { data, warnings } = await readFile(await h.getFile());
    loadIntoWorkspace(data);
    setLinked(h.name, h);
    return { name: h.name, warnings };
  }
  const file = await fallbackPick();
  if (!file) return null;
  const { data, warnings } = await readFile(file);
  loadIntoWorkspace(data);
  setLinked(file.name, null);
  return { name: file.name, warnings };
}

async function writable(h: Handle) {
  if (
    h.queryPermission &&
    (await h.queryPermission({ mode: "readwrite" })) !== "granted"
  ) {
    const state = await h.requestPermission?.({ mode: "readwrite" });
    if (state !== "granted") throw new Error("Permission to save was denied.");
  }
  return h.createWritable();
}
async function writeTo(h: Handle) {
  const out = await writable(h);
  await out.write(fileContent());
  await out.close();
}

/** Saves to the linked file, or asks where to save the first time. */
export async function saveFile(): Promise<string> {
  if (handle && canSaveInPlace()) {
    await writeTo(handle);
    markBackedUp();
    setLinked(handle.name, handle);
    return handle.name;
  }
  return saveFileAs();
}

/** Saves to a new file and links the workspace to it. */
export async function saveFileAs(): Promise<string> {
  const suggestedName = useFile.getState().name || DEFAULT_NAME;
  const picker = fsWindow().showSaveFilePicker;
  if (picker) {
    const h = await picker({ suggestedName, types });
    await writeTo(h);
    markBackedUp();
    setLinked(h.name, h);
    return h.name;
  }
  download(
    suggestedName,
    new Blob([fileContent()], { type: "application/json" }),
  );
  markBackedUp();
  setLinked(suggestedName, null);
  return suggestedName;
}

/** Starts an empty Laneboard that is not linked to a file. */
export function newLaneboard() {
  loadIntoWorkspace({ ...blankWorkspace(), ui: undefined });
  handle = null;
  saved = null;
  useFile.setState({ name: null, dirty: false, inPlace: false });
  persist();
}
