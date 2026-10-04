import { serviceStatus, flowAssessment, targetState } from "../model/analysis";
import type { Journey, Mode, Service } from "../model/schema";
export type Severity = "none" | "medium" | "high";
export interface RuleNote {
  rule: string;
  severity: Severity;
  message: string;
  positive?: boolean;
}
export function evaluateService(
  service: Service,
  journey: Journey,
  mode: Mode,
) {
  const notes: RuleNote[] = [],
    capabilities = new Set(service.capabilities),
    digital = journey.lanes.filter((l) => l.channel?.type === "digital");
  const auth = digital.filter(
    (l) => l.channel?.type === "digital" && l.channel.authenticated,
  );
  const applicable = auth.filter(
    (l) =>
      !["na", "unknown"].includes(serviceStatus(journey, service, mode, l.id)),
  );
  const available = (s: string) => s === "native" || s === "webview";
  const present = applicable.filter((l) =>
    available(serviceStatus(journey, service, mode, l.id)),
  );
  const isolated = flowAssessment(service) === "isolated";
  const linked =
    service.linksTo
      .map((id) => journey.services.find((s) => s.id === id)?.name || id)
      .join(", ") || "the next task";
  for (const l of digital)
    if (serviceStatus(journey, service, mode, l.id) === "webview") {
      capabilities.add("webview");
      if (flowAssessment(service) === "connected") {
        notes.push({
          rule: "R1",
          severity: "high",
          message: `Webview in ${l.name}, but the flow links on to ${linked}. The webview cannot follow the link, so the channel’s version is a compromise.`,
        });
        capabilities.add("context-sharing");
        capabilities.add("deep-linking");
      } else if (isolated)
        notes.push({
          rule: "R2",
          severity: "none",
          positive: true,
          message: `Webview in ${l.name} fits: the task is isolated.`,
        });
    }
  if (present.length === 1 && applicable.length > 1) {
    for (const other of applicable.filter((l) => l.id !== present[0].id)) {
      const s = serviceStatus(journey, service, mode, other.id),
        effect =
          s === "info"
            ? "is referred on"
            : s === "planned"
              ? "waits"
              : "hits a dead end";
      notes.push({
        rule: "R3",
        severity: flowAssessment(service) === "connected" ? "high" : "medium",
        message: `Only in ${present[0].name}. A customer in ${other.name} ${effect} and must switch channel.`,
      });
      if (other.channel?.type === "digital" && other.channel.webviewHost)
        notes.push({
          rule: "R3b",
          severity: "none",
          message: isolated
            ? `Can be offered in ${other.name} as a webview: the task is isolated.`
            : flowAssessment(service) === "unknown"
              ? `Assess the flow connection before deciding whether a webview can support this task in ${other.name}.`
              : `Webview is not an option in ${other.name}, because the flow links on to ${linked}.`,
        });
    }
    capabilities.add("session-handover");
    capabilities.add("deep-linking");
  }
  if (present.length === 0 && applicable.length)
    notes.push({
      rule: "R4",
      severity: "medium",
      message: "Not yet available in any logged-in channel.",
    });
  if (
    flowAssessment(service) === "connected" &&
    digital.some((l) =>
      available(serviceStatus(journey, service, mode, l.id) ?? "na"),
    )
  )
    capabilities.add("context-sharing");
  const severity: Severity = notes.some((n) => n.severity === "high")
    ? "high"
    : notes.some((n) => n.severity === "medium")
      ? "medium"
      : "none";
  return { severity, notes, capabilities: [...capabilities] };
}
export function visibleSteps(journey: Journey, mode: Mode) {
  if (mode === "target" && targetState(journey) === "not-started") mode = "now";
  return journey.steps.filter((s) => s.in === "both" || s.in === mode);
}
export function kpis(journey: Journey, mode: Mode) {
  if (mode === "target" && targetState(journey) === "not-started") mode = "now";
  const steps = visibleSteps(journey, mode),
    digital = journey.lanes.filter((l) => l.channel?.type === "digital");
  let native = 0,
    applicable = 0,
    unknown = 0,
    excluded = 0;
  journey.services.forEach((s) =>
    digital.forEach((l) => {
      const v = serviceStatus(journey, s, mode, l.id);
      if (v === "unknown") unknown++;
      else if (v === "na") excluded++;
      else applicable++;
      if (v === "native") native++;
    }),
  );
  return {
    restarts: steps.filter((s, i) => i > 0 && s.transition[mode] === "restart")
      .length,
    frictions: journey.frictions.length,
    coverage: applicable ? Math.round((native / applicable) * 100) : 0,
    native,
    applicable,
    unknown,
    excluded,
    servicesWithFriction: journey.services.filter(
      (s) => evaluateService(s, journey, mode).severity !== "none",
    ).length,
    channels: new Set(
      steps
        .filter(
          (s) => journey.lanes.find((l) => l.id === s.lane)?.kind === "channel",
        )
        .map((s) => s.lane),
    ).size,
  };
}
