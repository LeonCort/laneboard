import { beforeEach, expect, it } from "vitest";
import fixture from "./fixtures/connections.laneboard.json";
import { parseImport } from "../src/io/import";
import { blankWorkspace } from "../src/model/schema";
import { canConnectCards } from "../src/model/connections";
import { currentJourney, useStore } from "../src/store";
import { setCardLink } from "../src/store/actions";
import { layout } from "../src/canvas/layout";

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

it("retargets a feed with one undo and cannot orphan its required journey step", () => {
  const feed = { kind: "feed", id: "signal", lane: "customer" } as const;
  expect(setCardLink(feed, { kind: "step", id: "open" })).toBe(true);
  expect(currentJourney(useStore.getState())!.feeds[0].to).toBe("open");
  expect(setCardLink(feed, { kind: "step", id: "open" }, false)).toBe(false);
  expect(setCardLink(feed, { kind: "step", id: "missing" })).toBe(false);
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
    selectable: false,
    focusable: false,
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
