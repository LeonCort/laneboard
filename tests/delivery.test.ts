import { beforeEach, expect, it } from "vitest";
import { investingExample } from "../src/examples";
import { evaluateService, kpis } from "../src/rules";
import {
  serviceDelivery,
  targetChanges,
  channelPlatform,
} from "../src/model/analysis";
import { parseImport } from "../src/io/import";
import { blankWorkspace } from "../src/model/schema";
import { useStore, currentJourney, createTargetFromNow } from "../src/store";
import { removeStructure } from "../src/store/actions";
const journey = () => currentJourney(useStore.getState())!;
beforeEach(() => {
  const file = structuredClone(investingExample),
    w = blankWorkspace();
  file.journeys[0].readOnly = false;
  useStore.setState({
    workspace: {
      ...w,
      ...file,
      settings: w.settings,
      ui: { ...w.ui, selectedJourney: file.journeys[0].id },
    },
    selection: null,
  });
  useStore.temporal.getState().clear();
});
const setup = () => {
  useStore.getState().editJourney((j) => {
    const service = j.services[0];
    service.status.now.app = "browser-link";
    service.delivery = { now: { app: { destination: "netbank" } }, target: {} };
  });
  return journey();
};
const handoff = () =>
  evaluateService(journey().services[0], journey(), "now").notes.filter(
    (n) => n.rule === "R6" || n.rule === "R7",
  );
it("distinguishes information-only referrals from browser links and keeps native coverage unchanged", () => {
  const before = kpis(journey(), "now");
  setup();
  expect(kpis(journey(), "now").native).toBe(before.native);
  expect(kpis(journey(), "now").coverage).toBe(before.coverage);
  expect(
    evaluateService(journey().services[0], journey(), "now").notes.find(
      (n) => n.rule === "R3",
    )?.message,
  ).toContain("opens a separate browser");
  useStore.getState().editJourney((j) => {
    j.services[0].status.now.app = "info";
  });
  expect(handoff()).toEqual([]);
  expect(
    evaluateService(journey().services[0], journey(), "now").notes.find(
      (n) => n.rule === "R3",
    )?.message,
  ).toContain("without a direct link");
});
it("requires an available web destination and never follows another referral recursively", () => {
  setup();
  useStore.getState().editJourney((j) => {
    delete j.services[0].delivery!.now.app.destination;
  });
  expect(handoff()[0]).toMatchObject({ rule: "R6", severity: "medium" });
  useStore.getState().editJourney((j) => {
    j.services[0].delivery!.now.app.destination = "web";
  });
  expect(handoff()[0]).toMatchObject({ rule: "R6", severity: "high" });
  useStore.getState().editJourney((j) => {
    j.services[0].status.now.web = "browser-link";
  });
  expect(
    handoff().find((n) =>
      n.message.startsWith("Browser handoff from Mobile app"),
    )?.message,
  ).toContain("not available at this destination");
});
it("flags a legacy system even if marked responsive, and a modern system when not responsive", () => {
  setup();
  for (const value of [
    { system: "legacy", responsive: "yes" },
    { system: "modern", responsive: "no" },
  ] as const) {
    useStore.getState().editJourney((j) => {
      j.services[0].delivery!.now.netbank = value;
    });
    expect(handoff()[0]).toMatchObject({ rule: "R7", severity: "high" });
    expect(handoff()[0].message).toContain("do not offer this link");
  }
});
it("does not assume newer technology is responsive and assesses the chosen destination only", () => {
  setup();
  useStore.getState().editJourney((j) => {
    j.services[0].delivery!.now.netbank = { system: "modern" };
  });
  expect(handoff()[0]).toMatchObject({ rule: "R7", severity: "medium" });
  useStore.getState().editJourney((j) => {
    j.services[0].delivery!.now.netbank = {
      system: "legacy",
      responsive: "no",
    };
    j.services[0].delivery!.now.web = { system: "modern", responsive: "yes" };
    j.services[0].delivery!.now.app.destination = "web";
    j.services[0].status.now.web = "native";
  });
  expect(handoff()[0]).toMatchObject({ rule: "R7", severity: "none" });
  expect(handoff()[0].message).toContain(
    "check sign-in, retained context and return",
  );
});
it("does not propose a webview from an assessed unsuitable web implementation", () => {
  useStore.getState().editJourney((j) => {
    j.services[0].delivery = {
      now: { netbank: { system: "legacy" } },
      target: {},
    };
  });
  expect(
    evaluateService(journey().services[0], journey(), "now").notes.find(
      (n) => n.rule === "R3b",
    )?.message,
  ).toContain("Improve the web experience first");
});
it("copies characteristics to Target, preserves Now and invalidates review on Target edits", () => {
  setup();
  useStore.getState().editJourney((j) => {
    j.targetState = "not-started";
    j.services[0].delivery!.now.netbank = {
      system: "legacy",
      responsive: "no",
    };
  });
  expect(
    serviceDelivery(journey(), journey().services[0], "target", "netbank")
      .system,
  ).toBe("legacy");
  createTargetFromNow();
  expect(
    targetChanges(journey()).filter((c) => c.id === journey().services[0].id),
  ).toEqual([]);
  useStore.getState().editJourney((j) => {
    j.targetState = "reviewed";
  });
  useStore.getState().editJourney((j) => {
    j.services[0].delivery!.target.netbank = {
      system: "modern",
      responsive: "yes",
    };
  });
  expect(journey().targetState).toBe("draft");
  expect(
    serviceDelivery(journey(), journey().services[0], "now", "netbank").system,
  ).toBe("legacy");
  expect(targetChanges(journey())).toContainEqual(
    expect.objectContaining({
      lane: "Internet bank",
      before: "Legacy system · Not responsive",
      after: "Modern system · Responsive",
    }),
  );
  useStore.temporal.getState().undo();
  expect(journey().targetState).toBe("reviewed");
});
it("round trips new properties, rejects missing/self destinations and removes lane references", () => {
  setup();
  const serialized = JSON.stringify(useStore.getState().workspace);
  expect(parseImport(serialized).data.journeys[0].services[0].delivery).toEqual(
    journey().services[0].delivery,
  );
  for (const destination of ["missing-lane", "app"]) {
    const file = JSON.parse(serialized);
    file.journeys[0].services[0].delivery.now.app.destination = destination;
    expect(() => parseImport(JSON.stringify(file))).toThrow(/destination/);
  }
  removeStructure({ kind: "lane", id: "netbank" });
  expect(
    serviceDelivery(journey(), journey().services[0], "now", "app").destination,
  ).toBe("");
  expect(
    parseImport(JSON.stringify(useStore.getState().workspace)).warnings,
  ).toEqual([]);
  expect(handoff()[0].severity).toBe("medium");
  useStore.temporal.getState().undo();
  expect(
    serviceDelivery(journey(), journey().services[0], "now", "app").destination,
  ).toBe("netbank");
});
it("supports an app without embedded webview capability through explicit channel platform", () => {
  const app = structuredClone(journey().lanes.find((l) => l.id === "app")!);
  if (app.channel?.type !== "digital") throw new Error("Expected digital app");
  app.channel.platform = "app";
  app.channel.webviewHost = false;
  expect(channelPlatform(app)).toBe("app");
});
