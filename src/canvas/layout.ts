import type { Node, Edge } from "@xyflow/react";
import type { Journey, Mode, Layer, UIState } from "../model/schema";
import { visibleSteps, evaluateService } from "../rules";
import type { Selection } from "../store";
export interface CardData extends Record<string, unknown> {
  kind: Selection["kind"];
  entityId: string;
  lane: string;
  phase: string;
  text: string;
  meta?: string;
  status?: string;
  transition?: string;
  number?: number;
  owner?: string;
  assumption?: boolean;
  changed?: boolean;
  critical?: boolean;
  feedKind?: string;
  dimmed?: boolean;
  readOnly: boolean;
  cellId?: string;
}
export interface CellData extends Record<string, unknown> {
  lane: string;
  phase: string;
  group: string;
  width: number;
  height: number;
  text: string;
  readOnly: boolean;
  dimmed?: boolean;
  ownerIndex?: string;
}
export interface Row {
  id: string;
  y: number;
  height: number;
  kind: "lane" | "group" | "line" | "curve";
  name: string;
  sub?: string;
  group?: string;
  lineKind?: string;
}
export function layout(
  j: Journey,
  ui: UIState,
  selection: Selection | null,
  focus: string[] = [],
  dimJourney = false,
  filter?: { search: string; owner: string; severity: string; lane: string },
) {
  const mode: Mode = ui.mode,
    active = new Set<Layer>(ui.layers),
    nodes: Node[] = [],
    edges: Edge[] = [],
    rows: Row[] = [];
  const columns = j.phases.map((p, i) => ({
    id: p.id,
    name: p.name,
    x: j.phases.slice(0, i).reduce((a, p) => a + p.width + 10, 0),
    width: p.width,
  }));
  const totalWidth = columns.reduce((a, p) => a + p.width + 10, 0) - 10;
  const cards: CardData[] = [],
    steps = visibleSteps(j, mode),
    visibleLanes = j.lanes.filter(
      (l) =>
        !l.hidden &&
        !ui.collapsedGroups.includes(l.group || "") &&
        (l.kind !== "market" || active.has("market")),
    );
  const match = (
    text: string,
    owner?: string,
    lane?: string,
    severity?: string,
  ) =>
    !!(
      (filter?.search &&
        !text.toLowerCase().includes(filter.search.toLowerCase())) ||
      (filter?.owner && owner !== filter.owner) ||
      (filter?.lane && lane !== filter.lane) ||
      (filter?.severity && severity !== filter.severity)
    );
  for (const l of visibleLanes)
    for (const p of j.phases) {
      const dimmed = focus.length > 0 && !focus.includes(l.id);
      if (active.has("services") && l.channel?.type === "digital")
        for (const s of j.services.filter((s) => s.phase === p.id)) {
          const status = s.status[mode][l.id] ?? "na";
          if (status === "na") continue;
          cards.push({
            kind: "service",
            entityId: s.id,
            lane: l.id,
            phase: p.id,
            text: s.name,
            meta: s.isolated && !s.linksTo.length ? "isolated" : "linked",
            status,
            changed: mode === "target" && status !== s.status.now[l.id],
            critical:
              status === "webview" && (!s.isolated || s.linksTo.length > 0),
            dimmed:
              dimmed ||
              match(
                `${s.name} ${s.description}`,
                l.owner,
                l.id,
                evaluateService(s, j, mode).severity,
              ),
            readOnly: j.readOnly,
          });
        }
      if (active.has("journey"))
        for (const s of steps.filter(
          (s) => s.lane === l.id && s.phase === p.id,
        ))
          cards.push({
            kind: "step",
            entityId: s.id,
            lane: l.id,
            phase: p.id,
            text: mode === "target" ? s.textTarget || s.text : s.text,
            transition: s.transition[mode] || "channel-switch",
            number: steps.indexOf(s) + 1,
            dimmed:
              dimmed ||
              dimJourney ||
              match(`${s.text} ${s.notes[mode] || ""}`, l.owner, l.id),
            readOnly: j.readOnly,
          });
      if (active.has("frictions"))
        for (const f of j.frictions.filter(
          (f) => f.lane === l.id && f.phase === p.id,
        ))
          cards.push({
            kind: "friction",
            entityId: f.id,
            lane: l.id,
            phase: p.id,
            text: f.title,
            meta: mode === "target" ? f.recommendation : f.now,
            owner: f.owner,
            showOwner: active.has("owners"),
            assumption: f.assumption,
            dimmed:
              dimmed ||
              match(
                `${f.title} ${f.now} ${f.recommendation} ${f.othersPattern}`,
                f.owner,
                l.id,
                "high",
              ),
            readOnly: j.readOnly,
          });
      if (active.has("feeds"))
        for (const f of j.feeds.filter(
          (f) => f.lane === l.id && f.phase === p.id,
        ))
          cards.push({
            kind: "feed",
            entityId: f.id,
            lane: l.id,
            phase: p.id,
            text: f.text,
            feedKind: f.kind,
            dimmed:
              dimmed || match(`${f.text} ${f.explanation}`, l.owner, l.id),
            readOnly: j.readOnly,
          });
      for (const n of j.notes.filter(
        (n) => n.lane === l.id && n.phase === p.id,
      ))
        cards.push({
          kind: "note",
          entityId: n.id,
          lane: l.id,
          phase: p.id,
          text: n.text,
          dimmed: dimmed || match(n.text, l.owner, l.id),
          readOnly: j.readOnly,
        });
    }
  const heights = new Map<string, number>();
  cards.forEach((c) => {
    const width = columns.find((p) => p.id === c.phase)?.width || 300;
    const lines = Math.ceil(c.text.length / Math.max(20, (width - 48) / 7));
    heights.set(
      `${c.kind}-${c.entityId}-${c.lane}`,
      Math.max(c.kind === "step" ? 60 : 52, lines * 18 + 38),
    );
  });
  let y = 0;
  // Keep empty groups on the map so their inline add control remains available.
  for (const group of [null, ...j.laneGroups]) {
    if (group) {
      rows.push({
        id: group.id,
        y,
        height: 30,
        kind: "group",
        name: group.name,
      });
      y += 38;
    }
    for (const l of j.lanes.filter((l) => l.group === (group?.id ?? null))) {
      if (
        l.hidden ||
        (l.kind === "market" && !active.has("market")) ||
        ui.collapsedGroups.includes(l.group || "")
      )
        continue;
      const rowHeight = Math.max(
        l.kind === "customer" ? 94 : 90,
        ...columns.map((p) => {
          const cs = cards.filter((c) => c.lane === l.id && c.phase === p.id);
          const cellText =
            j.cells[l.id]?.[j.phases.findIndex((x) => x.id === p.id)] || "";
          return (
            cs.reduce(
              (a, c) =>
                a +
                (heights.get(`${c.kind}-${c.entityId}-${c.lane}`) || 52) +
                8,
              16,
            ) +
            (cellText
              ? Math.ceil(cellText.length / Math.max(20, (p.width - 24) / 6)) *
                  17 +
                12
              : 0)
          );
        }),
      );
      rows.push({
        id: l.id,
        y,
        height: rowHeight,
        kind: "lane",
        name: l.name,
        sub: l.sub,
        group:
          l.tint || (l.kind === "customer" ? "customer" : l.group || l.kind),
      });
      for (const p of columns) {
        const cellId = `cell-${l.id}-${p.id}`,
          text =
            j.cells[l.id]?.[j.phases.findIndex((x) => x.id === p.id)] || "",
          dimmed =
            (focus.length > 0 && !focus.includes(l.id)) ||
            match(text, l.owner, l.id);
        nodes.push({
          id: cellId,
          type: "cell",
          position: { x: p.x, y },
          data: {
            lane: l.id,
            phase: p.id,
            group:
              l.tint ||
              (l.kind === "customer" ? "customer" : l.group || l.kind),
            width: p.width,
            height: rowHeight,
            text,
            readOnly: j.readOnly || l.locked,
            dimmed,
            ownerIndex: active.has("owners") ? l.owner : undefined,
          },
          style: { width: p.width, height: rowHeight },
          selectable: false,
          draggable: false,
          connectable: false,
          zIndex: 0,
        });
        let cy = 8;
        for (const c of cards.filter(
          (c) => c.lane === l.id && c.phase === p.id,
        )) {
          const nid = `${c.kind}-${c.entityId}-${c.lane}`,
            height = heights.get(nid) || 52;
          nodes.push({
            id: nid,
            type: "card",
            parentId: cellId,
            position: { x: 8, y: cy },
            data: { ...c, cellId },
            style: { width: p.width - 16, height },
            selected: selection?.id === c.entityId && selection.kind === c.kind,
            draggable: !j.readOnly && !l.locked,
            zIndex: 5,
            ariaLabel: `${c.kind}: ${c.text}`,
          });
          cy += height + 8;
        }
      }
      y += rowHeight + 10;
      if (l.kind === "customer" && !rows.some((r) => r.kind === "curve")) {
        rows.push({
          id: "curve",
          y,
          height: 110,
          kind: "curve",
          name: "Customer experience",
        });
        nodes.push({
          id: "curve",
          type: "curve",
          position: { x: 0, y },
          data: {
            columns,
            now: j.experience.now,
            target: j.experience.target,
            mode,
            readOnly: j.readOnly,
            width: totalWidth,
          },
          style: { width: totalWidth, height: 110 },
          draggable: false,
          selectable: false,
          connectable: false,
        });
        y += 128;
      }
    }
    if (group?.lineAfter) {
      rows.push({
        id: `line-${group.id}`,
        y,
        height: 28,
        kind: "line",
        name: group.lineAfter.label,
        lineKind: group.lineAfter.kind,
      });
      y += 36;
    }
  }
  if (active.has("journey")) {
    const rendered = steps.filter((s) =>
      nodes.some((n) => n.id === `step-${s.id}-${s.lane}`),
    );
    rendered.forEach((s, i) => {
      if (!i) return;
      const prev = rendered[i - 1],
        transition = s.transition[mode] || "channel-switch";
      edges.push({
        id: `edge-${prev.id}-${s.id}`,
        source: `step-${prev.id}-${prev.lane}`,
        target: `step-${s.id}-${s.lane}`,
        sourceHandle: "out",
        targetHandle: "in",
        type: "journey",
        data: { transition, dimmed: dimJourney },
        zIndex: 6,
      });
    });
  }
  if (active.has("feeds") && active.has("journey"))
    for (const f of j.feeds) {
      const to = steps.find((s) => s.id === f.to);
      if (
        to &&
        nodes.some((n) => n.id === `feed-${f.id}-${f.lane}`) &&
        nodes.some((n) => n.id === `step-${to.id}-${to.lane}`)
      )
        edges.push({
          id: `feed-edge-${f.id}`,
          source: `feed-${f.id}-${f.lane}`,
          target: `step-${to.id}-${to.lane}`,
          sourceHandle: "out",
          targetHandle: "in",
          type: "journey",
          data: { transition: f.kind },
          zIndex: 6,
        });
    }
  if (active.has("sketches"))
    for (const s of j.sketches) {
      const cell = s.anchor
        ? nodes.find(
            (n) => n.id === `cell-${s.anchor?.lane}-${s.anchor?.phase}`,
          )
        : undefined;
      if (s.anchor && !cell) continue;
      const position =
        cell && s.anchor
          ? {
              x: cell.position.x + s.anchor.dx,
              y: cell.position.y + s.anchor.dy,
            }
          : { x: s.x, y: s.y };
      nodes.push({
        id: `sketch-${s.id}`,
        type: "sketch",
        position,
        data: {
          ...s,
          renderX: position.x,
          renderY: position.y,
          readOnly: j.readOnly,
        },
        style: { width: s.width, height: s.height },
        selected: selection?.kind === "sketch" && selection.id === s.id,
        draggable: !j.readOnly,
        zIndex: 10,
        ariaLabel: `Sketch ${s.kind}: ${s.text}`,
      });
    }
  return { nodes, edges, rows, columns, width: totalWidth, height: y };
}
