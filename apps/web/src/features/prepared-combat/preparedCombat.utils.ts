import type {
  KnowledgeEntity,
  PreparedCombatPlan,
  QuestEntity
} from "@shadow-edge/shared-types";
import type { PreparedCombatHostEntity } from "../combat/combat.types";
import {
  defaultPreparedCombatTitle,
  formatAllyCountLabel,
  formatPartyCountLabel,
  parseChallengeXp,
  resolveEntityPreparedCombats
} from "../combat/combat.utils";
import type {
  PreparedCombatCardView,
  PreparedCombatResolvedEntry
} from "./preparedCombat.types";

type CombatCreatureEntity = Extract<KnowledgeEntity, { kind: "player" | "npc" | "monster" }>;
type PreparedCombatNpcEntity = Extract<KnowledgeEntity, { kind: "npc" | "monster" }>;

const normalizePreparedCombatQuantity = (value: number) =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

const summarizePreparedCombatNames = (names: string[]) => {
  if (!names.length) {
    return "не выбраны";
  }
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]}, ${names[1]}`;
  }
  return `${names[0]}, ${names[1]} и ещё ${names.length - 2}`;
};

export const createPreparedCombatDraft = (title = ""): PreparedCombatPlan => ({
  title,
  items: []
});

export const createQuestPreparedCombatDraft = (questTitle: string) =>
  createPreparedCombatDraft(`${questTitle}: бой`);

export const resolvePreparedCombatEntries = (
  entityMap: Map<string, KnowledgeEntity>,
  plan?: PreparedCombatPlan | null
): PreparedCombatResolvedEntry[] =>
  (plan?.items ?? [])
    .map((item) => {
      const entity = entityMap.get(item.entityId);
      if (!entity || (entity.kind !== "player" && entity.kind !== "npc" && entity.kind !== "monster")) {
        return null;
      }
      return {
        entity,
        quantity: normalizePreparedCombatQuantity(item.quantity)
      };
    })
    .filter((item): item is PreparedCombatResolvedEntry => Boolean(item));

export const resolvePreparedCombatPlayers = (
  entityMap: Map<string, KnowledgeEntity>,
  plan?: PreparedCombatPlan | null
) =>
  (plan?.playerIds ?? [])
    .map((playerId) => entityMap.get(playerId))
    .filter((entity): entity is Extract<KnowledgeEntity, { kind: "player" }> => entity?.kind === "player");

export const resolvePreparedCombatAllies = (
  entityMap: Map<string, KnowledgeEntity>,
  plan?: PreparedCombatPlan | null
) =>
  (plan?.allies ?? [])
    .map((item) => {
      const entity = entityMap.get(item.entityId);
      if (entity?.kind !== "npc" && entity?.kind !== "monster") {
        return null;
      }
      return {
        entity,
        quantity: normalizePreparedCombatQuantity(item.quantity)
      };
    })
    .filter((item): item is { entity: PreparedCombatNpcEntity; quantity: number } => Boolean(item));

export const resolvePreparedCombatEnemies = (
  entityMap: Map<string, KnowledgeEntity>,
  plan?: PreparedCombatPlan | null
) =>
  resolvePreparedCombatEntries(entityMap, plan).filter(
    (item): item is { entity: PreparedCombatNpcEntity; quantity: number } =>
      item.entity.kind === "npc" || item.entity.kind === "monster"
  );

export const resolvePreparedCombatEntriesForPlans = (
  entityMap: Map<string, KnowledgeEntity>,
  plans: PreparedCombatPlan[] = []
) => plans.flatMap((plan) => resolvePreparedCombatEntries(entityMap, plan));

export const resolveQuestPreparedCombatEntries = (
  entityMap: Map<string, KnowledgeEntity>,
  quest: QuestEntity | null
) => (quest ? resolvePreparedCombatEntriesForPlans(entityMap, resolveEntityPreparedCombats(quest)) : []);

export const buildPreparedCombatCardView = ({
  entity,
  entityMap,
  hasActiveCombatEntries,
  plan,
  planIndex
}: {
  entity: PreparedCombatHostEntity;
  entityMap: Map<string, KnowledgeEntity>;
  hasActiveCombatEntries: boolean;
  plan: PreparedCombatPlan;
  planIndex: number;
}): PreparedCombatCardView => {
  const players = resolvePreparedCombatPlayers(entityMap, plan);
  const allies = resolvePreparedCombatAllies(entityMap, plan);
  const enemies = resolvePreparedCombatEnemies(entityMap, plan);
  const allyCount = allies.reduce((sum, item) => sum + item.quantity, 0);
  const enemyCount = enemies.reduce((sum, item) => sum + item.quantity, 0);
  const playerNames = players.map((player) => player.title);
  const allyNames = allies.map(({ entity: allyEntity, quantity }) => (quantity > 1 ? `${allyEntity.title} x${quantity}` : allyEntity.title));
  const partyNames = [...playerNames, ...allyNames];
  const enemyNames = enemies.map(({ entity: combatEntity, quantity }) =>
    quantity > 1 ? `${combatEntity.title} x${quantity}` : combatEntity.title
  );
  const enemyXpTotal = enemies.reduce(
    (sum, item) => sum + parseChallengeXp(item.entity.statBlock?.challenge ?? "") * item.quantity,
    0
  );

  return {
    title: plan.title?.trim() || defaultPreparedCombatTitle(planIndex),
    playersText: allyCount
      ? `Партия: ${players.length} ${formatPartyCountLabel(players.length)} • ${allyCount} ${formatAllyCountLabel(allyCount)} • ${summarizePreparedCombatNames(partyNames)}`
      : `Игроки: ${players.length || 0} • ${summarizePreparedCombatNames(playerNames)}`,
    enemiesText: `Враги: ${enemyCount} • ${summarizePreparedCombatNames(enemyNames)}`,
    xpText: enemyXpTotal > 0 ? `Суммарно ${enemyXpTotal} XP` : "XP подтянется из CR и состава врагов",
    startDisabled: hasActiveCombatEntries,
    startLabel: hasActiveCombatEntries ? "Есть активный бой" : "Начать бой"
  };
};

export const resolvePreparedCombatListCopy = (entity: PreparedCombatHostEntity) => ({
  createDescription: "Сохрани сюда отдельную сцену боя с нужными игроками и противниками, чтобы запускать её одной кнопкой.",
  description:
    entity.kind === "quest"
      ? "Несколько готовых сцен для этого квеста: засада, переговоры, финальная схватка или запасной боевой поворот."
      : "Отдельные заготовленные сцены боя для этой локации: гарнизон, случайная встреча, тревога или финальная оборона.",
  emptyDescription:
    "Пока карточек боя нет. Создай первую, и она откроется сразу в экране подготовки боя с отдельным сохранением."
});
