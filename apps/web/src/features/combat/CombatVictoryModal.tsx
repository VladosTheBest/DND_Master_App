import type { LastCombatSummary } from "@shadow-edge/shared-types";

type CombatVictoryModalProps = {
  latestCombatSummary: LastCombatSummary | null;
};

export function CombatVictoryModal({ latestCombatSummary }: CombatVictoryModalProps) {
  if (!latestCombatSummary) {
    return null;
  }

  return (
    <section className="card section-card combat-report">
      <div className="row muted">
        <span>Итог последнего боя</span>
        <span>Опыт считается по врагам, которые к финалу уже имеют 0 HP</span>
      </div>
      <div className="combat-report-grid">
        <article className="card mini fact-box">
          <small>Побеждено</small>
          <strong className="fact-value">{latestCombatSummary.defeatedCount}</strong>
        </article>
        <article className="card mini fact-box">
          <small>Всего опыта</small>
          <strong className="fact-value">{latestCombatSummary.totalExperience} XP</strong>
        </article>
        <article className="card mini fact-box">
          <small>На игрока</small>
          <strong className="fact-value">{latestCombatSummary.experiencePerPlayer} XP</strong>
        </article>
      </div>
    </section>
  );
}
