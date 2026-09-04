# ASH VECTOR

An original, fully 3D arcade run-and-gun mission inspired by the intensity of classic action games. Cross three industrial skybridge sectors and destroy the multi-phase MANTICORE siege engine.

## Play

- WASD / arrows: move along and across the bridge.
- Mouse: aim; hold left click to fire. Hold J for automatic targeting and fire.
- Space: jump; press again to double jump.
- Shift: invulnerable dash, followed by a short recharge.
- E / right click: grenade. Q: cycle pulse carbine, breach shotgun, arc lance.
- Escape / P: pause. M: mute. Enter: deploy, resume, or replay.
- Clear every hostile to unlock each sector gate. Checkpoints restore armor and grenades. Armor repairs slowly after five seconds without damage.
- Gamepad: left stick movement, right stick aim, RT fire, A jump, B dash, X weapon, LB grenade, Start pause. Touch controls appear on touch devices.

HQ/LQ changes rendering detail. Fullscreen and sound controls are in the top-right corner.

## Develop

Requires Node 22.13+ and npm. Install with `npm ci`, then use `npm run dev`. Production build: `npm run build`.

The Three.js scene uses physically based materials, animated procedural models, merged static architecture, instanced tracers and debris, shadow mapping, rain, fog, bloom, and ACES tone mapping. Music and combat sounds are synthesized locally with Web Audio; no external game assets are required.

## Verification

`node tests/gameplay.test.mjs` exercises movement, double jump, dash, pause, swept projectile collision, gate locking, checkpoint recovery, cover, boss phases, victory and replay, plus a complete mission driven through ordinary gameplay inputs. `npx tsc --noEmit` checks types.

Automated gameplay logic tests and the production build passed. Hands-on browser playthrough, physical gamepad, and touch-device testing have not been performed.

The starter component catalog has existing lint findings outside the game. The game, route, layout, and tests pass scoped lint with `npx oxlint app/game app/page.tsx app/layout.tsx tests`.
