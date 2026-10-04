import { useId, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Eye, EyeOff, Pencil, Plus, X } from "lucide-react";
import { useT } from "../i18n";
import type { Journey, Lane } from "../model/schema";
import { useStore } from "../store";
import { createLane, setLaneHidden, updateLane } from "../store/actions";
import { Field, Select } from "../ui/fields";

type LaneType = Exclude<Lane["kind"], "channel"> | "digital" | "assisted";

function initialType(journey: Journey, group: string | null): LaneType {
  if (group === null) return "digital";
  const counts = new Map<LaneType, number>();
  journey.lanes
    .filter((l) => l.group === group)
    .forEach((lane) => {
      const type =
        lane.kind === "channel" ? lane.channel?.type || "digital" : lane.kind;
      counts.set(type, (counts.get(type) || 0) + 1);
    });
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "digital";
}

function LaneForm({
  journey,
  lane,
  group,
  close,
  reveal,
}: {
  journey: Journey;
  lane?: Lane;
  group: string | null;
  close: () => void;
  reveal?: (id: string) => void;
}) {
  const t = useT(),
    titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(lane?.name || "");
  const [sub, setSub] = useState(lane?.sub || "");
  const [groupId, setGroupId] = useState(group || "");
  const [kind, setKind] = useState<LaneType>(() => initialType(journey, group));
  const disabled = journey.readOnly;
  return (
    <Popover.Content
      className="lb-lane-popover"
      side="right"
      align="start"
      sideOffset={10}
      collisionPadding={12}
      aria-labelledby={titleId}
      onOpenAutoFocus={(e) => {
        if (disabled) return;
        e.preventDefault();
        const input = formRef.current?.querySelector<HTMLInputElement>("input");
        input?.focus();
        input?.select();
      }}
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled || !name.trim()) return;
          const draft = { name, sub, group: groupId || null };
          let id = lane?.id;
          if (lane) updateLane(lane.id, draft);
          else
            id = createLane({
              ...draft,
              kind:
                kind === "digital" || kind === "assisted" ? "channel" : kind,
              channel:
                kind === "digital"
                  ? {
                      type: "digital",
                      authenticated: false,
                      webviewHost: false,
                    }
                  : kind === "assisted"
                    ? { type: "assisted" }
                    : undefined,
            });
          close();
          if (id) reveal?.(id);
        }}
      >
        <div className="lb-lane-popover__heading">
          <h2 id={titleId}>{t(lane ? "editLane" : "addLane")}</h2>
          <Popover.Close
            className="lb-iconbtn"
            aria-label={t("close")}
            type="button"
          >
            <X size={16} />
          </Popover.Close>
        </div>
        {disabled ? (
          <>
            <p className="lb-micro">{t("readOnly")}</p>
            <button
              type="button"
              className="lb-btn lb-btn--primary"
              onClick={() => {
                close();
                useStore.getState().duplicateJourney();
              }}
            >
              {t("duplicate")}
            </button>
          </>
        ) : null}
        <Field
          label={t("name")}
          value={name}
          onChange={setName}
          disabled={disabled}
        />
        <Field
          label={t("subtitle")}
          value={sub}
          onChange={setSub}
          disabled={disabled}
        />
        <Select
          label={t("laneGroup")}
          value={groupId}
          onChange={(v) => {
            setGroupId(v);
            if (!lane) setKind(initialType(journey, v || null));
          }}
          disabled={disabled}
        >
          <option value="">{t("ungrouped")}</option>
          {journey.laneGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        {!lane ? (
          <Select
            label={t("laneKind")}
            value={kind}
            onChange={(v) => setKind(v as LaneType)}
          >
            <option value="customer">{t("customerLane")}</option>
            <option value="entry">{t("entryLane")}</option>
            <option value="digital">{t("digitalLane")}</option>
            <option value="assisted">{t("assistedLane")}</option>
            <option value="backstage">{t("backstageLane")}</option>
            <option value="market">{t("marketLane")}</option>
          </Select>
        ) : null}
        <div className="lb-lane-popover__footer">
          {lane ? (
            <button
              type="button"
              className="lb-btn lb-btn--ghost"
              disabled={disabled || !name.trim()}
              onClick={() => {
                close();
                updateLane(lane.id, {
                  name,
                  sub,
                  group: groupId || null,
                  hidden: true,
                });
                requestAnimationFrame(() =>
                  document
                    .querySelector<HTMLButtonElement>(
                      "[data-hidden-lanes-trigger]",
                    )
                    ?.focus(),
                );
              }}
            >
              <EyeOff size={14} />
              {t("hideLane")}
            </button>
          ) : null}
          <Popover.Close type="button" className="lb-btn lb-btn--ghost">
            {t("cancel")}
          </Popover.Close>
          <button
            type="submit"
            className="lb-btn lb-btn--primary"
            disabled={disabled || !name.trim()}
          >
            {t(lane ? "save" : "addLane")}
          </button>
        </div>
      </form>
    </Popover.Content>
  );
}

export function LaneLabel({
  journey,
  lane,
  reveal,
}: {
  journey: Journey;
  lane: Lane;
  reveal?: (id: string) => void;
}) {
  const t = useT(),
    [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="lb-lane-title lb-lane-title--editable"
        data-lane-label={lane.id}
        aria-label={`${t("editLane")} ${lane.name}`}
        title={`${t("editLane")} ${lane.name}`}
        data-selected={open}
        onClick={() =>
          useStore.getState().select({ kind: "lane", id: lane.id })
        }
      >
        {lane.name}
        <Pencil size={12} className="lb-lane-edit-icon" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <LaneForm
          journey={journey}
          lane={lane}
          group={lane.group}
          close={() => setOpen(false)}
          reveal={reveal}
        />
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AddLaneButton({
  journey,
  group = null,
  compact = false,
  reveal,
}: {
  journey: Journey;
  group?: string | null;
  compact?: boolean;
  reveal?: (id: string) => void;
}) {
  const t = useT(),
    [open, setOpen] = useState(false);
  const groupName = journey.laneGroups.find((g) => g.id === group)?.name;
  const label = groupName ? `${t("addLaneTo")} ${groupName}` : t("addLane");
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={compact ? "lb-inline-add" : "lb-iconbtn"}
        aria-label={label}
        title={label}
        disabled={journey.readOnly || journey.lanes.length >= 100}
      >
        <Plus size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <LaneForm
          journey={journey}
          group={group}
          close={() => setOpen(false)}
          reveal={reveal}
        />
      </Popover.Portal>
    </Popover.Root>
  );
}

export function HiddenLanesControl({
  journey,
  reveal,
}: {
  journey: Journey;
  reveal?: (id: string) => void;
}) {
  const t = useT(),
    hidden = journey.lanes.filter((l) => l.hidden);
  if (!hidden.length) return null;
  return (
    <Menu.Root>
      <Menu.Trigger
        className="lb-btn lb-btn--ghost lb-hidden-lanes"
        data-hidden-lanes-trigger
        title={`${t("hiddenLanes")} (${hidden.length})`}
        aria-label={`${t("hiddenLanes")} (${hidden.length})`}
      >
        <EyeOff size={14} />
        <span>
          {t("hiddenLanes")} ({hidden.length})
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="lb-popover lb-menu"
          align="start"
          sideOffset={8}
          collisionPadding={12}
        >
          {hidden.map((lane) => (
            <Menu.Item
              key={lane.id}
              className="lb-menu__item"
              disabled={journey.readOnly}
              onSelect={() => {
                setLaneHidden(lane.id, false);
                reveal?.(lane.id);
              }}
            >
              <Eye size={14} />
              {t("show")} {lane.name}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
