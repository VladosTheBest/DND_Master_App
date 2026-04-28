import { badge, createHeroPanelStyle, gradients } from "../../app-shared";
import { CombatEntityPreviewSummary, RewardSection } from "../../combat-ui";
import { BestiaryImportModal } from "./BestiaryImportModal";
import type { BestiaryController } from "./useBestiaryController";

type BestiaryPreviewPanelProps = {
  controller: BestiaryController;
};

export function BestiaryPreviewPanel({ controller }: BestiaryPreviewPanelProps) {
  if (controller.selectedBestiaryMonster) {
    return (
      <div className="stack wide">
        <div className="row">
          <p className="eyebrow">dnd.su / Preview</p>
          <span className={badge(controller.selectedBestiaryImported ? "success" : "default")}>
            {controller.selectedBestiaryImported ? "Уже в кампании" : "Ещё не импортирован"}
          </span>
        </div>

        <section
          className="preview-hero"
          style={createHeroPanelStyle(
            gradients.monster,
            controller.selectedBestiaryMonster.summary.imageUrl ?? controller.selectedBestiaryMonster.monster.art?.url
          )}
        >
          <span>Монстр</span>
          <strong>{controller.selectedBestiaryMonster.monster.title}</strong>
          <small>{controller.selectedBestiaryMonster.monster.subtitle}</small>
        </section>

        <p className="copy">{controller.selectedBestiaryMonster.monster.summary}</p>
        <CombatEntityPreviewSummary entity={controller.selectedBestiaryMonster.monster} />
        <RewardSection compact kind="monster" rewardProfile={controller.selectedBestiaryMonster.monster.rewardProfile} />
        <BestiaryImportModal
          compact
          imported={controller.selectedBestiaryImported}
          importing={controller.importingBestiary}
          onImport={() => void controller.importSelectedBestiaryMonster()}
          onOpenSource={() => window.open(controller.selectedBestiaryMonster?.sourceUrl, "_blank", "noopener,noreferrer")}
        />
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="eyebrow">dnd.su / Preview</p>
      <h3>Выбери монстра из каталога</h3>
      <p className="copy">Когда откроешь запись слева, сюда подтянется краткая сводка и кнопка импорта в кампанию.</p>
    </div>
  );
}
