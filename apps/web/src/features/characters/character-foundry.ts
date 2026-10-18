import { equipmentEnglish } from "./starting-equipment";
import { zipSync, strToU8 } from "fflate";
import { ABILITIES, deriveCharacter, type CharacterDraft } from "./rules";
import { personalityEntries } from "./personality";
const html = (s: string) =>
  `<p>${s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`;
const skillKeys: Record<string, string> = {
  "animal-handling": "ani",
  "sleight-of-hand": "slt",
  athletics: "ath",
  acrobatics: "acr",
  arcana: "arc",
  deception: "dec",
  history: "his",
  insight: "ins",
  intimidation: "itm",
  investigation: "inv",
  medicine: "med",
  nature: "nat",
  perception: "prc",
  performance: "prf",
  persuasion: "per",
  religion: "rel",
  stealth: "ste",
  survival: "sur",
};

/** Native Actor import for Foundry 14 / dnd5e 6.0.x. No campaign tokens or edit links. */
export function characterFoundryActor(draft: CharacterDraft) {
  const c = deriveCharacter(draft);
  const description = (text: string) => ({ value: html(text) });
  const features = [
    ...c.features,
    ...c.feats,
    ...c.traits.map((name) => ({ name, description: name })),
  ];
  const spells = [
    ...new Map(
      [...c.selectedCantrips, ...c.selectedSpells, ...c.preparedSpells].map(
        (s) => [s.id, s],
      ),
    ).values(),
  ];
  const biography = [
    ...personalityEntries(draft.personality).map(
      (f) => `${f.label}\n${f.text}`,
    ),
    draft.notes,
  ].join("\n\n");
  const caster = c.spellcastingSources[0]?.ability;
  return {
    name: draft.name || "Персонаж",
    type: "character",
    img: draft.portrait || "icons/svg/mystery-man.svg",
    prototypeToken: { name: draft.name, actorLink: true, disposition: 1 },
    system: {
      source: { rules: draft.edition },
      abilities: Object.fromEntries(
        ABILITIES.map((id) => [
          id,
          {
            value: c.abilities[id],
            proficient: c.savingThrows.find((s) => s.ability === id)?.proficient
              ? 1
              : 0,
          },
        ]),
      ),
      attributes: {
        hp: { value: c.maxHp, max: c.maxHp },
        ac: { calcs: ["flat"], flat: c.armorClass },
        movement: { walk: c.speed, units: "ft" },
        ...(caster ? { spellcasting: caster } : {}),
      },
      details: {
        biography: { value: html(biography), public: html(biography) },
        spellLevel: c.level,
      },
      skills: Object.fromEntries(
        c.skills
          .filter((s) => skillKeys[s.id])
          .map((s) => {
            const value = s.proficient
              ? s.bonus - c.modifiers[s.ability] >= 2 * c.proficiencyBonus
                ? 2
                : 1
              : 0;
            return [
              skillKeys[s.id],
              {
                value,
                ability: s.ability,
                roll: {
                  bonus: String(
                    s.bonus -
                      c.modifiers[s.ability] -
                      value * c.proficiencyBonus,
                  ),
                },
              },
            ];
          }),
      ),
      currency: { gp: draft.gold ?? 0, pp: 0, ep: 0, sp: 0, cp: 0 },
      spells: {
        ...Object.fromEntries(
          c.spellSlots.map((n, i) => [
            `spell${i + 1}`,
            { override: n, value: n },
          ]),
        ),
        ...(c.pactSlots
          ? {
              pact: {
                override: c.pactSlots,
                value: c.pactSlots,
                level: c.pactSlotLevel,
              },
            }
          : {}),
      },
    },
    items: [
      {
        name: c.class?.name || draft.classId,
        type: "class",
        system: {
          identifier: draft.classId,
          levels: c.level,
          advancement: [],
          hd: { denomination: Number(c.hitDice.match(/d(\d+)/)?.[1] || 8) },
        },
      },
      ...(c.subclass
        ? [
            {
              name: c.subclass.name,
              type: "subclass",
              system: {
                identifier: c.subclass.id,
                classIdentifier: draft.classId,
                source: { rules: draft.edition },
                advancement: [],
              },
            },
          ]
        : []),
      ...(c.species
        ? [
            {
              name: c.species.name,
              type: "race",
              system: { description: description(c.traits.join("\n")) },
            },
          ]
        : []),
      ...(c.background
        ? [
            {
              name: c.background.name,
              type: "background",
              system: {
                description: description(c.background.description || ""),
              },
            },
          ]
        : []),
      ...(draft.equipment || []).map((item) => ({
        name: item.name,
        flags: { "shadow-edge": { englishName: equipmentEnglish[item.name] } },
        type: item.type,
        system: {
          quantity: item.quantity,
          equipped: false,
          description: description(
            "Предмет из листа персонажа. Механика определяется по компендиуму системы при импорте макросом.",
          ),
        },
      })),
      ...features.map((f) => ({
        name: f.name,
        type: "feat",
        system: {
          description: description(f.description),
          source: { rules: draft.edition },
        },
      })),
      ...spells.map((s) => ({
        name: s.name,
        type: "spell",
        system: {
          identifier: s.id.replace(/-(2014|2024)$/, ""),
          level: s.level,
          sourceItem: draft.classId,
          source: { rules: draft.edition },
          description: description(
            `${s.descriptionRu || s.summary || ""}\n\n${s.description}`,
          ),
          method: draft.classId === "warlock" ? "pact" : "spell",
          prepared:
            s.level === 0
              ? 2
              : c.preparedSpells.some((p) => p.id === s.id)
                ? 1
                : 0,
        },
        flags: { "shadow-edge-gm": { spellId: s.id } },
      })),
      ...(draft.notes
        ? [
            {
              name: "Снаряжение и заметки",
              type: "loot",
              system: { quantity: 1, description: description(draft.notes) },
            },
          ]
        : []),
    ],
    flags: {
      "shadow-edge-gm": {
        edition: draft.edition,
        exportVersion: 1,
        compatibility: "Foundry 14 / dnd5e 6.0.x",
        note: "Описания сохранены полностью. Заклинания и предметы следует сверить с компендиумом системы для автоматизации Activities.",
      },
    },
  };
}

export function characterFoundryMacro(draft: CharacterDraft) {
  const actor = characterFoundryActor(draft);
  const classNames: Record<string, string> = {
    barbarian: "Barbarian",
    bard: "Bard",
    cleric: "Cleric",
    druid: "Druid",
    fighter: "Fighter",
    monk: "Monk",
    paladin: "Paladin",
    ranger: "Ranger",
    rogue: "Rogue",
    sorcerer: "Sorcerer",
    warlock: "Warlock",
    wizard: "Wizard",
    artificer: "Artificer",
  };
  const source = JSON.stringify(actor);
  const command = `
if (!game.user.isGM) return ui.notifications.warn("Импорт выполняет мастер.");
if (game.system.id !== "dnd5e" || Number.parseInt(game.system.version,10) !== 6) return ui.notifications.error("Нужна система D&D5e 6.x (целевая версия 6.0.6).");
const data = ${source};
const classEnglish = ${JSON.stringify(classNames[draft.classId] || draft.classId)};
const edition = data.system.source.rules;
const missing = [];
const normalize = s => String(s || "").trim().toLowerCase().replaceAll("’", "'");
for (let i = 0; i < data.items.length; i++) {
 const item = data.items[i];
 const names = [item.name, item.flags?.["shadow-edge"]?.englishName, ...item.name.split(" · ").flatMap(name => name.split(" / ")), ...(item.type === "class" ? [classEnglish] : [])].map(normalize).filter(Boolean);
 let replacement;
 for (const pack of game.packs.values()) {
  if (pack.documentName !== "Item" || pack.metadata.packageName !== "dnd5e") continue;
  if (/24$/.test(pack.metadata.name) !== (edition === "2024")) continue;
  const index = await pack.getIndex({fields:["type","system.identifier"]});
  const hit = index.find(v => (v.type === item.type || item.flags?.["shadow-edge"]?.englishName && ["equipment", "weapon", "tool", "consumable", "loot", "container", "backpack"].includes(v.type)) && (names.includes(normalize(v.name)) || item.system.identifier && normalize(v.system?.identifier) === normalize(item.system.identifier)));
  if (!hit) continue;
  replacement = (await pack.getDocument(hit._id)).toObject();
  delete replacement._id; delete replacement._stats;
  replacement.name = item.name;
  replacement.system.description = item.system.description || replacement.system.description;
  if (item.type === "class") {
   replacement.system.levels = item.system.levels;
   data.system.traits ||= {};
   for (const advancement of Object.values(replacement.system.advancement || {})) {
    if (advancement.type !== "Trait" || advancement.level > 1 || advancement.classRestriction === "secondary" || advancement.configuration?.mode === "mastery") continue;
    for (const grant of advancement.configuration?.grants || []) {
     const kind = grant.startsWith("weapon:") ? "weaponProf" : grant.startsWith("armor:") ? "armorProf" : null;
     if (!kind) continue;
     const trait = data.system.traits[kind] ||= {value:[]};
     trait.value = [...new Set([...trait.value, grant.split(":").pop()])];
    }
   }
  }
  if (["class", "subclass"].includes(item.type)) replacement.system.advancement = [];
  if (item.type === "spell") { replacement.system.method = item.system.method; replacement.system.prepared = item.system.prepared; replacement.system.sourceItem = item.system.sourceItem; }
  if (item.system.quantity) replacement.system.quantity = item.system.quantity;
  replacement.flags = { ...replacement.flags, ...item.flags };
  break;
 }
 if (replacement) data.items[i] = replacement;
 else if (item.flags?.["shadow-edge"]?.englishName || ["spell","weapon","class","subclass"].includes(item.type)) missing.push(item.name);
}
if (data.img.startsWith("data:image/jpeg;base64,")) {
 const image = await (await fetch(data.img)).blob();
 const file = new File([image], "character-" + foundry.utils.randomID() + ".jpg", {type:"image/jpeg"});
 const uploaded = await foundry.applications.apps.FilePicker.implementation.upload("data", "worlds/" + game.world.id, file, {}, {notify:false});
 if (!uploaded?.path) throw new Error("Не удалось загрузить портрет в мир Foundry.");
 data.img = uploaded.path;
 data.prototypeToken.texture = {src: uploaded.path};
}
const actor = await Actor.create(data);
actor.sheet.render(true);
ui.notifications.info("Персонаж импортирован: " + actor.name);
if (missing.length) {
 const text = document.createElement("div"); text.textContent = "Нет совпадения в компендиуме этой редакции: " + missing.join(", ") + ". Описания сохранены. Настройте Activities этих записей вручную.";
 new Dialog({ title: "Проверка механики", content: text.outerHTML, buttons: { ok: { label: "Понятно" } } }).render(true);
}
`;
  return {
    name: `Импорт: ${draft.name || "Персонаж"}`,
    type: "script",
    scope: "global",
    img: "icons/svg/book.svg",
    command,
  };
}

export function downloadFoundryCharacter(draft: CharacterDraft) {
  const actor = characterFoundryActor(draft);
  const readme = `Shadow Edge GM — импорт персонажа\nЦель: Foundry 14 + D&D5e 6.0.6. Редакция: ${draft.edition}.\n\nРекомендуемый импорт с механикой из SRD:\n1. Распакуйте архив.\n2. В Foundry создайте пустой макрос типа Script и через его контекстное меню «Import Data / Импорт данных» выберите import-macro.json.\n3. Запустите макрос от имени мастера: он создаст нового персонажа, возьмёт совпавшие заклинания и оружие из компендиума той же редакции и покажет записи, требующие ручной проверки.\n\nПрямой импорт: создайте пустого Actor типа Character → контекстное меню «Import Data / Импорт данных» → actor.json. Этот вариант переносит данные и описания без разрешения механики по компендиуму; портрет выберите из portrait.jpg вручную. Макрос сам загружает портрет в папку мира.\n\nПредметы из списка снаряжения импортируются отдельно; свободные заметки сохраняются текстом. Экипировку включите на листе. Сложные эффекты способностей требуют проверки мастером. Повторный запуск макроса создаёт нового персонажа.\n`;
  const files = {
    "actor.json": strToU8(JSON.stringify(actor, null, 2)),
    "import-macro.json": strToU8(
      JSON.stringify(characterFoundryMacro(draft), null, 2),
    ),
    "README.txt": strToU8(readme),
  };
  const packageFiles: Record<string, Uint8Array> = files;
  if (draft.portrait)
    packageFiles["portrait.jpg"] = Uint8Array.from(
      atob(draft.portrait.split(",")[1]),
      (c) => c.charCodeAt(0),
    );
  const zip = zipSync(packageFiles);
  const url = URL.createObjectURL(
    new Blob([zip as BlobPart], { type: "application/zip" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(draft.name || "character").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").slice(0, 80)}-foundry.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
