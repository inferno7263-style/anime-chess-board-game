# Anime figurine assets

These 32 GLBs are original, generated, stylized placeholders—not official anime artwork or production character models. Names, colors, hairstyles, clothing and a few costume cues identify the user's lineup. Replace them with appropriately licensed character assets for final art.

The canonical manifest is `src/data/roster.ts`. Each character has a stable ID, `modelUrl`, chess role, initial square, color, accent and procedural fallback appearance. Set `modelUrl` to your replacement GLB. Do not change chess rules to implement character abilities.

Model contract: Y-up, feet/base resting at y=0, centered on x/z, facing +Z, total height about 1.15 scene units for back-rank pieces or 0.95 for pawns, maximum footprint 0.6 units. Include the chess base. Embed materials/textures or keep relative resources next to the GLTF. The renderer supplies lights, shadows, selection rings and auras; models need no lights/cameras.

Regenerate placeholders after dependency installation with `node scripts/generate-models.mjs`. The script derives identity and palette from the canonical roster. Premium replacement art may include animation clips, though the current renderer animates the figure as a single chess piece.

Stockfish is separate from this artwork; its license and engine files are under `/engine`.
