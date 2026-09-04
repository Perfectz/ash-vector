// Deterministic gameplay. Rendering and input adapters do not modify the rules.
export type Vec = { x: number; y: number; z: number };
export type EnemyKind = 'soldier' | 'drone' | 'turret';
export type Enemy = Vec & {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  cooldown: number;
  sector: number;
  active: boolean;
  angle: number;
  flash: number;
};
export type Bullet = Vec & {
  id: number;
  vx: number;
  vy: number;
  vz: number;
  friendly: boolean;
  damage: number;
  life: number;
  weapon: number;
};
export type Grenade = Vec & {
  id: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
};
export type Hazard = Vec & {
  id: number;
  radius: number;
  timer: number;
  exploded: boolean;
};
export type Pickup = Vec & { id: number; kind: 'health' | 'charge' };
export type GameEvent = Vec & {
  kind:
    | 'shot'
    | 'enemyShot'
    | 'impact'
    | 'explosion'
    | 'hurt'
    | 'jump'
    | 'dash'
    | 'pickup'
    | 'sector'
    | 'victory';
  size?: number;
  weapon?: number;
};
export type Input = {
  mx: number;
  aim: Vec | null;
  fire: boolean;
  autoAim: boolean;
  jump: boolean;
  dash: boolean;
  grenade: boolean;
  switchWeapon: boolean;
};
export const neutralInput = (): Input => ({
  mx: 0,
  aim: null,
  fire: false,
  autoAim: false,
  jump: false,
  dash: false,
  grenade: false,
  switchWeapon: false,
});
export const weapons = [
  { name: 'PULSE CARBINE', short: 'PULSE', rate: 0.1, damage: 12, speed: 76 },
  {
    name: 'BREACH SHOTGUN',
    short: 'BREACH',
    rate: 0.36,
    damage: 10,
    speed: 65,
  },
  { name: 'ARC LANCE', short: 'LANCE', rate: 0.35, damage: 48, speed: 105 },
];
export const cover = [
  { x: 27, z: 0 },
  { x: 44, z: 0 },
  { x: 69, z: 0 },
  { x: 91, z: 0 },
  { x: 119, z: 0 },
  { x: 139, z: 0 },
];
export const platforms = [
  { x: 37, y: 2.7, width: 6 },
  { x: 79, y: 2.9, width: 7 },
  { x: 129, y: 2.6, width: 6 },
  { x: 149, y: 3.2, width: 5 },
];
// One source of truth for aiming and collision, including airborne drone cores.
export const enemyCenter = (e: Enemy): Vec => ({
  x: e.x,
  y: e.y + (e.kind === 'drone' ? 0 : 1),
  z: 0,
});
export const sectorEnds = [57, 109, 158, 190];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function segmentDistance(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  const t = clamp(
    ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) /
      (dx * dx + dy * dy + dz * dz || 1),
    0,
    1,
  );
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t, p.z - a.z - dz * t);
}

export class Simulation {
  mode: 'menu' | 'playing' | 'paused' | 'dead' | 'won' = 'menu';
  time = 0;
  sector = 0;
  score = 0;
  kills = 0;
  combo = 0;
  comboTime = 0;
  bestCombo = 0;
  player = {
    x: 10,
    y: 0,
    z: 0,
    vy: 0,
    hp: 100,
    angle: 0,
    aimPitch: 0,
    jumps: 0,
    invulnerable: 0,
    dashTime: 0,
    dashCooldown: 0,
    shotCooldown: 0,
    grenades: 3,
    grenadeCooldown: 0,
    weapon: 0,
    flash: 0,
    lastDamage: -10,
    moving: 0,
    dashX: 1,
  };
  boss = {
    x: 177,
    y: 0,
    z: 0,
    hp: 1000,
    maxHp: 1000,
    active: false,
    phase: 1,
    cooldown: 2.2,
    attack: 0,
    flash: 0,
  };
  enemies: Enemy[] = [];
  aimPoint: Vec = { x: 25, y: 1.4, z: 0 };
  targetLocked = false;
  viewRange = 18;
  private jumpBuffer = 0;
  private announcedClear = -1;
  bullets: Bullet[] = [];
  grenades: Grenade[] = [];
  hazards: Hazard[] = [];
  pickups: Pickup[] = [];
  events: GameEvent[] = [];
  notice = 'BREACH THE SKYBRIDGE';
  noticeTime = 4;
  checkpoint = 0;
  private id = 1;
  private randomSeed = 921;
  random() {
    this.randomSeed = (this.randomSeed * 1664525 + 1013904223) >>> 0;
    return this.randomSeed / 4294967296;
  }
  constructor() {
    this.populate();
  }
  populate() {
    const waves: [EnemyKind, number, number, number][] = [
      ['soldier', 24, -2, 0],
      ['soldier', 31, 3.8, 0],
      ['drone', 36, -3, 0],
      ['soldier', 41, -0.5, 0],
      ['turret', 49, -4.5, 0],
      ['soldier', 50, 3, 0],
      ['soldier', 63, -3, 1],
      ['drone', 70, 2, 1],
      ['soldier', 75, -1, 1],
      ['turret', 82, 4.5, 1],
      ['soldier', 87, -4, 1],
      ['drone', 92, -2, 1],
      ['soldier', 99, 2, 1],
      ['turret', 102, -4, 1],
      ['soldier', 115, 2, 2],
      ['turret', 123, -4.5, 2],
      ['drone', 125, 3, 2],
      ['soldier', 132, -2, 2],
      ['soldier', 140, 1, 2],
      ['drone', 145, -3, 2],
      ['turret', 150, 4.5, 2],
      ['soldier', 153, -4, 2],
    ];
    this.enemies = waves.map(([kind, x, height, sector]) => ({
      id: this.id++,
      kind,
      x,
      y: kind === 'drone' ? 4 + Math.abs(height) * 0.2 : 0,
      z: 0,
      sector,
      hp: kind === 'turret' ? 85 : kind === 'drone' ? 42 : 48,
      maxHp: kind === 'turret' ? 85 : kind === 'drone' ? 42 : 48,
      cooldown: 1.3 + this.random(),
      active: false,
      angle: Math.PI,
      flash: 0,
    }));
  }
  start() {
    this.mode = 'playing';
    this.notice = 'BLACK RAIN // BREACH THE SKYBRIDGE';
    this.noticeTime = 4;
  }
  togglePause() {
    if (this.mode === 'playing') this.mode = 'paused';
    else if (this.mode === 'paused') this.mode = 'playing';
  }
  remaining() {
    return this.enemies.filter((e) => e.sector === this.sector).length;
  }
  hasTarget() {
    return this.enemies.some((e) => e.active && e.hp > 0) || this.boss.active;
  }
  clearShot(target: Vec) {
    const origin = { ...this.player, y: this.player.y + 1.4 };
    return !cover.some((c) => {
      const t = (c.x - origin.x) / (target.x - origin.x || 0.001);
      return t > 0 && t < 1 && origin.y + (target.y - origin.y) * t < 1.4;
    });
  }
  emit(kind: GameEvent['kind'], p: Vec, size = 1, weapon = 0) {
    this.events.push({ kind, x: p.x, y: p.y, z: p.z, size, weapon });
  }
  retry() {
    const cp = this.checkpoint;
    const score = Math.max(0, this.score - 1500);
    const kills = this.kills;
    const fresh = new Simulation();
    Object.assign(this, fresh);
    this.checkpoint = cp;
    this.sector = cp;
    this.score = score;
    this.kills = kills;
    this.enemies = this.enemies.filter((e) => e.sector >= cp);
    this.player.x = cp === 0 ? 10 : sectorEnds[cp - 1] + 2;
    this.player.z = 0;
    this.player.weapon = Math.min(cp, 2);
    if (cp === 3) this.boss.active = true;
    this.start();
    this.notice = cp
      ? 'CHECKPOINT RESTORED'
      : 'BLACK RAIN // BREACH THE SKYBRIDGE';
  }
  damagePlayer(damage: number) {
    const p = this.player;
    if (p.invulnerable > 0 || this.mode !== 'playing') return;
    p.hp = Math.max(0, p.hp - damage);
    p.invulnerable = 0.65;
    p.lastDamage = this.time;
    this.combo = 0;
    this.emit('hurt', { ...p, y: p.y + 1 });
    if (p.hp <= 0) {
      this.mode = 'dead';
      this.emit('explosion', { ...p, y: p.y + 1 }, 2);
    }
  }
  damageEnemy(e: Enemy, damage: number) {
    if (e.hp <= 0) return;
    e.hp -= damage;
    e.flash = 0.09;
    this.emit('impact', { ...e, y: e.y + 1 }, 0.5);
    if (e.hp <= 0) {
      this.kills++;
      this.combo++;
      this.comboTime = 4;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.score += Math.round(
        (e.kind === 'turret' ? 350 : 200) *
          (1 + Math.min(this.combo, 20) * 0.1),
      );
      this.emit(
        'explosion',
        { ...e, y: e.y + 1 },
        e.kind === 'turret' ? 2 : 1.2,
      );
      if (this.kills % 3 === 0)
        this.pickups.push({
          ...e,
          id: this.id++,
          y: 0.7,
          kind: this.kills % 6 === 0 ? 'charge' : 'health',
        });
    }
  }
  damageBoss(damage: number) {
    if (this.boss.hp <= 0) return;
    this.boss.hp = Math.max(0, this.boss.hp - damage);
    this.boss.flash = 0.08;
    this.emit('impact', { x: this.boss.x - 1.5, y: 4.5, z: this.boss.z }, 0.8);
    if (this.boss.hp <= 0) {
      this.mode = 'won';
      this.score += 10000 + Math.max(0, Math.round(4000 - this.time * 12));
      this.bullets = [];
      this.hazards = [];
      this.emit('victory', { ...this.boss, y: 4 }, 6);
    }
  }
  aimTarget(input: Input): Vec {
    const p = this.player,
      origin = { x: p.x, y: p.y + 1.45, z: p.z };
    const candidates = this.enemies
      .filter((e) => e.active && e.hp > 0)
      .map(enemyCenter);
    this.targetLocked = false;
    if (this.boss.active)
      candidates.push({ x: this.boss.x - 1.4, y: 4.5, z: this.boss.z });
    if (input.autoAim) {
      candidates.sort(
        (a, b) =>
          Number(this.clearShot(b)) - Number(this.clearShot(a)) ||
          dist(a, origin) - dist(b, origin),
      );
      if (candidates.length && dist(candidates[0], origin) < 23) {
        this.targetLocked = true;
        return candidates[0];
      }
    }
    let target = input.aim ?? {
      x: p.x + Math.cos(p.angle) * 30,
      y: origin.y,
      z: 0,
    };
    // Mouse and stick aiming share the visible XY plane. Snap only close to the
    // intended target; moving the cursor into empty space preserves free aim.
    if (input.aim) {
      let best = 1.35;
      for (const c of candidates) {
        const distance = Math.hypot(input.aim.x - c.x, input.aim.y - c.y);
        if (distance < best && dist(c, origin) < 23) {
          target = c;
          best = distance;
          this.targetLocked = true;
        }
      }
    }
    return { ...target, z: 0 };
  }
  shoot(
    origin: Vec,
    target: Vec,
    friendly: boolean,
    damage: number,
    speed: number,
    weapon = 0,
    spread = 0,
  ) {
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x) + spread;
    this.bullets.push({
      ...origin,
      z: 0,
      id: this.id++,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: 0,
      damage,
      friendly,
      life: friendly ? 0.72 : 5,
      weapon,
    });
  }
  step(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    dt = Math.min(dt, 1 / 30);
    this.time += dt;
    this.jumpBuffer = input.jump ? 0.14 : Math.max(0, this.jumpBuffer - dt);
    this.noticeTime = Math.max(0, this.noticeTime - dt);
    this.comboTime -= dt;
    if (this.comboTime <= 0) this.combo = 0;
    const p = this.player;
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.shotCooldown -= dt;
    p.grenadeCooldown -= dt;
    p.flash = Math.max(0, p.flash - dt);
    if (this.time - p.lastDamage > 5) p.hp = Math.min(100, p.hp + dt * 2.5);
    let dx = clamp(input.mx, -1, 1);
    const len = Math.abs(dx);
    p.moving = len;
    if (!input.aim && !input.autoAim && len > 0.1)
      p.angle = dx < 0 ? Math.PI : 0;
    if (input.switchWeapon) p.weapon = (p.weapon + 1) % 3;
    if (this.jumpBuffer > 0 && p.jumps < 2) {
      this.jumpBuffer = 0;
      p.vy = p.jumps === 0 ? 10 : 8.7;
      p.jumps++;
      this.emit('jump', p);
    }
    if (input.dash && p.dashCooldown <= 0) {
      p.dashTime = 0.23;
      p.dashCooldown = 1.3;
      p.invulnerable = 0.32;
      p.dashX = len > 0.1 ? Math.sign(dx) : Math.cos(p.angle);
      if (p.y > 0) p.vy = 0;
      this.emit('dash', p);
    }
    if (p.dashTime > 0) {
      dx = p.dashX * 3.6;
      p.dashTime -= dt;
    }
    const oldX = p.x,
      oldY = p.y;
    p.x += dx * 7.2 * dt;
    p.z = 0;
    const locked = this.sector < 3 && this.remaining() > 0;
    p.x = clamp(
      p.x,
      this.sector === 0 ? 2 : sectorEnds[this.sector - 1] - 2,
      this.boss.active
        ? this.boss.x - 3.2
        : locked
          ? sectorEnds[this.sector] - 1
          : sectorEnds[this.sector] + 1,
    );
    if (p.dashTime <= 0) p.vy -= 25 * dt;
    p.y += p.vy * dt;
    let floor = 0;
    for (const c of cover) {
      if (Math.abs(p.x - c.x) < 1.65 && Math.abs(p.z - c.z) < 1.4) {
        if (oldY >= 1.28) {
          floor = 1.35;
        } else if (p.y < 1.3) {
          p.x = oldX;
        }
      }
    }
    // One-way ledges: jump up through them and land on the way down.
    for (const ledge of platforms) {
      if (
        Math.abs(p.x - ledge.x) < ledge.width / 2 + 0.25 &&
        oldY >= ledge.y &&
        p.y <= ledge.y &&
        p.vy <= 0
      )
        floor = Math.max(floor, ledge.y);
    }
    if (p.y <= floor) {
      p.y = floor;
      p.vy = 0;
      p.jumps = 0;
    }
    if (this.sector < 3 && !locked && p.x > sectorEnds[this.sector] - 0.2) {
      this.sector++;
      this.checkpoint = this.sector;
      p.hp = 100;
      p.grenades = 3;
      p.weapon = Math.min(this.sector, 2);
      this.emit('sector', p);
      this.notice =
        this.sector === 3
          ? 'WARNING // SIEGE ENGINE ONLINE'
          : this.sector === 1
            ? 'CHECKPOINT // FOUNDRY APPROACH'
            : 'CHECKPOINT // THE KILLING FLOOR';
      this.noticeTime = 4;
      if (this.sector === 3) this.boss.active = true;
    }
    if (
      locked &&
      p.x >= sectorEnds[this.sector] - 1.2 &&
      this.noticeTime <= 0
    ) {
      this.notice = `LOCKDOWN // ${this.remaining()} HOSTILES REMAIN`;
      this.noticeTime = 1.8;
    }
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      e.active =
        e.sector === this.sector &&
        e.x < p.x + this.viewRange &&
        e.x > p.x - this.viewRange;
      if (!e.active) continue;
      const flat = Math.hypot(p.x - e.x, p.z - e.z);
      e.angle = Math.atan2(-(p.z - e.z), p.x - e.x);
      if (e.kind === 'soldier' && flat > 9) {
        const nextX = e.x + Math.sign(p.x - e.x) * 1.25 * dt;
        if (!cover.some((c) => Math.abs(nextX - c.x) < 1.7)) e.x = nextX;
      }
      if (e.kind === 'drone') {
        e.y = 4.5 + Math.sin(this.time * 1.7 + e.id) * 0.85;
      }
      e.cooldown -= dt;
      if (e.cooldown <= 0) {
        const origin = {
            x: e.x,
            y: e.y + (e.kind === 'drone' ? 0 : 1.25),
            z: e.z,
          },
          target = { x: p.x, y: p.y + 1, z: p.z };
        const n = e.kind === 'turret' ? 3 : 1;
        for (let j = 0; j < n; j++)
          this.shoot(
            origin,
            target,
            false,
            e.kind === 'turret' ? 13 : 10,
            e.kind === 'drone' ? 10 : 12,
            0,
            (j - (n - 1) / 2) * 0.14,
          );
        this.emit('enemyShot', origin);
        e.cooldown = (e.kind === 'turret' ? 2.2 : 1.65) + this.random() * 0.65;
      }
      if (flat < 1.05 && p.y < 2 && e.kind !== 'drone') this.damagePlayer(12);
    }
    const target = this.aimTarget(input);
    this.aimPoint = target;
    if (Math.abs(target.x - p.x) > 0.05) p.angle = target.x < p.x ? Math.PI : 0;
    p.aimPitch = Math.atan2(target.y - (p.y + 1.4), Math.abs(target.x - p.x));
    if (input.fire && p.shotCooldown <= 0) {
      const w = weapons[p.weapon],
        origin = {
          x: p.x + Math.cos(p.angle) * Math.cos(p.aimPitch) * 1.2,
          y: p.y + 1.4 + Math.sin(p.aimPitch) * 1.2,
          z: 0,
        };
      const n = p.weapon === 1 ? 7 : 1;
      for (let j = 0; j < n; j++)
        this.shoot(
          origin,
          target,
          true,
          w.damage,
          w.speed,
          p.weapon,
          (j - (n - 1) / 2) * 0.043,
        );
      p.shotCooldown = w.rate;
      p.flash = 0.045;
      this.emit('shot', origin, 1, p.weapon);
    }
    if (input.grenade && p.grenades > 0 && p.grenadeCooldown <= 0) {
      p.grenades--;
      p.grenadeCooldown = 0.5;
      const range = Math.hypot(target.x - p.x, target.z - p.z) || 1;
      const d = Math.min(range, 18);
      this.grenades.push({
        id: this.id++,
        x: p.x,
        y: p.y + 1.6,
        z: p.z,
        vx: ((target.x - p.x) / range) * d,
        vy: 7,
        vz: ((target.z - p.z) / range) * d,
        life: 1.05,
      });
    }
    for (const g of this.grenades) {
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      g.vy -= 18 * dt;
      if (g.y < 0.18) {
        g.y = 0.18;
        g.vy = Math.abs(g.vy) * 0.4;
        g.vx *= 0.65;
        g.vz *= 0.65;
      }
      if (g.life <= 0) {
        this.emit('explosion', g, 3);
        for (const e of this.enemies)
          if (dist(e, g) < 7) this.damageEnemy(e, 110);
        if (
          this.boss.active &&
          Math.hypot(this.boss.x - g.x, this.boss.z - g.z) < 8
        )
          this.damageBoss(180);
      }
    }
    this.grenades = this.grenades.filter((g) => g.life > 0);
    if (this.boss.active && this.mode === 'playing') this.updateBoss(dt);
    for (const b of this.bullets) {
      const old = { x: b.x, y: b.y, z: b.z };
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.friendly) {
        for (const e of this.enemies) {
          if (!e.active || e.hp <= 0) continue;
          const center = enemyCenter(e);
          if (
            segmentDistance(center, old, b) < (e.kind === 'turret' ? 0.9 : 0.78)
          ) {
            this.damageEnemy(e, b.damage);
            b.life = 0;
            break;
          }
        }
        if (
          b.life > 0 &&
          this.boss.active &&
          segmentDistance(
            { x: this.boss.x - 1, y: 4, z: this.boss.z },
            old,
            b,
          ) < 3.1
        ) {
          this.damageBoss(b.damage);
          b.life = 0;
        }
      } else if (
        segmentDistance({ x: p.x, y: p.y + 1, z: p.z }, old, b) < 0.55
      ) {
        this.damagePlayer(b.damage);
        b.life = 0;
      }
      if (b.y < 0) {
        this.emit('impact', b, 0.3);
        b.life = 0;
      }
      for (const c of cover) {
        if (
          b.y < 1.35 &&
          b.y > 0 &&
          Math.abs(b.x - c.x) < 1.35 &&
          Math.abs(b.z - c.z) < 1.15
        ) {
          b.life = 0;
          this.emit('impact', b, 0.4);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (
      this.sector < 3 &&
      this.remaining() === 0 &&
      this.announcedClear !== this.sector
    ) {
      this.announcedClear = this.sector;
      this.notice = 'SECTOR CLEAR // ADVANCE →';
      this.noticeTime = 2.4;
      this.score += 500;
      this.emit('sector', p);
    }
    for (const h of this.hazards) {
      h.timer -= dt;
      if (h.timer <= 0 && !h.exploded) {
        h.exploded = true;
        this.emit('explosion', h, 2.8);
        if (Math.hypot(h.x - p.x, h.z - p.z) < h.radius && p.y < 2.5)
          this.damagePlayer(25);
      }
    }
    this.hazards = this.hazards.filter((h) => h.timer > -0.5);
    this.pickups = this.pickups.filter((item) => {
      if (Math.hypot(item.x - p.x, item.z - p.z) < 2) {
        if (item.kind === 'health') p.hp = Math.min(100, p.hp + 25);
        else p.grenades = Math.min(5, p.grenades + 1);
        this.score += 100;
        this.emit('pickup', item);
        return false;
      }
      return true;
    });
  }
  updateBoss(dt: number) {
    const b = this.boss,
      p = this.player;
    b.flash = Math.max(0, b.flash - dt);
    const phase = b.hp > 650 ? 1 : b.hp > 300 ? 2 : 3;
    if (phase !== b.phase) {
      b.phase = phase;
      this.notice =
        phase === 2 ? 'SIEGE ENGINE // OVERDRIVE' : 'CRITICAL // FINAL ASSAULT';
      this.noticeTime = 3;
      this.emit('explosion', { ...b, y: 4 }, 2);
    }
    b.z = 0;
    b.cooldown -= dt;
    if (b.cooldown <= 0) {
      b.attack++;
      if (b.attack % 3 === 0) {
        for (let j = 0; j < 4 + b.phase; j++)
          this.hazards.push({
            id: this.id++,
            x: clamp(p.x + (j - 2) * 2.3, 158, 173),
            y: 0.05,
            z: 0,
            radius: 1.05,
            timer: 1.5,
            exploded: false,
          });
        this.notice = 'MISSILE LOCK // KEEP MOVING';
        this.noticeTime = 1.5;
      } else {
        // Alternating cannon heights create one legible fan, with gaps wide
        // enough to dodge on the shared plane instead of overlapping volleys.
        {
          const origin = { x: b.x - 2.5, y: b.attack % 2 ? 4.25 : 2.7, z: 0 };
          const n = 5 + b.phase * 2;
          for (let j = 0; j < n; j++)
            this.shoot(
              origin,
              { x: p.x, y: p.y + 1, z: p.z },
              false,
              14,
              9 + b.phase * 2,
              0,
              (j - (n - 1) / 2) * 0.12,
            );
          this.emit('enemyShot', origin);
        }
      }
      b.cooldown = b.phase === 1 ? 2.1 : b.phase === 2 ? 1.65 : 1.2;
    }
    if (p.x > b.x - 3 && Math.abs(p.z - b.z) < 3.5 && p.y < 4)
      this.damagePlayer(20);
  }
}
