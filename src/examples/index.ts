import investing from "./investing.laneboard.json";
import { parseImport } from "../io/import";
import type { FileData } from "../model/schema";
export const investingExample = parseImport(JSON.stringify(investing)).data;
const mortgage = structuredClone(investing) as Record<string, unknown>;
mortgage.journeys = [
  {
    id: "mortgage",
    title: "Mortgage from calculator to contract",
    segment: "Private",
    goal: "A clear path from exploring a home loan to signing",
    description:
      "Assumptions for a fictional Example Bank. A comparison site leads into a calculator, support and an advisor, then digital signing.",
    phases: [
      { id: "discover", name: "Explore options" },
      { id: "calculate", name: "Calculate & compare" },
      { id: "apply", name: "Apply" },
      { id: "advice", name: "Get advice" },
      { id: "sign", name: "Sign & move in" },
    ],
    laneGroups: [
      { id: "entry", name: "Entry points" },
      {
        id: "self",
        name: "Self-service",
        lineAfter: { kind: "boundary", label: "Self-service boundary" },
      },
      {
        id: "assisted",
        name: "Assisted",
        lineAfter: { kind: "visibility", label: "Line of visibility" },
      },
    ],
    lanes: [
      {
        id: "customer",
        group: null,
        kind: "customer",
        name: "Customer",
        assumption: true,
      },
      {
        id: "comparison",
        group: "entry",
        kind: "entry",
        name: "Comparison site",
        assumption: true,
      },
      {
        id: "web",
        group: "self",
        kind: "channel",
        name: "Public website",
        channel: { type: "digital", authenticated: false, webviewHost: false },
        assumption: true,
      },
      {
        id: "app",
        group: "self",
        kind: "channel",
        name: "Mobile app",
        channel: { type: "digital", authenticated: true, webviewHost: true },
        assumption: true,
      },
      {
        id: "netbank",
        group: "self",
        kind: "channel",
        name: "Internet bank",
        channel: { type: "digital", authenticated: true, webviewHost: false },
        assumption: true,
      },
      {
        id: "support",
        group: "assisted",
        kind: "channel",
        name: "Customer service",
        channel: { type: "assisted" },
        owner: "tech",
        assumption: true,
      },
      {
        id: "advisor",
        group: "assisted",
        kind: "channel",
        name: "Mortgage advisor",
        channel: { type: "assisted" },
        owner: "strategy",
        assumption: true,
      },
    ],
    cells: {
      customer: [
        "Find a home",
        "Understand affordability",
        "Apply for a loan",
        "Discuss the offer",
        "Sign the contract",
      ],
      comparison: ["Compare mortgage offers", "", "", "", ""],
      web: ["Information and rates", "Mortgage calculator", "", "", ""],
      app: ["", "", "Application status", "", "Digital signing"],
      netbank: ["", "", "Mortgage application", "", "Digital signing"],
      support: [
        "",
        "Questions about the calculator",
        "Help with documentation",
        "",
        "",
      ],
      advisor: ["", "", "", "Discuss suitability and terms", ""],
    },
    services: [
      {
        id: "calculator",
        name: "Mortgage calculator",
        phase: "calculate",
        isolated: true,
        linksTo: [],
        capabilities: [],
        status: {
          now: { web: "native", app: "missing", netbank: "native" },
          target: { web: "native", app: "native", netbank: "native" },
        },
      },
      {
        id: "application",
        name: "Mortgage application",
        phase: "apply",
        isolated: false,
        linksTo: ["signing"],
        capabilities: ["context-sharing"],
        status: {
          now: { web: "info", app: "info", netbank: "native" },
          target: { web: "info", app: "native", netbank: "native" },
        },
      },
      {
        id: "signing",
        name: "Digital signing",
        phase: "sign",
        isolated: true,
        linksTo: [],
        capabilities: [],
        status: {
          now: { web: "na", app: "native", netbank: "native" },
          target: { web: "na", app: "native", netbank: "native" },
        },
      },
    ],
    steps: [
      {
        id: "m1",
        lane: "web",
        phase: "calculate",
        in: "both",
        text: "Uses the mortgage calculator",
        transition: { now: "start", target: "start" },
      },
      {
        id: "m2",
        lane: "support",
        phase: "apply",
        in: "both",
        text: "Calls to clarify the documents",
        transition: { now: "to-support", target: "to-support" },
      },
      {
        id: "m3",
        lane: "netbank",
        phase: "apply",
        in: "both",
        text: "Restarts the application after the call",
        textTarget: "Continues the application with context kept",
        transition: { now: "restart", target: "back-to-digital" },
      },
      {
        id: "m4",
        lane: "advisor",
        phase: "advice",
        in: "both",
        text: "Discusses the offer with an advisor",
        transition: { now: "lead-to-advisor", target: "lead-to-advisor" },
      },
      {
        id: "m5",
        lane: "app",
        phase: "sign",
        in: "both",
        text: "Signs the mortgage digitally",
        transition: { now: "back-to-digital", target: "back-to-digital" },
      },
    ],
    frictions: [
      {
        id: "M1",
        lane: "support",
        phase: "apply",
        title: "Calculator context is lost",
        now: "The customer repeats the calculation over the phone.",
        recommendation:
          "Carry the calculation into support and the application.",
        othersPattern: "Shared calculation across channels (assumption).",
        owner: "tech",
        assumption: true,
      },
      {
        id: "M2",
        lane: "app",
        phase: "apply",
        title: "Application exists in one channel",
        now: "App users are referred to the internet bank.",
        recommendation:
          "Offer the same application in both logged-in channels.",
        owner: "strategy",
        assumption: true,
      },
      {
        id: "M3",
        lane: "advisor",
        phase: "advice",
        title: "Advisor starts without context",
        now: "The advisor asks for information already provided.",
        recommendation: "Route the lead with the application and calculation.",
        owner: "insight",
        assumption: true,
      },
    ],
    feeds: [
      {
        id: "mf1",
        kind: "entry",
        lane: "comparison",
        phase: "discover",
        to: "m1",
        text: "Comparison site leads to the calculator",
        explanation: "An assumed alternative entry point.",
      },
    ],
    experience: { now: [1, 0.5, -1, 0, 1], target: [1, 1, 1, 1.5, 2] },
    presentation: [],
  },
];
export const mortgageExample = parseImport(JSON.stringify(mortgage)).data;
export function exampleFile(kind: "investing" | "mortgage"): FileData {
  const data = structuredClone(
    kind === "investing" ? investingExample : mortgageExample,
  );
  data.journeys.forEach((j) => (j.readOnly = true));
  return data;
}
