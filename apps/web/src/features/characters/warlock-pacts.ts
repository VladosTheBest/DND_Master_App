import type { Bilingual } from "./rule-creatures";
import type { Edition } from "./rules-data";
export const CHAIN_SPECIAL_FORMS: Record<Edition,string[]> = {
  "2014":["imp","quasit","pseudodragon","sprite"].map(id=>id+"-2014"),
  "2024":["imp","quasit","pseudodragon","skeleton","slaad-tadpole","sprite","sphinx-of-wonder","venomous-snake"].map(id=>id+"-2024"),
};
export const BLADE_RULES: Record<Edition,Bilingual> = {
  "2014": {
    ru:"Действием создайте в пустой руке оружие договора, каждый раз выбирая вид рукопашного оружия. Пока держите его, вы им владеете; против сопротивления и иммунитета к немагическим атакам и урону оно считается магическим. Оно исчезает после 1 минуты на расстоянии больше 5 фт. от вас, при повторном создании, добровольном развеивании (без действия) или вашей смерти. Часовым ритуалом, держа одно магическое оружие, можно связать его с договором; ритуал допустим во время короткого отдыха. После этого убираемое оружие хранится в межпространственном кармане и появляется при создании оружия договора. Артефакт или разумное оружие связать нельзя. Связь с магическим оружием прекращается при вашей смерти, часовом ритуале с другим оружием или часовом ритуале разрыва связи; если оно было в кармане, появляется у ваших ног. Сам договор не позволяет заменять Силу или Ловкость Харизмой.",
    en:"As an action, create a pact weapon in an empty hand, choosing its melee weapon form each time. You are proficient while wielding it, and it counts as magical against resistance and immunity to nonmagical attacks and damage. It disappears after 1 minute more than 5 ft. from you, when created again, when dismissed without an action, or on your death. Holding one magic weapon throughout a 1-hour ritual bonds it instead; the ritual can occur during a Short Rest. Dismiss that weapon into an extradimensional space and recall it when creating your pact weapon. Artifacts and sentient weapons cannot be bonded. The magic weapon's bond ends on your death, a 1-hour ritual with another weapon, or a 1-hour ritual to end the bond; if stored, it appears at your feet. This pact alone does not substitute Charisma for Strength or Dexterity.",
  },
  "2024": {
    ru:"Бонусным действием создайте в руке простое или воинское рукопашное оружие и свяжитесь с ним либо свяжитесь с касаемым магическим оружием. Магическое оружие не должно быть настроено на другого или связано с другим колдуном. Пока связь действует, вы владеете оружием и можете использовать его как заклинательную фокусировку. При каждой атаке можно использовать Харизму вместо Силы или Ловкости для бросков атаки и урона; можно наносить обычный урон оружия либо некротический, психический или излучением. Связь заканчивается при повторном использовании этого бонусного действия, после 1 минуты на расстоянии больше 5 фт. от оружия или вашей смерти. Созданное оружие при окончании связи исчезает.",
    en:"As a Bonus Action, conjure and bond with a Simple or Martial Melee weapon in your hand, or bond with a magic weapon you touch. A magic weapon cannot be attuned to someone else or bonded to another Warlock. While bonded, you are proficient and can use it as a Spellcasting Focus. On each attack, you can use Charisma instead of Strength or Dexterity for attack and damage rolls and choose its normal damage type or Necrotic, Psychic or Radiant. The bond ends when you use this Bonus Action again, after the weapon stays more than 5 ft. from you for at least 1 minute, or on your death. A conjured weapon then disappears.",
  },
};
export const CHAIN_RULES: Record<Edition,Bilingual> = {
  "2014": {
    ru:"Изучаете Поиск фамильяра сверх обычного лимита известных заклинаний и можете применять его ритуалом. Кроме обычных форм доступны бес, квазит, псевдодракон и спрайт. Совершая действие Атака, можно отказаться от одной своей атаки, чтобы фамильяр реакцией совершил одну собственную атаку. Остальные условия заклинания, включая материальные компоненты, сохраняются.",
    en:"Learn Find Familiar without counting it against your spells known and cast it as a ritual. In addition to normal forms, choose an Imp, Quasit, Pseudodragon or Sprite. When taking the Attack action, forgo one attack to let the familiar make one of its attacks using its Reaction. Other spell requirements, including Material components, still apply.",
  },
  "2024": {
    ru:"Изучаете Поиск фамильяра и можете применять его действием Магия без ячейки. Кроме обычных форм доступны бес, квазит, псевдодракон, скелет, слаад-головастик, спрайт, сфинкс любознательности и ядовитая змея. Совершая действие Атака, можно отказаться от одной своей атаки, чтобы фамильяр реакцией совершил одну собственную атаку. Материальные компоненты и остальные условия заклинания сохраняются.",
    en:"Learn Find Familiar and cast it as a Magic action without a spell slot. Alongside normal forms, choose an Imp, Quasit, Pseudodragon, Skeleton, Slaad Tadpole, Sprite, Sphinx of Wonder or Venomous Snake. When taking the Attack action, forgo one attack to let the familiar make one of its attacks using its Reaction. Material components and other spell requirements still apply.",
  },
};

export const TOME_RULES: Record<Edition, Bilingual> = {
  "2014": {
    ru: "Книга теней даёт три выбранных заговора из списков любых классов. Пока книга при вас, их можно применять без ограничения; они считаются заклинаниями колдуна и не занимают обычный лимит заговоров. Если книга потеряна, часовой церемонией получите новую; церемония допустима во время короткого или долгого отдыха и уничтожает прежнюю книгу. При вашей смерти книга обращается в пепел.",
    en: "Your Book of Shadows grants three chosen cantrips from any class lists. While carrying the book, cast them at will as Warlock spells; they do not count against your normal cantrips known. Replace a lost book with a 1-hour ceremony, which can take place during a Short or Long Rest and destroys the previous book. The book turns to ash when you die.",
  },
  "2024": {
    ru: "В конце короткого или долгого отдыха создайте в руке Книгу теней выбранного облика. При каждом создании выберите три заговора и два ритуальных заклинания 1 круга из списков любых классов, которые у вас ещё не подготовлены. Пока книга при вас, они подготовлены как заклинания колдуна. Книгу можно использовать как заклинательную фокусировку. Её магия доступна только вам; она исчезает при создании новой или вашей смерти.",
    en: "At the end of a Short or Long Rest, conjure a Book of Shadows in your hand with an appearance you choose. Each time, choose three cantrips and two level-1 Ritual spells from any class lists that you do not already have prepared. While carrying the book, those spells are prepared as Warlock spells. The book is a Spellcasting Focus; only you can access its magic. It disappears when you create another or die.",
  },
};
export const TALISMAN_RULES: Bilingual = {
  ru: "Опциональный договор Tasha’s: носитель вашего талисмана после провала проверки характеристики может добавить 1d4 к результату. Всего применений — ваш бонус мастерства; они восстанавливаются после вашего долгого отдыха. Если талисман потерян, часовая церемония, допустимая во время короткого или долгого отдыха, создаёт замену и уничтожает прежний. При вашей смерти талисман обращается в пепел.",
  en: "Optional Tasha’s pact: after failing an ability check, the talisman's wearer can add 1d4 to the result. Total uses equal your proficiency bonus and return after your Long Rest. A lost talisman can be replaced with a 1-hour ceremony during a Short or Long Rest, destroying the previous one. It turns to ash when you die.",
};
