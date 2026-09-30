import type { Edition } from "./rules-data";
/** Reviewed independent English mechanics, in the same order as subclass features. */
const old: Record<string, string[]> = {
 alchemist:[
  "Gain proficiency with Alchemist’s Supplies; if already proficient, choose another Artisan’s Tool.",
  "At the end of a Long Rest, use Alchemist’s Supplies to create an elixir in an empty flask you touch. Roll d6 for its effect. A creature drinks it, or administers it to an Incapacitated creature, as an action. You can use an action and expend a spell slot of any level to create another elixir and choose its effect. Create 1 free elixir per rest, 2 from level 6, and 3 from level 15. Elixirs expire at the end of your next Long Rest.",
  "When casting through Alchemist’s Supplies, add your Intelligence modifier, minimum +1, to one healing roll or one roll of Acid, Fire, Necrotic, or Poison damage.",
  "A creature drinking your Experimental Elixir also gains 2d6 + your Intelligence modifier temporary HP, minimum 1. Cast Lesser Restoration through Alchemist’s Supplies without a spell slot or preparation a number of times equal to your Intelligence modifier, minimum 1, per Long Rest.",
  "Gain Resistance to Acid and Poison and immunity to Poisoned. Through Alchemist’s Supplies, cast Greater Restoration and Heal without preparation, spell slots, or Material components; each can be cast this way once per Long Rest.",
 ],
 armorer:[
  "Gain Heavy armor and Smith’s Tools proficiency. Replace an already-known tool proficiency with another Artisan’s Tool.",
  "Use an action with Smith’s Tools to convert armor you wear into Arcane Armor. Ignore its Strength requirement; use it as your Artificer focus, and it cannot be removed against your will. It covers your entire body, functionally replaces missing limbs, and its helmet can retract or deploy as a Bonus Action. Don or doff it as an action. The effect ends when you die or convert a different suit.",
  "Choose an armor model; change it at the end of a Short or Long Rest while holding Smith’s Tools. Use Intelligence instead of Strength or Dexterity for attacks and damage with its special weapon.",
  "When taking the Attack action on your turn, make two attacks instead of one.",
  "Treat the armor’s chest piece, boots, helmet, and special weapon as four separate items for infusion. Each holds one infusion, retained when changing models. Your active infusion limit increases by 2, but those additional items must be parts of this armor.",
  "Guardian: when a Huge or smaller creature you can see ends its turn within 30 feet, use a Reaction to force a Strength save against your spell save DC. On failure, pull it up to 25 feet; if it ends within 5 feet, make a melee weapon attack against it as part of the same Reaction. Uses equal PB per Long Rest. Infiltrator: a creature damaged by your Lightning Launcher sheds Dim Light for 5 feet and has Disadvantage on attacks against you until the start of your next turn. The next attack against it has Advantage and, on a hit, deals an additional 1d6 Lightning damage.",
 ],
 artillerist:[
  "Gain proficiency with Woodcarver’s Tools; if already proficient, choose another Artisan’s Tool.",
  "With Smith’s Tools or Woodcarver’s Tools, use an action to create a Small or Tiny Eldritch Cannon on a horizontal surface in an unoccupied space within 5 feet. A Tiny cannon can be held in one hand; a Small cannon occupies its space. Maintain one cannon. Creation is free once per Long Rest; further creations cost a spell slot. A cannon lasts 1 hour, until reduced to 0 HP, or until dismissed as an action. Its full statistics and operating modes are in the linked item reference.",
  "At the end of a Long Rest, use Woodcarver’s Tools to carve a wand, staff, or rod into an Arcane Firearm. Only one can have this property. It is an Artificer focus; when you cast a damaging Artificer spell through it, add 1d8 to one damage roll of that spell.",
  "Your cannon’s damage rolls gain 1d8. Use an action while within 60 feet to detonate it: creatures within 20 feet make a Dexterity save against your spell save DC, taking 3d8 Force damage on failure or half on success. The cannon is destroyed.",
  "Maintain two cannons and create both with the same action. When paying spell slots to create them, pay separately for each. One Bonus Action activates both, with different commands allowed. You and allies within 10 feet of a cannon have Half Cover.",
 ],
 "battle-smith":[
  "Gain proficiency with Smith’s Tools; if already proficient, choose another Artisan’s Tool.",
  "Gain Martial weapon proficiency. You may use Intelligence instead of Strength or Dexterity for attack and damage rolls with magic weapons.",
  "A friendly Steel Defender obeys your commands. It shares your Initiative but acts immediately after you. Mending restores 2d6 of its HP. It dies when you die. It can move and use its Reaction freely, but takes Dodge unless you spend a Bonus Action to order another action; if you are Incapacitated it acts freely. Within 1 hour after its death, use an action with Smith’s Tools within 5 feet and expend any spell slot: it returns to full HP after 1 minute. At the end of a Long Rest, Smith’s Tools can create a replacement; the old defender immediately dies.",
  "When taking the Attack action on your turn, make two attacks instead of one.",
  "When you hit with a magic weapon or your defender hits, choose either an extra 2d6 Force damage to the target or 2d6 healing to a creature or object you can see within 30 feet of that target. Use at most once per turn, a number of times equal to your Intelligence modifier, minimum 1, per Long Rest.",
  "Arcane Jolt deals or heals 4d6. The defender gains +2 AC. When it uses Deflect Attack, the attacker takes 1d4 + your Intelligence modifier Force damage.",
 ],
};
const revised: Record<string, string[]> = {
 alchemist:[
  "Gain proficiency with Alchemist’s Supplies and the Herbalism Kit. Replace each already-known proficiency with another Artisan’s Tool. Crafting potions takes half the usual time.",
  "At the end of a Long Rest while holding Alchemist’s Supplies, create 2 elixirs, rolling d6 separately for each. Create 3 from level 5, 4 from level 9, and 5 from level 15. A creature drinks one or administers it to another creature within 5 feet as a Bonus Action. Use a Magic action with the tools and expend any spell slot to create another elixir with an effect of your choice. A flask appears with each elixir and vanishes when drunk or poured out; remaining flasks and elixirs vanish after your next Long Rest.",
  "When casting through Alchemist’s Supplies, add your Intelligence modifier, minimum +1, to one healing roll or one roll of Acid, Fire, or Poison damage.",
  "Cast Lesser Restoration through Alchemist’s Supplies without a spell slot a number of times equal to your Intelligence modifier, minimum 1, per Long Rest.",
  "Gain Resistance to Acid and Poison and immunity to Poisoned. Once on each of your turns when you cast an Alchemist spell dealing Acid, Fire, or Poison damage to a target, deal an additional 2d8 Force damage to that target. Once per Long Rest, cast Tasha’s Bubbling Cauldron through Alchemist’s Supplies without preparation, a spell slot, or Material components.",
 ],
 armorer:[
  old.armorer[0]+" Crafting magic or nonmagical armor takes half the usual time.",
  "Use a Magic action while holding Smith’s Tools to convert armor you wear into Arcane Armor. Ignore its Strength requirement; use it as your Artificer focus, and it cannot be removed against your will. Don or doff it as a Utilize action. The effect ends when you die or don another suit.",
  old.armorer[2],old.armorer[3],
  "Learn an additional Replicate Magic Item plan for Armor; a replacement for this plan must also be Armor. Create one additional Armor replica beyond your normal active limit. Your model’s special weapon gains +1 to attack and damage rolls.",
  "Guardian: gauntlets deal 1d10 Thunder. When a Huge or smaller visible creature ends its turn within 30 feet, use a Reaction to force a Strength save against your spell save DC. Failure pulls it up to 25 feet; if it ends within 5 feet, make a melee weapon attack against it as part of that Reaction. Uses equal Intelligence modifier, minimum 1, per Long Rest. Infiltrator: launcher damage becomes 2d6 Lightning. A creature it damages sheds Dim Light for 5 feet and has Disadvantage on attacks against you until the start of your next turn. A Bonus Action grants Fly Speed twice your walking Speed until the end of this turn; Intelligence modifier uses, minimum 1, per Long Rest. Dreadnought: ball damage becomes 2d6 Force; during Giant Stature choose Large or Huge size, reach increases by 10 feet, and Strength checks and saves have Advantage.",
 ],
};
revised.artillerist = [
 old.artillerist[0]+" Gain Martial Ranged weapon proficiency; crafting Wands takes half the usual time.",
 "With Smith’s Tools or Woodcarver’s Tools, use a Magic action to create a Small or Tiny Eldritch Cannon on a horizontal surface in an unoccupied space within 5 feet. A Tiny cannon can be held in one hand; a Small cannon occupies its space. Maintain one cannon. Creation is free once per Long Rest; further creations cost a spell slot. A cannon lasts 1 hour, until reduced to 0 HP, or until dismissed as a Magic action. Its full statistics and operating modes are in the linked item reference.",
 "At the end of a Long Rest, use Woodcarver’s Tools to carve a wand, staff, rod, or Martial Ranged weapon into an Arcane Firearm. Only one can have this property. It is an Artificer focus; when you cast a damaging Artificer spell through it, add 1d8 to one damage roll of that spell.",
 "Your cannon’s damage and temporary HP rolls gain 1d8. When a cannon within 60 feet takes damage, use your Reaction to detonate it: creatures within 20 feet make a Dexterity save against your spell save DC, taking 3d10 Force damage on failure or half on success. The cannon is destroyed.",
 "Maintain two cannons and create both with one Magic action. When paying spell slots to create them, pay separately for each. One Bonus Action activates both, with different commands allowed. You and allies within 10 feet of a cannon have Half Cover.",
];
revised["battle-smith"] = [
 old["battle-smith"][0]+" Crafting magic or nonmagical weapons takes half the usual time.",
 old["battle-smith"][1]+" Any weapon with which you are proficient can serve as your Artificer focus.",
 "A friendly Steel Defender obeys your commands and acts during your turn. It vanishes when you die. It can move and use its Reaction freely, but takes Dodge unless you spend a Bonus Action to order another action; if you are Incapacitated it acts freely. Within 1 hour after its death, touch it with a Magic action and expend any spell slot: it returns to full HP after 1 minute. At the end of a Long Rest, Smith’s Tools can create a replacement; the old defender vanishes.",
 old["battle-smith"][3]+" You may replace one attack with a command for your defender to use Force-Empowered Rend.",
 old["battle-smith"][4],
 "Arcane Jolt deals or heals 4d6. When your defender uses Deflect Attack, the attacker takes 1d4 + your Intelligence modifier Force damage.",
];
revised.cartographer = [
 "Gain proficiency with Calligrapher’s Supplies and Cartographer’s Tools; replace each already-known proficiency with another Artisan’s Tool. Crafting Spell Scrolls takes half the usual time.",
 "At the end of a Long Rest while holding Cartographer’s Tools, touch between 2 and 1 + your Intelligence modifier creatures, with a minimum upper limit of 2; you may include yourself. Each gains a map that others cannot read. Maps vanish when you die or create another atlas. A holder carrying their map adds 1d4 to Initiative and knows the location of every other holder on the same plane. When targeting another holder with a spell or effect requiring sight, ignore vision and cover, but retain range requirements.",
 "Cast Faerie Fire without a spell slot a number of times equal to your Intelligence modifier, minimum 1, per Long Rest. On your turn, spend movement equal to half your Speed rounded down to teleport to a visible unoccupied space within 10 feet of you, or within 5 feet of a map holder within 30 feet of you. Speed 0 prevents this teleportation.",
 "Once per turn when casting a Cartographer spell or hitting a target illuminated by your Faerie Fire, add your Intelligence modifier to one damage roll of that spell or attack. Taking damage cannot break your Concentration on Faerie Fire.",
 "When using Flash of Genius, as part of the same Reaction teleport yourself or a willing creature you can see within 30 feet up to 30 feet to an unoccupied space you can see.",
 "When a map holder falls to 0 HP without being killed outright, they may destroy their map to instead have HP equal to twice your Artificer level and teleport to an unoccupied space within 5 feet of you or another holder of their choice. While you are a map holder, cast Find the Path once per Long Rest without preparation, a spell slot, or components.",
];
revised.reanimator = [
 "Gain proficiency with Alchemist’s Supplies; if already proficient, choose another Artisan’s Tool. When casting Spare the Dying, you may alter it: the target regains HP equal to your Artificer level, and each creature in a 10-foot Emanation from it makes a Dexterity save against your spell save DC, taking 2d4 Lightning damage on failure or half on success. Uses equal your Intelligence modifier per Long Rest. Damage increases to 3d4 at level 11 and 4d4 at level 17.",
 "Use a Magic action with Tinker’s Tools or other Artisan’s Tools with which you are proficient to create a companion in an unoccupied space within 5 feet. Create one free per Long Rest; further creations cost a spell slot. You cannot create another while it exists. Friendly to you and your allies, it obeys commands, moves and uses its Reaction freely, but takes Dodge unless you spend a Bonus Action to order another action; if you are Incapacitated it acts freely. It harmlessly dissolves at the end of your Long Rest or when dismissed with a Magic action. When you die, it drops to 0 HP, dies, and triggers Death Burst.",
 "Whenever you create the companion, choose one modification; choose two from level 9 and three from level 15.",
 "Death Burst deals 4d4 damage. The companion’s Necrotic damage ignores Resistance.",
 "Once per Long Rest, cast Raise Dead through Artisan’s Tools with which you are proficient without a spell slot or Material components. When you take damage, use a Reaction to regain HP equal to your companion’s current HP; its HP becomes 0, it dies, and triggers Death Burst.",
];
export const ARTIFICER_FEATURE_EN: Record<Edition, Record<string,string[]>> = {"2014":old,"2024":revised};
