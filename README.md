# ASH VECTOR

An original 2.5D arcade run-and-gun mission inspired by Hard Corps: Uprising's side-scrolling combat, aerial mobility, and industrial spectacle. The characters, scenery, lighting, and effects are rendered in 3D; movement and gunfire share a single side-view combat plane. Cross three industrial skybridge sectors and destroy the multi-phase MANTICORE siege engine.

## Play

- A/D or left/right arrows: run left/right. W/S or up/down arrows: aim up/down; combine with movement for diagonal fire. Hold C to plant your feet and aim with the direction keys.
- Mouse: point directly at ground or flying enemies; hold left click to fire. A gold ring confirms target assistance. Hold J for automatic targeting and fire, or use W/S plus J for manual directional fire.
- Space: jump; press again to double jump.
- Shift: invulnerable ground or air dash, followed by a short recharge. Air dashes briefly hold altitude.
- E / right click: grenade. Q: cycle pulse carbine, breach shotgun, arc lance.
- Escape / P: pause. M: mute. Enter: deploy, resume, or replay.
- Clear every hostile to unlock each sector gate. Checkpoints restore armor and grenades. Armor repairs slowly after five seconds without damage.
- Jump over cargo or double jump onto elevated one-way platforms. Enemy volleys spread vertically; jump or dash through the gaps. The boss's red warning discs mark missile strike zones.
- Gamepad: left stick movement, right stick aim, RT fire, A jump, B dash, X weapon, LB grenade, Start pause.
- Phone: use the left/right thumb buttons to move and the large Jump button to jump twice. Dash is beside Jump. Auto Fire aims and shoots by default; toggle it off for manual hold-to-fire. Tap the weapon name to switch or BOMB to throw a grenade. Portrait and landscape layouts are supported, and phones start with lighter graphics.

HQ/LQ changes rendering detail. Fullscreen and sound controls are in the top-right corner.

## Develop

Requires Node 22.13+ and npm. Install with `npm ci`, then use `npm run dev`. Production build: `npm run build`.

The Three.js scene uses physically based materials, animated procedural models, merged static architecture, instanced tracers and debris, shadow mapping, rain, fog, bloom, and ACES tone mapping. Music and combat sounds are synthesized locally with Web Audio; no external game assets are required.

## Verification

`node tests/gameplay.test.mjs` exercises plane-constrained movement, direct drone targeting, aim assistance, vertical spread, one-way platforms, air dashes, double jump, pause, swept projectile collision, gate locking, checkpoint recovery, cover, boss phases, victory and replay, plus a complete mission driven through ordinary gameplay inputs. `npx tsc --noEmit` checks types.

Automated gameplay logic tests and browser touch-emulation checks passed. The touch-driven browser mission reached victory with no deaths. Four phone viewport sizes were checked, including simultaneous touches, cancellation, rotation, abilities, and manual fire. Physical mobile hardware, Safari, and gamepad testing remain outstanding. See [the quality report](docs/quality-pass.md).

`node tests/camera.test.mjs` verifies camera framing and screen-to-world drone targeting at four aspect ratios, firing through the actual simulation after converting projected cursor positions back into aim points. These numerical checks do not replace visual browser testing.

`node tests/phone.test.mjs` covers independent touch tracking, buffered jumps, unobstructed automatic targeting, and the one-time sector reward.

Browser regression scripts are `tests/browser-phone.mjs` and `tests/browser-desktop.mjs`. Start the standalone dev server on `127.0.0.1:5173`, open a dedicated agent-browser session, and pass its `get cdp-url` websocket URL as the first script argument. The phone script supports `--quick` to skip the sustained mission; it still exercises layouts, multi-touch, abilities, rotation, and pause. Screenshots are written to the ignored `outputs/` directory.

The starter component catalog has existing lint findings outside the game. The game, route, layout, and tests pass scoped lint with `npx oxlint app/game app/page.tsx app/layout.tsx tests`.

## Public links

- Play: https://ash-vector.vercel.app
- GitHub: https://github.com/Perfectz/ash-vector
- Intro video: https://ash-vector.vercel.app/media/ash-vector-intro.mp4

Vercel is connected to this repository. The standalone Vercel build uses `npm run build:vercel` and shares the game's existing components and simulation. The original Sites build remains available through `npm run build`.

The title screen has a Watch intro button with a 20-second 1080p cinematic and optional English closed captions. Editable HyperFrames source, camera choreography, original audio synthesis, and font licenses live in `videos/ash-vector-intro/`.

Research and the design changes are documented in [docs/uprising-reference.md](docs/uprising-reference.md). Reference screenshots were studied for composition only; no Konami or Arc System Works artwork, characters, music, or branding is included in the game.
