import assert from 'node:assert/strict';
import { Simulation, neutralInput, weapons } from '../app/game/simulation.ts';
import { rosterFrame } from '../app/game/sprite.ts';
const fresh = (character = 'patrick') => {
  const s = new Simulation(character);
  s.start();
  s.enemies = [];
  return s;
};
const enemy = (id, x, y = 0, hp = 300) => ({
  id,
  kind: 'soldier',
  x,
  y,
  z: 0,
  hp,
  maxHp: hp,
  cooldown: 100,
  sector: 0,
  active: true,
  angle: Math.PI,
  flash: 0,
});
const step = (s, input = neutralInput(), count = 1) => {
  for (let i = 0; i < count; i++) s.step(1 / 60, input);
};

const melee = fresh();
melee.enemies = [enemy(1, 12), enemy(2, 8), enemy(3, 15), enemy(4, 12, 4)];
step(melee, { ...neutralInput(), melee: true });
assert.equal(rosterFrame('patrick', melee.player, melee.time), 12);
step(melee, neutralInput(), 12);
assert.equal(
  melee.enemies[0].hp,
  240,
  'One hit per swing, across the active animation',
);
assert.equal(melee.enemies[1].hp, 300, 'No damage behind Patrick');
assert.equal(melee.enemies[2].hp, 300, 'No damage outside sword range');
assert.equal(melee.enemies[3].hp, 300, 'No damage to distant airborne enemies');
const cooldown = melee.player.meleeCooldown;
step(melee, { ...neutralInput(), melee: true });
assert(
  melee.player.meleeCooldown < cooldown,
  'Cooldown prevents instant repeat',
);
melee.togglePause();
const frozen = melee.player.meleeTime;
step(melee, neutralInput(), 30);
assert.equal(melee.player.meleeTime, frozen);
melee.mode = 'dead';
melee.retry();
assert.equal(melee.character, 'patrick');
const su = fresh('su');
step(su, { ...neutralInput(), melee: true });
assert.equal(su.player.meleeTime, 0);
step(su, { ...neutralInput(), jump: true });
step(su, neutralInput(), 15);
step(su, { ...neutralInput(), jump: true });
assert.equal(su.player.jumps, 2);
assert(su.player.vy > 10);
assert(su.events.some((e) => e.kind === 'doubleJump'));
assert(rosterFrame('su', su.player, su.time) >= 12);
const before = su.player.vy;
step(su, { ...neutralInput(), jump: true });
assert(su.player.vy < before);
assert.equal(su.player.jumps, 2);
console.log(
  'PASS Patrick frontal sword, cooldown, pause, retry; Su boosted double jump and no third jump',
);

assert.equal(weapons.length, 8);
const rail = fresh();
rail.enemies = [enemy(1, 14), enemy(2, 17)];
rail.player.weapon = 2;
step(rail, { ...neutralInput(), fire: true });
step(rail, neutralInput(), 12);
assert(
  rail.enemies.every((e) => e.hp === 252),
  'Rail pierces both targets once',
);
const rocket = fresh();
rocket.enemies = [enemy(1, 14), enemy(2, 16)];
rocket.player.weapon = 3;
step(rocket, { ...neutralInput(), fire: true });
step(rocket, neutralInput(), 20);
assert(rocket.enemies.every((e) => e.hp < 300));
assert(rocket.events.some((e) => e.kind === 'explosion'));
const homing = fresh();
homing.enemies = [enemy(1, 20, 4)];
homing.player.weapon = 4;
step(homing, { ...neutralInput(), fire: true, aim: { x: 30, y: 1.4, z: 0 } });
step(homing, neutralInput(), 6);
assert(
  homing.bullets.some((b) => b.friendly && b.vy > 1),
  'Homing corrects toward an elevated target',
);
const flame = fresh();
flame.player.weapon = 5;
step(flame, { ...neutralInput(), fire: true });
assert.equal(flame.bullets.length, 3);
assert(flame.bullets.every((b) => b.life <= 0.22));
step(flame, neutralInput(), 20);
assert.equal(flame.bullets.length, 0);
const bounce = fresh();
bounce.player.weapon = 6;
step(bounce, { ...neutralInput(), fire: true, aim: { x: 18, y: -4, z: 0 } });
step(bounce, neutralInput(), 12);
assert(bounce.bullets.some((b) => b.bounces > 0 && b.vy > 0));
const disc = fresh();
disc.player.weapon = 7;
step(disc, { ...neutralInput(), fire: true });
step(disc, neutralInput(), 52);
assert(
  disc.bullets.some((b) => b.vx < 0),
  'Energy disc reverses toward the player',
);
const cycle = fresh();
for (let i = 0; i < 8; i++)
  step(cycle, { ...neutralInput(), switchWeapon: true });
assert.equal(cycle.player.weapon, 0);
console.log(
  'PASS Eight weapon behaviors: piercing, explosive splash, homing, limited flame range, ricochet, returning disc and full cycling',
);

const guard = fresh();
const bot = { ...enemy(1, 12), kind: 'shield', guard: true };
guard.enemies = [bot];
guard.damageEnemy(bot, 60);
assert.equal(bot.hp, 282);
guard.damageEnemy(bot, 60, true);
assert.equal(bot.hp, 222);
const creep = fresh();
creep.enemies = [{ ...enemy(1, 16), kind: 'creep' }];
step(creep, neutralInput(), 20);
assert(creep.enemies[0].x < 16);
console.log('PASS Approval shield protection and scope-creep rush behavior');
