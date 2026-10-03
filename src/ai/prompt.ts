import { z } from "zod";
import { fileSchema } from "../model/schema";
import investing from "../examples/investing.laneboard.json";
export function buildPrompt(description: string, notes: string) {
  return `You are helping a bank map a customer journey as a service blueprint. Return only a JSON object in the Laneboard format below. No Markdown fences, no prose before or after.

The map spans the bank's channels. Think across silos: the customer's path, the services they need, what goes wrong at transitions and which technical capabilities each fix needs. Use generic names, not a real bank. Do not include personal customer data.

REQUIREMENTS
- 4 to 7 phases, from need to deeper relationship.
- Lanes: customer; entry points (other products, third parties); self-service (public website, mobile app, internet bank); assisted (customer service, advisor); backstage (enablers, support functions, insight); market (how others solve it).
- Services: 3 to 8. Each needs status per digital channel for now and target: native | webview | info | missing | planned | na.
- A service is isolated only if it can be completed without linking on. If it links on, list linksTo and set isolated to false.
- Steps: 6 to 10 ordered steps. Transitions: start | channel-switch | restart | to-support | lead-to-advisor | back-to-digital. Use in: now | target | both.
- Frictions: 3 to 8. Include now, recommendation, othersPattern if known.
- Feeds: other products or third parties that lead in (entry), and support functions that inform a step (support).
- Experience: -2 to 2 per phase in now and target.
- Every reference must resolve. Every id must be unique in its list.
- Do not invent statistics, prices or named competitors. Mark inferred frictions and lanes assumption: true.
- Write in the language of the description.

SCENARIO
${description}

NOTES
${notes}

SCHEMA
${JSON.stringify(z.toJSONSchema(fileSchema), null, 2)}

EXAMPLE
${JSON.stringify(investing, null, 2)}`;
}
