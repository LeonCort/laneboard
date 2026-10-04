import {
  serviceStatus,
  serviceDelivery,
  channelPlatform,
  flowAssessment,
  targetState,
} from "../model/analysis";
import type { Journey, Mode, Service } from "../model/schema";
export type Severity = "none" | "medium" | "high";
export interface RuleNote {
  rule: string;
  severity: Severity;
  message: string;
  positive?: boolean;
  sourceLane?: string;
  destinationLane?: string;
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
          s === "browser-link"
            ? "opens a separate browser"
            : s === "info"
              ? "is told to visit the web without a direct link"
              : s === "planned"
                ? "waits"
                : "hits a dead end";
      notes.push({
        rule: "R3",
        severity: flowAssessment(service) === "connected" ? "high" : "medium",
        message: `Only in ${present[0].name}. A customer in ${other.name} ${effect} and must switch channel.`,
      });
      if (
        channelPlatform(other) === "app" &&
        other.channel?.type === "digital" &&
        other.channel.webviewHost &&
        s !== "browser-link"
      ) {
        const destination = serviceDelivery(
            journey,
            service,
            mode,
            present[0].id,
          ),
          unsuitable =
            channelPlatform(present[0]) === "web" &&
            (destination.system === "legacy" ||
              destination.responsive === "no");
        notes.push({
          rule: "R3b",
          severity: "none",
          message: unsuitable
            ? `Do not offer this web service in ${other.name}: ${present[0].name} uses a legacy or non-responsive page. Improve the web experience first.`
            : isolated
              ? `Can be offered in ${other.name} as a webview: the task is isolated.`
              : flowAssessment(service) === "unknown"
                ? `Assess the flow connection before deciding whether a webview can support this task in ${other.name}.`
                : `Webview is not an option in ${other.name}, because the flow links on to ${linked}.`,
        });
      }
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
  for (const source of digital) {
    if (serviceStatus(journey, service, mode, source.id) !== "browser-link")
      continue;
    capabilities.add("deep-linking");
    capabilities.add("session-handover");
    const destinationId = serviceDelivery(
        journey,
        service,
        mode,
        source.id,
      ).destination,
      destination = digital.find(
        (l) =>
          l.id === destinationId &&
          l.id !== source.id &&
          channelPlatform(l) === "web",
      ),
      prefix = `Browser handoff from ${source.name}`;
    if (!destination) {
      notes.push({
        rule: "R6",
        sourceLane: source.id,
        destinationLane: destinationId || undefined,
        severity: "medium",
        message: `${prefix}: choose the web destination before assessing this link.`,
      });
      continue;
    }
    if (!available(serviceStatus(journey, service, mode, destination.id))) {
      notes.push({
        rule: "R6",
        sourceLane: source.id,
        destinationLane: destination?.id,
        severity: "high",
        message: `${prefix} to ${destination.name}: the service is not available at this destination. Do not offer the link yet.`,
      });
      continue;
    }
    const delivery = serviceDelivery(journey, service, mode, destination.id);
    if (delivery.system === "legacy" || delivery.responsive === "no")
      notes.push({
        rule: "R7",
        sourceLane: source.id,
        destinationLane: destination.id,
        severity: "high",
        message: `${prefix} to ${destination.name}: do not offer this link. The destination ${delivery.system === "legacy" ? "uses a legacy system" : "is not responsive"}${delivery.system === "legacy" && delivery.responsive === "no" ? " and is not responsive" : ""}. Improve the web service before linking from the app.`,
      });
    else if (delivery.system === "unknown" || delivery.responsive === "unknown")
      notes.push({
        rule: "R7",
        sourceLane: source.id,
        destinationLane: destination.id,
        severity: "medium",
        message: `${prefix} to ${destination.name}: assess the system and responsiveness before offering this link. A newer system does not establish mobile suitability by itself.`,
      });
    else
      notes.push({
        rule: "R7",
        sourceLane: source.id,
        destinationLane: destination.id,
        severity: "none",
        message: `${prefix} to ${destination.name}: recorded as modern and responsive. Opens outside the app; check sign-in, retained context and return to the app in customer testing.`,
      });
  }
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
export function stepTargets(journey: Journey, source: string, mode: Mode) {
  if (mode === "target" && targetState(journey) === "not-started") mode = "now";
  const steps = visibleSteps(journey, mode),
    index = steps.findIndex((step) => step.id === source);
  if (index < 0) return [];
  const override = steps[index].next?.[mode];
  return override === undefined
    ? steps[index + 1]
      ? [steps[index + 1].id]
      : []
    : [...new Set(override)].filter(
        (id) => id !== source && steps.some((step) => step.id === id),
      );
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
    restarts: steps
      .flatMap((step) => stepTargets(journey, step.id, mode))
      .filter(
        (id) =>
          steps.find((step) => step.id === id)?.transition[mode] === "restart",
      ).length,
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
