import { beforeEach, expect, it } from "vitest";
import fixture from "./fixtures/connections.laneboard.json";
import { parseImport } from "../src/io/import";
import { blankWorkspace } from "../src/model/schema";
import { canConnectCards } from "../src/model/connections";
import {
  currentJourney,
  useStore,
  deleteSelection,
  createTargetFromNow,
} from "../src/store";
import { setCardLink, reconnectCardLink } from "../src/store/actions";
import { layout } from "../src/canvas/layout";
import { stepTargets, kpis } from "../src/rules";

beforeEach(() => {
  const file = parseImport(JSON.stringify(fixture)).data;
  const workspace = {
    ...blankWorkspace(),
    ...file,
    ui: { ...blankWorkspace().ui, selectedJourney: file.journeys[0].id },
  };
  useStore.setState({ workspace, selection: null, selectedIds: [] });
  useStore.temporal.getState().clear();
});
const source = { kind: "service", id: "options", lane: "app" } as const;
const target = { kind: "service", id: "account" } as const;

it("connects services atomically, updates flow assessment and restores it with undo", () => {
  const before = structuredClone(useStore.getState().workspace);
  expect(setCardLink(source, target)).toBe(true);
  expect(currentJourney(useStore.getState())!.services[0]).toMatchObject({
    linksTo: ["account"],
    isolated: false,
    flowAssessment: "connected",
  });
  expect(useStore.temporal.getState().pastStates).toHaveLength(1);
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
  expect(setCardLink(source, target)).toBe(false);
  expect(useStore.temporal.getState().pastStates).toHaveLength(1);
  useStore.temporal.getState().undo();
  expect(useStore.getState().workspace).toEqual(before);
  useStore.temporal.getState().redo();
  expect(setCardLink(source, target, false)).toBe(true);
  expect(currentJourney(useStore.getState())!.services[0].linksTo).toEqual([]);
});

it("rejects self-links, missing references and incompatible card types without consuming undo", () => {
  const before = structuredClone(useStore.getState().workspace);
  expect(setCardLink(source, { kind: "service", id: "options" })).toBe(false);
  expect(setCardLink(source, { kind: "service", id: "missing" })).toBe(false);
  expect(setCardLink(source, { kind: "step", id: "open" })).toBe(false);
  expect(
    setCardLink({ kind: "feed", id: "signal", lane: "customer" }, target),
  ).toBe(false);
  expect(setCardLink({ ...source, id: "missing" }, target)).toBe(false);
  expect(useStore.getState().workspace).toEqual(before);
  expect(useStore.temporal.getState().pastStates).toHaveLength(0);
});

it("retargets and disconnects feeds while keeping the feed and valid backups", () => {
  const feed = { kind: "feed", id: "signal", lane: "customer" } as const;
  expect(setCardLink(feed, { kind: "step", id: "open" })).toBe(true);
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("open");
  expect(setCardLink(feed, { kind: "step", id: "open" }, false)).toBe(true);
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("");
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
  expect(setCardLink(feed, { kind: "step", id: "missing" })).toBe(false);
  useStore.temporal.getState().undo();
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("open");
  useStore.temporal.getState().undo();
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("compare");
});

it("honours read-only journeys, locked source lanes and targets that have not started", () => {
  const original = structuredClone(currentJourney(useStore.getState())!);
  for (const change of [
    { ...original, readOnly: true },
    {
      ...original,
      lanes: original.lanes.map((lane) => ({
        ...lane,
        locked: lane.id === "app",
      })),
    },
  ]) {
    useStore.setState({
      workspace: { ...useStore.getState().workspace, journeys: [change] },
    });
    useStore.temporal.getState().clear();
    expect(setCardLink(source, target)).toBe(false);
    expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  }
  useStore.setState({
    workspace: {
      ...useStore.getState().workspace,
      journeys: [{ ...original, targetState: "not-started" }],
      ui: { ...useStore.getState().workspace.ui, mode: "target" },
    },
  });
  useStore.temporal.getState().clear();
  expect(setCardLink(source, target)).toBe(false);
  expect(useStore.temporal.getState().pastStates).toHaveLength(0);
});

it("only connects a feed to steps in the active map mode", () => {
  const journey = structuredClone(currentJourney(useStore.getState())!);
  journey.steps[1].in = "target";
  expect(
    canConnectCards(
      journey,
      { kind: "feed", id: "signal" },
      { kind: "step", id: "open" },
      "now",
    ),
  ).toBe(false);
  journey.targetState = "draft";
  expect(
    canConnectCards(
      journey,
      { kind: "feed", id: "signal" },
      { kind: "step", id: "open" },
      "target",
    ),
  ).toBe(true);
});

it("renders directional service links and leaves no dangling edges when targets are hidden", () => {
  setCardLink(source, target);
  const state = useStore.getState();
  let graph = layout(currentJourney(state)!, state.workspace.ui, null);
  const edge = graph.edges.find((edge) => edge.data?.transition === "service")!;
  expect(edge).toMatchObject({
    source: "service-options-app",
    target: "service-account-app",
    selectable: true,
    focusable: true,
  });
  expect(edge.markerEnd).toBeDefined();
  const hidden = structuredClone(currentJourney(state)!);
  hidden.lanes.find((lane) => lane.id === "app")!.hidden = true;
  graph = layout(hidden, state.workspace.ui, null);
  const ids = new Set(graph.nodes.map((node) => node.id));
  expect(
    graph.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target)),
  ).toBe(true);
  expect(
    graph.edges.filter((edge) => edge.data?.transition === "service"),
  ).toEqual([]);
});

it("connects service instances in their own channels and does not render duplicate links", () => {
  const state = useStore.getState(),
    journey = structuredClone(currentJourney(state)!);
  journey.lanes.push({ ...journey.lanes[1], id: "web", name: "Website" });
  for (const service of journey.services) service.status.now.web = "native";
  journey.services[0].linksTo = ["account", "account"];
  const graph = layout(journey, state.workspace.ui, null),
    links = graph.edges.filter((edge) => edge.data?.transition === "service");
  expect(links.map((edge) => [edge.source, edge.target])).toEqual([
    ["service-options-app", "service-account-app"],
    ["service-options-web", "service-account-web"],
  ]);
});

it("reconnects either service endpoint atomically without deleting cards or unrelated links", () => {
  const extra = structuredClone(
    currentJourney(useStore.getState())!.services[1],
  );
  useStore.getState().editJourney((j) =>
    j.services.push({
      ...extra,
      id: "budget",
      name: "Budget planner",
      linksTo: [],
    }),
  );
  setCardLink(source, target);
  useStore.temporal.getState().clear();
  const before = structuredClone(useStore.getState().workspace),
    original = { source, target };
  expect(
    reconnectCardLink(original, source, { kind: "service", id: "budget" }),
  ).toBe(true);
  expect(currentJourney(useStore.getState())!.services[0].linksTo).toEqual([
    "budget",
  ]);
  expect(currentJourney(useStore.getState())!.services).toHaveLength(3);
  expect(useStore.temporal.getState().pastStates).toHaveLength(1);
  useStore.temporal.getState().undo();
  expect(useStore.getState().workspace).toEqual(before);
  expect(
    reconnectCardLink(
      original,
      { kind: "service", id: "budget", lane: "app" },
      target,
    ),
  ).toBe(true);
  const j = currentJourney(useStore.getState())!;
  expect(j.services[0].linksTo).toEqual([]);
  expect(j.services[2].linksTo).toEqual(["account"]);
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
});

it("rejects stale, duplicate, locked and incompatible reconnections without undo entries", () => {
  setCardLink(source, target);
  useStore.temporal.getState().clear();
  const before = structuredClone(useStore.getState().workspace),
    original = { source, target };
  expect(reconnectCardLink(original, source, target)).toBe(false);
  expect(
    reconnectCardLink(original, source, { kind: "service", id: "options" }),
  ).toBe(false);
  expect(
    reconnectCardLink(original, source, { kind: "step", id: "open" }),
  ).toBe(false);
  expect(
    reconnectCardLink(
      { source, target: { kind: "service", id: "missing" } },
      source,
      target,
    ),
  ).toBe(false);
  expect(useStore.getState().workspace).toEqual(before);
  expect(useStore.temporal.getState().pastStates).toHaveLength(0);
  useStore.getState().editJourney((j) => {
    j.lanes[1].locked = true;
  });
  useStore.temporal.getState().clear();
  expect(
    reconnectCardLink(
      original,
      { kind: "service", id: "account", lane: "app" },
      { kind: "service", id: "options" },
    ),
  ).toBe(false);
  expect(useStore.temporal.getState().pastStates).toHaveLength(0);
});

it("deletes selected service and feed connections rather than their cards, then restores with undo", () => {
  setCardLink(source, target);
  useStore.getState().select({
    kind: "connection",
    id: "service-link",
    connection: { source, target },
  });
  deleteSelection();
  expect(currentJourney(useStore.getState())!.services).toHaveLength(2);
  expect(currentJourney(useStore.getState())!.services[0].linksTo).toEqual([]);
  useStore.temporal.getState().undo();
  expect(currentJourney(useStore.getState())!.services[0].linksTo).toEqual([
    "account",
  ]);
  const feed = { kind: "feed", id: "signal", lane: "customer" } as const;
  useStore.getState().select({
    kind: "connection",
    id: "feed-edge-signal",
    connection: { source: feed, target: { kind: "step", id: "compare" } },
  });
  deleteSelection();
  expect(currentJourney(useStore.getState())!.feeds).toHaveLength(1);
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("");
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
  useStore.temporal.getState().undo();
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("compare");
});

it("edits journey paths per mode and counts only connected restart transitions", () => {
  useStore.getState().editJourney((j) => {
    j.steps[1].transition.now = "restart";
    j.targetState = "draft";
  });
  const step = { kind: "step", id: "compare", lane: "app" } as const,
    next = { kind: "step", id: "open" } as const;
  expect(kpis(currentJourney(useStore.getState())!, "now").restarts).toBe(1);
  expect(setCardLink(step, next, false)).toBe(true);
  let j = currentJourney(useStore.getState())!;
  expect(stepTargets(j, "compare", "now")).toEqual([]);
  expect(stepTargets(j, "compare", "target")).toEqual(["open"]);
  expect(kpis(j, "now").restarts).toBe(0);
  expect(j.steps).toHaveLength(2);
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
  useStore.getState().editJourney((j) => {
    j.targetState = "not-started";
  });
  createTargetFromNow();
  j = currentJourney(useStore.getState())!;
  expect(stepTargets(j, "compare", "target")).toEqual([]);
  useStore.getState().setMode("target");
  expect(setCardLink(step, next)).toBe(true);
  expect(
    stepTargets(currentJourney(useStore.getState())!, "compare", "target"),
  ).toEqual(["open"]);
  expect(
    stepTargets(currentJourney(useStore.getState())!, "compare", "now"),
  ).toEqual([]);
});

it("reconnects journey paths without reordering steps and cleans deleted step references", () => {
  const extra = structuredClone(currentJourney(useStore.getState())!.steps[1]);
  useStore.getState().editJourney((j) =>
    j.steps.push({
      ...extra,
      id: "review",
      text: "Review account",
    }),
  );
  const from = { kind: "step", id: "compare", lane: "app" } as const,
    to = { kind: "step", id: "open" } as const;
  expect(
    reconnectCardLink({ source: from, target: to }, from, {
      kind: "step",
      id: "review",
    }),
  ).toBe(true);
  let j = currentJourney(useStore.getState())!;
  expect(stepTargets(j, "compare", "now")).toEqual(["review"]);
  expect(j.steps.map((step) => step.id)).toEqual(["compare", "open", "review"]);
  expect(
    layout(j, useStore.getState().workspace.ui, null).edges.some(
      (edge) => edge.id === "edge-compare-review",
    ),
  ).toBe(true);
  useStore.getState().select({ kind: "step", id: "review" });
  deleteSelection();
  j = currentJourney(useStore.getState())!;
  expect(j.steps[0].next!.now).toEqual([]);
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
});
