import { ServiceChannelFields } from "../ui/ServiceChannelFields";
import { EvidenceFields } from "../ui/Workflow";
import {
  targetState,
  flowAssessment,
  channelPlatform,
  clearServiceLane,
} from "../model/analysis";
import {
  X,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Lock,
  Layers,
} from "lucide-react";
import {
  useStore,
  currentJourney,
  deleteSelection,
  type Selection,
} from "../store";
import {
  duplicateCards,
  removeStructure,
  reorder,
  reorderPhase,
  setCardLink,
} from "../store/actions";
import { useT, type Key } from "../i18n";
import { Field, Select, Check } from "../ui/fields";
import { kpis, evaluateService } from "../rules";
import { transitions, layers, type Lane, type Journey } from "../model/schema";
export function Inspector({
  confirm,
  ownerFilter = "",
  onOwnerFilter,
}: {
  confirm: (title: string, fn: () => void) => void;
  ownerFilter?: string;
  onOwnerFilter?: (id: string) => void;
}) {
  const s = useStore(),
    t = useT(),
    j = currentJourney(s),
    sel = s.selection,
    mode = s.workspace.ui.mode;
  if (!j || sel?.kind === "connection") return null;
  const edit = s.editJourney,
    disabled =
      j.readOnly || (mode === "target" && targetState(j) === "not-started");
  const entity =
    sel?.kind === "service"
      ? j.services.find((x) => x.id === sel.id)
      : sel?.kind === "step"
        ? j.steps.find((x) => x.id === sel.id)
        : sel?.kind === "friction"
          ? j.frictions.find((x) => x.id === sel.id)
          : sel?.kind === "feed"
            ? j.feeds.find((x) => x.id === sel.id)
            : sel?.kind === "note"
              ? j.notes.find((x) => x.id === sel.id)
              : sel?.kind === "sketch"
                ? j.sketches.find((x) => x.id === sel.id)
                : sel?.kind === "lane"
                  ? j.lanes.find((x) => x.id === sel.id)
                  : sel?.kind === "phase"
                    ? j.phases.find((x) => x.id === sel.id)
                    : sel?.kind === "group"
                      ? j.laneGroups.find((x) => x.id === sel.id)
                      : undefined;
  const name =
    entity &&
    ("name" in entity
      ? entity.name
      : "title" in entity
        ? entity.title
        : "text" in entity
          ? entity.text
          : "");
  const capabilityName = (id: string) =>
    ({
      webview: "Embedded web experience",
      "context-sharing": "Shared customer context",
      "deep-linking": "Direct links to tasks",
      "session-handover": "Session handover",
    })[id as "webview"] || id.replaceAll("-", " ");
  const title = sel
    ? sel.kind === "journey"
      ? j.title
      : name || t("selected")
    : j.title;
  const metric = kpis(j, mode);
  const remove = () => {
    if (!sel) return;
    if (["lane", "phase", "group"].includes(sel.kind))
      confirm(`${t("delete")} ${title}`, () => removeStructure(sel));
    else deleteSelection();
  };
  return (
    <aside
      className="lb-island lb-inspector lb-inspector-position"
      aria-label="Inspector"
    >
      <div className="lb-inspector__head">
        <div>
          <div className="lb-caps lb-inspector__kind">
            {sel ? sel.kind : t("journey")}
          </div>
          <div className="lb-inspector__title">{title}</div>
        </div>
        {sel ? (
          <button
            className="lb-iconbtn"
            aria-label={t("close")}
            onClick={() => s.select(null)}
          >
            <X />
          </button>
        ) : (
          <Layers size={16} />
        )}
      </div>
      {disabled ? (
        <div className="lb-inspector__section">
          <span className="lb-tag">{t("readOnly")}</span>
          <button
            className="lb-btn lb-btn--primary"
            onClick={s.duplicateJourney}
          >
            <Copy size={14} />
            {t("duplicate")}
          </button>
        </div>
      ) : null}
      {!sel || sel.kind === "journey" ? (
        <>
          <section className="lb-inspector__section">
            <Field
              label={t("name")}
              value={j.title}
              onChange={(v) =>
                edit((j) => {
                  j.title = v;
                })
              }
              disabled={disabled}
            />
            <Field
              label={t("goal")}
              value={j.goal}
              onChange={(v) =>
                edit((j) => {
                  j.goal = v;
                })
              }
              disabled={disabled}
              multiline
            />
            {sel?.kind === "journey" ? (
              <>
                <Field
                  label={t("description")}
                  value={j.description}
                  onChange={(v) =>
                    edit((j) => {
                      j.description = v;
                    })
                  }
                  disabled={disabled}
                  multiline
                />
                <Field
                  label={t("segment")}
                  value={j.segment}
                  onChange={(v) =>
                    edit((j) => {
                      j.segment = v;
                    })
                  }
                  disabled={disabled}
                />
              </>
            ) : null}
            <div className="lb-two-fields">
              <Field
                label={t("baseline")}
                value={j.baseline}
                onChange={(v) =>
                  edit((j) => {
                    j.baseline = v;
                  })
                }
                disabled={disabled}
              />
              <Field
                label={t("targetMetric")}
                value={j.targetMetric}
                onChange={(v) =>
                  edit((j) => {
                    j.targetMetric = v;
                  })
                }
                disabled={disabled}
              />
            </div>
          </section>
          <section className="lb-inspector__section">
            {(
              [
                "customer",
                "situation",
                "hypothesis",
                "testPlan",
                "nextAction",
              ] as const
            ).map((key) => (
              <Field
                key={key}
                label={t(key)}
                value={j[key]}
                multiline
                disabled={disabled}
                onChange={(v) =>
                  edit((j) => {
                    j[key] = v;
                  })
                }
              />
            ))}
            <Select
              label={t("validationOwner")}
              value={j.validationOwner || ""}
              disabled={disabled}
              onChange={(v) =>
                edit((j) => {
                  j.validationOwner = v || undefined;
                })
              }
            >
              <option value="">{t("none")}</option>
              {s.workspace.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <EvidenceFields
              item={j}
              disabled={disabled}
              onChange={(v) => edit((j) => Object.assign(j, v))}
            />
          </section>
          <section className="lb-inspector__section">
            <span className="lb-inspector__label">{t("layers")}</span>
            <div className="lb-chips">
              {layers.map((l) => (
                <button
                  key={l}
                  className="lb-chip"
                  aria-pressed={s.workspace.ui.layers.includes(l)}
                  onClick={() => s.toggleLayer(l)}
                >
                  <span className="lb-chip__box" />
                  {t(l)}
                </button>
              ))}
            </div>
          </section>
          {s.workspace.ui.layers.includes("owners") ? (
            <section className="lb-inspector__section">
              <span className="lb-inspector__label">{t("owners")}</span>
              <div className="lb-chips">
                {s.workspace.owners.map((o, i) => (
                  <button
                    className="lb-chip"
                    key={o.id}
                    data-owner-index={(i % 6) + 1}
                    aria-pressed={ownerFilter === o.id}
                    onClick={() =>
                      onOwnerFilter?.(ownerFilter === o.id ? "" : o.id)
                    }
                  >
                    <span className="lb-owner-tag">{o.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <section className="lb-inspector__section">
            <div className="lb-stats">
              {(
                [
                  ["restarts", metric.restarts],
                  [
                    "coverage",
                    metric.applicable ? `${metric.coverage}%` : t("unknown"),
                  ],
                  ["serviceFriction", metric.servicesWithFriction],
                  ["frictions", metric.frictions],
                  ["channels", metric.channels],
                ] as [Key, string | number][]
              ).map(([key, value]) => (
                <div className="lb-stat" key={key}>
                  <span className="lb-stat__label">{t(key)}</span>
                  <strong className="lb-stat__value" data-testid={`kpi-${key}`}>
                    {value}
                  </strong>
                </div>
              ))}
            </div>
            <span className="lb-field__hint">
              {metric.native} / {metric.applicable} applicable service statuses
              are native.
            </span>
          </section>
          <section className="lb-inspector__section">
            <p className="lb-field__hint">{t("noSelection")}</p>
          </section>
        </>
      ) : null}
      {sel?.kind === "cell" ? (
        <section className="lb-inspector__section">
          <Field
            label={t("notes")}
            value={
              j.cells[sel.lane || ""]?.[
                j.phases.findIndex((p) => p.id === sel.phase)
              ] || ""
            }
            onChange={(v) =>
              edit((j) => {
                const i = j.phases.findIndex((p) => p.id === sel.phase),
                  lane = sel.lane!;
                j.cells[lane] ??= j.phases.map(() => "");
                j.cells[lane][i] = v;
              })
            }
            multiline
            disabled={disabled}
          />
        </section>
      ) : null}
      {entity && sel ? (
        <section className="lb-inspector__section">
          {"name" in entity ? (
            <Field
              label={t("name")}
              value={entity.name}
              onChange={(v) =>
                edit((j) => {
                  const x = findEntity(j, sel);
                  if (x && "name" in x) x.name = v;
                })
              }
              disabled={disabled}
            />
          ) : null}
          {"text" in entity ? (
            <Field
              label={sel.kind === "step" ? t("journey") : t("notes")}
              value={entity.text}
              onChange={(v) =>
                edit((j) => {
                  const x = findEntity(j, sel);
                  if (x && "text" in x) x.text = v;
                })
              }
              multiline
              disabled={disabled}
            />
          ) : null}
          {"title" in entity ? (
            <Field
              label={t("name")}
              value={entity.title}
              onChange={(v) =>
                edit((j) => {
                  const x = j.frictions.find((x) => x.id === sel.id);
                  if (x) x.title = v;
                })
              }
              disabled={disabled}
            />
          ) : null}
          {"description" in entity ? (
            <Field
              label={t("description")}
              value={entity.description}
              onChange={(v) =>
                edit((j) => {
                  const x = j.services.find((x) => x.id === sel.id);
                  if (x) x.description = v;
                })
              }
              multiline
              disabled={disabled}
            />
          ) : null}
          {"phase" in entity ? (
            <Select
              label={t("phase")}
              value={entity.phase}
              onChange={(v) =>
                edit((j) => {
                  const x = findEntity(j, sel);
                  if (x && "phase" in x) x.phase = v;
                })
              }
              disabled={disabled}
            >
              {j.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          ) : null}
          {"lane" in entity ? (
            <Select
              label={t("lane")}
              value={entity.lane}
              onChange={(v) =>
                edit((j) => {
                  const x = findEntity(j, sel);
                  if (x && "lane" in x) x.lane = v;
                })
              }
              disabled={disabled}
            >
              {j.lanes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          ) : null}
          {["lane", "service", "step", "friction"].includes(sel.kind) ? (
            <EvidenceFields
              item={
                entity as {
                  evidence?: "unknown" | "assumed" | "validated";
                  evidenceNotes?: string;
                  assumption?: boolean;
                }
              }
              disabled={disabled}
              onChange={(v) =>
                edit((j) => {
                  const x = findEntity(j, sel);
                  if (x) Object.assign(x, v);
                })
              }
            />
          ) : null}
          {sel.kind === "service"
            ? (() => {
                const service = j.services.find((x) => x.id === sel.id)!;
                const result = evaluateService(service, j, mode);
                return (
                  <>
                    <Select
                      label={t("flowAssessment")}
                      value={flowAssessment(service)}
                      disabled={disabled || service.linksTo.length > 0}
                      onChange={(v) =>
                        edit((j) => {
                          const x = j.services.find((x) => x.id === sel.id)!;
                          x.flowAssessment = v as
                            "unknown" | "isolated" | "connected";
                          x.isolated = v === "isolated";
                        })
                      }
                    >
                      {["unknown", "isolated", "connected"].map((v) => (
                        <option key={v} value={v}>
                          {t(v)}
                        </option>
                      ))}
                    </Select>
                    <span className="lb-caps">{t("links")}</span>
                    {j.services
                      .filter((x) => x.id !== sel.id)
                      .map((other) => (
                        <Check
                          key={other.id}
                          label={other.name}
                          checked={service.linksTo.includes(other.id)}
                          disabled={disabled}
                          onChange={(v) =>
                            setCardLink(
                              { kind: "service", id: sel.id, lane: sel.lane },
                              { kind: "service", id: other.id },
                              v,
                            )
                          }
                        />
                      ))}
                    <span className="lb-caps">
                      {t("status")} · {t(mode)}
                    </span>
                    {j.lanes
                      .filter((l) => l.channel?.type === "digital")
                      .map((l) => (
                        <ServiceChannelFields
                          key={l.id}
                          journey={j}
                          service={service}
                          lane={l}
                          mode={mode}
                          disabled={disabled}
                          expanded={sel.lane === l.id}
                          notes={result.notes.filter(
                            (n) =>
                              n.sourceLane === l.id ||
                              n.destinationLane === l.id,
                          )}
                        />
                      ))}
                    <span
                      className="lb-severity"
                      data-severity={result.severity}
                    >
                      {t(result.severity)}
                    </span>
                    <span className="lb-caps">{t("automaticChecks")}</span>
                    <ul className="lb-rule-list">
                      {result.notes.map((n, i) => (
                        <li key={i}>{n.message}</li>
                      ))}
                    </ul>
                    <span className="lb-caps">{t("capabilities")}</span>
                    <div className="lb-chips">
                      {result.capabilities.map((c) => (
                        <span className="lb-tag" key={c}>
                          {s.workspace.capabilities.find((x) => x.id === c)
                            ?.name || capabilityName(c)}
                        </span>
                      ))}
                    </div>
                    {s.workspace.capabilities.map((c) => (
                      <Check
                        key={c.id}
                        label={c.name}
                        checked={service.capabilities.includes(c.id)}
                        disabled={disabled}
                        onChange={(v) =>
                          edit((j) => {
                            const x = j.services.find((x) => x.id === sel.id)!;
                            x.capabilities = v
                              ? [...x.capabilities, c.id]
                              : x.capabilities.filter((id) => id !== c.id);
                          })
                        }
                      />
                    ))}
                  </>
                );
              })()
            : null}
          {sel.kind === "step"
            ? (() => {
                const step = j.steps.find((x) => x.id === sel.id)!;
                return (
                  <>
                    <Field
                      label={t("targetText")}
                      value={step.textTarget || ""}
                      onChange={(v) =>
                        edit((j) => {
                          j.steps.find((x) => x.id === sel.id)!.textTarget = v;
                        })
                      }
                      disabled={disabled}
                      multiline
                    />
                    <Select
                      label={t("mode")}
                      value={step.in}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.steps.find((x) => x.id === sel.id)!.in = v as
                            "now" | "target" | "both";
                        })
                      }
                    >
                      <option value="both">{t("both")}</option>
                      <option value="now">{t("now")}</option>
                      <option value="target">{t("target")}</option>
                    </Select>
                    <Select
                      label={`${t("transition")} · ${t(mode)}`}
                      value={step.transition[mode] || "continue"}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.steps.find((x) => x.id === sel.id)!.transition[
                            mode
                          ] = v as (typeof transitions)[number];
                        })
                      }
                    >
                      {transitions.map((v) => (
                        <option key={v} value={v}>
                          {t(v)}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label={`${t("notes")} · ${t(mode)}`}
                      value={step.notes[mode] || ""}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.steps.find((x) => x.id === sel.id)!.notes[mode] = v;
                        })
                      }
                      multiline
                    />
                  </>
                );
              })()
            : null}
          {sel.kind === "friction"
            ? (() => {
                const f = j.frictions.find((x) => x.id === sel.id)!;
                return (
                  <>
                    <Field
                      label={t("currentState")}
                      value={f.now}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.frictions.find((x) => x.id === sel.id)!.now = v;
                        })
                      }
                      multiline
                    />
                    <Field
                      label={t("recommendation")}
                      value={f.recommendation}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.frictions.find(
                            (x) => x.id === sel.id,
                          )!.recommendation = v;
                        })
                      }
                      multiline
                    />
                    <Field
                      label={t("othersPattern")}
                      value={f.othersPattern}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.frictions.find(
                            (x) => x.id === sel.id,
                          )!.othersPattern = v;
                        })
                      }
                      multiline
                    />
                  </>
                );
              })()
            : null}
          {sel.kind === "feed"
            ? (() => {
                const feed = j.feeds.find((x) => x.id === sel.id)!;
                return (
                  <>
                    <Select
                      label={t("feedKind")}
                      value={feed.kind}
                      onChange={(v) =>
                        edit((j) => {
                          j.feeds.find((x) => x.id === sel.id)!.kind = v as
                            "entry" | "support";
                        })
                      }
                      disabled={disabled}
                    >
                      <option value="entry">{t("entryLabel")}</option>
                      <option value="support">{t("supportLabel")}</option>
                    </Select>
                    <Select
                      label={t("informsStep")}
                      value={feed.to}
                      onChange={(v) =>
                        setCardLink(
                          { kind: "feed", id: sel.id, lane: sel.lane },
                          { kind: "step", id: v },
                        )
                      }
                      disabled={disabled}
                    >
                      {!feed.to ? (
                        <option value="">{t("notConnected")}</option>
                      ) : null}
                      {j.steps.map((x, i) => (
                        <option key={x.id} value={x.id}>
                          {i + 1}. {x.text}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label={t("explanation")}
                      value={feed.explanation}
                      onChange={(v) =>
                        edit((j) => {
                          j.feeds.find((x) => x.id === sel.id)!.explanation = v;
                        })
                      }
                      multiline
                      disabled={disabled}
                    />
                  </>
                );
              })()
            : null}
          {sel.kind === "lane"
            ? (() => {
                const l = entity as Lane;
                return (
                  <>
                    <Field
                      label={t("subtitle")}
                      value={l.sub}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.lanes.find((x) => x.id === sel.id)!.sub = v;
                        })
                      }
                    />
                    <Select
                      label={t("laneKind")}
                      value={l.kind}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          const x = j.lanes.find((x) => x.id === sel.id)!;
                          x.kind = v as Lane["kind"];
                          if (v === "channel")
                            x.channel = {
                              type: "digital",
                              authenticated: true,
                              webviewHost: false,
                            };
                          else {
                            delete x.channel;
                            j.services.forEach((s) => {
                              clearServiceLane(s, x.id);
                            });
                          }
                        })
                      }
                    >
                      {[
                        "customer",
                        "entry",
                        "channel",
                        "backstage",
                        "market",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {t(v)}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label={t("laneGroup")}
                      value={l.group || ""}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.lanes.find((x) => x.id === sel.id)!.group =
                            v || null;
                        })
                      }
                    >
                      <option value="">{t("ungrouped")}</option>
                      {j.laneGroups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label={t("tint")}
                      value={l.tint || l.group || l.kind}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.lanes.find((x) => x.id === sel.id)!.tint =
                            v as Lane["tint"];
                        })
                      }
                    >
                      {[
                        "customer",
                        "entry",
                        "self",
                        "assisted",
                        "backstage",
                        "market",
                      ].map((v) => (
                        <option key={v} value={v}>
                          {t(v)}
                        </option>
                      ))}
                    </Select>
                    {l.kind === "channel" ? (
                      <>
                        <Select
                          label={t("channelType")}
                          value={l.channel?.type || "digital"}
                          disabled={disabled}
                          onChange={(v) =>
                            edit((j) => {
                              j.lanes.find((x) => x.id === sel.id)!.channel =
                                v === "digital"
                                  ? {
                                      type: "digital",
                                      authenticated: true,
                                      webviewHost: false,
                                    }
                                  : { type: "assisted" };
                              if (v === "assisted")
                                j.services.forEach((s) => {
                                  clearServiceLane(s, sel.id);
                                });
                            })
                          }
                        >
                          <option value="digital">{t("digital")}</option>
                          <option value="assisted">{t("assisted")}</option>
                        </Select>
                        {l.channel?.type === "digital" ? (
                          <>
                            <Check
                              label={t("authenticated")}
                              checked={l.channel.authenticated}
                              disabled={disabled}
                              onChange={(v) =>
                                edit((j) => {
                                  const c = j.lanes.find(
                                    (x) => x.id === sel.id,
                                  )!.channel;
                                  if (c?.type === "digital")
                                    c.authenticated = v;
                                })
                              }
                            />
                            <Select
                              label={t("platform")}
                              value={channelPlatform(l) || "web"}
                              disabled={disabled}
                              onChange={(platform) =>
                                edit((j) => {
                                  const channel = j.lanes.find(
                                    (x) => x.id === sel.id,
                                  )!.channel;
                                  if (channel?.type === "digital")
                                    channel.platform = platform as
                                      "app" | "web";
                                })
                              }
                            >
                              <option value="app">{t("platformApp")}</option>
                              <option value="web">{t("platformWeb")}</option>
                            </Select>
                            <Check
                              label={t("webviewHost")}
                              checked={l.channel.webviewHost}
                              disabled={disabled}
                              onChange={(v) =>
                                edit((j) => {
                                  const c = j.lanes.find(
                                    (x) => x.id === sel.id,
                                  )!.channel;
                                  if (c?.type === "digital") {
                                    c.platform ??= channelPlatform(l);
                                    c.webviewHost = v;
                                  }
                                })
                              }
                            />
                          </>
                        ) : null}
                      </>
                    ) : null}
                    <Check
                      label={t("visible")}
                      checked={!l.hidden}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.lanes.find((x) => x.id === sel.id)!.hidden = !v;
                        })
                      }
                    />
                    <Check
                      label={t("locked")}
                      checked={l.locked}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.lanes.find((x) => x.id === sel.id)!.locked = v;
                        })
                      }
                    />
                  </>
                );
              })()
            : null}
          {sel.kind === "phase" ? (
            <>
              <Field
                label={t("width")}
                value={j.phases.find((x) => x.id === sel.id)!.width}
                type="number"
                disabled={disabled}
                onChange={(v) =>
                  edit((j) => {
                    j.phases.find((x) => x.id === sel.id)!.width = Math.max(
                      220,
                      Math.min(1600, Number(v) || 220),
                    );
                  })
                }
              />
              {(["now", "target"] as const).map((m) => (
                <label className="lb-field" key={m}>
                  <span className="lb-field__label">
                    {t("experience")} · {t(m)}:{" "}
                    {
                      j.experience[m][
                        j.phases.findIndex((p) => p.id === sel.id)
                      ]
                    }
                  </span>
                  <input
                    type="range"
                    min={-2}
                    max={2}
                    step={0.1}
                    disabled={disabled}
                    aria-label={`${t("experience")} ${t(m)}`}
                    value={
                      j.experience[m][
                        j.phases.findIndex((p) => p.id === sel.id)
                      ]
                    }
                    onChange={(e) =>
                      edit((j) => {
                        j.experience[m][
                          j.phases.findIndex((p) => p.id === sel.id)
                        ] = Number(e.target.value);
                      })
                    }
                  />
                </label>
              ))}
            </>
          ) : null}
          {sel.kind === "group"
            ? (() => {
                const g = j.laneGroups.find((x) => x.id === sel.id)!;
                return (
                  <>
                    <Select
                      label={t("lineAfter")}
                      value={g.lineAfter?.kind || ""}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          const x = j.laneGroups.find((x) => x.id === sel.id)!;
                          if (!v) delete x.lineAfter;
                          else
                            x.lineAfter = {
                              kind: v as "boundary" | "visibility",
                              label:
                                v === "boundary"
                                  ? "Self-service boundary"
                                  : "Line of visibility",
                            };
                        })
                      }
                    >
                      <option value="">None</option>
                      <option value="boundary">{t("boundary")}</option>
                      <option value="visibility">{t("visibilityLine")}</option>
                    </Select>
                    {g.lineAfter ? (
                      <Field
                        label={t("lineLabel")}
                        value={g.lineAfter.label}
                        disabled={disabled}
                        onChange={(v) =>
                          edit((j) => {
                            j.laneGroups.find(
                              (x) => x.id === sel.id,
                            )!.lineAfter!.label = v;
                          })
                        }
                      />
                    ) : null}
                  </>
                );
              })()
            : null}
          {"owner" in entity ||
          sel.kind === "lane" ||
          sel.kind === "friction" ? (
            <Select
              label={t("owner")}
              value={"owner" in entity ? entity.owner || "" : ""}
              disabled={disabled}
              onChange={(v) =>
                edit((j) => {
                  const x = findEntity(j, sel);
                  if (
                    x &&
                    ("owner" in x ||
                      sel.kind === "lane" ||
                      sel.kind === "friction")
                  )
                    Object.assign(x, { owner: v || undefined });
                })
              }
            >
              <option value="">{t("none")}</option>
              {s.workspace.owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          ) : null}
          {sel.kind === "sketch"
            ? (() => {
                const sketch = j.sketches.find((x) => x.id === sel.id)!;
                return (
                  <>
                    <Select
                      label={t("shape")}
                      value={sketch.kind}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          j.sketches.find((x) => x.id === sel.id)!.kind =
                            v as typeof sketch.kind;
                        })
                      }
                    >
                      {["note", "text", "rectangle", "ellipse", "arrow"].map(
                        (v) => (
                          <option key={v} value={v}>
                            {t(v)}
                          </option>
                        ),
                      )}
                    </Select>
                    {(["width", "height"] as const).map((dimension) => (
                      <Field
                        key={dimension}
                        label={t(dimension)}
                        type="number"
                        value={sketch[dimension]}
                        disabled={disabled}
                        onChange={(v) =>
                          edit((j) => {
                            j.sketches.find((x) => x.id === sel.id)![
                              dimension
                            ] = Math.max(40, Math.min(3000, Number(v) || 40));
                          })
                        }
                      />
                    ))}
                    {(["x", "y"] as const).map((axis) => (
                      <Field
                        key={axis}
                        label={t(
                          sketch.anchor
                            ? axis === "x"
                              ? "horizontalOffset"
                              : "verticalOffset"
                            : axis === "x"
                              ? "horizontalPosition"
                              : "verticalPosition",
                        )}
                        type="number"
                        value={
                          sketch.anchor
                            ? sketch.anchor[axis === "x" ? "dx" : "dy"]
                            : sketch[axis]
                        }
                        disabled={disabled}
                        onChange={(v) =>
                          edit((j) => {
                            const item = j.sketches.find(
                              (x) => x.id === sel.id,
                            )!;
                            const value = Number.isFinite(Number(v))
                              ? Number(v)
                              : 0;
                            if (item.anchor)
                              item.anchor[axis === "x" ? "dx" : "dy"] = value;
                            else item[axis] = value;
                          })
                        }
                      />
                    ))}
                    <Select
                      label={t("pin")}
                      value={sketch.anchor?.lane || ""}
                      disabled={disabled}
                      onChange={(v) =>
                        edit((j) => {
                          const x = j.sketches.find((x) => x.id === sel.id)!;
                          if (!v) delete x.anchor;
                          else
                            x.anchor = {
                              lane: v,
                              phase: x.anchor?.phase || j.phases[0].id,
                              dx: 12,
                              dy: 12,
                            };
                        })
                      }
                    >
                      <option value="">{t("unpin")}</option>
                      {j.lanes.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </Select>
                    {sketch.anchor ? (
                      <Select
                        label={t("phase")}
                        value={sketch.anchor.phase}
                        disabled={disabled}
                        onChange={(v) =>
                          edit((j) => {
                            j.sketches.find(
                              (x) => x.id === sel.id,
                            )!.anchor!.phase = v;
                          })
                        }
                      >
                        {j.phases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </Select>
                    ) : null}
                  </>
                );
              })()
            : null}
          {["phase", "lane", "step", "group"].includes(sel.kind) ? (
            <div className="lb-dialog-actions">
              <button
                className="lb-btn lb-btn--sm"
                disabled={disabled}
                onClick={() => edit((j) => moveEntity(j, sel, -1))}
              >
                <ChevronUp size={14} />
                {t("moveUp")}
              </button>
              <button
                className="lb-btn lb-btn--sm"
                disabled={disabled}
                onClick={() => edit((j) => moveEntity(j, sel, 1))}
              >
                <ChevronDown size={14} />
                {t("moveDown")}
              </button>
            </div>
          ) : null}
          <div className="lb-dialog-actions">
            {!["phase", "lane", "group"].includes(sel.kind) ? (
              <button
                className="lb-btn lb-btn--sm"
                disabled={disabled}
                onClick={duplicateCards}
              >
                <Copy size={14} />
                Duplicate
              </button>
            ) : null}
            <button
              className="lb-btn lb-btn--sm lb-btn--danger"
              disabled={
                disabled ||
                (sel.kind === "lane" && j.lanes.length === 1) ||
                (sel.kind === "phase" && j.phases.length === 1)
              }
              onClick={remove}
            >
              <Trash2 size={14} />
              {t("delete")}
            </button>
          </div>
        </section>
      ) : null}
      {!entity && sel && sel.kind !== "cell" && sel.kind !== "journey" ? (
        <div className="lb-inspector__section">
          <Lock size={16} />
          {t("noSelection")}
        </div>
      ) : null}
    </aside>
  );
}
function findEntity(j: Journey, s: Selection) {
  switch (s.kind) {
    case "service":
      return j.services.find((x) => x.id === s.id);
    case "step":
      return j.steps.find((x) => x.id === s.id);
    case "friction":
      return j.frictions.find((x) => x.id === s.id);
    case "feed":
      return j.feeds.find((x) => x.id === s.id);
    case "note":
      return j.notes.find((x) => x.id === s.id);
    case "sketch":
      return j.sketches.find((x) => x.id === s.id);
    case "lane":
      return j.lanes.find((x) => x.id === s.id);
    case "phase":
      return j.phases.find((x) => x.id === s.id);
    case "group":
      return j.laneGroups.find((x) => x.id === s.id);
  }
}
function moveEntity(j: Journey, s: Selection, d: number) {
  if (s.kind === "phase") {
    const i = j.phases.findIndex((x) => x.id === s.id);
    reorderPhase(j, i, i + d);
  } else {
    const arr =
      s.kind === "lane" ? j.lanes : s.kind === "step" ? j.steps : j.laneGroups;
    const i = arr.findIndex((x) => x.id === s.id);
    reorder<{ id: string }>(arr, i, i + d);
  }
}
