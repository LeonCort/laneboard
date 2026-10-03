import type { Journey, Layer } from "../model/schema";
export function presentationFor(j: Journey) {
  return j.presentation.length
    ? j.presentation
    : [
        {
          title: "Channels and services",
          text: "Which services does the goal need, and where do they exist?",
          layers: ["services"] as Layer[],
          focusLanes: j.lanes
            .filter((l) => l.channel?.type === "digital")
            .map((l) => l.id),
          dimJourney: false,
        },
        {
          title: "The customer journey",
          text: "Follow the numbered path across channels. Where does context follow — and where does it disappear?",
          layers: ["services", "journey"] as Layer[],
          focusLanes: [],
          dimJourney: false,
        },
        {
          title: "Frictions",
          text: "Look at restarts, missing services and the recommendations for a connected experience.",
          layers: ["services", "journey", "frictions"] as Layer[],
          focusLanes: [],
          dimJourney: false,
        },
        {
          title: "Feeds and support",
          text: "Other products and third parties bring customers in. Support functions help the journey work.",
          layers: ["journey", "feeds"] as Layer[],
          focusLanes: [],
          dimJourney: false,
        },
        {
          title: "Market patterns",
          text: "Patterns from others are assumptions until verified.",
          layers: ["market"] as Layer[],
          focusLanes: j.lanes
            .filter((l) => l.kind === "market")
            .map((l) => l.id),
          dimJourney: true,
        },
        {
          title: "Owners and the shared goal",
          text: "Connect workstreams around the customer’s goal instead of optimising each channel separately.",
          layers: ["frictions", "owners"] as Layer[],
          focusLanes: [],
          dimJourney: true,
        },
      ];
}
