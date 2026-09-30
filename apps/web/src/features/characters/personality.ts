/** Optional narrative fields; old saved characters remain valid. No mechanical effects. */
export interface CharacterPersonality {
  backstory?: string;
  appearance?: string;
  traits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
}

export const PERSONALITY_FIELDS = [
  {
    id: "backstory",
    label: "История и происхождение",
    en: "Backstory and origin",
    limit: 3000,
    prompt: "Где вы выросли? Какое событие привело вас к приключениям?",
    promptEn: "Where did you grow up? What event led you to adventure?",
  },
  {
    id: "appearance",
    label: "Внешность",
    en: "Appearance",
    limit: 1000,
    prompt: "Что замечают при первой встрече: облик, одежда, голос?",
    promptEn: "What do people notice first: your appearance, clothing, voice?",
  },
  {
    id: "traits",
    label: "Черты характера",
    en: "Personality traits",
    limit: 1000,
    prompt: "Как вы ведёте себя с незнакомцами и под давлением?",
    promptEn: "How do you behave around strangers and under pressure?",
  },
  {
    id: "ideals",
    label: "Моральные ценности и идеалы",
    en: "Values and ideals",
    limit: 1000,
    prompt: "Во что вы верите? Какую черту никогда не переступите?",
    promptEn: "What do you believe in? What line would you never cross?",
  },
  {
    id: "bonds",
    label: "Привязанности",
    en: "Bonds",
    limit: 1000,
    prompt: "Кого или что вы стремитесь защитить? Кому обязаны?",
    promptEn: "Who or what do you protect? To whom do you owe a debt?",
  },
  {
    id: "flaws",
    label: "Слабости",
    en: "Flaws",
    limit: 1000,
    prompt: "Какой страх, соблазн или привычка мешает вам?",
    promptEn: "What fear, temptation, or habit gets in your way?",
  },
] as const;

export function isPersonality(
  value: unknown,
): value is CharacterPersonality | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, text]) =>
      PERSONALITY_FIELDS.some((f) => f.id === key) && typeof text === "string",
  );
}

export function personalityEntries(value?: CharacterPersonality) {
  return PERSONALITY_FIELDS.flatMap((field) => {
    const text = value?.[field.id]?.trim();
    return text ? [{ ...field, text }] : [];
  });
}
