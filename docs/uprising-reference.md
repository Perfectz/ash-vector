# Side-scrolling combat direction

Research date: September 4, 2026.

## Sources studied

- [Official Xbox listing](https://www.xbox.com/en-US/games/store/hard-corps-uprising/C30Z07T9Q9CT/0001): identifies Hard Corps: Uprising as an Arc System Works 2D side-scrolling run-and-gun, published by Konami. Its Arcade and Rising modes offer different approaches to progression.
- [SmashPad review and screenshots](https://smashpad.com/hard-corps-uprising-review/): discusses double jumping, dashing, strafing, and firing in different directions while stationary.
- [TheSixthAxis screenshot](https://www.thesixthaxis.com/wp-content/uploads/2011/02/Level3_3.jpg), from its [review](https://www.thesixthaxis.com/2011/02/16/review-hard-corps-uprising/), and [SmashPad industrial combat screenshot](https://i0.wp.com/smashpad.com/wp-content/uploads/2011/02/sequence-01_11.jpg?fit=1200%2C675&ssl=1).

## Visual observations and original adaptation

The inspected images use layered industrial scenery, clear side-on character silhouettes, elevated surfaces, and bright projectile fans against darker backgrounds. These are visual observations, not claims about the original game's engine.

ASH VECTOR now uses a fixed side-facing perspective camera, retaining its original 3D geometry, atmospheric lighting, rain, skyline, music, and story. Foreground gantry posts and railings that would hide the player were removed. Cargo and elevated ledges have shared render/collision definitions. A lit deck edge distinguishes the playable floor from background architecture.

All gameplay runs in XY at Z=0. Mouse rays intersect that same plane; drone assistance uses the actual drone collision center. A gold world-space ring confirms target lock, while cyan indicates free aim. Rifle elevation follows the shot direction. Keyboard directional fire and planted aiming complement the mouse, gamepad, and automatic touch targeting.

Double jumps reach raised platforms; air dashes suspend gravity briefly. Shotgun pellets, turret fans, and boss attacks spread vertically. Boss volleys alternate cannon height instead of overlapping depth-separated fans. Side-facing missile markers make the damage zones visible.

This is an original tribute to the combat style, not a remake. No reference images or original game assets are shipped. The prior 3D cinematic remains accessible as the introduction.

## Validation scope

Automated simulation tests cover airborne hits, assistance/free aim, plane invariants, vertical spreads, platform landings, air dashes, recovery, and a complete mission through normal controls. Type checking and the Vercel production build are separate checks. Hands-on browser, physical controller, and mobile-device playthroughs remain unverified.
