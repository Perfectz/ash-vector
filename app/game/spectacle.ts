import * as T from 'three';
import { weapons, type GameEvent, type Simulation } from './simulation';

type Mote = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: T.Color;
  spark: boolean;
  gravity: number;
};
type Wave = {
  mesh: T.Mesh<T.RingGeometry, T.MeshBasicMaterial>;
  life: number;
  max: number;
  radius: number;
};

/** Two instanced particle batches and a fixed pool of shock rings. */
export class Spectacle {
  root = new T.Group();
  motes: Mote[] = [];
  waves: Wave[] = [];
  capacity = 900;
  glow: T.InstancedMesh;
  sparks: T.InstancedMesh;
  texture: T.CanvasTexture;
  private dummy = new T.Object3D();
  private tint = new T.Color();
  private emission = 0;
  private lastY = 0;
  private wasAirborne = false;
  private lastTime = 0;
  private waveCursor = 0;
  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, '#ffffffff');
    gradient.addColorStop(0.12, '#fffffff0');
    gradient.addColorStop(0.35, '#ffffff70');
    gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    this.texture = new T.CanvasTexture(canvas);
    this.glow = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.8,
      }),
      this.capacity,
    );
    this.sparks = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.85,
      }),
      this.capacity,
    );
    for (const mesh of [this.glow, this.sparks]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.root.add(mesh);
    }
    const ring = new T.RingGeometry(0.94, 1, 64);
    for (let i = 0; i < 18; i++) {
      const mesh = new T.Mesh(
        ring,
        new T.MeshBasicMaterial({
          color: 0x7dffdf,
          transparent: true,
          blending: T.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
          side: T.DoubleSide,
        }),
      );
      mesh.visible = false;
      this.waves.push({ mesh, life: 0, max: 1, radius: 1 });
      this.root.add(mesh);
    }
  }
  private mote(
    x: number,
    y: number,
    z: number,
    color: number,
    size: number,
    life: number,
    vx = 0,
    vy = 0,
    spark = false,
    gravity = 0,
  ) {
    if (this.motes.length >= this.capacity) return;
    this.motes.push({
      x,
      y,
      z,
      vx,
      vy,
      life,
      max: life,
      size,
      color: new T.Color(color),
      spark,
      gravity,
    });
  }
  private ring(
    x: number,
    y: number,
    color: number,
    radius: number,
    life = 0.48,
    ground = false,
  ) {
    const wave = this.waves[this.waveCursor++ % this.waves.length];
    wave.life = wave.max = life;
    wave.radius = radius;
    wave.mesh.position.set(x, y, 0.35);
    wave.mesh.rotation.x = ground ? -Math.PI / 2 : 0;
    wave.mesh.material.color.setHex(color).multiplyScalar(1.5);
  }
  burst(e: GameEvent, high: boolean) {
    const boom = e.kind === 'explosion' || e.kind === 'victory';
    const ability = [
      'dash',
      'slash',
      'doubleJump',
      'pickup',
      'sector',
    ].includes(e.kind);
    if (
      !boom &&
      !ability &&
      e.kind !== 'impact' &&
      e.kind !== 'shot' &&
      e.kind !== 'jump'
    )
      return;
    const color = ability
      ? 0x63ffdc
      : e.kind === 'shot'
        ? weapons[e.weapon ?? 0].color
        : 0xffa34d;
    const size = Math.min(e.size ?? 1, 3);
    const count = Math.round(
      (boom ? 55 : e.kind === 'shot' ? 3 : ability ? 22 : 12) *
        (high ? 1 : 0.45),
    );
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed =
        (boom ? 3 + Math.random() * 14 : 2 + Math.random() * 7) *
        Math.sqrt(size);
      this.mote(
        e.x,
        e.y,
        0.25 + Math.random() * 0.4,
        i % 5 === 0 ? 0xfff5d8 : color,
        boom ? 0.06 + Math.random() * 0.07 : 0.035,
        0.25 + Math.random() * (boom ? 0.75 : 0.3),
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        true,
        boom ? 8 : 2,
      );
    }
    if (boom) {
      this.ring(e.x, e.y, 0xffc280, 3.7 * Math.sqrt(size), 0.65);
      this.ring(e.x, 0.05, 0xff7647, 4.5 * Math.sqrt(size), 0.8, true);
      for (let i = 0; i < (high ? 10 : 5); i++)
        this.mote(
          e.x,
          e.y,
          0.1,
          i % 2 ? 0xff4c20 : 0xffc15a,
          (1.3 + Math.random()) * Math.sqrt(size),
          0.25 + Math.random() * 0.4,
          (Math.random() - 0.5) * 5,
          Math.random() * 4,
        );
    } else if (ability || e.kind === 'jump') {
      this.ring(e.x, e.y, color, e.kind === 'doubleJump' ? 2.4 : 1.5, 0.4);
      this.mote(e.x, e.y, 0.2, color, 2.5, 0.23);
    } else {
      this.mote(e.x, e.y, 0.45, color, e.kind === 'impact' ? 1.3 : 0.8, 0.15);
    }
  }
  update(dt: number, sim: Simulation | undefined, high: boolean) {
    const playing = sim?.mode === 'playing';
    const frozen = sim?.mode === 'paused';
    const step = frozen ? 0 : Math.min(dt, 0.05);
    if (!sim || sim.mode === 'menu' || sim.time < this.lastTime) {
      this.motes.length = 0;
      this.waves.forEach((w) => {
        w.life = 0;
      });
      this.wasAirborne = false;
    }
    this.lastTime = sim?.time ?? 0;
    this.emission += step;
    if (playing && this.emission >= (high ? 1 / 45 : 1 / 24)) {
      this.emission = 0;
      const p = sim.player;
      for (const b of sim.bullets) {
        if (!b.friendly || Math.abs(b.x - p.x) > 30) continue;
        if (b.weapon === 0 && Math.random() > 0.3) continue;
        const flame = b.weapon === 5;
        this.mote(
          b.x,
          b.y,
          b.z,
          weapons[b.weapon].color,
          flame ? 1.15 : b.weapon === 3 ? 0.8 : 0.38,
          flame ? 0.16 : 0.24,
          -b.vx * 0.06,
          -b.vy * 0.06,
        );
        if (b.weapon === 2 || b.weapon === 7)
          this.mote(
            b.x,
            b.y,
            b.z + 0.1,
            weapons[b.weapon].color,
            0.045,
            0.13,
            b.vx * 0.3,
            b.vy * 0.3,
            true,
          );
      }
      if (p.dashTime > 0 || p.jumpBurst > 0) {
        this.mote(
          p.x,
          p.y + 0.8,
          0.15,
          0x63ffed,
          1.2,
          0.28,
          p.dashTime > 0 ? -Math.cos(p.angle) * 5 : 0,
          -1,
        );
        this.mote(
          p.x,
          p.y + 0.3,
          0.3,
          0xc1fff4,
          0.035,
          0.35,
          (Math.random() - 0.5) * 5,
          -4,
          true,
        );
      }
      if (p.meleeTime > 0.1 && p.meleeTime < 0.28) {
        const a = ((0.28 - p.meleeTime) / 0.18 - 0.5) * 2.2;
        this.mote(
          p.x + Math.cos(a) * 2.9 * p.meleeFacing,
          p.y + 1.2 + Math.sin(a) * 2.9,
          0.5,
          0x9affda,
          0.8,
          0.18,
        );
      }
      if (this.wasAirborne && p.y <= 0.05 && this.lastY > 0.05) {
        this.ring(p.x, 0.08, 0x9bd9d6, 1.8, 0.35, true);
        for (let i = 0; i < 10; i++)
          this.mote(
            p.x,
            0.1,
            0.2,
            0x93b9b8,
            0.4,
            0.35,
            (Math.random() - 0.5) * 8,
            Math.random(),
          );
      }
      this.wasAirborne = p.y > 0.05;
      this.lastY = p.y;
      // A sparse layer of drifting embers gives the industrial air depth.
      if (Math.random() < 0.25)
        this.mote(
          p.x + (Math.random() - 0.5) * 35,
          1 + Math.random() * 10,
          -2 - Math.random() * 5,
          0xffb575,
          0.08,
          2.4,
          -0.6,
          0.3,
        );
    }
    let glowCount = 0,
      sparkCount = 0;
    this.motes = this.motes.filter((m) => m.life > 0);
    for (const m of this.motes) {
      m.life -= step;
      m.vy -= step * m.gravity;
      m.x += m.vx * step;
      m.y += m.vy * step;
      const fade = Math.max(0, m.life / m.max);
      this.dummy.position.set(m.x, m.y, m.z);
      this.dummy.rotation.set(0, 0, m.spark ? Math.atan2(m.vy, m.vx) : 0);
      this.dummy.scale.set(
        m.spark
          ? Math.max(m.size * 2, Math.hypot(m.vx, m.vy) * 0.045)
          : m.size * (1.6 - fade * 0.6),
        m.spark ? m.size * fade : m.size * (1.6 - fade * 0.6),
        1,
      );
      this.dummy.updateMatrix();
      const mesh = m.spark ? this.sparks : this.glow,
        index = m.spark ? sparkCount++ : glowCount++;
      mesh.setMatrixAt(index, this.dummy.matrix);
      mesh.setColorAt(
        index,
        this.tint.copy(m.color).multiplyScalar(fade * (m.spark ? 2 : 1)),
      );
    }
    for (const [mesh, count] of [
      [this.glow, glowCount],
      [this.sparks, sparkCount],
    ] as const) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const w of this.waves) {
      w.life = Math.max(0, w.life - step);
      w.mesh.visible = w.life > 0;
      const age = 1 - w.life / w.max;
      w.mesh.scale.setScalar(w.radius * (0.15 + Math.sqrt(age) * 0.85));
      w.mesh.material.opacity = (1 - age) ** 2 * 0.65;
    }
  }
  dispose() {
    for (const mesh of [this.glow, this.sparks]) {
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
      mesh.dispose();
    }
    this.waves[0].mesh.geometry.dispose();
    this.waves.forEach((w) => w.mesh.material.dispose());
    this.texture.dispose();
    this.root.removeFromParent();
  }
}
