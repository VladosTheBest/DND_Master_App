# Bundled effect artwork

Original PNG assets generated with the built-in imagegen tool for this module. User images were visual references only and are not distributed. No external animation module, media service or runtime image generation is required. All PNG files in this directory ship in the module ZIP; the game animates their GPU sprites with deterministic motion, particles and fades.

- `weapons.png`: detailed sword, axe, hammer and dagger atlas. `effect-art.mjs` uses inspected pixel bounds rather than assuming equal cells.
- `blood-slash.png`: one painted crimson slash and droplets, shown only for a confirmed hit (or the explicit local preview).
- `vines.png`: one thorny vine ring, layered and slowly deformed by sprite motion for single-target binding.
- `magic.png`: fire, ice, arcane and radiant textures, in four quadrants.

The source PNGs are retained unmodified. These are static texture components, not generated frame-by-frame animations. Custom spell colors use the procedural layer where a precolored texture would conflict. Long-lived regions use the existing concentration/duration lifecycle.

## Prompt set

The following records the generation specifications; all calls requested a transparent background. The final application adds motion and timing in code.

1. **Weapons:** Premium fantasy game VFX, stylized detailed concept art. One 2 by 2 atlas: top-left horizontal longsword, top-right battleaxe, bottom-left warhammer, bottom-right dagger. Handles point left; orthographic broadside view. Readable at 150–250 pixels with steel bevels, scratches, leather and restrained gold details. Separate complete silhouettes, padding, transparent background. No characters, ground, text or glow.
2. **Vines:** One circular top-down snarl of living emerald vines, brown roots and ivory thorns, small leaves, detailed bark and specular highlights. Leave transparency in the center for a readable token. Complete silhouette, no ground, characters, labels or animation grid.
3. **Blood slash:** One sweeping crimson crescent from lower-left toward upper-right, pale scarlet-white core, translucent red streaks and glossy outward droplets along the convex edge. Transparent background. No creatures, body parts, ground or weapon. Intended as a growing, sweeping and fading game VFX component.
4. **Magic:** Premium painted fantasy VFX atlas, strict 2 by 2 quadrants on transparency: turbulent orange fire orb, faceted blue ice cluster, ornate purple arcane rune vortex with empty center, golden sunburst with empty center. Crisp readable details, no text or ground.

## Continuous area surfaces

`area-vines.png`, `area-web.png` (transparent) and `area-darkness.png` (opaque) were generated with the built-in imagegen tool. Original files are copied unchanged into this directory. `area-surface.mjs` animates one 25×25 vertex plane per region; the existing shape mask clips circles, rotated shapes and holes. Shared texture caching avoids a texture copy per region. No external module or image service is needed during play.

Final prompt specifications:
- **Area vines:** one continuous square top-down carpet of emerald vines, woody roots, ivory thorns and leaves. Uniform edge-to-edge coverage through the center and corners, narrow transparent gaps, no wreath or large central hole, no ground, characters, text or repeated clusters. Detailed painted fantasy VFX.
- **Area web:** one continuous square field of silver/ivory cobweb silk with curved strands, connected off-center hubs, braided anchor threads and small dew pearls. True transparent gaps; no spiders, ground, text, frame or separate stamps. Premium top-down fantasy VFX.
- **Area darkness:** one continuous square field of almost-black volumetric smoke, charcoal folds with muted indigo/amethyst highlights, detail throughout the square. No vortex, stars, bright neon, symbols, ground, text or repeated particles. Opaque top-down cinematic smoke.


## Foundation 0.14.0

Created with the built-in imagegen tool, true transparency, copied unchanged. Animation and atlas frames are applied in PIXI at runtime.

- `wall-fire.png`: wide 3:1 top-down continuous ribbon of roaring orange/scarlet/golden fire; white-hot seam, turbulent interwoven tongues curling out along both long edges, feathered transparent tips, extends through left/right edges. Detailed painterly plasma, no ground, tiles, text or separate fireballs. A 65×9 plane bends along a wall or ring; mirrored ring UVs remove the endpoint seam.
- `bite.png`: square isolated open predatory reptilian bite. Two separate semicircular rows of curved ivory fangs on dark scaled jaw rims, upper teeth down and lower teeth up, transparent middle and separation at horizontal midline. Intricate enamel, root shading and highlights; no head, tongue, body or blood. GPU half-frames close together; confirmed hits add the existing blood texture.
- `creature-weapons.png`: square transparent four-quadrant premium fantasy atlas. Top-left detailed horizontal steel flanged mace, top-right wooden spear with polished steel leaf tip, bottom-left glossy purple curved tentacle with pale suckers, bottom-right green scaled reptile tail with bony spines. Handles/bases left and tips right, padding, dimensional painterly shading; no labels, ground, dividers or glow. Runtime frames share one GPU texture.
