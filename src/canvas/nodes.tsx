import { memo, useRef, useEffect, useState } from "react";
import {
  Handle,
  Position,
  NodeResizer,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useViewport,
  useConnection,
  useUpdateNodeInternals,
  type NodeProps,
  type EdgeProps,
  type Node,
} from "@xyflow/react";
import rough from "roughjs";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Plus } from "lucide-react";
import { useStore, currentJourney, addCard, type Selection } from "../store";
import { targetState } from "../model/analysis";
import {
  cardSource,
  cardTarget,
  canConnectCards,
  hasCardLink,
} from "../model/connections";
import { CardLinks } from "./CardLinks";
import { EdgeControls } from "./EdgeControls";
import type { ConnectionRef } from "../model/connections";
import { useT } from "../i18n";
import type { CardData, CellData } from "./layout";
import type { Key } from "../i18n";
export const CellNode = memo(function CellNode({
  data,
}: NodeProps<Node<CellData>>) {
  const ownerIndex = useStore(
    (s) => s.workspace.owners.findIndex((o) => o.id === data.ownerIndex) + 1,
  );
  const t = useT(),
    s = useStore(),
    j = currentJourney(s),
    lane = j?.lanes.find((l) => l.id === data.lane);
  const { zoom } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const disabled =
    data.readOnly ||
    (s.workspace.ui.mode === "target" &&
      !!j &&
      targetState(j) === "not-started");
  return (
    <div
      className="lb-cell lb-cell-node"
      data-group={data.group}
      data-dimmed={data.dimmed}
      data-owner-index={ownerIndex}
      data-owned={!!data.ownerIndex}
      style={{ width: data.width, height: data.height }}
    >
      {!disabled ? (
        <Menu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <Menu.Trigger asChild>
            <button
              ref={addRef}
              className="lb-cell-add nodrag nopan"
              style={{
                transform: `scale(${1 / zoom})`,
                transformOrigin: "bottom right",
              }}
              aria-label={`${t("addInCell")} · ${lane?.name} · ${j?.phases.find((p) => p.id === data.phase)?.name}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (e.button === 0 && !e.ctrlKey) setMenuOpen(true);
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <Plus size={18} />
            </button>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content
              className="lb-popover lb-cell-menu"
              sideOffset={4}
              onClick={(e) => e.stopPropagation()}
              onPointerDownOutside={(e) => {
                if (
                  addRef.current?.contains(
                    e.detail.originalEvent.target as globalThis.Node,
                  )
                )
                  e.preventDefault();
              }}
            >
              {(
                [
                  "step",
                  ...(lane?.channel?.type === "digital" ? ["service"] : []),
                  "friction",
                  "note",
                  ...(j?.steps.length ? ["feed"] : []),
                ] as Selection["kind"][]
              ).map((kind) => (
                <Menu.Item
                  key={kind}
                  className="lb-menu__item"
                  onSelect={() => addCard(kind, data.lane, data.phase)}
                >
                  {t(
                    {
                      step: "toolStep",
                      service: "toolService",
                      friction: "toolFriction",
                      note: "toolNote",
                      feed: "toolFeed",
                    }[kind as "step"],
                  )}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      ) : null}
      {data.text ? (
        <span className="lb-cell__text lb-cell-bottom">{data.text}</span>
      ) : null}
    </div>
  );
});
export const CardNode = memo(function CardNode({
  id,
  data,
  selected,
  isConnectable,
}: NodeProps<Node<CardData>>) {
  const t = useT(),
    owners = useStore((s) => s.workspace.owners),
    edit = useStore((s) => s.editJourney),
    [editing, setEditing] = useState(false),
    [text, setText] = useState(data.text);
  const journey = useStore(currentJourney),
    mode = useStore((s) => s.workspace.ui.mode);
  const source = cardSource(data),
    target = cardTarget(data);
  const receive = useConnection((connection) => {
    const backwards = connection.fromHandle?.type === "target";
    const from =
      connection.fromNode?.type === "card"
        ? backwards
          ? source
          : cardSource(connection.fromNode.data as CardData)
        : null;
    const to = backwards
      ? cardTarget(connection.fromNode?.data as CardData | undefined)
      : target;
    const valid = !!(
      isConnectable &&
      journey &&
      from &&
      to &&
      canConnectCards(journey, from, to, mode) &&
      !hasCardLink(journey, from, to, mode)
    );
    return valid ? (backwards ? "source" : "target") : "none";
  });
  const canReceive = receive !== "none";
  const { zoom } = useViewport(),
    updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    // The hover control keeps its screen size, and drag targets expand to the
    // whole card. Re-measure these handles whenever their geometry changes.
    updateNodeInternals(id);
  }, [id, zoom, receive, updateNodeInternals]);
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
        if (x) {
          if (
            data.kind === "step" &&
            useStore.getState().workspace.ui.mode === "target" &&
            "textTarget" in x
          )
            x.textTarget = text;
          else if (
            data.kind === "step" &&
            useStore.getState().workspace.ui.mode === "target"
          )
            Object.assign(x, { textTarget: text });
          else x.text = text;
        }
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
      data-link-target={canReceive}
      data-reconnect-source={receive === "source"}
      data-owned={data.showOwner}
      data-owner-index={owners.findIndex((o) => o.id === data.owner) + 1}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="lb-handle lb-link-target"
        isConnectable={isConnectable}
        isConnectableStart={false}
        isConnectableEnd={receive === "target"}
      />
      {data.kind === "step" ? (
        <span className="lb-card__num">{data.number}</span>
      ) : null}
      <div className="lb-card-content">
        <div className="lb-card-heading">
          {data.kind === "friction" ? (
            <span className="lb-friction__id">{data.reference as string}</span>
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
      {source ? (
        <CardLinks
          source={source}
          name={data.text}
          connectable={isConnectable}
          readOnly={data.readOnly}
          receive={receive === "source"}
        />
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="lb-handle"
          isConnectable={false}
        />
      )}
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
        markerEnd={props.markerEnd}
        interactionWidth={24}
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
      {props.selected && props.data?.connection ? (
        <EdgeLabelRenderer>
          <EdgeControls
            id={props.id}
            connection={props.data.connection as ConnectionRef}
            sourceNode={props.source}
            targetNode={props.target}
            x={x}
            sourceY={props.sourceY}
            targetY={props.targetY}
            disabled={!!props.data.readOnly}
          />
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
        minWidth={40}
        minHeight={40}
        maxWidth={3000}
        maxHeight={3000}
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
