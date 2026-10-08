# Bundled effect artwork

Four original transparent PNG assets generated with the built-in imagegen tool for this module. User images were visual references only and are not distributed. No external animation module, media service or runtime image generation is required. All PNG files in this directory ship in the module ZIP; the game animates their GPU sprites with deterministic motion, particles and fades.

- `weapons.png`: detailed sword, axe, hammer and dagger atlas. `effect-art.mjs` uses inspected pixel bounds rather than assuming equal cells.
- `blood-slash.png`: one painted crimson slash and droplets, shown only for a confirmed hit (or the explicit local preview).
- `vines.png`: one thorny vine ring, layered and slowly deformed by sprite motion for binding and persistent terrain.
- `magic.png`: fire, ice, arcane and radiant textures, in four quadrants.

The source PNGs are retained unmodified. These are static texture components, not generated frame-by-frame animations. Custom spell colors use the procedural layer where a precolored texture would conflict. Long-lived regions use the existing concentration/duration lifecycle.

## Prompt set

The following records the generation specifications; all calls requested a transparent background. The final application adds motion and timing in code.

1. **Weapons:** Premium fantasy game VFX, stylized detailed concept art. One 2 by 2 atlas: top-left horizontal longsword, top-right battleaxe, bottom-left warhammer, bottom-right dagger. Handles point left; orthographic broadside view. Readable at 150–250 pixels with steel bevels, scratches, leather and restrained gold details. Separate complete silhouettes, padding, transparent background. No characters, ground, text or glow.
2. **Vines:** One circular top-down snarl of living emerald vines, brown roots and ivory thorns, small leaves, detailed bark and specular highlights. Leave transparency in the center for a readable token. Complete silhouette, no ground, characters, labels or animation grid.
3. **Blood slash:** One sweeping crimson crescent from lower-left toward upper-right, pale scarlet-white core, translucent red streaks and glossy outward droplets along the convex edge. Transparent background. No creatures, body parts, ground or weapon. Intended as a growing, sweeping and fading game VFX component.
4. **Magic:** Premium painted fantasy VFX atlas, strict 2 by 2 quadrants on transparency: turbulent orange fire orb, faceted blue ice cluster, ornate purple arcane rune vortex with empty center, golden sunburst with empty center. Crisp readable details, no text or ground.
