import { it, expect, beforeEach } from "vitest";
import { useStore, currentJourney } from "../src/store";
import { addPhase, reorderPhase, removeStructure } from "../src/store/actions";
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
