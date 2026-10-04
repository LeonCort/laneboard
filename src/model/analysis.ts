import type { Journey, Service, Status } from "./schema";

export const targetState = (j: Journey) => j.targetState || "draft";
export const serviceStatus = (
  j: Journey,
  service: Service,
  mode: "now" | "target",
  lane: string,
): Status =>
  service.status[
    mode === "target" && targetState(j) === "not-started" ? "now" : mode
  ][lane] ?? "unknown";
export const flowAssessment = (service: Service) =>
  service.linksTo.length
    ? "connected"
    : service.flowAssessment || (service.isolated ? "isolated" : "connected");
export const evidenceState = (item: {
  evidence?: "unknown" | "assumed" | "validated";
  assumption?: boolean;
}) => item.evidence || (item.assumption ? "assumed" : "unknown");

export function frictionReference(j: Journey, id: string) {
  if (/^F\d+$/i.test(id)) return id.toUpperCase();
  const used = new Set(
    j.frictions
      .filter((f) => /^F\d+$/i.test(f.id))
      .map((f) => Number(f.id.slice(1))),
  );
  let next = 1;
  for (const f of j.frictions.filter((f) => !/^F\d+$/i.test(f.id))) {
    while (used.has(next)) next++;
    if (f.id === id) return `F${next}`;
    used.add(next++);
  }
  return "F";
}

export function targetSignature(j: Journey) {
  return JSON.stringify({
    phases: j.phases.map((p) => [p.id, p.name]),
    lanes: j.lanes.map((l) => [
      l.id,
      l.name,
      l.group,
      l.kind,
      l.channel,
      l.owner,
    ]),
    services: j.services.map((s) => [
      s.id,
      s.name,
      s.phase,
      s.status.target,
      s.linksTo,
      s.flowAssessment,
      s.isolated,
      s.capabilities,
    ]),
    steps: j.steps
      .filter((s) => s.in !== "now")
      .map((s) => [
        s.id,
        s.lane,
        s.phase,
        s.textTarget || s.text,
        s.transition.target,
        s.notes.target,
      ]),
    experience: j.experience.target,
    recommendations: j.frictions.map((f) => [f.id, f.recommendation]),
  });
}

export function targetChanges(j: Journey) {
  if (targetState(j) === "not-started") return [];
  const changes: {
    kind: "service" | "step" | "experience";
    id: string;
    label: string;
    before: string;
    after: string;
    lane?: string;
  }[] = [];
  for (const service of j.services) {
    for (const lane of j.lanes.filter((l) => l.channel?.type === "digital")) {
      const before = serviceStatus(j, service, "now", lane.id),
        after = serviceStatus(j, service, "target", lane.id);
      if (before !== after)
        changes.push({
          kind: "service",
          id: service.id,
          label: service.name,
          lane: lane.name,
          before,
          after,
        });
    }
  }
  for (const step of j.steps) {
    if (step.in === "target")
      changes.push({
        kind: "step",
        id: step.id,
        label: step.textTarget || step.text,
        before: "absent",
        after: "added",
      });
    else if (step.in === "now")
      changes.push({
        kind: "step",
        id: step.id,
        label: step.text,
        before: "present",
        after: "removed",
      });
    else {
      if (step.textTarget && step.textTarget !== step.text)
        changes.push({
          kind: "step",
          id: step.id,
          label: step.text,
          before: step.text,
          after: step.textTarget,
        });
      const before = step.transition.now || "continue",
        after = step.transition.target || before;
      if (before !== after)
        changes.push({
          kind: "step",
          id: step.id,
          label: step.text,
          before,
          after,
        });
    }
  }
  j.phases.forEach((phase, i) => {
    if (j.experience.now[i] !== j.experience.target[i])
      changes.push({
        kind: "experience",
        id: phase.id,
        label: phase.name,
        before: String(j.experience.now[i]),
        after: String(j.experience.target[i]),
      });
  });
  return changes;
}

export const capabilityName = (id: string) =>
  ({
    webview: "Embedded web experience",
    "context-sharing": "Shared customer context",
    "deep-linking": "Direct links to tasks",
    "session-handover": "Session handover",
  })[id as "webview"] || id.replaceAll("-", " ");
