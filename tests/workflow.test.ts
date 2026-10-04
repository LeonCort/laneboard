import { beforeEach, expect, it } from "vitest";
import {
  useStore,
  currentJourney,
  addCard,
  addJourneyStep,
  createTargetFromNow,
} from "../src/store";
import { blankWorkspace, workspaceSchema } from "../src/model/schema";
import { targetChanges, frictionReference } from "../src/model/analysis";
import { kpis, evaluateService } from "../src/rules";
import { parseImport } from "../src/io/import";
import { investingExample } from "../src/examples";
beforeEach(() => {
  useStore.setState({
    workspace: blankWorkspace(),
    selection: null,
    selectedIds: [],
  });
  useStore.getState().newJourney("bank");
  useStore.temporal.getState().clear();
});
const journey = () => currentJourney(useStore.getState())!;
it("does not invent availability or a completed Target for new services", () => {
  addCard("service", "app", "discover");
  const j = journey(),
    service = j.services[0];
  expect(j.targetState).toBe("not-started");
  expect(service.flowAssessment).toBe("unknown");
  expect(kpis(j, "now")).toMatchObject({
    native: 0,
    applicable: 0,
    unknown: 3,
    servicesWithFriction: 0,
  });
  expect(kpis(j, "target")).toEqual(kpis(j, "now"));
  expect(evaluateService(service, j, "now").notes).toEqual([]);
  expect(targetChanges(j)).toEqual([]);
});
it("creates Target from Now without inventing improvements", () => {
  addCard("service", "app", "discover");
  addJourneyStep("app", "discover", "Check invoices");
  useStore.getState().editJourney((j) => {
    j.services[0].status.now.app = "missing";
    j.experience.now[0] = -1;
    j.steps[0].transition.now = "restart";
  });
  createTargetFromNow();
  expect(journey().targetState).toBe("draft");
  expect(kpis(journey(), "target")).toEqual(kpis(journey(), "now"));
  expect(targetChanges(journey())).toEqual([]);
  useStore.getState().editJourney((j) => {
    j.services[0].status.target.app = "native";
  });
  createTargetFromNow();
  expect(journey().services[0].status.target.app).toBe("native");
});
it("separates unknown and excluded pairs and exposes denominator changes", () => {
  addCard("service", "app", "discover");
  createTargetFromNow();
  useStore.getState().editJourney((j) => {
    j.services[0].status.now.app = "missing";
    j.services[0].status.now.netbank = "native";
    j.services[0].status.target.app = "na";
    j.services[0].status.target.netbank = "native";
  });
  expect(kpis(journey(), "target")).toMatchObject({
    native: 1,
    applicable: 1,
    coverage: 100,
    unknown: 1,
    excluded: 1,
  });
  expect(targetChanges(journey())).toContainEqual(
    expect.objectContaining({
      before: "missing",
      after: "na",
      lane: "Mobile app",
    }),
  );
});
it("invalidates design review after a Target change but preserves it for Now status edits", () => {
  addCard("service", "app", "discover");
  createTargetFromNow();
  useStore.getState().editJourney((j) => {
    j.targetState = "reviewed";
  });
  useStore.getState().editJourney((j) => {
    j.services[0].status.now.app = "missing";
  });
  expect(journey().targetState).toBe("reviewed");
  useStore.getState().editJourney((j) => {
    j.services[0].status.target.app = "native";
  });
  expect(journey().targetState).toBe("draft");
  useStore.temporal.getState().undo();
  expect(journey().targetState).toBe("reviewed");
});
it("adds steps in order with sensible transitions and mode membership", () => {
  const first = addJourneyStep("app", "discover", "Check invoices")!;
  const next = addJourneyStep("app", "discover", "Check cash balance", first)!;
  addJourneyStep("support", "consider", "Ask for help", next);
  expect(journey().steps.map((s) => s.transition.now)).toEqual([
    "start",
    "continue",
    "to-support",
  ]);
  createTargetFromNow();
  useStore.getState().setMode("target");
  addJourneyStep("app", "consider", "Receive a decision", next);
  expect(journey().steps[2].in).toBe("target");
  expect(targetChanges(journey())).toContainEqual(
    expect.objectContaining({ after: "added", label: "Receive a decision" }),
  );
});
it("prevents creation in an uncreated Target and on read-only journeys", () => {
  useStore.getState().setMode("target");
  expect(addJourneyStep("app", "discover", "Unexpected")).toBeUndefined();
  expect(addCard("service", "app", "discover")).toBeUndefined();
  useStore.getState().setMode("now");
  useStore.getState().editJourney((j) => {
    j.readOnly = true;
  });
  expect(addJourneyStep("app", "discover", "Unexpected")).toBeUndefined();
  createTargetFromNow();
  expect(journey().targetState).toBe("not-started");
});
it("round trips hypothesis, evidence and Target state and validates new references", () => {
  addCard("service", "app", "discover");
  useStore.getState().editJourney((j) => {
    j.customer = "Freelancer";
    j.hypothesis = "Reusing invoice data will reduce repeated information";
    j.evidence = "assumed";
    j.evidenceNotes = "Needs customer interviews";
    j.testPlan = "Compare task completion in two prototypes";
  });
  const result = parseImport(JSON.stringify(useStore.getState().workspace));
  expect(result.warnings).toEqual([]);
  expect(result.data.journeys[0]).toEqual(journey());
  const bad = structuredClone(result.data);
  bad.journeys[0].validationOwner = "missing-owner";
  expect(() => parseImport(JSON.stringify(bad))).toThrow(/validationOwner/);
});
it("preserves an imported legacy Target and assigns human-readable friction references", () => {
  const legacy = parseImport(JSON.stringify(investingExample)).data.journeys[0];
  expect(legacy.services[0].status.target).toEqual(
    investingExample.journeys[0].services[0].status.target,
  );
  addCard("friction", "app", "discover");
  addCard("friction", "app", "discover");
  expect(
    journey().frictions.map((f) => frictionReference(journey(), f.id)),
  ).toEqual(["F1", "F2"]);
});

it("migrates existing saved workspaces without replacing their Target design", () => {
  const old = structuredClone(investingExample);
  const migrated = workspaceSchema.parse(old);
  expect(migrated.journeys[0].hypothesis).toBe("");
  expect(migrated.journeys[0].evidence).toBe("unknown");
  expect(migrated.journeys[0].services[0].status.target).toEqual(
    old.journeys[0].services[0].status.target,
  );
  expect(migrated.ui.mode).toBe("now");
});

it("preserves a service when its initial channel becomes assisted", () => {
  addCard("service", "app", "discover");
  useStore.getState().editJourney((j) => {
    j.lanes.find((l) => l.id === "app")!.channel = { type: "assisted" };
    delete j.services[0].status.now.app;
    delete j.services[0].status.target.app;
  });
  expect(journey().services[0].placementLane).toBe("web");
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
});
