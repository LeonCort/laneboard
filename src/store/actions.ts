import { currentJourney, useStore, type Selection } from ".";
import {
  newId,
  phaseSchema,
  laneSchema,
  groupSchema,
  type Journey,
} from "../model/schema";
export function addLane() {
  const s = useStore.getState();
  s.editJourney((j) => {
    const id = newId("lane");
    j.lanes.push(
      laneSchema.parse({
        id,
        name: "New lane",
        kind: "channel",
        group: j.laneGroups.find((g) => g.id === "self")?.id || null,
        channel: { type: "digital", authenticated: true, webviewHost: false },
      }),
    );
    j.cells[id] = j.phases.map(() => "");
    s.select({ kind: "lane", id });
  });
}
export function addPhase() {
  const s = useStore.getState();
  s.editJourney((j) => {
    const id = newId("phase");
    j.phases.push(phaseSchema.parse({ id, name: "New phase" }));
    Object.values(j.cells).forEach((a) => a.push(""));
    j.experience.now.push(0);
    j.experience.target.push(0);
    s.select({ kind: "phase", id });
  });
}
export function addGroup() {
  const s = useStore.getState();
  const id = newId("group");
  s.editJourney((j) =>
    j.laneGroups.push(groupSchema.parse({ id, name: "New group" })),
  );
  s.select({ kind: "group", id });
}
export function reorder<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || to >= list.length) return;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
}
export function reorderPhase(j: Journey, from: number, to: number) {
  reorder(j.phases, from, to);
  Object.values(j.cells).forEach((a) => reorder(a, from, to));
  reorder(j.experience.now, from, to);
  reorder(j.experience.target, from, to);
}
export function removeStructure(sel: Selection) {
  useStore.getState().editJourney((j) => {
    if (sel.kind === "phase" && j.phases.length > 1) {
      const i = j.phases.findIndex((p) => p.id === sel.id);
      j.phases.splice(i, 1);
      Object.values(j.cells).forEach((a) => a.splice(i, 1));
      j.experience.now.splice(i, 1);
      j.experience.target.splice(i, 1);
      j.services = j.services.filter((s) => s.phase !== sel.id);
      j.services.forEach(
        (s) =>
          (s.linksTo = s.linksTo.filter((id) =>
            j.services.some((x) => x.id === id),
          )),
      );
    }
    if (sel.kind === "lane" && j.lanes.length > 1) {
      j.lanes = j.lanes.filter((l) => l.id !== sel.id);
      delete j.cells[sel.id];
      j.services.forEach((s) => {
        delete s.status.now[sel.id];
        delete s.status.target[sel.id];
      });
      j.presentation.forEach(
        (p) => (p.focusLanes = p.focusLanes.filter((id) => id !== sel.id)),
      );
    }
    if (sel.kind === "group") {
      j.laneGroups = j.laneGroups.filter((g) => g.id !== sel.id);
      j.lanes.forEach((l) => {
        if (l.group === sel.id) l.group = null;
      });
    }
    j.steps = j.steps.filter(
      (s) =>
        j.lanes.some((l) => l.id === s.lane) &&
        j.phases.some((p) => p.id === s.phase),
    );
    j.frictions = j.frictions.filter(
      (s) =>
        j.lanes.some((l) => l.id === s.lane) &&
        j.phases.some((p) => p.id === s.phase),
    );
    j.feeds = j.feeds.filter(
      (s) =>
        j.lanes.some((l) => l.id === s.lane) &&
        j.phases.some((p) => p.id === s.phase) &&
        j.steps.some((x) => x.id === s.to),
    );
    j.notes = j.notes.filter(
      (s) =>
        j.lanes.some((l) => l.id === s.lane) &&
        j.phases.some((p) => p.id === s.phase),
    );
    j.sketches.forEach((s) => {
      if (
        s.anchor &&
        (!j.lanes.some((l) => l.id === s.anchor?.lane) ||
          !j.phases.some((p) => p.id === s.anchor?.phase))
      )
        delete s.anchor;
    });
  });
  useStore.getState().select(null);
}
let clipboard: { kind: string; item: unknown }[] = [];
export function copyCards() {
  const s = useStore.getState(),
    j = currentJourney(s);
  if (!j) return;
  const ids = new Set(
    s.selectedIds.length ? s.selectedIds : s.selection ? [s.selection.id] : [],
  );
  clipboard = [];
  for (const key of [
    "services",
    "steps",
    "frictions",
    "feeds",
    "notes",
    "sketches",
  ] as const)
    for (const item of j[key])
      if (ids.has(item.id))
        clipboard.push({ kind: key, item: structuredClone(item) });
  navigator.clipboard
    ?.writeText(JSON.stringify({ laneboardCards: clipboard }))
    .catch(() => {});
}
export async function pasteCards(useSystem = true) {
  if (useSystem)
    try {
      const raw = await navigator.clipboard.readText();
      if (new Blob([raw]).size <= 5 * 1024 * 1024) {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "laneboardCards" in parsed &&
          Array.isArray(parsed.laneboardCards)
        )
          clipboard = parsed.laneboardCards;
      }
    } catch {
      /* Use the in-memory clipboard when the browser disallows clipboard reads. */
    }
  // Validate copied entities through the same importer before committing them.
  const { parseImport } = await import("../io/import");
  const s = useStore.getState(),
    j = currentJourney(s);
  if (!j || j.readOnly || !clipboard.length) return;
  const clone = structuredClone(j),
    ids = new Map<string, string>();
  for (const row of clipboard) {
    if (typeof row.item === "object" && row.item !== null && "id" in row.item)
      ids.set(String(row.item.id), newId("copy"));
  }
  for (const row of clipboard) {
    if (
      ![
        "services",
        "steps",
        "frictions",
        "feeds",
        "notes",
        "sketches",
      ].includes(row.kind)
    )
      continue;
    const item = structuredClone(row.item) as Record<string, unknown>;
    item.id = ids.get(String(item.id));
    if (Array.isArray(item.linksTo))
      item.linksTo = item.linksTo.map((id) => ids.get(String(id)) || id);
    if (typeof item.to === "string") item.to = ids.get(item.to) || item.to;
    if (row.kind === "sketches") {
      item.x = Number(item.x) + 24;
      item.y = Number(item.y) + 24;
    }
    const list = clone[row.kind as "notes"] as unknown[];
    list.push(item);
  }
  const parsed = parseImport(
    JSON.stringify({ ...s.workspace, journeys: [clone] }),
  );
  s.editJourney((j) => Object.assign(j, parsed.data.journeys[0]));
  const id = [...ids.values()][0];
  if (id && s.selection) s.select({ ...s.selection, id });
}
export function duplicateCards() {
  copyCards();
  void pasteCards(false);
}
