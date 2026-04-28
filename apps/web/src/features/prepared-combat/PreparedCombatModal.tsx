import type { KnowledgeEntity, PreparedCombatPlan } from "@shadow-edge/shared-types";
import type { CombatSearchItem } from "../combat/combat.types";
import { PreparedCombatActions } from "./PreparedCombatActions";
import { PreparedCombatEditor } from "./PreparedCombatEditor";
import "./preparedCombat.css";

type PreparedCombatModalProps = {
  bootError: string;
  entityMap: Map<string, KnowledgeEntity>;
  notice: string;
  open: boolean;
  preparedCombatBestiaryLoading: boolean;
  preparedCombatChallenge: string;
  preparedCombatDraft: PreparedCombatPlan;
  preparedCombatQuantity: number;
  preparedCombatSearchItems: CombatSearchItem[];
  preparedCombatSearchQuery: string;
  questTitle: string;
  saving: boolean;
  selectedPreparedCombatSearchItem: CombatSearchItem | null;
  onAddEnemy: () => void;
  onChangeChallenge: (value: string) => void;
  onChangeQuantity: (value: number) => void;
  onChangeSearchQuery: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onClose: () => void;
  onPeekEntity: (entityId: string) => void;
  onRemoveEnemy: (entityId: string) => void;
  onSave: () => void;
  onSelectItem: (itemKey: string) => void;
  onUpdateEnemyQuantity: (entityId: string, quantity: number) => void;
};

export function PreparedCombatModal({
  bootError,
  entityMap,
  notice,
  open,
  preparedCombatBestiaryLoading,
  preparedCombatChallenge,
  preparedCombatDraft,
  preparedCombatQuantity,
  preparedCombatSearchItems,
  preparedCombatSearchQuery,
  questTitle,
  saving,
  selectedPreparedCombatSearchItem,
  onAddEnemy,
  onChangeChallenge,
  onChangeQuantity,
  onChangeSearchQuery,
  onChangeTitle,
  onClose,
  onPeekEntity,
  onRemoveEnemy,
  onSave,
  onSelectItem,
  onUpdateEnemyQuantity
}: PreparedCombatModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay" role="presentation">
      <div className="panel palette prepared-combat-modal" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="stack wide">
          <div className="row">
            <div>
              <p className="eyebrow">Prepared Combat</p>
              <h2>{questTitle}</h2>
              <p className="copy">
                Подготовь список врагов отдельно от полного редактирования квеста: ищи по всем НПС и монстрам кампании,
                фильтруй по CR и собирай сцену для запуска одной кнопкой.
              </p>
            </div>
            <button className="ghost" onClick={onClose} type="button">
              Esc
            </button>
          </div>

          {bootError ? (
            <div className="card mini form-error" role="status">
              <strong>Проблема при сохранении или добавлении</strong>
              <p>{bootError}</p>
            </div>
          ) : null}

          {notice ? (
            <div className="card mini form-success" role="status">
              <strong>Сохранено</strong>
              <p>{notice}</p>
            </div>
          ) : null}

          <PreparedCombatEditor
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
            onChangeTitle={onChangeTitle}
            onPeekEntity={onPeekEntity}
            onRemoveEnemy={onRemoveEnemy}
            onSelectItem={onSelectItem}
            onUpdateEnemyQuantity={onUpdateEnemyQuantity}
          />

          <PreparedCombatActions onClose={onClose} onSave={onSave} saving={saving} />
        </div>
      </div>
    </div>
  );
}
