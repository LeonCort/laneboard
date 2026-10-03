import { fileSchema, type FileData } from "../model/schema";
export const MAX_IMPORT_SIZE = 5 * 1024 * 1024;
export class ImportError extends Error {
  constructor(public problems: string[]) {
    super(problems.join("\n"));
  }
}
type Obj = Record<string, unknown>;
const isObject = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const slug = (v: unknown) =>
  String(v || "item")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "item";
export function parseImport(raw: string): {
  data: FileData;
  warnings: string[];
} {
  if (new Blob([raw]).size > MAX_IMPORT_SIZE)
    throw new ImportError(["$: File exceeds the 5 MB limit."]);
  const warnings: string[] = [];
  let source = raw.trim();
  if (source.startsWith("```")) {
    source = source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    warnings.push("$: Removed Markdown fences.");
  }
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new ImportError([
      "$: This is not valid JSON. Check commas, quotes and brackets.",
    ]);
  }
  if (!isObject(value))
    throw new ImportError(["$: Expected a Laneboard object."]);
  if (value.schemaVersion === 0) {
    value.schemaVersion = 1;
    warnings.push("schemaVersion: Migrated version 0 to version 1.");
  }
  if (value.schemaVersion !== 1)
    throw new ImportError([
      "schemaVersion: Expected version 1. Newer versions need an updated app.",
    ]);
  const repairList = (parent: Obj, key: string, path: string) => {
    if (parent[key] === undefined) {
      parent[key] = [];
      warnings.push(`${path}${key}: Added an empty list.`);
    }
    if (Array.isArray(parent[key])) {
      const used = new Set(
        (parent[key] as unknown[])
          .filter(isObject)
          .map((x) => x.id)
          .filter(Boolean),
      );
      (parent[key] as unknown[]).forEach((item, i) => {
        if (isObject(item) && !item.id) {
          const base = slug(
            item.name || item.title || item.text || `${key}-${i + 1}`,
          );
          let keyId = base,
            n = 2;
          while (used.has(keyId)) keyId = `${base}-${n++}`;
          item.id = keyId;
          used.add(keyId);
          warnings.push(`${path}${key}[${i}].id: Generated “${keyId}”.`);
        }
      });
    }
  };
  repairList(value, "owners", "");
  repairList(value, "capabilities", "");
  if (Array.isArray(value.journeys)) {
    repairList(value, "journeys", "");
    value.journeys.forEach((j, ji) => {
      if (!isObject(j)) return;
      const p = `journeys[${ji}].`;
      for (const k of [
        "phases",
        "laneGroups",
        "lanes",
        "services",
        "steps",
        "frictions",
        "feeds",
      ])
        repairList(j, k, p);
      if (Array.isArray(j.services))
        j.services.forEach((s, si) => {
          if (!isObject(s)) return;
          for (const k of ["linksTo", "capabilities"])
            if (s[k] === undefined) {
              s[k] = [];
              warnings.push(`${p}services[${si}].${k}: Added an empty list.`);
            }
          if (isObject(s.status))
            for (const mode of ["now", "target"]) {
              if (!isObject(s.status[mode])) s.status[mode] = {};
              const lanes = Array.isArray(j.lanes)
                ? j.lanes
                    .filter(isObject)
                    .filter(
                      (l) =>
                        isObject(l.channel) && l.channel.type === "digital",
                    )
                : [];
              for (const l of lanes) {
                const sm = s.status[mode] as Obj;
                if (sm[String(l.id)] === undefined) {
                  sm[String(l.id)] = "na";
                  warnings.push(
                    `${p}services[${si}].status.${mode}.${l.id}: Defaulted to na.`,
                  );
                }
              }
            }
          else {
            warnings.push(`${p}services[${si}].status: Defaulted to na.`);
          }
        });
      if (Array.isArray(j.steps))
        j.steps.forEach((s, si) => {
          if (isObject(s) && s.in === undefined) {
            s.in = "both";
            warnings.push(`${p}steps[${si}].in: Defaulted to both.`);
          }
        });
    });
  }
  const parsed = fileSchema.safeParse(value);
  if (!parsed.success)
    throw new ImportError(
      parsed.error.issues.map(
        (x) => `${x.path.join(".") || "$"}: ${x.message}`,
      ),
    );
  const data = parsed.data;
  const unknown = (a: unknown, b: unknown, path: string) => {
    if (isObject(a) && isObject(b))
      for (const [k, v] of Object.entries(a)) {
        if (!(k in b)) warnings.push(`${path}${k}: Ignored unknown field.`);
        else unknown(v, b[k], `${path}${k}.`);
      }
    else if (Array.isArray(a) && Array.isArray(b))
      a.forEach((v, i) => unknown(v, b[i], `${path}[${i}].`));
  };
  unknown(value, data, "");
  const errors: string[] = [];
  const unique = (list: { id: string }[], path: string) => {
    const seen = new Set<string>();
    list.forEach((x, i) => {
      if (seen.has(x.id))
        errors.push(`${path}[${i}].id: Duplicate id “${x.id}”.`);
      seen.add(x.id);
    });
    return seen;
  };
  const owners = unique(data.owners, "owners"),
    caps = unique(data.capabilities, "capabilities");
  unique(data.journeys, "journeys");
  data.journeys.forEach((j, ji) => {
    const p = `journeys[${ji}]`,
      phases = unique(j.phases, `${p}.phases`),
      groups = unique(j.laneGroups, `${p}.laneGroups`),
      lanes = unique(j.lanes, `${p}.lanes`),
      services = unique(j.services, `${p}.services`),
      steps = unique(j.steps, `${p}.steps`);
    for (const key of ["frictions", "feeds", "notes", "sketches"] as const)
      unique(j[key], `${p}.${key}`);
    const ref = (
      v: string | undefined | null,
      set: Set<string>,
      path: string,
    ) => {
      if (v != null && !set.has(v))
        errors.push(`${path}: Reference “${v}” does not exist.`);
    };
    j.lanes.forEach((l, i) => {
      ref(l.group, groups, `${p}.lanes[${i}].group`);
      ref(l.owner, owners, `${p}.lanes[${i}].owner`);
      if (l.kind === "channel" && !l.channel)
        errors.push(
          `${p}.lanes[${i}].channel: Channel properties are required.`,
        );
    });
    const digital = new Set(
      j.lanes.filter((l) => l.channel?.type === "digital").map((l) => l.id),
    );
    j.services.forEach((s, i) => {
      ref(s.phase, phases, `${p}.services[${i}].phase`);
      s.linksTo.forEach((v, k) =>
        ref(v, services, `${p}.services[${i}].linksTo[${k}]`),
      );
      s.capabilities.forEach((v, k) =>
        ref(v, caps, `${p}.services[${i}].capabilities[${k}]`),
      );
      for (const m of ["now", "target"] as const)
        for (const k of Object.keys(s.status[m]))
          ref(k, digital, `${p}.services[${i}].status.${m}.${k}`);
      if (s.isolated && s.linksTo.length) {
        s.isolated = false;
        warnings.push(
          `${p}.services[${i}].isolated: Cleared because the service links on.`,
        );
      }
    });
    for (const key of ["steps", "frictions", "feeds", "notes"] as const)
      j[key].forEach((x, i) => {
        ref(x.lane, lanes, `${p}.${key}[${i}].lane`);
        ref(x.phase, phases, `${p}.${key}[${i}].phase`);
      });
    j.frictions.forEach((f, i) =>
      ref(f.owner, owners, `${p}.frictions[${i}].owner`),
    );
    j.feeds.forEach((f, i) => ref(f.to, steps, `${p}.feeds[${i}].to`));
    j.sketches.forEach((s, i) => {
      if (s.anchor) {
        ref(s.anchor.lane, lanes, `${p}.sketches[${i}].anchor.lane`);
        ref(s.anchor.phase, phases, `${p}.sketches[${i}].anchor.phase`);
      }
    });
    Object.entries(j.cells).forEach(([l, a]) => {
      ref(l, lanes, `${p}.cells.${l}`);
      if (a.length !== j.phases.length)
        errors.push(
          `${p}.cells.${l}: Expected ${j.phases.length} entries, received ${a.length}.`,
        );
    });
    for (const mode of ["now", "target"] as const)
      if (j.experience[mode].length !== j.phases.length)
        errors.push(
          `${p}.experience.${mode}: Expected ${j.phases.length} values, received ${j.experience[mode].length}.`,
        );
    j.presentation.forEach((s, i) =>
      s.focusLanes.forEach((l, k) =>
        ref(l, lanes, `${p}.presentation[${i}].focusLanes[${k}]`),
      ),
    );
  });
  if (errors.length) throw new ImportError(errors);
  return { data, warnings };
}
