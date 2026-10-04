import { useId, useRef, useState } from "react";
import { Handle, Position, useViewport } from "@xyflow/react";
import * as Popover from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, Plus, Search, X } from "lucide-react";
import { currentJourney, useStore } from "../store";
import { setCardLink } from "../store/actions";
import {
  canConnectCards,
  hasCardLink,
  type LinkSource,
  type LinkTarget,
} from "../model/connections";
import { targetState } from "../model/analysis";
import { visibleSteps } from "../rules";
import { useT } from "../i18n";

export function CardLinks({
  source,
  name,
  connectable,
  readOnly,
  receive,
}: {
  source: LinkSource;
  name: string;
  connectable: boolean;
  readOnly: boolean;
  receive: boolean;
}) {
  const t = useT(),
    j = useStore(currentJourney),
    mode = useStore((s) => s.workspace.ui.mode);
  const { zoom } = useViewport();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const titleId = useId(),
    pressed = useRef<{ x: number; y: number } | null>(null),
    dragged = useRef(false);
  if (!j) return null;
  const blocked =
    readOnly || (mode === "target" && targetState(j) === "not-started");
  const targets =
    source.kind === "service"
      ? j.services
          .filter((service) => service.id !== source.id)
          .map((service) => ({
            target: { kind: "service", id: service.id } as LinkTarget,
            name: service.name,
            phase: service.phase,
            lane: undefined as string | undefined,
          }))
      : visibleSteps(j, mode).map((step) => ({
          target: { kind: "step", id: step.id } as LinkTarget,
          name: mode === "target" ? step.textTarget || step.text : step.text,
          phase: step.phase,
          lane: step.lane as string | undefined,
        }));
  return (
    <Popover.Root
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setSearch("");
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="lb-link-handle nodrag nopan lb-canvas-ui"
        isConnectable={connectable && !blocked}
        isConnectableStart={connectable && !blocked}
        isConnectableEnd={receive}
        data-open={open}
        style={{ transform: `translate(50%, -50%) scale(${1 / zoom})` }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`${t("addLinkFrom")} ${name}`}
            title={t(
              blocked
                ? j.readOnly
                  ? "duplicate"
                  : "linkBlocked"
                : "linkGesture",
            )}
            onPointerDown={(e) => {
              pressed.current = { x: e.clientX, y: e.clientY };
              dragged.current = false;
            }}
            onPointerLeave={() => {
              if (pressed.current) dragged.current = true;
            }}
            onPointerUp={(e) => {
              if (
                pressed.current &&
                Math.hypot(
                  e.clientX - pressed.current.x,
                  e.clientY - pressed.current.y,
                ) > 4
              )
                dragged.current = true;
              pressed.current = null;
            }}
            onClick={(e) => {
              e.stopPropagation();
              if ((e.detail > 0 && dragged.current) || e.detail > 1)
                e.preventDefault();
              dragged.current = false;
              pressed.current = null;
            }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <Plus size={16} />
          </button>
        </Popover.Trigger>
      </Handle>
      <Popover.Portal>
        <Popover.Content
          className="lb-popover lb-link-popover nodrag nopan nowheel"
          side="right"
          sideOffset={10}
          aria-labelledby={titleId}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="lb-link-header">
            <strong id={titleId}>
              {t(
                source.kind === "service"
                  ? "linkService"
                  : source.kind === "step"
                    ? "linkSteps"
                    : "linkFeed",
              )}
            </strong>
            <Popover.Close className="lb-iconbtn" aria-label={t("close")}>
              <X size={16} />
            </Popover.Close>
          </div>
          <p className="lb-field__hint">
            {t(
              source.kind === "service"
                ? "linkServiceHint"
                : source.kind === "step"
                  ? "linkStepsHint"
                  : "linkFeedHint",
            )}
          </p>
          {blocked ? (
            <div className="lb-link-blocked">
              <p>{t(j.readOnly ? "readOnly" : "linkBlocked")}</p>
              {j.readOnly ? (
                <button
                  className="lb-btn lb-btn--primary"
                  onClick={() => {
                    const store = useStore.getState();
                    store.duplicateJourney();
                    store.select({ ...source, inline: true });
                  }}
                >
                  {t("duplicate")}
                </button>
              ) : null}
            </div>
          ) : (
            <Command
              className="lb-link-search"
              label={t("findConnection")}
              loop
            >
              <div className="lb-link-search-input">
                <Search size={16} />
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder={t(
                    source.kind === "service"
                      ? "searchServices"
                      : "searchSteps",
                  )}
                  aria-label={t("findConnection")}
                />
              </div>
              <Command.List>
                <Command.Empty>
                  {t(targets.length ? "noResults" : "noConnectionResults")}
                </Command.Empty>
                {targets.map((item) => {
                  const phase =
                      j.phases.find((phase) => phase.id === item.phase)?.name ||
                      "",
                    lane = j.lanes.find((lane) => lane.id === item.lane)?.name;
                  const linked = hasCardLink(j, source, item.target, mode);
                  return (
                    <Command.Item
                      key={item.target.id}
                      value={item.target.id}
                      keywords={[item.name, phase, lane || ""]}
                      disabled={!canConnectCards(j, source, item.target, mode)}
                      onSelect={() => {
                        setCardLink(
                          source,
                          item.target,
                          source.kind === "feed" || !linked,
                        );
                        setOpen(false);
                      }}
                    >
                      <span className="lb-link-result">
                        <span>{item.name}</span>
                        <small>
                          {[phase, lane].filter(Boolean).join(" · ")}
                        </small>
                        {linked ? (
                          <small>
                            {t(
                              source.kind === "service"
                                ? "removeExistingLink"
                                : "currentConnection",
                            )}
                          </small>
                        ) : null}
                      </span>
                      {linked ? (
                        <Check size={16} aria-label={t("linked")} />
                      ) : (
                        <Plus size={16} />
                      )}
                    </Command.Item>
                  );
                })}
              </Command.List>
            </Command>
          )}
          {!blocked ? (
            <p className="lb-field__hint">{t("linkGesture")}</p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
