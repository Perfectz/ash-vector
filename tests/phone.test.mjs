import assert from 'node:assert/strict';
import { TouchState } from '../app/game/touch.ts';
import {
  Simulation,
  neutralInput,
  enemyCenter,
} from '../app/game/simulation.ts';

const touch = new TouchState();
touch.press(1, 'right');
touch.press(2, 'fire');
touch.press(3, 'jump');
assert.equal(touch.x, 1);
assert.equal(touch.fire, true);
touch.release(3);
assert.equal(touch.x, 1);
assert.equal(touch.fire, true);
touch.release(2);
assert.equal(touch.x, 1);
assert.equal(touch.fire, false);
touch.press(4, 'left');
assert.equal(touch.x, 0);
touch.release(1);
assert.equal(touch.x, -1);
touch.clear();
assert.equal(touch.x, 0);
assert.equal(touch.fire, false);
console.log(
  'PASS Independent touch pointers, release, opposing inputs, and cancellation',
);

const s = new Simulation();
s.start();
s.enemies = [];
s.player.y = 0.08;
s.player.vy = -2;
s.player.jumps = 2;
s.step(1 / 60, { ...neutralInput(), jump: true });
for (let i = 0; i < 5; i++) s.step(1 / 60, neutralInput());
assert(
  s.player.y > 0.3 && s.player.vy > 0,
  'A jump tapped just before landing should trigger on landing',
);
console.log('PASS Early jump input buffers until landing');

const aim = new Simulation();
aim.start();
aim.player.x = 22;
const soldier = aim.enemies.find((e) => e.kind === 'soldier');
soldier.x = 31;
soldier.active = true;
const drone = aim.enemies.find((e) => e.kind === 'drone');
drone.x = 33;
drone.y = 6;
drone.active = true;
aim.enemies = [soldier, drone];
assert.equal(aim.clearShot(enemyCenter(soldier)), false);
assert.deepEqual(
  aim.aimTarget({ ...neutralInput(), autoAim: true }),
  enemyCenter(drone),
);
console.log(
  'PASS Auto targeting prefers an exposed drone over a soldier behind cargo',
);

const clear = new Simulation();
clear.start();
clear.enemies = [];
clear.step(1 / 60, neutralInput());
assert(clear.notice.includes('ADVANCE'));
assert.equal(clear.score, 500);
for (let i = 0; i < 200; i++) clear.step(1 / 60, neutralInput());
assert.equal(clear.score, 500, 'Sector reward must not repeat each frame');
console.log('PASS Clear-sector cue and one-time score reward');
