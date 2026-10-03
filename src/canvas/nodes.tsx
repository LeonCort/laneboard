import { memo, useRef, useEffect, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type NodeProps,
  type EdgeProps,
  type Node,
} from "@xyflow/react";
import rough from "roughjs";
import { useStore } from "../store";
import { useT } from "../i18n";
import type { CardData, CellData } from "./layout";
import type { Key } from "../i18n";
export const CellNode = memo(function CellNode({
  data,
}: NodeProps<Node<CellData>>) {
  const ownerIndex = useStore(
    (s) => s.workspace.owners.findIndex((o) => o.id === data.ownerIndex) + 1,
  );
  return (
    <div
      className="lb-cell lb-cell-node"
      data-group={data.group}
      data-dimmed={data.dimmed}
      data-owner-index={ownerIndex}
      data-owned={!!data.ownerIndex}
      style={{ width: data.width, height: data.height }}
    >
      {data.text ? (
        <span className="lb-cell__text lb-cell-bottom">{data.text}</span>
      ) : null}
    </div>
  );
});
export const CardNode = memo(function CardNode({
  data,
  selected,
}: NodeProps<Node<CardData>>) {
  const t = useT(),
    owners = useStore((s) => s.workspace.owners),
    edit = useStore((s) => s.editJourney),
    [editing, setEditing] = useState(false),
    [text, setText] = useState(data.text);
  const commit = () => {
    edit((j) => {
      if (data.kind === "service") {
        const x = j.services.find((x) => x.id === data.entityId);
        if (x) x.name = text;
      } else if (data.kind === "friction") {
        const x = j.frictions.find((x) => x.id === data.entityId);
        if (x) x.title = text;
      } else {
        const list =
          data.kind === "step"
            ? j.steps
            : data.kind === "feed"
              ? j.feeds
              : j.notes;
        const x = list.find((x) => x.id === data.entityId);
        if (x) x.text = text;
      }
    });
    setEditing(false);
  };
  const cls = `lb-card lb-card--${data.kind}${data.critical ? " is-linked-webview" : ""}${data.changed ? " is-changed" : ""}`;
  return (
    <div
      className={cls}
      data-status={data.status}
      data-transition={data.transition}
      data-kind={data.feedKind}
      data-dimmed={data.dimmed}
      data-selected={selected}
      data-owned={data.showOwner}
      data-owner-index={owners.findIndex((o) => o.id === data.owner) + 1}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="lb-handle"
      />
      {data.kind === "step" ? (
        <span className="lb-card__num">{data.number}</span>
      ) : null}
      <div className="lb-card-content">
        <div className="lb-card-heading">
          {data.kind === "friction" ? (
            <span className="lb-friction__id">{data.entityId}</span>
          ) : null}
          <span
            onDoubleClick={(e) => {
              if (!data.readOnly) {
                e.stopPropagation();
                setText(data.text);
                setEditing(true);
              }
            }}
          >
            {editing ? (
              <textarea
                autoFocus
                className="lb-input nodrag nowheel lb-inline-edit"
                aria-label="Edit card text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commit();
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
              />
            ) : (
              data.text
            )}
          </span>
        </div>
        {data.status ? (
          <div className="lb-card__meta lb-card-meta">
            <span className="lb-status" data-status={data.status}>
              {t(data.status as Key)}
            </span>
            {data.changed ? (
              <span className="lb-tag">{t("changed")}</span>
            ) : null}
            {data.meta === "linked" ? (
              <span className="lb-micro">{t("linked")}</span>
            ) : null}
          </div>
        ) : null}
        {data.feedKind ? (
          <span className="lb-card__kind">
            {data.feedKind === "entry" ? t("entryLabel") : t("supportLabel")}
          </span>
        ) : null}
        {data.assumption ? (
          <span className="lb-tag lb-tag--assumption">{t("assumption")}</span>
        ) : null}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="lb-handle"
      />
    </div>
  );
});
export const JourneyEdge = memo(function JourneyEdge(props: EdgeProps) {
  const t = useT();
  const transition = String(props.data?.transition || "channel-switch");
  const [path, x, y] = getSmoothStepPath({
    ...props,
    borderRadius: 12,
    offset: 30,
  });
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        className={`lb-edge lb-edge--${transition}${props.data?.dimmed ? " is-dimmed" : ""}`}
      />
      {transition === "restart" ? (
        <EdgeLabelRenderer>
          <span
            className="lb-edge-label"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
            }}
          >
            {t("restarts")}
          </span>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
export const SketchNode = memo(function SketchNode({
  data,
  selected,
}: NodeProps) {
  const ref = useRef<SVGSVGElement>(null),
    kind = String(data.kind),
    width = Number(data.width),
    height = Number(data.height);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    svg.replaceChildren();
    const rc = rough.svg(svg),
      options = {
        seed: 1,
        roughness: 1.3,
        stroke: "currentColor",
        strokeWidth: 1.6,
      };
    const shape =
      kind === "ellipse"
        ? rc.ellipse(width / 2, height / 2, width - 10, height - 10, options)
        : kind === "arrow"
          ? rc.line(8, height - 8, width - 8, 8, options)
          : rc.rectangle(5, 5, width - 10, height - 10, options);
    svg.append(shape);
    if (kind === "arrow") {
      svg.append(
        rc.line(width - 8, 8, width - 30, 10, options),
        rc.line(width - 8, 8, width - 10, 30, options),
      );
    }
  }, [kind, width, height]);
  const edit = useStore((s) => s.editJourney);
  return (
    <div
      className={kind === "note" ? "lb-note" : "lb-sketch-wrap"}
      style={{ width, height }}
    >
      <NodeResizer
        isVisible={selected && !data.readOnly}
        minWidth={60}
        minHeight={40}
        onResizeEnd={(_, p) =>
          edit((j) => {
            const s = j.sketches.find((s) => s.id === data.id);
            if (s) {
              s.width = p.width;
              s.height = p.height;
              if (s.anchor) {
                const dx = p.x - Number(data.renderX),
                  dy = p.y - Number(data.renderY);
                s.anchor.dx += dx;
                s.anchor.dy += dy;
              }
              s.x = p.x;
              s.y = p.y;
            }
          })
        }
      />
      {kind === "note" || kind === "text" ? (
        <span className="lb-sketch-text">{String(data.text)}</span>
      ) : (
        <svg
          ref={ref}
          className="lb-sketch"
          width={width}
          height={height}
          aria-label={`${kind} annotation`}
        />
      )}{" "}
      {data.anchor ? (
        <span className="lb-pin" aria-label="Pinned to cell" />
      ) : null}
    </div>
  );
});
export const CurveNode = memo(function CurveNode({ data }: NodeProps) {
  const edit = useStore((s) => s.editJourney),
    t = useT(),
    columns = data.columns as { x: number; width: number; id: string }[],
    mode = data.mode as "now" | "target",
    values = data[mode] as number[],
    other = data[mode === "now" ? "target" : "now"] as number[],
    width = Number(data.width);
  const points = (v: number[]) =>
    v
      .map((v, i) => `${columns[i].x + columns[i].width / 2},${54 - v * 20}`)
      .join(" ");
  return (
    <div className="lb-curve" style={{ width, height: 110 }}>
      <svg width={width} height={110} viewBox={`0 0 ${width} 110`}>
        <line className="lb-curve__axis" x1={0} x2={width} y1={54} y2={54} />
        <polyline
          className="lb-curve__line lb-curve__line--ghost"
          points={points(other)}
        />
        <polyline
          className={`lb-curve__line lb-curve__line--${mode}`}
          points={points(values)}
        />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={columns[i].x + columns[i].width / 2}
            cy={54 - v * 20}
            r={5}
            fill={`var(--${mode === "now" ? "crit" : "ok"})`}
            className="lb-curve__point"
            onPointerDown={(e) => {
              if (data.readOnly) return;
              e.stopPropagation();
              const svg = e.currentTarget.ownerSVGElement!,
                rect = svg.getBoundingClientRect();
              const move = (ev: PointerEvent) => {
                const value =
                  Math.round(
                    Math.max(
                      -2,
                      Math.min(
                        2,
                        (54 - ((ev.clientY - rect.top) * 110) / rect.height) /
                          20,
                      ),
                    ) * 10,
                  ) / 10;
                edit((j) => {
                  j.experience[mode][i] = value;
                });
              };
              const end = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", end);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", end);
            }}
          />
        ))}
        <text x={8} y={15} className="lb-curve__label">
          +2 {t("easy")}
        </text>
        <text x={8} y={100} className="lb-curve__label">
          −2 {t("hard")}
        </text>
      </svg>
    </div>
  );
});
export const nodeTypes = {
  cell: CellNode,
  card: CardNode,
  sketch: SketchNode,
  curve: CurveNode,
};
export const edgeTypes = { journey: JourneyEdge };
