# Character appearance selector

The title and pause screens offer **3D MODEL** and **2D SPRITE**. The original model remains the default. The selected style persists under `ash-vector:character-style` in local storage; blocked storage does not prevent switching. Pausing and changing style preserves position, health, score, weapons, enemies, and mission progress.

## Rendering

The 2D operative uses the generated original anime artwork in `public/sprites/operative-sheet-v1.png`. Sixteen authored crop bounds and body anchors accommodate the source sheet's irregular gutters. A one-time border-connected background removal preserves ivory armor and enclosed highlights. Two exclusion masks remove neighboring boot/muzzle fragments. The renderer creates transparent Three.js sprite textures, mirrors the texture and anchor for left-facing poses, and chooses poses from actual movement, airborne, firing, aiming, dashing, and hurt state. Animation uses simulation time so it freezes while paused. The world, enemy models, combat and collision rules are shared by both styles.

The sprite option stays disabled until decoding and texture preparation finish. Failed artwork leaves the 3D model available. Textures are disposed with the scene. Vercel's SPA fallback excludes `/sprites/` so the image is served as an image rather than HTML.

## Verification

- TypeScript, scoped lint, production build, and gameplay/phone/camera simulation tests pass.
- Sprite unit tests cover action priority, standing on raised platforms, preserving enclosed white highlights and ivory armor, and registered crop bounds.
- Production-preview browser tests cover both renderers, run/jump/dash frames, switching during pause without resetting progress, paused animation, preference persistence for both styles, blocked local storage, and failed image loading.
- Selector and deployment buttons remain reachable with at least 44-pixel touch targets at 393x852, 320x568, 844x390, and 568x320. Screenshots confirm a transparent sprite in the battlefield.
- The real multi-touch input regression suite passes in both styles at four phone sizes. Full missions using each style defeated all 22 enemies and the boss with no deaths and no uncaught browser exceptions.

Browser checks use Chromium desktop and touch emulation. Physical Android/iPhone devices and Safari are not verified. The generated poses are animation keyframes, not a fully hand-animated character rig; the 3D option retains continuous skeletal-part aiming.
