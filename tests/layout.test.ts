import { it, expect } from "vitest";
import { layout } from "../src/canvas/layout";
import { investingExample } from "../src/examples";
import { uiSchema } from "../src/model/schema";
it("lays out the performance target: 15 lanes, 12 phases and 300 cards", () => {
  const j = structuredClone(investingExample.journeys[0]);
  j.phases = [
    ...j.phases,
    ...j.phases.map((p) => ({ ...p, id: `more-${p.id}` })),
  ];
  j.lanes = [
    ...j.lanes,
    ...j.lanes.slice(0, 3).map((l) => ({ ...l, id: `more-${l.id}` })),
  ];
  j.cells = {};
  j.services = [];
  j.steps = [];
  j.frictions = [];
  j.feeds = [];
  j.notes = Array.from({ length: 300 }, (_, i) => ({
    id: `note-${i}`,
    lane: j.lanes[i % 15].id,
    phase: j.phases[i % 12].id,
    text: `Sample touchpoint ${i}: context follows the customer`,
    kind: "note" as const,
  }));
  j.experience = { now: Array(12).fill(0), target: Array(12).fill(1) };
  const start = performance.now(),
    graph = layout(j, uiSchema.parse({}), null);
  expect(graph.nodes.filter((n) => n.type === "card")).toHaveLength(300);
  expect(graph.nodes.filter((n) => n.type === "cell")).toHaveLength(180);
  expect(performance.now() - start).toBeLessThan(100);
});
it("routes across collapsed and hidden lanes without dangling edges", () => {
  const j = structuredClone(investingExample.journeys[0]);
  j.lanes.find((l) => l.id === "app")!.hidden = true;
  const graph = layout(j, uiSchema.parse({ collapsedGroups: ["entry"] }), null);
  const ids = new Set(graph.nodes.map((n) => n.id));
  expect(graph.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(
    true,
  );
});

it("keeps empty and fully hidden groups available without rendering their cells", () => {
  const j = structuredClone(investingExample.journeys[0]);
  j.laneGroups.push({ id: "research", name: "Research" });
  j.lanes
    .filter((l) => l.group === "assisted")
    .forEach((l) => {
      l.hidden = true;
    });
  const graph = layout(j, uiSchema.parse({ collapsedGroups: ["self"] }), null);
  expect(graph.rows.filter((r) => r.kind === "group").map((r) => r.id)).toEqual(
    j.laneGroups.map((g) => g.id),
  );
  expect(
    graph.rows.some(
      (r) =>
        r.kind === "lane" &&
        j.lanes.find((l) => l.id === r.id)?.group === "assisted",
    ),
  ).toBe(false);
  expect(
    graph.nodes.some(
      (n) => n.id.startsWith("cell-advisor-") || n.id.startsWith("cell-app-"),
    ),
  ).toBe(false);
});
