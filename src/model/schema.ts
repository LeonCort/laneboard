import { z } from "zod";
export const statuses = [
  "unknown",
  "native",
  "webview",
  "browser-link",
  "info",
  "missing",
  "planned",
  "na",
] as const;
export const transitions = [
  "start",
  "continue",
  "channel-switch",
  "restart",
  "to-support",
  "lead-to-advisor",
  "back-to-digital",
] as const;
export const layers = [
  "services",
  "journey",
  "frictions",
  "feeds",
  "market",
  "owners",
  "sketches",
] as const;
export const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9-]+$/, "Use letters, digits and hyphens");
const text = z.string().max(20000);
export const evidenceStates = ["unknown", "assumed", "validated"] as const;
const evidenceFields = {
  evidence: z.enum(evidenceStates).optional(),
  evidenceNotes: text.optional(),
};
export const definitionSchema = z.object({
  id,
  name: text,
  description: text.default(""),
});
export const phaseSchema = z.object({
  id,
  name: text,
  width: z.number().min(220).max(1600).default(300),
});
export const groupSchema = z.object({
  id,
  name: text,
  lineAfter: z
    .object({ kind: z.enum(["boundary", "visibility"]), label: text })
    .optional(),
});
export const laneSchema = z.object({
  ...evidenceFields,
  id,
  group: id.nullable().default(null),
  kind: z.enum(["customer", "entry", "channel", "backstage", "market"]),
  name: text,
  sub: text.default(""),
  owner: id.optional(),
  assumption: z.boolean().default(false),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
  tint: z
    .enum(["customer", "entry", "self", "assisted", "backstage", "market"])
    .optional(),
  channel: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("digital"),
        authenticated: z.boolean().default(false),
        webviewHost: z.boolean().default(false),
        platform: z.enum(["app", "web"]).optional(),
      }),
      z.object({ type: z.literal("assisted") }),
    ])
    .optional(),
});
export const deliverySchema = z.object({
  system: z.enum(["unknown", "legacy", "modern"]).optional(),
  responsive: z.enum(["unknown", "yes", "no"]).optional(),
  destination: id.optional(),
});
export const serviceSchema = z.object({
  ...evidenceFields,
  id,
  name: text,
  description: text.default(""),
  phase: id,
  isolated: z.boolean().default(true),
  flowAssessment: z.enum(["unknown", "isolated", "connected"]).optional(),
  placementLane: id.optional(),
  linksTo: z.array(id).default([]),
  capabilities: z.array(id).default([]),
  delivery: z
    .object({
      now: z.record(id, deliverySchema).default({}),
      target: z.record(id, deliverySchema).default({}),
    })
    .optional(),
  status: z
    .object({
      now: z.record(id, z.enum(statuses)).default({}),
      target: z.record(id, z.enum(statuses)).default({}),
    })
    .default({ now: {}, target: {} }),
});
export const stepSchema = z.object({
  ...evidenceFields,
  id,
  lane: id,
  phase: id,
  in: z.enum(["now", "target", "both"]).default("both"),
  transition: z
    .object({
      now: z.enum(transitions).optional(),
      target: z.enum(transitions).optional(),
    })
    .default({}),
  text,
  textTarget: text.optional(),
  // Omitted means the next ordered step; an empty list explicitly ends the path.
  next: z
    .object({ now: z.array(id).optional(), target: z.array(id).optional() })
    .optional(),
  notes: z
    .object({ now: text.optional(), target: text.optional() })
    .default({}),
});
export const frictionSchema = z.object({
  ...evidenceFields,
  id,
  lane: id,
  phase: id,
  title: text,
  now: text.default(""),
  recommendation: text.default(""),
  othersPattern: text.default(""),
  owner: id.optional(),
  assumption: z.boolean().default(false),
});
export const feedSchema = z.object({
  id,
  kind: z.enum(["entry", "support"]),
  lane: id,
  phase: id,
  to: z.union([id, z.literal("")]).default(""),
  text,
  explanation: text.default(""),
});
export const noteSchema = z.object({
  id,
  lane: id,
  phase: id,
  text,
  kind: z.enum(["note", "competitor"]).default("note"),
});
export const sketchSchema = z.object({
  id,
  kind: z.enum(["rectangle", "ellipse", "arrow", "text", "note"]),
  text: text.default(""),
  x: z.number(),
  y: z.number(),
  width: z.number().min(40).max(3000).default(220),
  height: z.number().min(40).max(3000).default(100),
  anchor: z
    .object({ lane: id, phase: id, dx: z.number(), dy: z.number() })
    .optional(),
});
export const presentationSchema = z.object({
  title: text,
  text,
  layers: z.array(z.enum(layers)).default([]),
  focusLanes: z.array(id).default([]),
  dimJourney: z.boolean().default(false),
});
export const journeySchema = z.object({
  id,
  title: text,
  segment: text.default(""),
  goal: text.default(""),
  description: text.default(""),
  customer: text.default(""),
  situation: text.default(""),
  hypothesis: text.default(""),
  testPlan: text.default(""),
  nextAction: text.default(""),
  validationOwner: id.optional(),
  evidence: z.enum(evidenceStates).default("unknown"),
  evidenceNotes: text.default(""),
  targetState: z.enum(["not-started", "draft", "reviewed"]).optional(),
  baseline: text.default(""),
  targetMetric: text.default(""),
  readOnly: z.boolean().default(false),
  phases: z.array(phaseSchema).min(1).max(100),
  laneGroups: z.array(groupSchema).default([]),
  lanes: z.array(laneSchema).min(1).max(100),
  cells: z.record(id, z.array(text)).default({}),
  services: z.array(serviceSchema).max(3000).default([]),
  steps: z.array(stepSchema).max(3000).default([]),
  frictions: z.array(frictionSchema).max(3000).default([]),
  feeds: z.array(feedSchema).max(3000).default([]),
  notes: z.array(noteSchema).max(3000).default([]),
  sketches: z.array(sketchSchema).max(3000).default([]),
  experience: z.object({
    now: z.array(z.number().min(-2).max(2)),
    target: z.array(z.number().min(-2).max(2)),
  }),
  presentation: z.array(presentationSchema).default([]),
});
export const uiSchema = z.object({
  selectedJourney: z.string().default(""),
  mode: z.enum(["now", "target"]).default("now"),
  layers: z
    .array(z.enum(layers))
    .default([
      "services",
      "journey",
      "frictions",
      "feeds",
      "market",
      "sketches",
    ]),
  collapsedGroups: z.array(z.string()).default([]),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
});
export const settingsSchema = z.object({
  name: text.default("My workspace"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  language: z.enum(["en", "sv"]).default("en"),
  accent: z.enum(["blue", "teal", "purple"]).default("blue"),
  logo: z
    .string()
    .max(20000)
    .refine(
      (v) =>
        !v || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v),
      "Logo must be a locally embedded PNG, JPEG or WebP image",
    )
    .default(""),
  lastExport: z.string().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export const fileSchema = z.object({
  format: z.literal("laneboard"),
  schemaVersion: z.literal(1),
  exportedAt: z.string().optional(),
  owners: z.array(definitionSchema).default([]),
  capabilities: z.array(definitionSchema).default([]),
  journeys: z.array(journeySchema).max(100),
  settings: settingsSchema.optional(),
  ui: uiSchema.optional(),
});
export const workspaceSchema = fileSchema.extend({
  settings: settingsSchema.default(() => settingsSchema.parse({})),
  ui: uiSchema.default(() => uiSchema.parse({})),
});
export type Journey = z.infer<typeof journeySchema>;
export type Lane = z.infer<typeof laneSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Definition = z.infer<typeof definitionSchema>;
export type FileData = z.infer<typeof fileSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type UIState = z.infer<typeof uiSchema>;
export type Mode = "now" | "target";
export type Layer = (typeof layers)[number];
export type Status = (typeof statuses)[number];
export type Workspace = FileData & { settings: Settings; ui: UIState };
export const newId = (prefix = "item") =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
export const blankWorkspace = (): Workspace => ({
  format: "laneboard",
  schemaVersion: 1,
  owners: [],
  capabilities: [],
  journeys: [],
  settings: settingsSchema.parse({}),
  ui: uiSchema.parse({}),
});
