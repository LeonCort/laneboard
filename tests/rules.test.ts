import { describe, it, expect } from "vitest";
import { investingExample, mortgageExample } from "../src/examples";
import { evaluateService, kpis } from "../src/rules";
const original = investingExample.journeys[0];
describe("friction rules", () => {
  it("matches all five required example severities", () =>
    expect(
      original.services.map((s) => [
        s.id,
        evaluateService(s, original, "now").severity,
      ]),
    ).toEqual([
      ["surplus-analysis", "medium"],
      ["inflation-tool", "high"],
      ["savings-guide", "high"],
      ["fund-account", "none"],
      ["fund-trading", "high"],
    ]));
  it("R1 flags a webview in a linked flow and requires capabilities", () => {
    const j = structuredClone(original),
      s = j.services[2];
    s.status.now.app = "webview";
    const r = evaluateService(s, j, "now");
    expect(r.notes.find((n) => n.rule === "R1")?.severity).toBe("high");
    expect(r.capabilities).toEqual(
      expect.arrayContaining(["webview", "context-sharing", "deep-linking"]),
    );
  });
  it("R2 fits an isolated webview", () => {
    const r = evaluateService(original.services[3], original, "now");
    expect(r.notes.find((n) => n.rule === "R2")?.positive).toBe(true);
    expect(r.severity).toBe("none");
  });
  it("R3 is medium for an isolated single-channel service", () =>
    expect(
      evaluateService(original.services[0], original, "now").severity,
    ).toBe("medium"));
  it("R3 is high for a linked or non-isolated service", () =>
    expect(
      evaluateService(original.services[1], original, "now").severity,
    ).toBe("high"));
  it("R3b proposes a webview for an isolated task", () =>
    expect(
      evaluateService(original.services[0], original, "now").notes.find(
        (n) => n.rule === "R3b",
      )?.message,
    ).toContain("Can be offered"));
  it("R3b rejects webviews in a linked flow", () =>
    expect(
      evaluateService(original.services[1], original, "now").notes.find(
        (n) => n.rule === "R3b",
      )?.message,
    ).toContain("not an option"));
  it("R3 excludes channels marked na", () => {
    const j = structuredClone(original),
      s = j.services[0];
    s.status.now.app = "na";
    expect(
      evaluateService(s, j, "now").notes.some((n) => n.rule === "R3"),
    ).toBe(false);
  });
  it("R4 finds unavailable services in applicable authenticated channels", () => {
    const j = structuredClone(original),
      s = j.services[0];
    s.status.now.netbank = "planned";
    const r = evaluateService(s, j, "now");
    expect(r.notes.find((n) => n.rule === "R4")?.severity).toBe("medium");
  });
  it("R4 ignores all-na authenticated channels", () => {
    const j = structuredClone(original),
      s = j.services[0];
    s.status.now.app = "na";
    s.status.now.netbank = "na";
    expect(
      evaluateService(s, j, "now").notes.some((n) => n.rule === "R4"),
    ).toBe(false);
  });
  it("R5 adds context for any available non-isolated service", () =>
    expect(
      evaluateService(original.services[4], original, "now").capabilities,
    ).toContain("context-sharing"));
  it("a linksTo entry overrides isolated", () => {
    const j = structuredClone(original),
      s = j.services[0];
    s.linksTo = ["savings-guide"];
    s.status.now.app = "webview";
    expect(
      evaluateService(s, j, "now").notes.some((n) => n.rule === "R1"),
    ).toBe(true);
  });
  it("uses authenticated digital channels for R3, regardless of public availability", () => {
    const j = structuredClone(original),
      s = j.services[0];
    s.status.now.web = "native";
    expect(evaluateService(s, j, "now").severity).toBe("medium");
  });
  it("target drops restarts from two to zero and increases coverage", () => {
    expect(kpis(original, "now").restarts).toBe(2);
    expect(kpis(original, "target").restarts).toBe(0);
    expect(kpis(original, "target").coverage).toBeGreaterThan(
      kpis(original, "now").coverage,
    );
    expect(kpis(original, "target").servicesWithFriction).toBe(0);
  });
  it("mortgage fixture covers support, advisor and digital return", () => {
    const j = mortgageExample.journeys[0];
    expect(kpis(j, "now").restarts).toBe(1);
    expect(kpis(j, "target").restarts).toBe(0);
    expect(j.steps.map((s) => s.transition.now)).toContain("back-to-digital");
  });
});
