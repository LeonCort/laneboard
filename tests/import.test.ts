import { it, expect, describe } from "vitest";
import example from "../src/examples/investing.laneboard.json";
import { parseImport, MAX_IMPORT_SIZE } from "../src/io/import";
import { mortgageExample } from "../src/examples";
import { buildPrompt } from "../src/ai/prompt";
describe("safe import", () => {
  it("imports the delivered fixture with exact counts and no warnings", () => {
    const { data, warnings } = parseImport(JSON.stringify(example)),
      j = data.journeys[0];
    expect(warnings).toEqual([]);
    expect([
      j.phases.length,
      j.lanes.length,
      j.services.length,
      j.steps.length,
      j.frictions.length,
      j.feeds.length,
    ]).toEqual([6, 12, 5, 9, 6, 5]);
  });
  it("imports and roundtrips the mortgage fixture", () =>
    expect(parseImport(JSON.stringify(mortgageExample)).warnings).toEqual([]));
  it("names the JSON path for broken references", () => {
    const x = structuredClone(example);
    x.journeys[0].steps[0].lane = "missing-lane";
    expect(() => parseImport(JSON.stringify(x))).toThrow(
      "journeys[0].steps[0].lane",
    );
  });
  it("rejects duplicate ids", () => {
    const x = structuredClone(example);
    x.journeys[0].services[1].id = x.journeys[0].services[0].id;
    expect(() => parseImport(JSON.stringify(x))).toThrow(
      "services[1].id: Duplicate",
    );
  });
  it("rejects experience lengths", () => {
    const x = structuredClone(example);
    x.journeys[0].experience.now.pop();
    expect(() => parseImport(JSON.stringify(x))).toThrow(
      "experience.now: Expected 6",
    );
  });
  it("rejects cell lengths and invalid status keys", () => {
    const x = structuredClone(example);
    x.journeys[0].cells.customer.pop();
    expect(() => parseImport(JSON.stringify(x))).toThrow("cells.customer");
  });
  it("repairs fences, missing ids and arrays with warnings", () => {
    const x = structuredClone(example) as unknown as {
      journeys: Record<string, unknown>[];
    };
    delete x.journeys[0].id;
    delete x.journeys[0].feeds;
    const raw = "```json\n" + JSON.stringify(x) + "\n```";
    const r = parseImport(raw);
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("fences"),
        expect.stringContaining("Generated"),
        expect.stringContaining("empty list"),
      ]),
    );
  });
  it("defaults missing step mode, per-channel statuses and arrays", () => {
    const x = JSON.parse(JSON.stringify(example));
    delete x.journeys[0].steps[0].in;
    delete x.journeys[0].services[0].linksTo;
    delete x.journeys[0].services[0].status.now.app;
    const r = parseImport(JSON.stringify(x));
    expect(r.data.journeys[0].steps[0].in).toBe("both");
    expect(r.data.journeys[0].services[0].status.now.app).toBe("unknown");
    expect(r.warnings.length).toBe(3);
  });
  it("ignores unknown fields with warnings", () => {
    const x = { ...example, unknown: "never rendered" };
    const r = parseImport(JSON.stringify(x));
    expect(r.warnings).toContain("unknown: Ignored unknown field.");
    expect(r.data).not.toHaveProperty("unknown");
  });
  it("clears isolated when a link is supplied", () => {
    const x = structuredClone(example);
    x.journeys[0].services[0].linksTo = ["savings-guide"];
    const r = parseImport(JSON.stringify(x));
    expect(r.data.journeys[0].services[0].isolated).toBe(false);
  });
  it("rejects oversized input before parsing", () =>
    expect(() => parseImport(" ".repeat(MAX_IMPORT_SIZE + 1))).toThrow("5 MB"));
  it("migrates version 0 and refuses future versions", () => {
    expect(
      parseImport(JSON.stringify({ ...example, schemaVersion: 0 })).warnings[0],
    ).toContain("Migrated");
    expect(() =>
      parseImport(JSON.stringify({ ...example, schemaVersion: 2 })),
    ).toThrow("schemaVersion");
  });
  it("keeps imported HTML as text", () => {
    const x = structuredClone(example);
    x.journeys[0].title = "<img src=x onerror=alert(1)>";
    expect(parseImport(JSON.stringify(x)).data.journeys[0].title).toBe(
      x.journeys[0].title,
    );
  });
  it("prompt contains the description, schema and fixture", () => {
    const prompt = buildPrompt(
      "A new customer opens an account",
      "No personal data",
    );
    expect(prompt).toContain("A new customer opens an account");
    expect(prompt).toContain("SCHEMA");
    expect(prompt).toContain('"format"');
    expect(prompt).toContain("surplus-analysis");
  });
});
