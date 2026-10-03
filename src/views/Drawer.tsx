import { useState, useRef } from "react";
import {
  X,
  Printer,
  Download,
  ChevronUp,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { useStore, currentJourney, type Selection } from "../store";
import { reorder } from "../store/actions";
import { useT } from "../i18n";
import { evaluateService, visibleSteps } from "../rules";
import { statuses, transitions, type Status } from "../model/schema";
import { exportCSV } from "../io/export";
export type Tab =
  "services" | "frictions" | "capabilities" | "steps" | "overview";
export function Drawer({
  tab,
  setTab,
  onClose,
  onSelect,
}: {
  tab: Tab;
  setTab: (v: Tab) => void;
  onClose: () => void;
  onSelect: (s: Selection) => void;
}) {
  const s = useStore(),
    t = useT(),
    j = currentJourney(s),
    [height, setHeight] = useState(320),
    [diagram, setDiagram] = useState(0),
    drag = useRef("");
  if (!j) return null;
  const mode = s.workspace.ui.mode,
    disabled = j.readOnly,
    digital = j.lanes.filter((l) => l.channel?.type === "digital"),
    results = j.services.map((service) => ({
      service,
      ...evaluateService(service, j, mode),
    }));
  const caps = [...new Set(results.flatMap((r) => r.capabilities))];
  return (
    <section
      className="lb-island lb-drawer lb-drawer-position"
      aria-label="Journey data"
      style={{ height }}
    >
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
      <div className="lb-drawer__head">
        <div className="lb-tabs" role="tablist" aria-label="Data views">
          {(
            [
              "services",
              "frictions",
              "capabilities",
              "steps",
              "overview",
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
              {key !== "overview" ? (
                <span className="lb-tab__count">
                  {key === "capabilities"
                    ? caps.length
                    : key === "steps"
                      ? visibleSteps(j, mode).length
                      : j[key].length}
                </span>
              ) : null}
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
                <th>{t("isolated")}</th>
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
                    <input
                      aria-label={`${r.service.name} isolated`}
                      type="checkbox"
                      checked={r.service.isolated}
                      disabled={disabled || r.service.linksTo.length > 0}
                      onChange={(e) =>
                        s.editJourney((j) => {
                          j.services.find(
                            (x) => x.id === r.service.id,
                          )!.isolated = e.target.checked;
                        })
                      }
                    />
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
                                  if (e.target.checked)
                                    service.isolated = false;
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
                        value={r.service.status[mode][l.id] ?? "na"}
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
                          <b>{n.rule}</b> {n.message}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <div className="lb-chips">
                      {r.capabilities.map((c) => (
                        <span className="lb-tag" key={c}>
                          {s.workspace.capabilities.find((x) => x.id === c)
                            ?.name || c}
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
                <tr key={f.id} aria-selected={s.selection?.id === f.id}>
                  <td>
                    <button
                      className="lb-row-link"
                      onClick={() => onSelect({ kind: "friction", id: f.id })}
                    >
                      <span className="lb-tag">{f.id}</span> {f.title}
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
                  {s.workspace.capabilities.find((x) => x.id === c)?.name || c}
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
        {tab === "steps" ? (
          <table className="lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("steps")}</th>
                <th>
                  {t("lane")} / {t("phase")}
                </th>
                <th>
                  {t("transition")} · {t(mode)}
                </th>
                <th>
                  {t("notes")} · {t(mode)}
                </th>
                <th>{t("order")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleSteps(j, mode).map((step, i) => (
                <tr
                  key={step.id}
                  aria-selected={s.selection?.id === step.id}
                  draggable={!disabled}
                  onDragStart={() => {
                    drag.current = step.id;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() =>
                    s.editJourney((j) =>
                      reorder(
                        j.steps,
                        j.steps.findIndex((x) => x.id === drag.current),
                        j.steps.findIndex((x) => x.id === step.id),
                      ),
                    )
                  }
                >
                  <td>{i + 1}</td>
                  <td>
                    <button
                      className="lb-row-link"
                      onClick={() => onSelect({ kind: "step", id: step.id })}
                    >
                      {mode === "target"
                        ? step.textTarget || step.text
                        : step.text}
                    </button>
                  </td>
                  <td>
                    {j.lanes.find((l) => l.id === step.lane)?.name}
                    <p>{j.phases.find((p) => p.id === step.phase)?.name}</p>
                  </td>
                  <td>
                    <select
                      className="lb-select"
                      aria-label={`${step.text} transition`}
                      disabled={disabled}
                      value={step.transition[mode] || "channel-switch"}
                      onChange={(e) =>
                        s.editJourney((j) => {
                          j.steps.find((x) => x.id === step.id)!.transition[
                            mode
                          ] = e.target.value as (typeof transitions)[number];
                        })
                      }
                    >
                      {transitions.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <textarea
                      className="lb-textarea"
                      aria-label={`${step.text} notes`}
                      disabled={disabled}
                      value={step.notes[mode] || ""}
                      onChange={(e) =>
                        s.editJourney((j) => {
                          j.steps.find((x) => x.id === step.id)!.notes[mode] =
                            e.target.value;
                        })
                      }
                    />
                  </td>
                  <td>
                    <div className="lb-dialog-actions">
                      <button
                        className="lb-iconbtn"
                        disabled={disabled}
                        aria-label={t("moveUp")}
                        onClick={() =>
                          s.editJourney((j) => {
                            const index = j.steps.findIndex(
                              (x) => x.id === step.id,
                            );
                            reorder(j.steps, index, index - 1);
                          })
                        }
                      >
                        <ChevronUp />
                      </button>
                      <button
                        className="lb-iconbtn"
                        disabled={disabled}
                        aria-label={t("moveDown")}
                        onClick={() =>
                          s.editJourney((j) => {
                            const index = j.steps.findIndex(
                              (x) => x.id === step.id,
                            );
                            reorder(j.steps, index, index + 1);
                          })
                        }
                      >
                        <ChevronDown />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {tab === "overview" ? (
          <>
            <div className="lb-overview-diagram">
              <div className="lb-segmented">
                {[t("silos"), t("crossCutting"), t("sharedGoal")].map(
                  (label, i) => (
                    <button
                      key={i}
                      aria-pressed={diagram === i}
                      onClick={() => setDiagram(i)}
                    >
                      {label}
                    </button>
                  ),
                )}
              </div>
              <div className="lb-silo-row">
                {[
                  "Products",
                  "Private banking",
                  "Business banking",
                  "Channels",
                  "Service & advice",
                  "Technology",
                ].map((label) => (
                  <div className="lb-silo" key={label}>
                    {label}
                    <span>
                      {diagram === 0
                        ? t("localObjectives")
                        : diagram === 1
                          ? t("connectedFunction")
                          : j.goal || t("oneJourneyLabel")}
                    </span>
                  </div>
                ))}
              </div>
              {diagram > 0 ? (
                <div className="lb-cross-cutting">
                  {diagram === 1
                    ? t("experienceFunction")
                    : j.goal || t("sharedGoal")}
                </div>
              ) : null}
            </div>
            <div className="lb-view-grid">
              {s.workspace.owners.map((o, i) => (
                <div className="lb-view-card" key={o.id}>
                  <span className="lb-owner-tag" data-owner-index={(i % 6) + 1}>
                    {o.name}
                  </span>
                  <p className="lb-field__hint">{o.description}</p>
                  {j.frictions
                    .filter((f) => f.owner === o.id)
                    .map((f) => (
                      <button
                        className="lb-row-link"
                        key={f.id}
                        onClick={() => onSelect({ kind: "friction", id: f.id })}
                      >
                        {f.id} · {f.title}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
