# ASH VECTOR: One Tiny Change

Patrick and Su are the main selectable leads in an original anime-styled action parody. The jokes draw on this project's real brief: ambitious AI builds, requests for triple-A polish, comics and intro videos, mobile support, and a shareable deployment. The fictional antagonist is an escaped project deadline. This is affectionate creative-work parody, not a claim about private personal traits.

## Playable content

- Patrick: generated likeness sprite sheet preserving bald head, rectangular glasses, goatee, crimson jacket and jeans. Energy saber on **K**, controller **Y / triangle**, or the phone **SABER** button. Four slash keyframes, short windup/recovery, directional damage, once-per-swing hit registration, and a visible energy arc. Sword attacks bypass approval-bot armor.
- Su: generated likeness sprite sheet preserving her bob, orange overshirt, burgundy top and cyan cybernetic details. Press Jump again in midair for a stronger second boost with four dedicated cyan-burst frames. A third jump is rejected until landing.
- Original operative: remains selectable with both 3D model and 2D sprite options. Patrick/Su selection persists locally. Retry, replay and return to title retain the lead.
- Eight ranged weapons: **Prompt Pistol** (rapid fire), **Scope Spreader** (seven pellets), **Deadline Rail** (piercing), **Hotfix Launcher** (explosive splash), **The Delegator** (homing), **Hot Take** (short-range flame), **Bounce Back** (ricochet), **The Follow-Up** (returning disc). All are available immediately; use **1–8**, **Q**, controller **X / square**, the phone weapon button, or the pause-menu arsenal. Grenades remain available.
- Thirty-four enemies across four sectors: Idea Backlog, Scope Creep Factory, Approval Purgatory, and The Deadline. New sprite scope-creeps rush and hop over cargo; approval bots alternate shielding and exposed attack windows. Existing soldiers, drones, turrets, three-phase boss, cargo, raised platforms, industrial world, lighting and particles are 3D.
- Patrick/Su radio banter, environmental joke signs, a parody title screen and a closing exchange. Existing intro remains available as the original operation's origin story.
- Shared jump buffer, air dash, aim assistance, auto fire, checkpoints, armor recovery, score chains and supply drops. Character or weapon changes while paused preserve mission progress.

## Art and provenance

Built-in OpenAI image generation produced `public/sprites/patrick-sheet-v1.png` (16 poses), `su-sheet-v1.png` (16 poses), and `enemies-v1.png` (8 poses). Patrick and Su use user-supplied reference images. Those original reference files are not copied into the public game. Prompts are saved in `art/one-tiny-change/prompts.txt`.

Hero sources retain white backgrounds; the runtime applies border-connected background removal and authored crop masks/pivots. Enemy art has an alpha channel and is sampled from one shared atlas. This is a mix of 2D illustrated characters and 3D scenery, effects and opponents.

## Verification evidence

### Spectacle update

`app/game/spectacle.ts` adds additive energy glows, velocity-stretched sparks, weapon-colored trails, expanding blast rings and ground shockwaves, saber-tip trails, dash/air-boost wakes, landing dust and drifting embers. The atmosphere uses deeper blue-green fog and stronger bloom. Effects remain visible without bloom in low quality; emissions are reduced there. Two instanced particle meshes share a total cap of 900 particles, with 18 reusable shock rings. Effects freeze on pause and clear on menu/restart. No gameplay damage, timing or hitboxes changed.

`tests/browser-effects.mjs` checks actual combat emission, particle bounds, pause stability and low-quality rendering without browser exceptions. The phone browser smoke test passes portrait, landscape, compact landscape and small portrait viewports after this update. Physical device performance remains unverified.

- `tests/roster.test.mjs`: directional sword reach, no rear/far hits, once-per-swing damage, cooldown, pause/retry; Su boost and rejected third jump; unique ranged mechanics; shield resistance and rushing enemy movement.
- `tests/arsenal-missions.test.mjs`: all 16 lead/weapon combinations complete the entire 34-enemy/boss mission through normal inputs with no deaths under the test driver.
- Existing gameplay, phone-input, camera, and original sprite tests pass. TypeScript and scoped lint are checked separately.
- `tests/browser-parody.mjs`: actual rendered leads; Patrick slash and Su burst frames; persistent roster; eight keyboard weapon shortcuts; position-preserving pause changes; visible non-overlapping phone controls and real touch actions at 393x852, 320x568, 844x390 and 568x320.
- `tests/browser-phone.mjs --hero=patrick` and `--hero=su`: multi-touch movement/jump/fire, independent finger release, cancellation, dash, weapons, grenades, rotation, pause/resume, and full boss victories for both leads without deaths or uncaught exceptions.

Browser tests use Chromium touch emulation. Physical controllers, physical Android/iPhone devices, Safari and sustained thermal performance remain unverified. Automated playthroughs validate mechanics and completion, not a guarantee of subjective fun; the design aims for variety, readable threats, expressive abilities and quick retries.
