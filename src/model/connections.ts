import type { Journey, Mode } from "./schema";
import { targetState } from "./analysis";
import { visibleSteps, stepTargets } from "../rules";

export type LinkSource = {
  kind: "service" | "feed" | "step";
  id: string;
  lane?: string;
};
export type LinkTarget = { kind: "service" | "step"; id: string };
export type ConnectionRef = { source: LinkSource; target: LinkTarget };
type Card = { kind: string; entityId: string; lane: string };

export function cardSource(card?: Card): LinkSource | null {
  return card &&
    (card.kind === "service" || card.kind === "feed" || card.kind === "step")
    ? { kind: card.kind, id: card.entityId, lane: card.lane }
    : null;
}

export function cardTarget(card?: Card): LinkTarget | null {
  return card && (card.kind === "service" || card.kind === "step")
    ? { kind: card.kind, id: card.entityId }
    : null;
}

export function canConnectCards(
  journey: Journey,
  source: LinkSource,
  target: LinkTarget,
  mode: Mode,
) {
  if (
    journey.readOnly ||
    (mode === "target" && targetState(journey) === "not-started") ||
    (source.lane &&
      (!journey.lanes.some((lane) => lane.id === source.lane) ||
        journey.lanes.find((lane) => lane.id === source.lane)?.locked))
  )
    return false;
  if (source.kind === "service")
    return (
      target.kind === "service" &&
      source.id !== target.id &&
      journey.services.some((service) => service.id === source.id) &&
      journey.services.some((service) => service.id === target.id)
    );
  return (
    target.kind === "step" &&
    (source.kind === "feed"
      ? journey.feeds.some((feed) => feed.id === source.id)
      : source.id !== target.id &&
        visibleSteps(journey, mode).some((step) => step.id === source.id)) &&
    visibleSteps(journey, mode).some((step) => step.id === target.id)
  );
}

export function hasCardLink(
  journey: Journey,
  source: LinkSource,
  target: LinkTarget,
  mode: Mode = "now",
) {
  return source.kind === "service"
    ? journey.services
        .find((service) => service.id === source.id)
        ?.linksTo.includes(target.id) || false
    : source.kind === "feed"
      ? journey.feeds.find((feed) => feed.id === source.id)?.to === target.id
      : stepTargets(journey, source.id, mode).includes(target.id);
}

export function canEditConnection(
  journey: Journey,
  ref: ConnectionRef,
  mode: Mode,
) {
  return (
    canConnectCards(journey, ref.source, ref.target, mode) &&
    hasCardLink(journey, ref.source, ref.target, mode)
  );
}
export function canReconnectConnection(
  journey: Journey,
  original: ConnectionRef,
  source: LinkSource,
  target: LinkTarget,
  mode: Mode,
) {
  return (
    canEditConnection(journey, original, mode) &&
    canConnectCards(journey, source, target, mode) &&
    !hasCardLink(journey, source, target, mode)
  );
}
export function connectionEdgeId(
  sourceNode: string,
  targetNode: string,
  ref: ConnectionRef,
) {
  return ref.source.kind === "service"
    ? `service-link-${sourceNode}-${targetNode}`
    : ref.source.kind === "feed"
      ? `feed-edge-${ref.source.id}`
      : `edge-${ref.source.id}-${ref.target.id}`;
}

export function applyCardLink(
  journey: Journey,
  source: LinkSource,
  target: LinkTarget,
  linked: boolean,
  mode: Mode,
) {
  if (source.kind === "service") {
    const service = journey.services.find((s) => s.id === source.id)!;
    service.linksTo = linked
      ? [...service.linksTo, target.id]
      : service.linksTo.filter((id) => id !== target.id);
    if (linked) {
      service.isolated = false;
      service.flowAssessment = "connected";
    }
  } else if (source.kind === "feed") {
    journey.feeds.find((feed) => feed.id === source.id)!.to = linked
      ? target.id
      : "";
  } else {
    const step = journey.steps.find((s) => s.id === source.id)!,
      next = stepTargets(journey, source.id, mode);
    step.next ||= {};
    step.next[mode] = linked
      ? [...next, target.id]
      : next.filter((id) => id !== target.id);
  }
}
