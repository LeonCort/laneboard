import { it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Inspector } from "../src/views/Inspector";
import { useStore } from "../src/store";
import { blankWorkspace } from "../src/model/schema";
import { investingExample } from "../src/examples";
beforeEach(() => {
  cleanup();
  const w = blankWorkspace();
  useStore.setState({
    workspace: {
      ...w,
      ...structuredClone(investingExample),
      settings: w.settings,
      ui: { ...w.ui, selectedJourney: "sme-investing" },
    },
    selection: null,
  });
});
it("recomputes KPIs when now switches to target", () => {
  render(<Inspector confirm={() => {}} />);
  expect(screen.getByTestId("kpi-restarts")).toHaveTextContent("2");
  useStore.getState().setMode("target");
});
it("adding a link disables and clears the isolated checkbox", () => {
  useStore.getState().select({ kind: "service", id: "surplus-analysis" });
  render(<Inspector confirm={() => {}} />);
  fireEvent.click(screen.getByLabelText("Savings guide"));
  expect(screen.getByLabelText("Isolated task")).toBeDisabled();
  expect(screen.getByLabelText("Isolated task")).not.toBeChecked();
});
