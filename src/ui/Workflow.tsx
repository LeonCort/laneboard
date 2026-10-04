import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import {
  useStore,
  currentJourney,
  addJourneyStep,
  createTargetFromNow,
} from "../store";
import { reorder } from "../store/actions";
import { evidenceStates, transitions, type Journey } from "../model/schema";
import { evidenceState, targetChanges, targetState } from "../model/analysis";
import { visibleSteps, kpis } from "../rules";
import { useT } from "../i18n";
import { Field, Select } from "./fields";
import { Modal } from "./dialogs";

type EvidenceItem = {
  evidence?: (typeof evidenceStates)[number];
  evidenceNotes?: string;
  assumption?: boolean;
};
export function EvidenceFields({
  item,
  onChange,
  disabled,
}: {
  item: EvidenceItem;
  onChange: (value: EvidenceItem) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <>
      <Select
        label={t("evidence")}
        value={evidenceState(item)}
        disabled={disabled}
        onChange={(evidence) =>
          onChange({
            evidence: evidence as EvidenceItem["evidence"],
            ...("assumption" in item
              ? { assumption: evidence === "assumed" }
              : {}),
          })
        }
      >
        {evidenceStates.map((e) => (
          <option key={e} value={e}>
            {t(e)}
          </option>
        ))}
      </Select>
      <Field
        label={t("evidenceNotes")}
        value={item.evidenceNotes || ""}
        multiline
        disabled={disabled}
        onChange={(evidenceNotes) => onChange({ evidenceNotes })}
      />
    </>
  );
}
export function JourneySetup({ onClose }: { onClose: () => void }) {
  const s = useStore(),
    j = currentJourney(s),
    t = useT();
  const [stage, setStage] = useState(0),
    [action, setAction] = useState("");
  if (!j) return null;
  const save = (
    key:
      | "title"
      | "customer"
      | "situation"
      | "goal"
      | "hypothesis"
      | "testPlan"
      | "nextAction",
    value: string,
  ) =>
    s.editJourney((j) => {
      j[key] = value;
    });
  return (
    <Modal
      title={t("setup")}
      description={
        stage === 0
          ? "1 / 2 · Customer and goal"
          : "2 / 2 · Hypothesis and test"
      }
      onClose={onClose}
    >
      {stage === 0 ? (
        <>
          {(["title", "customer", "situation", "goal"] as const).map((key) => (
            <Field
              key={key}
              label={t(key === "title" ? "name" : key)}
              value={j[key]}
              multiline={key !== "title"}
              onChange={(v) => save(key, v)}
              disabled={j.readOnly}
            />
          ))}
        </>
      ) : (
        <>
          {(["hypothesis", "testPlan", "nextAction"] as const).map((key) => (
            <Field
              key={key}
              label={t(key)}
              value={j[key]}
              multiline
              onChange={(v) => save(key, v)}
              disabled={j.readOnly}
            />
          ))}
          <EvidenceFields
            item={j}
            disabled={j.readOnly}
            onChange={(v) => s.editJourney((j) => Object.assign(j, v))}
          />
          {!j.steps.length ? (
            <Field
              label={t("firstAction")}
              value={action}
              onChange={setAction}
              hint="Describe what the customer does or needs first."
            />
          ) : null}
        </>
      )}
      <div className="lb-dialog-actions">
        <button className="lb-btn" onClick={onClose}>
          {t("skipSetup")}
        </button>
        {stage === 0 ? (
          <button
            className="lb-btn lb-btn--primary"
            onClick={() => setStage(1)}
          >
            {t("next")}
          </button>
        ) : (
          <button
            className="lb-btn lb-btn--primary"
            onClick={() => {
              if (action.trim())
                addJourneyStep(
                  j.lanes.find((l) => l.kind === "customer")?.id ||
                    j.lanes[0].id,
                  j.phases[0].id,
                  action,
                );
              onClose();
            }}
          >
            {t("finishSetup")}
          </button>
        )}
      </div>
    </Modal>
  );
}

export function TargetReview({ j }: { j: Journey }) {
  const s = useStore(),
    t = useT(),
    state = targetState(j),
    changes = targetChanges(j),
    now = kpis(j, "now"),
    target = kpis(j, "target");
  const value = (v: string) => (v === "present" ? t("presentValue") : t(v));
  return (
    <section className="lb-target-review" aria-label={t("comparison")}>
      <div className="lb-overview-section-head">
        <h2>{t("comparison")}</h2>
        <span className="lb-tag">
          {t(state === "not-started" ? "target" : state)} · {t("evidence")}:{" "}
          {t(evidenceState(j))}
        </span>
      </div>
      {state === "not-started" ? (
        <>
          <p>{t("targetNotStarted")}</p>
          <button
            className="lb-btn lb-btn--primary"
            disabled={j.readOnly}
            onClick={createTargetFromNow}
          >
            {t("createTarget")}
          </button>
        </>
      ) : (
        <>
          <p>
            {t("coverage")}:{" "}
            {now.applicable
              ? `${now.coverage}% (${now.native}/${now.applicable})`
              : t("unknown")}{" "}
            →{" "}
            {target.applicable
              ? `${target.coverage}% (${target.native}/${target.applicable})`
              : t("unknown")}
            . {t("unknownCount")}: {now.unknown} → {target.unknown}.{" "}
            {t("excludedCount")}: {now.excluded} → {target.excluded}.
          </p>
          <p className="lb-field__hint">
            Native coverage counts assessed, applicable service/channel pairs.
            Removing a pair changes the denominator. Design review does not
            validate the hypothesis.
          </p>
          {changes.length ? (
            <ul className="lb-change-list">
              {changes.map((c, i) => (
                <li key={`${c.id}-${i}`}>
                  <strong>{c.label}</strong>
                  {c.lane ? ` · ${c.lane}` : ""}
                  <span>
                    {value(c.before)} → {value(c.after)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("noChanges")}</p>
          )}
          <button
            className="lb-btn"
            disabled={j.readOnly || state === "reviewed"}
            onClick={() =>
              s.editJourney((j) => {
                j.targetState = "reviewed";
              })
            }
          >
            {t("reviewTarget")}
          </button>
        </>
      )}
    </section>
  );
}

export function JourneyList() {
  const s = useStore(),
    j = currentJourney(s),
    t = useT(),
    mode = s.workspace.ui.mode;
  const [adding, setAdding] = useState<string | null>(null),
    [text, setText] = useState(""),
    [lane, setLane] = useState(""),
    [phase, setPhase] = useState("");
  if (!j) return null;
  const steps = visibleSteps(j, mode),
    disabled =
      j.readOnly || (mode === "target" && targetState(j) === "not-started");
  const begin = (afterId: string) => {
    const previous = j.steps.find((x) => x.id === afterId) || steps.at(-1);
    setAdding(afterId);
    setText("");
    setLane(
      previous?.lane ||
        j.lanes.find((l) => l.kind === "customer")?.id ||
        j.lanes[0].id,
    );
    setPhase(previous?.phase || j.phases[0].id);
  };
  const form = (
    <form
      className="lb-next-step lb-island"
      onSubmit={(e) => {
        e.preventDefault();
        if (addJourneyStep(lane, phase, text, adding || undefined)) {
          setAdding(null);
          setText("");
        }
      }}
    >
      <Field label={t("journey")} value={text} multiline onChange={setText} />
      <div className="lb-two-fields">
        <Select label={t("lane")} value={lane} onChange={setLane}>
          {j.lanes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        <Select label={t("phase")} value={phase} onChange={setPhase}>
          {j.phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="lb-dialog-actions">
        <button
          type="button"
          className="lb-btn"
          onClick={() => setAdding(null)}
        >
          {t("cancel")}
        </button>
        <button className="lb-btn lb-btn--primary" disabled={!text.trim()}>
          {t("addNextStep")}
        </button>
      </div>
    </form>
  );
  return (
    <div className="lb-journey-list">
      <p className="lb-field__hint">
        {t(mode)} · {j.title}
      </p>
      {steps.map((step, i) => (
        <article
          key={step.id}
          className="lb-story-step lb-island"
          aria-label={`${i + 1}. ${step.text}`}
        >
          <div className="lb-story-head">
            <strong>{i + 1}</strong>
            <div className="lb-dialog-actions">
              <button
                className="lb-iconbtn"
                aria-label={t("moveUp")}
                disabled={disabled || i === 0}
                onClick={() =>
                  s.editJourney((j) =>
                    reorder(
                      j.steps,
                      j.steps.findIndex((x) => x.id === step.id),
                      j.steps.findIndex((x) => x.id === steps[i - 1].id),
                    ),
                  )
                }
              >
                <ChevronUp />
              </button>
              <button
                className="lb-iconbtn"
                aria-label={t("moveDown")}
                disabled={disabled || i === steps.length - 1}
                onClick={() =>
                  s.editJourney((j) =>
                    reorder(
                      j.steps,
                      j.steps.findIndex((x) => x.id === step.id),
                      j.steps.findIndex((x) => x.id === steps[i + 1].id),
                    ),
                  )
                }
              >
                <ChevronDown />
              </button>
            </div>
          </div>
          <Field
            label={t("journey")}
            value={mode === "target" ? step.textTarget || step.text : step.text}
            multiline
            disabled={disabled}
            onChange={(v) =>
              s.editJourney((j) => {
                const x = j.steps.find((x) => x.id === step.id)!;
                if (mode === "target") x.textTarget = v;
                else x.text = v;
              })
            }
          />
          <div className="lb-story-location">
            <Select
              label={t("lane")}
              value={step.lane}
              disabled={disabled}
              onChange={(v) =>
                s.editJourney((j) => {
                  j.steps.find((x) => x.id === step.id)!.lane = v;
                })
              }
            >
              {j.lanes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <Select
              label={t("phase")}
              value={step.phase}
              disabled={disabled}
              onChange={(v) =>
                s.editJourney((j) => {
                  j.steps.find((x) => x.id === step.id)!.phase = v;
                })
              }
            >
              {j.phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Select
              label={t("transition")}
              value={step.transition[mode] || "continue"}
              disabled={disabled}
              onChange={(v) =>
                s.editJourney((j) => {
                  j.steps.find((x) => x.id === step.id)!.transition[mode] =
                    v as (typeof transitions)[number];
                })
              }
            >
              {transitions.map((v) => (
                <option key={v} value={v}>
                  {t(v)}
                </option>
              ))}
            </Select>
          </div>
          <details>
            <summary>
              {t("evidence")} · {t(evidenceState(step))}
            </summary>
            <EvidenceFields
              item={step}
              disabled={disabled}
              onChange={(v) =>
                s.editJourney((j) =>
                  Object.assign(
                    j.steps.find((x) => x.id === step.id)!,
                    v,
                  ),
                )
              }
            />
            <Field
              label={t("notes")}
              value={step.notes[mode] || ""}
              multiline
              disabled={disabled}
              onChange={(v) =>
                s.editJourney((j) => {
                  j.steps.find((x) => x.id === step.id)!.notes[mode] = v;
                })
              }
            />
          </details>
          <button
            className="lb-btn lb-btn--ghost"
            disabled={disabled}
            onClick={() => begin(step.id)}
          >
            <Plus size={16} />
            {t("addNextStep")}
          </button>
          {adding === step.id ? form : null}
        </article>
      ))}
      {adding === "" ? (
        form
      ) : (
        <button
          className="lb-btn lb-btn--primary"
          disabled={disabled}
          onClick={() => begin("")}
        >
          <Plus size={16} />
          {steps.length ? t("addNextStep") : t("firstAction")}
        </button>
      )}
    </div>
  );
}
