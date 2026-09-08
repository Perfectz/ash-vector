# ASH VECTOR operative sprite artwork, v1

Generated with OpenAI built-in image generation, 2026-09-08.

Original cel-shaded operative inspired by Guilty Gear Strive's anime presentation. Preserves ASH VECTOR's ivory/graphite armor, orange accents, cyan visor and pulse rifle.

## Pose order

Read left to right, top to bottom:
- Row 1: four idle variations.
- Row 2: four running key poses.
- Row 3: anticipation, ascent, apex, landing.
- Row 4: rifle fire, upward aim, airborne dash, hit reaction.

## Asset status

1254 x 1254 RGB source PNG on a white background. The game uses a copy at `public/sprites/operative-sheet-v1.png`. Its sprite renderer in `app/game/sprite.ts` creates transparent, individually cropped frames with registered pivots at load time, preserving the enclosed armor highlights. Two crop masks exclude neighboring poses where the source artwork crosses row boundaries. The source artwork remains unchanged.

Select **2D SPRITE** in the title or pause menu to use the anime operative. **3D MODEL** retains the original modeled character. The renderer selection is saved locally and does not change the simulation or collision rules.
