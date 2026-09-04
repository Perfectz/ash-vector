import assert from 'node:assert/strict';
import {
  Simulation,
  neutralInput,
  segmentDistance,
} from '../app/game/simulation.ts';
const step = (s, input, n = 60) => {
  for (let i = 0; i < n; i++) {
    s.step(1 / 60, input);
    s.events = [];
  }
};
const check = (name, fn) => {
  fn();
  console.log('PASS', name);
};
check('Full 3D movement and normalized diagonal speed', () => {
  const s = new Simulation();
  s.start();
  step(s, { ...neutralInput(), mx: 1, mz: -1 }, 30);
  assert(s.player.x > 12);
  assert(s.player.z < 0);
  assert(Math.abs(Math.hypot(s.player.x - 10, s.player.z - 2) - 3.6) < 0.03);
});
check('Double jump, rejected third jump, landing reset', () => {
  const s = new Simulation();
  s.start();
  s.step(1 / 60, { ...neutralInput(), jump: true });
  step(s, neutralInput(), 12);
  s.step(1 / 60, { ...neutralInput(), jump: true });
  const vy = s.player.vy;
  s.step(1 / 60, { ...neutralInput(), jump: true });
  assert(s.player.vy < vy);
  assert.equal(s.player.jumps, 2);
  step(s, neutralInput(), 100);
  assert.equal(s.player.y, 0);
  assert.equal(s.player.jumps, 0);
});
check('Dash grants invulnerability and has a cooldown', () => {
  const s = new Simulation();
  s.start();
  s.step(1 / 60, { ...neutralInput(), dash: true, mx: 1 });
  s.damagePlayer(30);
  assert.equal(s.player.hp, 100);
  assert(s.player.dashCooldown > 1);
  step(s, neutralInput(), 45);
  s.damagePlayer(30);
  assert.equal(s.player.hp, 70);
});
check('Pause freezes gameplay and resumes cleanly', () => {
  const s = new Simulation();
  s.start();
  s.togglePause();
  step(s, { ...neutralInput(), mx: 1, fire: true });
  assert.equal(s.time, 0);
  assert.equal(s.player.x, 10);
  s.togglePause();
  s.step(1 / 60, neutralInput());
  assert(s.time > 0);
});
check('Swept collision catches high velocity projectiles', () => {
  assert.equal(
    segmentDistance(
      { x: 5, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 10, y: 1, z: 0 },
    ),
    0,
  );
  const s = new Simulation();
  s.start();
  s.player.x = 20;
  step(s, { ...neutralInput(), fire: true, autoAim: true }, 100);
  assert(s.kills > 0);
});
check('Sector gate prevents skipping living enemies', () => {
  const s = new Simulation();
  s.start();
  step(s, { ...neutralInput(), mx: 1 }, 600);
  assert.equal(s.sector, 0);
  assert(s.player.x <= 56);
});
check('Checkpoint restores armor, supplies and the correct sector', () => {
  const s = new Simulation();
  s.start();
  s.enemies = s.enemies.filter((e) => e.sector !== 0);
  s.player.x = 56.9;
  s.step(1 / 60, { ...neutralInput(), mx: 1 });
  assert.equal(s.sector, 1);
  assert.equal(s.checkpoint, 1);
  s.player.invulnerable = 0;
  s.damagePlayer(1000);
  assert.equal(s.mode, 'dead');
  s.retry();
  assert.equal(s.mode, 'playing');
  assert.equal(s.sector, 1);
  assert.equal(s.player.hp, 100);
  assert.equal(s.player.grenades, 3);
  assert(s.enemies.every((e) => e.sector >= 1));
});
check('Jumpable cover blocks walking through solid crates', () => {
  const s = new Simulation();
  s.start();
  s.player.x = 24;
  s.player.z = -3;
  step(s, { ...neutralInput(), mx: 1 }, 30);
  assert(s.player.x < 25.5);
  s.step(1 / 60, { ...neutralInput(), jump: true });
  step(s, { ...neutralInput(), mx: 1 }, 22);
  assert(s.player.x > 26);
});
check('Boss has three phases and telegraphed missiles', () => {
  const s = new Simulation();
  s.start();
  s.sector = 3;
  s.boss.active = true;
  s.player.x = 161;
  s.boss.hp = 600;
  s.step(1 / 60, neutralInput());
  assert.equal(s.boss.phase, 2);
  s.boss.hp = 200;
  s.boss.attack = 2;
  s.boss.cooldown = 0;
  s.step(1 / 60, neutralInput());
  assert.equal(s.boss.phase, 3);
  assert(s.hazards.length > 0);
  assert(s.hazards.every((h) => h.timer > 1));
});
check('Victory and fresh replay reset the mission', () => {
  const s = new Simulation();
  s.start();
  s.boss.active = true;
  s.damageBoss(1000);
  assert.equal(s.mode, 'won');
  assert.equal(s.boss.hp, 0);
  assert(s.score >= 10000);
  const replay = new Simulation();
  replay.start();
  assert.equal(replay.score, 0);
  assert.equal(replay.boss.hp, 1000);
  assert.equal(replay.enemies.length, 22);
});
// Exercise the actual mission rules from first deployment through final victory.
const run = new Simulation();
run.start();
let deaths = 0;
let frame = 0;
const transitions = [];
let previous = 0;
for (; frame < 60 * 420 && run.mode !== 'won'; frame++) {
  if (run.mode === 'dead') {
    deaths++;
    run.retry();
    if (deaths > 8) break;
  }
  const target = run.enemies
    .filter((e) => e.sector === run.sector)
    .sort(
      (a, b) => Math.abs(a.x - run.player.x) - Math.abs(b.x - run.player.x),
    )[0];
  const wantX = run.boss.active
    ? 164
    : target
      ? Math.max(run.player.x, target.x - 13)
      : [58, 110, 159][run.sector];
  const blocked =
    (run.player.moving > 0 && Math.abs(run.player.x - 27) < 2) ||
    Math.abs(run.player.x - 44) < 2;
  const input = {
    ...neutralInput(),
    mx: run.player.x < wantX ? 1 : 0,
    mz: Math.sin(run.time * 1.7) > 0.2 ? 0.7 : -0.7,
    fire: true,
    autoAim: true,
    jump: frame % 65 === 0 || (!!blocked && frame % 20 === 0),
    dash: frame % 109 === 0,
    grenade:
      !!target && Math.abs(target.x - run.player.x) < 15 && frame % 120 === 0,
    switchWeapon: false,
  };
  if (run.boss.active) run.player.weapon = 2;
  run.step(1 / 60, input);
  run.events = [];
  if (run.sector !== previous) {
    transitions.push({ sector: run.sector, time: run.time });
    previous = run.sector;
  }
}
console.log(
  'MISSION RUN',
  JSON.stringify({
    mode: run.mode,
    seconds: run.time,
    frames: frame,
    deaths,
    score: run.score,
    kills: run.kills,
    sector: run.sector,
    hp: run.player.hp,
    bossHp: run.boss.hp,
    transitions,
  }),
);
assert.equal(
  run.mode,
  'won',
  'Full mission must be completable through normal movement, firing, dash, jump and grenade inputs',
);
assert(deaths <= 8);
