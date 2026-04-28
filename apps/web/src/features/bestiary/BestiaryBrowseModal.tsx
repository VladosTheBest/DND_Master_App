import { badge, createHeroPanelStyle, gradients, sigil, toneClass } from "../../app-shared";
import { CombatEntityStatSheet, RewardSection } from "../../combat-ui";
import type { BestiaryMonsterDetail, BestiaryMonsterSummary } from "@shadow-edge/shared-types";
import { BestiaryImportModal } from "./BestiaryImportModal";
import { splitBestiaryContent } from "./bestiary.utils";

type BestiaryBrowseModalProps = {
  imported: boolean;
  importing: boolean;
  monster: BestiaryMonsterDetail;
  onImport: () => void;
  onOpenSource: () => void;
  summary: BestiaryMonsterSummary | null;
};

export function BestiaryBrowseModal({
  imported,
  importing,
  monster,
  onImport,
  onOpenSource,
  summary
}: BestiaryBrowseModalProps) {
  return (
    <>
      <section className="card hero" style={createHeroPanelStyle(gradients.monster, monster.summary.imageUrl ?? monster.monster.art?.url)}>
        <div className="hero-head">
          <span className="sigil big" style={{ backgroundImage: gradients.monster }}>
            {sigil(monster.monster.title)}
          </span>
          <div className="hero-copy-block">
            <div className="hero-tags">
              <span className={badge("accent")}>dnd.su</span>
              {summary?.challenge ? <span className={badge()}>{summary.challenge}</span> : null}
              {summary?.creatureTypeLabel ? <span className={badge()}>{summary.creatureTypeLabel}</span> : null}
              {summary?.source ? <span className={badge()}>{summary.source}</span> : null}
            </div>
            <h1>{monster.monster.title}</h1>
            <p className="hero-subtitle">{monster.monster.subtitle}</p>
            <p className="copy">{monster.monster.summary}</p>
          </div>
        </div>

        <BestiaryImportModal compact={false} imported={imported} importing={importing} onImport={onImport} onOpenSource={onOpenSource} />
      </section>

      <div className="facts">
        {monster.monster.quickFacts.map((fact) => (
          <article key={fact.label} className="card mini fact-box">
            <small>{fact.label}</small>
            <strong className={`fact-value ${toneClass[fact.tone ?? "default"]}`}>{fact.value}</strong>
          </article>
        ))}
      </div>

      <CombatEntityStatSheet entity={monster.monster} />
      <RewardSection kind="monster" rewardProfile={monster.monster.rewardProfile} />

      <article className="card section-card">
        <div className="row muted">
          <span>Описание</span>
          <span>Подтянуто из официальной карточки dnd.su</span>
        </div>
        <div className="rich">
          {splitBestiaryContent(monster.monster.content).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </>
  );
}
