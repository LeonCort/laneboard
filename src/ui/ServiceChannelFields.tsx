import { useEffect, useRef } from "react";
import type { RuleNote } from "../rules";
import {
  channelPlatform,
  serviceDelivery,
  serviceStatus,
} from "../model/analysis";
import type { Journey, Lane, Mode, Service, Status } from "../model/schema";
import { statuses } from "../model/schema";
import { useStore } from "../store";
import { useT } from "../i18n";
import { Select } from "./fields";

export function ServiceChannelFields({
  journey,
  service,
  lane,
  mode,
  disabled,
  expanded = false,
  notes = [],
}: {
  journey: Journey;
  service: Service;
  lane: Lane;
  mode: Mode;
  disabled: boolean;
  expanded?: boolean;
  notes?: RuleNote[];
}) {
  const t = useT(),
    edit = useStore((s) => s.editJourney),
    status = serviceStatus(journey, service, mode, lane.id),
    delivery = serviceDelivery(journey, service, mode, lane.id),
    web = channelPlatform(lane) === "web",
    referral = status === "info" || status === "browser-link";
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (expanded) details.current?.scrollIntoView({ block: "nearest" });
  }, [expanded]);
  const update = (
    patch: Partial<NonNullable<Service["delivery"]>["now"][string]>,
  ) =>
    edit((j) => {
      const value = j.services.find((s) => s.id === service.id)!;
      value.delivery ??= { now: {}, target: {} };
      const data = (value.delivery[mode][lane.id] ??= {});
      Object.assign(data, patch);
      if (!data.destination) delete data.destination;
    });
  return (
    <div className="lb-service-channel">
      <Select
        label={lane.name}
        value={status}
        disabled={disabled || lane.locked}
        onChange={(v) =>
          edit((j) => {
            j.services.find((s) => s.id === service.id)!.status[mode][lane.id] =
              v as Status;
          })
        }
      >
        {statuses.map((v) => (
          <option key={v} value={v}>
            {t(v)}
          </option>
        ))}
      </Select>
      {referral ? (
        <p className="lb-field__hint">
          {t(status === "browser-link" ? "browserLinkHint" : "informationHint")}
        </p>
      ) : null}
      {web || referral ? (
        <details
          ref={details}
          open={expanded || status === "browser-link"}
          className="lb-channel-details"
        >
          <summary>
            {lane.name} · {t("deliveryDetails")}
          </summary>
          {referral ? (
            <>
              <Select
                label={`${lane.name} — ${t("browserDestination")}`}
                value={delivery.destination}
                disabled={disabled || lane.locked}
                onChange={(destination) => update({ destination })}
              >
                <option value="">{t("chooseDestination")}</option>
                {journey.lanes
                  .filter(
                    (l) => l.id !== lane.id && channelPlatform(l) === "web",
                  )
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ·{" "}
                      {t(serviceStatus(journey, service, mode, l.id))}
                    </option>
                  ))}
              </Select>
              {delivery.destination ? (
                <button
                  className="lb-btn lb-btn--sm"
                  onClick={() =>
                    useStore.getState().select({
                      kind: "service",
                      id: service.id,
                      lane: delivery.destination,
                      phase: service.phase,
                    })
                  }
                >
                  {t("editDestination")}
                </button>
              ) : null}
            </>
          ) : null}
          {web ? (
            <>
              <p className="lb-field__hint">{t("webCharacteristicsHint")}</p>
              <Select
                label={`${lane.name} — ${t("webSystem")}`}
                value={delivery.system}
                disabled={disabled || lane.locked}
                onChange={(system) =>
                  update({ system: system as "unknown" | "legacy" | "modern" })
                }
              >
                {["unknown", "legacy", "modern"].map((v) => (
                  <option key={v} value={v}>
                    {t(v)}
                  </option>
                ))}
              </Select>
              <Select
                label={`${lane.name} — ${t("responsiveness")}`}
                value={delivery.responsive}
                disabled={disabled || lane.locked}
                onChange={(responsive) =>
                  update({ responsive: responsive as "unknown" | "yes" | "no" })
                }
              >
                <option value="unknown">{t("unknown")}</option>
                <option value="yes">{t("responsiveYes")}</option>
                <option value="no">{t("responsiveNo")}</option>
              </Select>
            </>
          ) : null}
          {notes.length ? (
            <div className="lb-handoff-assessment" role="status">
              {notes.map((note, i) => (
                <p key={i} data-severity={note.severity}>
                  {note.message}
                </p>
              ))}
            </div>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
