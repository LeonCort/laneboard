import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useStore, currentJourney, type Selection } from "../store";
import { useT, type Key } from "../i18n";
import { kpis } from "../rules";

export function Overview({
  onSelect,
}: {
  onSelect: (selection: Selection) => void;
}) {
  const s = useStore(),
    t = useT(),
    j = currentJourney(s),
    [diagram, setDiagram] = useState(0);
  if (!j) return null;
  const metric = kpis(j, s.workspace.ui.mode);
  const stats: [Key, string | number][] = [
    ["restarts", metric.restarts],
    ["coverage", `${metric.coverage}%`],
    ["serviceFriction", metric.servicesWithFriction],
    ["frictions", metric.frictions],
    ["channels", metric.channels],
  ];
  const ownerCards = s.workspace.owners.map((owner, i) => ({
    ...owner,
    index: i,
    frictions: j.frictions.filter((f) => f.owner === owner.id),
  }));
  const unassigned = j.frictions.filter((f) => !f.owner);
  return (
    <section className="lb-overview" aria-label={t("overview")}>
      <div className="lb-overview-content">
        <header className="lb-overview-header">
          <span className="lb-caps">
            {j.segment} · {t(s.workspace.ui.mode)}
          </span>
          <h1>{t("overview")}</h1>
          <p>{j.title}</p>
        </header>
        <section className="lb-overview-goal lb-island" aria-label={t("goal")}>
          <span className="lb-caps">{t("goal")}</span>
          <h2>{j.goal || t("oneJourneyLabel")}</h2>
          {j.baseline || j.targetMetric ? (
            <p>
              {j.baseline ? `${t("baseline")}: ${j.baseline}` : ""}
              {j.baseline && j.targetMetric ? " · " : ""}
              {j.targetMetric ? `${t("targetMetric")}: ${j.targetMetric}` : ""}
            </p>
          ) : null}
        </section>
        <div className="lb-overview-stats">
          {stats.map(([key, value]) => (
            <div className="lb-island lb-overview-stat" key={key}>
              <span>{t(key)}</span>
              <strong data-testid={`overview-${key}`}>{value}</strong>
            </div>
          ))}
        </div>
        <section
          className="lb-overview-section lb-island"
          aria-label={t("organisation")}
        >
          <div className="lb-overview-section-head">
            <div>
              <h2>{t("organisation")}</h2>
              <p>{t("organisationDescription")}</p>
            </div>
            <div className="lb-segmented" aria-label={t("organisation")}>
              {[t("silos"), t("crossCutting"), t("sharedGoal")].map(
                (label, i) => (
                  <button
                    key={label}
                    aria-pressed={diagram === i}
                    onClick={() => setDiagram(i)}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
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
        </section>
        <section className="lb-overview-section" aria-label={t("ownership")}>
          <div className="lb-overview-section-head">
            <h2>{t("ownership")}</h2>
          </div>
          <div className="lb-overview-owners">
            {ownerCards.map((owner) => (
              <article className="lb-view-card lb-island" key={owner.id}>
                <span
                  className="lb-owner-tag"
                  data-owner-index={(owner.index % 6) + 1}
                >
                  {owner.name}
                </span>
                <p className="lb-field__hint">{owner.description}</p>
                {owner.frictions.length ? (
                  owner.frictions.map((f) => (
                    <button
                      className="lb-overview-friction"
                      key={f.id}
                      onClick={() => onSelect({ kind: "friction", id: f.id })}
                    >
                      <span>
                        <span className="lb-tag">{f.id}</span> {f.title}
                      </span>
                      <ArrowUpRight size={16} />
                    </button>
                  ))
                ) : (
                  <p className="lb-field__hint">{t("noOwnedFrictions")}</p>
                )}
              </article>
            ))}
            {unassigned.length ? (
              <article className="lb-view-card lb-island">
                <h3>{t("unassigned")}</h3>
                {unassigned.map((f) => (
                  <button
                    className="lb-overview-friction"
                    key={f.id}
                    onClick={() => onSelect({ kind: "friction", id: f.id })}
                  >
                    <span>
                      {f.id} · {f.title}
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </article>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
