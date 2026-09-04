# Gameplay and phone quality pass

## What was getting in the way

1. Holding fire, moving, and jumping required three fingers. The old horizontal action-button row also overflowed narrow screens.
2. The portrait camera preserved the entire wide arena, making combatants too small. The HUD and controls competed with the battlefield.
3. Automatic targeting could choose a soldier behind cargo instead of an exposed drone. Early jump taps could be lost immediately before landing.
4. A cleared sector had little feedback until the player reached the next checkpoint.

## Changes shipped

- Auto Fire defaults on for touch devices; it aims and fires when targets are active. A toggle restores manual hold-to-fire. Keyboard and mouse retain their controls.
- Separate left/right buttons and a large Jump button allow two-thumb play, with Dash nearby. Weapon switching and counted grenades live in a separate toolbar.
- Every finger is tracked independently. Pointer release, lost capture, cancellation, pause, blur, and rotation clear the appropriate held actions.
- Portrait reserves a battlefield above the controls; landscape leaves the center open. All tested controls have targets at least 44 CSS pixels in each dimension. Safe-area insets and dynamic viewport height are respected.
- The portrait camera shows a closer view, and enemy activation distance follows the visible arena. The boss camera retains the full arena.
- Phones start in the lighter graphics mode. This is a rendering-cost reduction, not a measured real-device frame-rate guarantee.
- Automatic targeting prefers unobstructed shots. Jump input is buffered for 140 ms before landing. Clearing a sector gives an advance cue and a one-time 500-point reward.
- The pause guide explains the phone controls rather than displaying a keyboard-only manual.

## Verification

Chromium touch emulation at 393×852, 844×390, 360×640, and 320×568 checked:

- Visible, non-overlapping controls in automatic and manual fire modes.
- Movement while jumping, continued movement after the jumping finger lifts, and stopping on touch cancellation.
- Independent release of the firing finger, while movement remains held.
- Dash movement, exactly one weapon switch per tap, and one grenade consumed per tap.
- Rotation while holding movement, plus pause/resume.
- No uncaught browser exceptions.

Desktop browser regression checks also passed for movement, jumping, assisted firing, kills, and pause. Phone mode follows the primary pointer type, so a mouse-driven touchscreen laptop keeps the desktop interface.

A sustained browser mission using touch movement, repeated jump taps, and automatic firing defeated all 22 enemies and the boss without deaths. The victory screen reported 29 seconds. This verifies a control path; it is not a human assessment of difficulty or enjoyment.

Simulation tests cover jumping, buffered landing input, targeting around cover, sector rewards, controls, camera projection, boss phases, recovery, and mission completion. Physical iPhone/Android hardware, Safari, thermal behavior, and real-device frame rates remain untested.

## Best next improvements

1. **Encounter variety:** add a rushing ground enemy and a shielding enemy that rewards getting above it. The current soldiers, drones, and turrets are readable but repeat frequently.
2. **A longer level with deliberate pacing:** the automated run finishes in roughly half a minute. Add a quiet traversal beat, a distinct ambush, and a miniboss instead of simply increasing enemy health.
3. **A more distinct boss finale:** its phases currently increase pressure through fan density and missile timing. A separate, clearly telegraphed weak-point phase would give the fight a stronger identity.

These are recommendations for a subsequent content pass, not features claimed to be in this update. A short playtest on physical phones should guide their difficulty and timing.
