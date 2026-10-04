import type { Journey, Mode } from "./schema";
import { targetState } from "./analysis";
import { visibleSteps } from "../rules";

export type LinkSource = {
  kind: "service" | "feed";
  id: string;
  lane?: string;
};
export type LinkTarget = { kind: "service" | "step"; id: string };
type Card = { kind: string; entityId: string; lane: string };

export function cardSource(card?: Card): LinkSource | null {
  return card && (card.kind === "service" || card.kind === "feed")
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
    journey.feeds.some((feed) => feed.id === source.id) &&
    visibleSteps(journey, mode).some((step) => step.id === target.id)
  );
}

export function hasCardLink(
  journey: Journey,
  source: LinkSource,
  target: LinkTarget,
) {
  return source.kind === "service"
    ? journey.services
        .find((service) => service.id === source.id)
        ?.linksTo.includes(target.id) || false
    : journey.feeds.find((feed) => feed.id === source.id)?.to === target.id;
}
