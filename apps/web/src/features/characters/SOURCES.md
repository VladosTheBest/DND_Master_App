# Sources and supported rules

Verified 7 September 2026 against the official publisher sources:

- [SRD 5.1, Creative Commons edition](https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0License.pdf): 2014 classes, class tables, races, spell lists, 319 spell descriptions, ability generation, feats, leveling and multiclass distinction. Implementation supports a single class.
- [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf): 2024 character creation, class tables (pp. 28–82), backgrounds/species (pp. 83–87), feats and the 339 spell descriptions. The 2024 rules explicitly move ability increases to backgrounds and subclass selection to class level 3. Paladin and Ranger cast from level 1; prepared-spell tables replace the 2014 ability-modifier formulas for Cleric, Druid, Paladin and Wizard.
- [Official SRD download and version page](https://www.dndbeyond.com/srd).
- [2014 Basic Rules: Personality and Background](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/personality-and-background): factual skill pairs for Criminal, Folk Hero, Noble, Sage and Soldier. Descriptive Russian summaries in this catalogue are original, not copied background prose. Acolyte and custom-background creation come from SRD 5.1.

## Attribution

This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

Changes: machine-readable class and spell metadata, original Russian summaries/display names, selected feature summaries, character-creation validation, and derived statistics. Spell descriptions preserve the original English edition text with PDF whitespace normalized. A Russian spell name is a navigation aid; the linked edition's rules govern mechanics.

The creator also provides original Russian explanations for every spell in its catalogue, all class progression features, skills, subclass choices, weapon masteries, metamagic and other selectable options. These explanations describe use and key limitations; they are not a complete Russian translation of the SRDs. Edition text is available in the same spell/feature cards, without leaving the application. `feature-reference.ts` contains publisher class-feature excerpts extracted from the licensed PDFs by `scripts/extract-character-feature-reference.py` (PyMuPDF required); layout tables in these excerpts are reference material, not the calculation engine.

PDF export creates a separate, searchable document with the bundled DejaVu Sans font, rather than relying on the current tab's print dialog. The font's distribution license is included in `apps/web/public/fonts/LICENSE-DejaVu.txt`. Generation happens locally in the browser; character data is not sent to a PDF service. Printing remains a separate action. The export includes every selected spell regardless of the current sheet tab or search filter.

## What the generator automates

- All 12 SRD classes at levels 1–20, one SRD subclass per class; edition-specific subclass timing, ASIs, Fighter/Rogue extra ASIs and 2024 epic boons.
- Standard array and 27-point buy, fixed racial increases in 2014 and constrained background increases in 2024. Half-Elf flexible increases exclude Charisma.
- Class skills, background/species extra skills, expertise, a selected catalogue of fighting styles, invocations, metamagic, weapon masteries, class orders and subclass choices.
- Separate full/half caster slots and Warlock Pact Magic. Edition-specific known/prepared counts; Wizard's initial 6 spells and two per additional level, retained acquisition history, preparation and Evocation Savant extras.
- Automatic domain/oath/Draconic/Fiend/Circle of Land spells, innate spells, Magic Initiate and Mystic Arcanum selections, without consuming class preparation slots.
- Fixed (rounded-up average) hit-point gains; retroactive Constitution, Dwarf/Draconic bonuses; unarmored AC, initiative, saving throws and skill bonuses.

## Explicit scope limits

The interface calls this an open-rules selection, not every published D&D option. Some species are presented as a particular lineage (for example, infernal Tiefling); available feats, fighting styles, invocations and other choices are curated subsets. Unlisted options, multiclassing, optional 2014 variant rules and non-SRD subclasses are not silently simulated. Leveling assumes a newly built single-class character, without scroll-copying or adventure-earned bonus feats. Spell replacement follows class-level progression; a short/long-rest preparation manager is outside this creation flow.

Equipment, armor/shield selection, tools, languages, creature forms/familiars, campaign-specific possessions and expendable resources are recorded in notes. The sheet labels its armor class as unarmored. Class features are listed with source summaries; the generator is not a combat automation engine and does not calculate every conditional advantage, damage rider or resource use. These limits are also displayed on the character sheet.

## Reproduction and verification

`node scripts/test-character-rules.mjs` tests the browser rules directly, including all 480 edition/class/level combinations and regression cases for spell history, edition boundaries, Pact Magic, preparation, ability increases, subclass timing and capstones. It also checks that the embedded server catalogue exactly matches a fresh export.

`node scripts/export-character-catalog.mjs` regenerates the embedded Go catalogue and valid parity fixtures from the same TypeScript rules. The server validates and calculates public submissions independently; its tests compare accepted builds and derived statistics against these fixtures. Run the export after changing any rules or catalogue data.

`node scripts/export-character-catalog.mjs --check` performs the same derivation without writing files and fails if the snapshot differs. The checked-in fixtures include all class/edition builds at levels 1, 5 and 20, every supported species/background, and additional human Magic Initiate combinations.
