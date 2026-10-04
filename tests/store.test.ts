import { it, expect, beforeEach } from "vitest";
import { useStore, currentJourney } from "../src/store";
import {
  addPhase,
  createLane,
  reorderPhase,
  removeStructure,
  setLaneHidden,
  updateLane,
} from "../src/store/actions";
import { blankWorkspace } from "../src/model/schema";
import { investingExample } from "../src/examples";
import { parseImport } from "../src/io/import";
beforeEach(() => {
  useStore.setState({
    workspace: {
      ...blankWorkspace(),
      ...structuredClone(investingExample),
      settings: blankWorkspace().settings,
      ui: { ...blankWorkspace().ui, selectedJourney: "sme-investing" },
    },
  });
  useStore.temporal.getState().clear();
});
it("undos and redos 110 independent edits exactly", () => {
  const original = structuredClone(useStore.getState().workspace);
  for (let i = 0; i < 110; i++)
    useStore.getState().editJourney((j) => {
      j.title = `Journey ${i}`;
    });
  expect(useStore.temporal.getState().pastStates.length).toBe(110);
  useStore.temporal.getState().undo(110);
  expect(useStore.getState().workspace).toEqual(original);
  useStore.temporal.getState().redo(110);
  expect(currentJourney(useStore.getState())!.title).toBe("Journey 109");
});
it("keeps cells and curves aligned when adding and reordering phases", () => {
  addPhase();
  useStore.getState().editJourney((j) => reorderPhase(j, 0, 2));
  const r = parseImport(JSON.stringify(useStore.getState().workspace));
  expect(r.warnings).toEqual([]);
  expect(r.data.journeys[0].experience.now.length).toBe(7);
});
it("deletes a lane and its references atomically", () => {
  removeStructure({ kind: "lane", id: "app" });
  expect(() =>
    parseImport(JSON.stringify(useStore.getState().workspace)),
  ).not.toThrow();
});
it("deletes a phase and links to deleted services atomically", () => {
  removeStructure({ kind: "phase", id: "start" });
  expect(() =>
    parseImport(JSON.stringify(useStore.getState().workspace)),
  ).not.toThrow();
});
it("examples are immutable until duplicated", () => {
  useStore.getState().editJourney((j) => {
    j.readOnly = true;
  });
  useStore.getState().editJourney((j) => {
    j.title = "Changed";
  });
  expect(currentJourney(useStore.getState())!.title).not.toBe("Changed");
  useStore.getState().duplicateJourney();
  expect(currentJourney(useStore.getState())!.readOnly).toBe(false);
});

it("creates a lane in its chosen group with aligned cells and one undo", () => {
  useStore.getState().edit((w) => {
    w.ui.collapsedGroups = ["assisted"];
  });
  const before = structuredClone(useStore.getState().workspace);
  useStore.temporal.getState().clear();
  const id = createLane({
    name: " Video advice ",
    sub: "Remote meetings",
    group: "assisted",
    kind: "channel",
    channel: { type: "assisted" },
  })!;
  const j = currentJourney(useStore.getState())!;
  expect(j.lanes.find((l) => l.id === id)).toMatchObject({
    name: "Video advice",
    group: "assisted",
    channel: { type: "assisted" },
  });
  expect(j.lanes[j.lanes.findIndex((l) => l.id === id) - 1].group).toBe(
    "assisted",
  );
  expect(j.cells[id]).toEqual(j.phases.map(() => ""));
  expect(useStore.getState().workspace.ui.collapsedGroups).not.toContain(
    "assisted",
  );
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
  expect(useStore.temporal.getState().pastStates).toHaveLength(1);
  useStore.temporal.getState().undo();
  expect(useStore.getState().workspace).toEqual(before);
});

it("moves and hides a lane without losing its cards or service coverage", () => {
  const original = structuredClone(currentJourney(useStore.getState())!);
  updateLane("app", {
    name: "Business app",
    sub: "On the go",
    group: "assisted",
    hidden: true,
  });
  const changed = currentJourney(useStore.getState())!;
  expect(changed.lanes.find((l) => l.id === "app")).toMatchObject({
    group: "assisted",
    hidden: true,
  });
  expect(changed.cells.app).toEqual(original.cells.app);
  expect(changed.services).toEqual(original.services);
  expect(changed.steps).toEqual(original.steps);
  useStore.getState().edit((w) => {
    w.ui.collapsedGroups = ["assisted"];
  });
  setLaneHidden("app", false);
  expect(
    currentJourney(useStore.getState())!.lanes.find((l) => l.id === "app")!
      .hidden,
  ).toBe(false);
  expect(useStore.getState().workspace.ui.collapsedGroups).not.toContain(
    "assisted",
  );
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
});

it("rejects invalid groups and read-only lane edits without changing selection or history", () => {
  const original = structuredClone(useStore.getState().workspace);
  createLane({
    name: "Wrong group",
    group: "missing-group",
    kind: "backstage",
  });
  updateLane("app", { name: "App", sub: "", group: "missing-group" });
  expect(useStore.getState().workspace).toEqual(original);
  useStore.getState().editJourney((j) => {
    j.readOnly = true;
  });
  const readOnly = structuredClone(useStore.getState().workspace),
    selection = useStore.getState().selection;
  useStore.temporal.getState().clear();
  createLane({ name: "New", group: null, kind: "customer" });
  updateLane("app", { name: "Changed", sub: "", group: null });
  setLaneHidden("app", true);
  expect(useStore.getState().workspace).toEqual(readOnly);
  expect(useStore.getState().selection).toEqual(selection);
  expect(useStore.temporal.getState().pastStates).toHaveLength(0);
});
