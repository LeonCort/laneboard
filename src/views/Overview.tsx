import { ArrowUpRight } from "lucide-react";
import { useStore, currentJourney, type Selection } from "../store";
import { useT, type Key } from "../i18n";
import { kpis, visibleSteps, evaluateService } from "../rules";
import { evidenceState, frictionReference } from "../model/analysis";
import { TargetReview } from "../ui/Workflow";
export function Overview({
  onSelect,
  onEdit,
}: {
  onSelect: (selection: Selection) => void;
  onEdit?: () => void;
}) {
  const s = useStore(),
    t = useT(),
    j = currentJourney(s);
  if (!j) return null;
  const mode = s.workspace.ui.mode,
    metric = kpis(j, mode);
  const stats: [Key, string | number][] = [
    ["restarts", metric.restarts],
    [
      "coverage",
      metric.applicable
        ? `${metric.coverage}% (${metric.native}/${metric.applicable})`
        : t("unknown"),
    ],
    ["serviceFriction", metric.servicesWithFriction],
    ["frictions", metric.frictions],
    ["channels", metric.channels],
  ];
  const ownerIds = new Set(
    [
      ...j.lanes.map((l) => l.owner),
      ...j.frictions.map((f) => f.owner),
      j.validationOwner,
    ].filter(Boolean),
  );
  const owners = s.workspace.owners.filter((o) => ownerIds.has(o.id));
  const steps = visibleSteps(j, mode);
  const handoffs = steps.slice(1).flatMap((step, i) => {
    const previous = steps[i],
      from = j.lanes.find((l) => l.id === previous.lane),
      to = j.lanes.find((l) => l.id === step.lane);
    return from?.owner && to?.owner && from.owner !== to.owner
      ? [{ step, from, to }]
      : [];
  });
  const ownerName = (id?: string) =>
    s.workspace.owners.find((o) => o.id === id)?.name || t("unassigned");
  const friction = (f: (typeof j.frictions)[number]) => (
    <button
      className="lb-overview-friction"
      key={f.id}
      onClick={() => onSelect({ kind: "friction", id: f.id })}
    >
      <span>
        <span className="lb-tag">{frictionReference(j, f.id)}</span> {f.title}
        <small>{t(evidenceState(f))}</small>
      </span>
      <ArrowUpRight size={16} />
    </button>
  );
  return (
    <section className="lb-overview" aria-label={t("overview")}>
      <div className="lb-overview-content">
        <header className="lb-overview-header">
          <span className="lb-caps">
            {j.segment} · {t(mode)}
          </span>
          <h1>{t("overview")}</h1>
          <p>{j.title}</p>
        </header>
        <section className="lb-overview-goal lb-island">
          <div className="lb-overview-section-head">
            <h2>{j.goal || t("goal")}</h2>
            <button className="lb-btn" onClick={onEdit}>
              {t("editDetails")}
            </button>
          </div>
          <dl className="lb-context-grid">
            {(
              [
                "customer",
                "situation",
                "hypothesis",
                "testPlan",
                "nextAction",
              ] as const
            ).map((key) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{j[key] || t("unknown")}</dd>
              </div>
            ))}
            <div>
              <dt>{t("validationOwner")}</dt>
              <dd>{ownerName(j.validationOwner)}</dd>
            </div>
            <div>
              <dt>{t("evidence")}</dt>
              <dd>
                {t(evidenceState(j))} · {j.evidenceNotes || t("noEvidence")}
              </dd>
            </div>
            <div>
              <dt>{t("baseline")}</dt>
              <dd>{j.baseline || t("unknown")}</dd>
            </div>
            <div>
              <dt>{t("targetMetric")}</dt>
              <dd>{j.targetMetric || t("unknown")}</dd>
            </div>
          </dl>
        </section>
        <div className="lb-overview-stats">
          {stats.map(([key, value]) => (
            <div className="lb-island lb-overview-stat" key={key}>
              <span>{t(key)}</span>
              <strong data-testid={`overview-${key}`}>{value}</strong>
            </div>
          ))}
        </div>
        <section className="lb-overview-section lb-island">
          <TargetReview j={j} />
        </section>
        <section className="lb-overview-section" aria-label={t("ownership")}>
          <h2>{t("ownership")}</h2>
          <div className="lb-overview-owners">
            {owners.map((owner) => (
              <article className="lb-view-card lb-island" key={owner.id}>
                <h3>{owner.name}</h3>
                <p>
                  {j.lanes
                    .filter((l) => l.owner === owner.id)
                    .map((l) => l.name)
                    .join(" · ")}
                </p>
                {j.frictions.filter((f) => f.owner === owner.id).map(friction)}
              </article>
            ))}
            {!owners.length ? <p>{t("noOwners")}</p> : null}
            {j.frictions.some((f) => !f.owner) ? (
              <article className="lb-view-card lb-island">
                <h3>{t("unassigned")}</h3>
                {j.frictions.filter((f) => !f.owner).map(friction)}
              </article>
            ) : null}
          </div>
        </section>
        <section className="lb-overview-section lb-island">
          <h2>{t("handoffs")}</h2>
          {handoffs.length ? (
            <ol className="lb-change-list">
              {handoffs.map(({ step, from, to }) => (
                <li key={step.id}>
                  <strong>
                    {ownerName(from.owner)} → {ownerName(to.owner)}
                  </strong>
                  <button
                    className="lb-row-link"
                    onClick={() => onSelect({ kind: "step", id: step.id })}
                  >
                    {mode === "target"
                      ? step.textTarget || step.text
                      : step.text}
                  </button>
                  <span>
                    {from.name} → {to.name}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p>{t("noHandoffs")}</p>
          )}
        </section>
        <section className="lb-overview-section lb-island">
          <h2>{t("automaticChecks")}</h2>
          <p className="lb-field__hint">
            These checks infer potential service issues from the availability
            and connections you record. Customer frictions and their evidence
            are recorded separately.
          </p>
          {j.services
            .filter(
              (service) =>
                evaluateService(service, j, mode).severity !== "none",
            )
            .map((service) => (
              <div key={service.id}>
                <button
                  className="lb-row-link"
                  onClick={() => onSelect({ kind: "service", id: service.id })}
                >
                  {service.name}
                </button>
                <ul>
                  {evaluateService(service, j, mode)
                    .notes.filter((n) => n.severity !== "none")
                    .map((n, i) => (
                      <li key={i}>{n.message}</li>
                    ))}
                </ul>
              </div>
            ))}
        </section>
      </div>
    </section>
  );
}
