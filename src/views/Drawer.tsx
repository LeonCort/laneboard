import { JourneyList, TargetReview } from "../ui/Workflow";
import {
  serviceStatus,
  targetState,
  frictionReference,
  flowAssessment,
  capabilityName,
} from "../model/analysis";
import { useState } from "react";
import { X, Printer, Download, ArrowRight } from "lucide-react";
import { useStore, currentJourney, type Selection } from "../store";

import { useT } from "../i18n";
import { evaluateService, visibleSteps, kpis } from "../rules";
import { statuses, type Status } from "../model/schema";
import { exportCSV } from "../io/export";
export type Tab =
  "services" | "frictions" | "capabilities" | "steps" | "comparison";
export function Drawer({
  tab,
  setTab,
  onClose,
  onSelect,
  fullPage = false,
}: {
  fullPage?: boolean;
  tab: Tab;
  setTab: (v: Tab) => void;
  onClose: () => void;
  onSelect: (s: Selection) => void;
}) {
  const s = useStore(),
    t = useT(),
    j = currentJourney(s),
    [height, setHeight] = useState(320);
  if (!j) return null;
  const mode = s.workspace.ui.mode,
    metric = kpis(j, mode),
    disabled =
      j.readOnly || (mode === "target" && targetState(j) === "not-started"),
    digital = j.lanes.filter((l) => l.channel?.type === "digital"),
    results = j.services.map((service) => ({
      service,
      ...evaluateService(service, j, mode),
    }));
  const caps = [...new Set(results.flatMap((r) => r.capabilities))];
  return (
    <section
      className={`lb-island lb-drawer ${fullPage ? "lb-data-page" : "lb-drawer-position"}`}
      aria-label="Journey data"
      style={fullPage ? undefined : { height }}
    >
      {!fullPage ? (
        <div
          className="lb-drawer__handle"
          role="separator"
          aria-label="Resize data drawer"
          aria-orientation="horizontal"
          aria-valuenow={height}
          aria-valuemin={180}
          aria-valuemax={800}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") setHeight((h) => Math.min(800, h + 40));
            if (e.key === "ArrowDown") setHeight((h) => Math.max(180, h - 40));
          }}
          onPointerDown={(e) => {
            const start = e.clientY,
              initial = height;
            const move = (ev: PointerEvent) =>
              setHeight(
                Math.max(
                  180,
                  Math.min(
                    window.innerHeight - 100,
                    initial + start - ev.clientY,
                  ),
                ),
              );
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        />
      ) : null}
      <div className="lb-data-scope lb-caps">
        {j.title} · {t(mode)}
      </div>
      <p className="lb-data-scope lb-field__hint">
        {t("serviceFriction")}:{" "}
        <span data-testid="kpi-serviceFriction">
          {metric.servicesWithFriction}
        </span>{" "}
        · {t("coverage")}:{" "}
        {metric.applicable
          ? `${metric.coverage}% (${metric.native}/${metric.applicable})`
          : t("unknown")}{" "}
        · {t("unknownCount")}: {metric.unknown} · {t("excludedCount")}:{" "}
        {metric.excluded}
      </p>
      <div className="lb-drawer__head">
        <div className="lb-tabs" role="tablist" aria-label="Data views">
          {(
            [
              "steps",
              "services",
              "frictions",
              "capabilities",
              "comparison",
            ] as const
          ).map((key) => (
            <button
              key={key}
              role="tab"
              className="lb-tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
            >
              {t(key)}
              <span className="lb-tab__count">
                {key === "comparison"
                  ? ""
                  : key === "capabilities"
                    ? caps.length
                    : key === "steps"
                      ? visibleSteps(j, mode).length
                      : j[key].length}
              </span>
            </button>
          ))}
        </div>
        <div className="lb-dialog-actions">
          {tab === "services" || tab === "frictions" ? (
            <>
              <button
                className="lb-btn lb-btn--sm"
                onClick={() => exportCSV(tab, j, mode)}
              >
                <Download size={14} />
                CSV
              </button>
              <button
                className="lb-btn lb-btn--sm"
                onClick={() => window.print()}
              >
                <Printer size={14} />
                {t("print")}
              </button>
            </>
          ) : null}
          <button
            className="lb-iconbtn"
            aria-label={t("close")}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
      </div>
      <div className="lb-drawer__body" role="tabpanel" aria-label={t(tab)}>
        {tab === "services" ? (
          <table className="lb-table">
            <thead>
              <tr>
                <th>
                  {t("name")} / {t("description")}
                </th>
                <th>{t("flowAssessment")}</th>
                <th>{t("links")}</th>
                {digital.map((l) => (
                  <th key={l.id}>{l.name}</th>
                ))}
                <th>{t("frictions")}</th>
                <th>{t("capabilities")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.service.id}
                  aria-selected={s.selection?.id === r.service.id}
                >
                  <td>
                    <button
                      className="lb-row-link"
                      onClick={() =>
                        onSelect({ kind: "service", id: r.service.id })
                      }
                    >
                      {r.service.name}
                    </button>
                    <p className="lb-table-description">
                      {r.service.description}
                    </p>
                  </td>
                  <td>
                    <select
                      className="lb-select"
                      aria-label={`${r.service.name} flow connection`}
                      value={flowAssessment(r.service)}
                      disabled={disabled || r.service.linksTo.length > 0}
                      onChange={(e) =>
                        s.editJourney((j) => {
                          const x = j.services.find(
                            (x) => x.id === r.service.id,
                          )!;
                          x.flowAssessment = e.target.value as
                            "unknown" | "isolated" | "connected";
                          x.isolated = e.target.value === "isolated";
                        })
                      }
                    >
                      {["unknown", "isolated", "connected"].map((v) => (
                        <option key={v} value={v}>
                          {t(v)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="lb-link-select">
                      {j.services
                        .filter((x) => x.id !== r.service.id)
                        .map((other) => (
                          <label className="lb-check" key={other.id}>
                            <input
                              type="checkbox"
                              checked={r.service.linksTo.includes(other.id)}
                              disabled={disabled}
                              onChange={(e) =>
                                s.editJourney((j) => {
                                  const service = j.services.find(
                                    (x) => x.id === r.service.id,
                                  )!;
                                  service.linksTo = e.target.checked
                                    ? [...service.linksTo, other.id]
                                    : service.linksTo.filter(
                                        (id) => id !== other.id,
                                      );
                                  if (e.target.checked) {
                                    service.isolated = false;
                                    service.flowAssessment = "connected";
                                  }
                                })
                              }
                            />
                            {other.name}
                          </label>
                        ))}
                    </div>
                  </td>
                  {digital.map((l) => (
                    <td key={l.id}>
                      <select
                        className="lb-select"
                        aria-label={`${r.service.name} — ${l.name} status`}
                        value={serviceStatus(j, r.service, mode, l.id)}
                        disabled={disabled}
                        onChange={(e) =>
                          s.editJourney((j) => {
                            j.services.find(
                              (x) => x.id === r.service.id,
                            )!.status[mode][l.id] = e.target.value as Status;
                          })
                        }
                      >
                        {statuses.map((v) => (
                          <option key={v} value={v}>
                            {t(v)}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td>
                    <span className="lb-severity" data-severity={r.severity}>
                      {t(r.severity)}
                    </span>
                    <ul className="lb-rule-list">
                      {r.notes.map((n, i) => (
                        <li className={n.positive ? "is-positive" : ""} key={i}>
                          {n.message}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <div className="lb-chips">
                      {r.capabilities.map((c) => (
                        <span className="lb-tag" key={c}>
                          {s.workspace.capabilities.find((x) => x.id === c)
                            ?.name || capabilityName(c)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === "frictions" ? (
          <table className="lb-table">
            <thead>
              <tr>
                <th>ID / {t("name")}</th>
                <th>
                  {t("phase")} / {t("lane")}
                </th>
                <th>
                  {mode === "now" ? t("currentState") : t("recommendation")}
                </th>
                <th>{t("othersPattern")}</th>
                <th>{t("owner")}</th>
              </tr>
            </thead>
            <tbody>
              {j.frictions.map((f) => (
                <tr
                  key={frictionReference(j, f.id)}
                  aria-selected={s.selection?.id === f.id}
                >
                  <td>
                    <button
                      className="lb-row-link"
                      onClick={() => onSelect({ kind: "friction", id: f.id })}
                    >
                      <span className="lb-tag">
                        {frictionReference(j, f.id)}
                      </span>{" "}
                      {f.title}
                    </button>
                    {f.assumption ? (
                      <span className="lb-tag lb-tag--assumption">
                        {t("assumption")}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {j.phases.find((p) => p.id === f.phase)?.name}
                    <p>{j.lanes.find((l) => l.id === f.lane)?.name}</p>
                  </td>
                  <td>{mode === "now" ? f.now : f.recommendation}</td>
                  <td>{f.othersPattern}</td>
                  <td>
                    <span
                      className="lb-owner-tag"
                      data-owner-index={
                        s.workspace.owners.findIndex((o) => o.id === f.owner) +
                        1
                      }
                    >
                      {s.workspace.owners.find((o) => o.id === f.owner)?.name ||
                        "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === "capabilities" ? (
          <div className="lb-view-grid">
            {caps.map((c) => (
              <div key={c} className="lb-view-card">
                <h3>
                  {s.workspace.capabilities.find((x) => x.id === c)?.name ||
                    capabilityName(c)}
                </h3>
                <p className="lb-field__hint">
                  {
                    s.workspace.capabilities.find((x) => x.id === c)
                      ?.description
                  }
                </p>
                <div className="lb-chips">
                  {results
                    .filter((r) => r.capabilities.includes(c))
                    .map((r) => (
                      <button
                        className="lb-chip"
                        key={r.service.id}
                        onClick={() =>
                          onSelect({ kind: "service", id: r.service.id })
                        }
                      >
                        {r.service.name}
                        <ArrowRight size={12} />
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {tab === "steps" ? <JourneyList /> : null}
        {tab === "comparison" ? <TargetReview j={j} /> : null}
      </div>
    </section>
  );
}
