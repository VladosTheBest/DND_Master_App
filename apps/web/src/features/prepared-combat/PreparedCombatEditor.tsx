import type { KnowledgeEntity, PreparedCombatPlan } from "@shadow-edge/shared-types";
import type { CombatSearchItem } from "../combat/combat.types";
import { PreparedCombatEnemyPicker } from "./PreparedCombatEnemyPicker";

type PreparedCombatEditorProps = {
  entityMap: Map<string, KnowledgeEntity>;
  preparedCombatBestiaryLoading: boolean;
  preparedCombatChallenge: string;
  preparedCombatDraft: PreparedCombatPlan;
  preparedCombatQuantity: number;
  preparedCombatSearchItems: CombatSearchItem[];
  preparedCombatSearchQuery: string;
  selectedPreparedCombatSearchItem: CombatSearchItem | null;
  saving: boolean;
  onAddEnemy: () => void;
  onChangeChallenge: (value: string) => void;
  onChangeQuantity: (value: number) => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onPeekEntity: (entityId: string) => void;
  onRemoveEnemy: (entityId: string) => void;
  onSelectItem: (itemKey: string) => void;
  onUpdateEnemyQuantity: (entityId: string, quantity: number) => void;
};

export function PreparedCombatEditor({
  entityMap,
  preparedCombatBestiaryLoading,
  preparedCombatChallenge,
  preparedCombatDraft,
  preparedCombatQuantity,
  preparedCombatSearchItems,
  preparedCombatSearchQuery,
  selectedPreparedCombatSearchItem,
  saving,
  onAddEnemy,
  onChangeChallenge,
  onChangeQuantity,
  onChangeSearchQuery,
  onChangeTitle,
  onPeekEntity,
  onRemoveEnemy,
  onSelectItem,
  onUpdateEnemyQuantity
}: PreparedCombatEditorProps) {
  return (
    <section className="card section-card prepared-combat-card">
      <div className="form-grid">
        <label className="field field-full">
          <span>Название сцены</span>
          <input
            className="input"
            onChange={(event) => onChangeTitle(event.target.value)}
            placeholder="Например: Засада у старого моста"
            value={preparedCombatDraft.title ?? ""}
          />
        </label>
      </div>

      <PreparedCombatEnemyPicker
        entityMap={entityMap}
        preparedCombatBestiaryLoading={preparedCombatBestiaryLoading}
        preparedCombatChallenge={preparedCombatChallenge}
        preparedCombatDraft={preparedCombatDraft}
        preparedCombatQuantity={preparedCombatQuantity}
        preparedCombatSearchItems={preparedCombatSearchItems}
        preparedCombatSearchQuery={preparedCombatSearchQuery}
        selectedPreparedCombatSearchItem={selectedPreparedCombatSearchItem}
        saving={saving}
        onAddEnemy={onAddEnemy}
        onChangeChallenge={onChangeChallenge}
        onChangeQuantity={onChangeQuantity}
        onChangeSearchQuery={onChangeSearchQuery}
        onPeekEntity={onPeekEntity}
        onRemoveEnemy={onRemoveEnemy}
        onSelectItem={onSelectItem}
        onUpdateEnemyQuantity={onUpdateEnemyQuantity}
      />
    </section>
  );
}
