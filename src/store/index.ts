import { create } from "zustand";
import { temporal } from "zundo";
import { produce, current } from "immer";
import {
  blankWorkspace,
  newId,
  journeySchema,
  workspaceSchema,
  type Workspace,
  type Journey,
  type FileData,
  type Layer,
  type Mode,
} from "../model/schema";
import { loadWorkspace, saveWorkspace } from "../persistence/db";
import { targetSignature, targetState } from "../model/analysis";
export type Selection = {
  kind:
    | "service"
    | "step"
    | "friction"
    | "feed"
    | "note"
    | "sketch"
    | "lane"
    | "phase"
    | "journey"
    | "group"
    | "cell";
  id: string;
  lane?: string;
  phase?: string;
};
interface State {
  workspace: Workspace;
  ready: boolean;
  saveState: "saved" | "saving" | "error";
  saveError: string;
  selection: Selection | null;
  selectedIds: string[];
  edit: (fn: (w: Workspace) => void) => void;
  editJourney: (fn: (j: Journey) => void) => void;
  select: (s: Selection | null) => void;
  setMode: (mode: Mode) => void;
  toggleLayer: (layer: Layer) => void;
  importData: (data: FileData, replace: boolean, restore?: boolean) => void;
  duplicateJourney: () => void;
  newJourney: (template: "blank" | "bank") => void;
}
export const useStore = create<State>()(
  temporal(
    (set, get) => ({
      workspace: blankWorkspace(),
      ready: false,
      saveState: "saved",
      saveError: "",
      selection: null,
      selectedIds: [],
      edit: (fn) =>
        set((s) => ({
          workspace: produce(s.workspace, (w) => {
            fn(w);
            for (const j of w.journeys) {
              const before = s.workspace.journeys.find((x) => x.id === j.id);
              if (
                before?.targetState === "reviewed" &&
                j.targetState === "reviewed" &&
                targetSignature(before) !== targetSignature(j)
              )
                j.targetState = "draft";
            }
          }),
        })),
      editJourney: (fn) => {
        const j = get().workspace.journeys.find(
          (j) => j.id === get().workspace.ui.selectedJourney,
        );
        if (!j || j.readOnly) return;
        get().edit((w) => {
          const j = w.journeys.find((j) => j.id === w.ui.selectedJourney);
          if (j) fn(j);
        });
      },
      select: (selection) =>
        set({ selection, selectedIds: selection ? [selection.id] : [] }),
      setMode: (mode) =>
        get().edit((w) => {
          w.ui.mode = mode;
        }),
      toggleLayer: (layer) =>
        get().edit((w) => {
          const a = w.ui.layers;
          w.ui.layers = a.includes(layer)
            ? a.filter((x) => x !== layer)
            : [...a, layer];
        }),
      importData: (data, replace, restore = false) => {
        get().edit((w) => {
          for (const key of ["owners", "capabilities"] as const)
            for (const item of data[key]) {
              const index = w[key].findIndex((x) => x.id === item.id);
              if (index >= 0) w[key][index] = item;
              else w[key].push(item);
            }
          for (const item of data.journeys) {
            const index = w.journeys.findIndex((x) => x.id === item.id);
            if (index >= 0 && replace) w.journeys[index] = item;
            else
              w.journeys.push(
                index >= 0
                  ? {
                      ...item,
                      id: newId(item.id),
                      title: `${item.title} (imported)`,
                    }
                  : item,
              );
          }
          if (restore) {
            if (data.settings) w.settings = data.settings;
            if (data.ui) w.ui = data.ui;
          } else if (data.journeys.length)
            w.ui.selectedJourney = w.journeys.at(-1)!.id;
        });
        get().select(null);
      },
      duplicateJourney: () => {
        get().edit((w) => {
          const source = w.journeys.find((j) => j.id === w.ui.selectedJourney);
          if (!source) return;
          const copy = structuredClone(current(source));
          copy.id = newId("journey");
          copy.title = `${copy.title} — copy`;
          copy.readOnly = false;
          w.journeys.push(copy);
          w.ui.selectedJourney = copy.id;
        });
        get().select(null);
      },
      newJourney: (template) => {
        const phases = [
          { id: "discover", name: "Discover" },
          { id: "consider", name: "Consider" },
          { id: "start", name: "Get started" },
          { id: "use", name: "Use & manage" },
        ];
        const lanes =
          template === "bank"
            ? [
                {
                  id: "customer",
                  name: "Customer",
                  kind: "customer",
                  group: null,
                },
                {
                  id: "web",
                  name: "Public website",
                  kind: "channel",
                  group: "self",
                  channel: {
                    type: "digital",
                    authenticated: false,
                    webviewHost: false,
                  },
                },
                {
                  id: "app",
                  name: "Mobile app",
                  kind: "channel",
                  group: "self",
                  channel: {
                    type: "digital",
                    authenticated: true,
                    webviewHost: true,
                  },
                },
                {
                  id: "netbank",
                  name: "Internet bank",
                  kind: "channel",
                  group: "self",
                  channel: {
                    type: "digital",
                    authenticated: true,
                    webviewHost: false,
                  },
                },
                {
                  id: "support",
                  name: "Customer service",
                  kind: "channel",
                  group: "assisted",
                  channel: { type: "assisted" },
                },
                {
                  id: "advisor",
                  name: "Advisor",
                  kind: "channel",
                  group: "assisted",
                  channel: { type: "assisted" },
                },
                {
                  id: "backstage",
                  name: "Enablers",
                  kind: "backstage",
                  group: "backstage",
                },
              ]
            : [
                {
                  id: "customer",
                  name: "Customer",
                  kind: "customer",
                  group: null,
                },
                {
                  id: "channel",
                  name: "Channel",
                  kind: "channel",
                  group: null,
                  channel: {
                    type: "digital",
                    authenticated: true,
                    webviewHost: false,
                  },
                },
              ];
        const journey = journeySchema.parse({
          id: newId("journey"),
          title: "Untitled journey",
          targetState: "not-started",
          phases,
          lanes,
          laneGroups:
            template === "bank"
              ? [
                  {
                    id: "self",
                    name: "Self-service",
                    lineAfter: {
                      kind: "boundary",
                      label: "Self-service boundary",
                    },
                  },
                  {
                    id: "assisted",
                    name: "Assisted",
                    lineAfter: {
                      kind: "visibility",
                      label: "Line of visibility",
                    },
                  },
                  { id: "backstage", name: "Backstage" },
                ]
              : [],
          experience: { now: [0, 0, 0, 0], target: [0, 0, 0, 0] },
        });
        get().edit((w) => {
          w.journeys.push(journey);
          w.ui.selectedJourney = journey.id;
          w.ui.mode = "now";
          delete w.ui.viewport;
        });
        get().select({ kind: "journey", id: journey.id });
      },
    }),
    {
      limit: 200,
      partialize: (s) => ({ workspace: s.workspace }),
      equality: (a, b) => a.workspace === b.workspace,
    },
  ),
);
export const currentJourney = (s: State) =>
  s.workspace.journeys.find((j) => j.id === s.workspace.ui.selectedJourney);
let saving = Promise.resolve();
export async function hydrate() {
  try {
    const w = await loadWorkspace();
    if (w) useStore.setState({ workspace: workspaceSchema.parse(w) });
    useStore.setState({ ready: true });
    useStore.temporal.getState().clear();
  } catch (error) {
    useStore.setState({
      ready: true,
      saveState: "error",
      saveError: String(error),
    });
  }
  useStore.subscribe((state, prev) => {
    if (state.workspace === prev.workspace) return;
    useStore.setState({ saveState: "saving" });
    const snapshot = structuredClone(state.workspace);
    saving = saving
      .catch(() => {})
      .then(() => saveWorkspace(snapshot))
      .then(() => {
        if (useStore.getState().workspace === state.workspace)
          useStore.setState({ saveState: "saved", saveError: "" });
      })
      .catch((e) =>
        useStore.setState({ saveState: "error", saveError: String(e) }),
      );
  });
  navigator.storage?.persist?.().catch(() => {});
}
export function setUI(fn: (ui: Workspace["ui"]) => void) {
  useStore.getState().edit((w) => fn(w.ui));
}
export function addCard(
  kind: Selection["kind"],
  lane: string,
  phase: string,
  position?: { x: number; y: number },
) {
  const store = useStore.getState(),
    j = currentJourney(store);
  if (
    !j ||
    j.readOnly ||
    (store.workspace.ui.mode === "target" && targetState(j) === "not-started")
  )
    return;
  const id = newId(kind);
  store.editJourney((j) => {
    switch (kind) {
      case "service": {
        const status = Object.fromEntries(
          j.lanes
            .filter((l) => l.channel?.type === "digital")
            .map((l) => [l.id, "unknown" as const]),
        );
        j.services.push({
          id,
          name: "New service",
          description: "",
          phase,
          isolated: false,
          flowAssessment: "unknown",
          placementLane: j.lanes.some(
            (l) => l.id === lane && l.channel?.type === "digital",
          )
            ? lane
            : j.lanes.find((l) => l.channel?.type === "digital")?.id,
          evidence: "unknown",
          linksTo: [],
          capabilities: [],
          status: { now: { ...status }, target: { ...status } },
        });
        break;
      }
      case "step":
        j.steps.push({
          id,
          lane,
          phase,
          text: "New journey step",
          in:
            targetState(j) === "not-started" ? "both" : store.workspace.ui.mode,
          transition: {
            now: j.steps.length
              ? j.steps.at(-1)?.lane === lane
                ? "continue"
                : "channel-switch"
              : "start",
            target: j.steps.length
              ? j.steps.at(-1)?.lane === lane
                ? "continue"
                : "channel-switch"
              : "start",
          },
          notes: {},
        });
        break;
      case "friction":
        j.frictions.push({
          id,
          lane,
          phase,
          title: "New friction",
          now: "",
          recommendation: "",
          othersPattern: "",
          assumption: true,
        });
        break;
      case "feed":
        if (j.steps.length)
          j.feeds.push({
            id,
            lane,
            phase,
            kind: "entry",
            text: "New feed",
            to: j.steps[0].id,
            explanation: "",
          });
        break;
      case "note":
        j.notes.push({ id, lane, phase, text: "New note", kind: "note" });
        break;
      case "sketch":
        j.sketches.push({
          id,
          kind: "note",
          text: "Your note",
          x: position?.x ?? 0,
          y: position?.y ?? 0,
          width: 220,
          height: 100,
        });
        break;
    }
  });
  store.select({ kind, id, lane, phase });
  return id;
}
export function createTargetFromNow() {
  useStore.getState().editJourney((j) => {
    if (targetState(j) !== "not-started") return;
    j.services.forEach((s) => {
      s.status.target = { ...s.status.now };
    });
    j.steps = j.steps.filter((s) => s.in !== "target");
    j.steps.forEach((s) => {
      s.in = "both";
      s.textTarget = s.text;
      s.transition.target = s.transition.now;
      s.notes.target = s.notes.now;
    });
    j.experience.target = [...j.experience.now];
    j.targetState = "draft";
  });
}
export function addJourneyStep(
  lane: string,
  phase: string,
  text: string,
  afterId?: string,
) {
  const s = useStore.getState(),
    j = currentJourney(s);
  if (
    !j ||
    j.readOnly ||
    !text.trim() ||
    !j.lanes.some((l) => l.id === lane) ||
    !j.phases.some((p) => p.id === phase) ||
    (s.workspace.ui.mode === "target" && targetState(j) === "not-started")
  )
    return;
  const id = newId("step");
  s.editJourney((j) => {
    const index = afterId
      ? j.steps.findIndex((x) => x.id === afterId) + 1
      : j.steps.length;
    const previous = j.steps[index - 1];
    const transition = !previous
      ? "start"
      : previous.lane === lane
        ? "continue"
        : j.lanes.find((l) => l.id === lane)?.channel?.type === "assisted"
          ? "to-support"
          : "channel-switch";
    j.steps.splice(index, 0, {
      id,
      lane,
      phase,
      text: text.trim(),
      in: targetState(j) === "not-started" ? "both" : s.workspace.ui.mode,
      transition: { now: transition, target: transition },
      notes: {},
      evidence: "unknown",
    });
  });
  s.select({ kind: "step", id, lane, phase });
  return id;
}
export function deleteSelection() {
  const s = useStore.getState();
  const sel = s.selection;
  if (!sel) return;
  s.editJourney((j) => {
    const ids = new Set(s.selectedIds.length ? s.selectedIds : [sel.id]);
    j.services = j.services.filter((x) => !ids.has(x.id));
    j.services.forEach(
      (x) => (x.linksTo = x.linksTo.filter((id) => !ids.has(id))),
    );
    j.steps = j.steps.filter((x) => !ids.has(x.id));
    j.feeds = j.feeds.filter((x) => !ids.has(x.id) && !ids.has(x.to));
    j.frictions = j.frictions.filter((x) => !ids.has(x.id));
    j.notes = j.notes.filter((x) => !ids.has(x.id));
    j.sketches = j.sketches.filter((x) => !ids.has(x.id));
  });
  s.select(null);
}
