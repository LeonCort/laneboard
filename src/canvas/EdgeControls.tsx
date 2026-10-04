import { useId, useState } from "react";
import {
  useReactFlow,
  useViewport,
  useStore as useFlowStore,
} from "@xyflow/react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { ArrowLeft, ArrowRight, Search, Trash2, X } from "lucide-react";
import { currentJourney, deleteSelection, useStore } from "../store";
import { reconnectCardLink } from "../store/actions";
import {
  cardSource,
  cardTarget,
  canReconnectConnection,
  connectionEdgeId,
  type ConnectionRef,
} from "../model/connections";
import type { CardData } from "./layout";
import { useT } from "../i18n";

function EndpointPicker({
  end,
  connection,
  sourceNode,
  targetNode,
  disabled,
}: {
  end: "source" | "target";
  connection: ConnectionRef;
  sourceNode: string;
  targetNode: string;
  disabled: boolean;
}) {
  const t = useT(),
    flow = useReactFlow(),
    j = useStore(currentJourney),
    mode = useStore((s) => s.workspace.ui.mode),
    [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [focused, setFocused] = useState(""),
    titleId = useId();
  const label = t(end === "source" ? "changeSource" : "changeDestination");
  const candidates =
    open && j
      ? flow.getNodes().flatMap((node) => {
          if (node.type !== "card") return [];
          const data = node.data as CardData,
            source = end === "source" ? cardSource(data) : connection.source,
            target = end === "target" ? cardTarget(data) : connection.target;
          if (
            !source ||
            !target ||
            !canReconnectConnection(j, connection, source, target, mode)
          )
            return [];
          const lane = j.lanes.find((l) => l.id === data.lane)?.name || "",
            phase = j.phases.find((p) => p.id === data.phase)?.name || "";
          return [{ node, source, target, data, lane, phase }];
        })
      : [];
  const words = search.toLocaleLowerCase().trim().split(/\s+/),
    results = candidates.filter((item) =>
      words.every((word) =>
        `${item.data.text} ${item.lane} ${item.phase}`
          .toLocaleLowerCase()
          .includes(word),
      ),
    );
  const selected = results.some((item) => item.node.id === focused)
    ? focused
    : results[0]?.node.id || "";
  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          setSearch("");
          setFocused("");
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="lb-btn"
          disabled={disabled}
          aria-label={label}
          data-edge-action={end}
        >
          {end === "source" ? (
            <ArrowLeft size={15} />
          ) : (
            <ArrowRight size={15} />
          )}
          {t(end === "source" ? "connectionSource" : "connectionDestination")}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="lb-popover lb-link-popover nodrag nopan nowheel"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={titleId}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="lb-link-header">
            <strong id={titleId}>{label}</strong>
            <Popover.Close className="lb-iconbtn" aria-label={t("close")}>
              <X size={16} />
            </Popover.Close>
          </div>
          <Command
            className="lb-link-search"
            label={t("findConnection")}
            loop
            shouldFilter={false}
            value={selected}
            onValueChange={setFocused}
          >
            <div className="lb-link-search-input">
              <Search size={16} />
              <Command.Input
                autoFocus
                aria-label={t("findConnection")}
                placeholder={t("searchConnectionCards")}
                value={search}
                onValueChange={(value) => {
                  setSearch(value);
                  setFocused("");
                }}
              />
            </div>
            <Command.List>
              <Command.Empty>{t("noConnectionResults")}</Command.Empty>
              {results.map(({ node, data, source, target, lane, phase }) => {
                return (
                  <Command.Item
                    key={node.id}
                    value={node.id}
                    keywords={[data.text, lane, phase]}
                    onSelect={() => {
                      if (reconnectCardLink(connection, source, target)) {
                        const ref = { source, target };
                        useStore.getState().select({
                          kind: "connection",
                          id: connectionEdgeId(
                            end === "source" ? node.id : sourceNode,
                            end === "target" ? node.id : targetNode,
                            ref,
                          ),
                          connection: ref,
                          inline: true,
                        });
                      }
                      setOpen(false);
                    }}
                  >
                    <span className="lb-link-result">
                      <span>{data.text}</span>
                      <small>{[lane, phase].filter(Boolean).join(" · ")}</small>
                    </span>
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function EdgeControls({
  id,
  connection,
  sourceNode,
  targetNode,
  x,
  sourceY,
  targetY,
  disabled,
}: {
  id: string;
  connection: ConnectionRef;
  sourceNode: string;
  targetNode: string;
  x: number;
  sourceY: number;
  targetY: number;
  disabled: boolean;
}) {
  const t = useT(),
    j = useStore(currentJourney),
    flow = useReactFlow(),
    { zoom, x: panX, y: panY } = useViewport(),
    width = useFlowStore((s) => s.width),
    height = useFlowStore((s) => s.height);
  const source = flow.getNode(sourceNode)?.data.text as string | undefined,
    target = flow.getNode(targetNode)?.data.text as string | undefined,
    left =
      (Math.max(160, Math.min(width - 160, x * zoom + panX)) - panX) / zoom,
    below = Math.max(sourceY, targetY) * zoom + panY + 24,
    screenTop =
      below + 110 < height - 80
        ? below
        : Math.max(
            112,
            Math.min(
              height - 190,
              Math.min(sourceY, targetY) * zoom + panY - 134,
            ),
          ),
    top = (screenTop - panY) / zoom;
  return (
    <div
      className="lb-island lb-edge-controls nodrag nopan nowheel lb-canvas-ui"
      data-edge-controls={id}
      role="group"
      aria-label={t("connectionControls")}
      style={{
        transform: `translate(-50%, 0) translate(${left}px,${top}px) scale(${1 / zoom})`,
        transformOrigin: "top center",
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          useStore.getState().select(null);
          e.stopPropagation();
        }
      }}
    >
      <strong
        className="lb-edge-controls__name"
        title={`${source} → ${target}`}
      >
        {source} <span aria-hidden>→</span> {target}
      </strong>
      <p>
        {t(
          disabled
            ? j?.readOnly
              ? "readOnly"
              : "linkBlocked"
            : "editConnectionHint",
        )}
      </p>
      <div className="lb-edge-controls__actions">
        <EndpointPicker
          end="source"
          connection={connection}
          sourceNode={sourceNode}
          targetNode={targetNode}
          disabled={disabled}
        />
        <EndpointPicker
          end="target"
          connection={connection}
          sourceNode={sourceNode}
          targetNode={targetNode}
          disabled={disabled}
        />
        <button
          type="button"
          className="lb-iconbtn lb-edge-controls__delete"
          disabled={disabled}
          aria-label={t("deleteConnection")}
          title={t("deleteConnection")}
          onClick={deleteSelection}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
