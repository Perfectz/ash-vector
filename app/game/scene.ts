import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  makeWorld,
  operative,
  siegeMech,
  drone,
  turret,
  type Rig,
  palette,
} from './models';
import { Simulation, type Enemy, type GameEvent } from './simulation';
import { frameCombatCamera, aimOnCombatPlane } from './camera';
import { SpriteOperative, type CharacterStyle } from './sprite';

type Particle = {
  p: T.Vector3;
  v: T.Vector3;
  life: number;
  max: number;
  size: number;
  color: T.Color;
};

export class GameScene {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(48, 1, 0.1, 400);
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  pilot = operative();
  spritePilot = new SpriteOperative();
  characterStyle: CharacterStyle = '3d';
  boss = siegeMech();
  sun = new T.DirectionalLight(0xffc49a, 3.5);
  aim = new T.Vector3(20, 1.5, 0);
  ray = new T.Raycaster();
  enemies = new Map<number, { root: T.Group; rig?: Rig }>();
  particles: Particle[] = [];
  particleMesh: T.InstancedMesh;
  bulletMesh: T.InstancedMesh;
  extras = new Map<number, T.Object3D>();
  rain: T.LineSegments;
  rainPositions: Float32Array;
  shake = 0;
  cameraX = 10;
  menu = true;
  marker: T.Mesh;
  aimLine: T.Line;
  gate: T.Group;
  flash = new T.PointLight(0xff742a, 0, 20, 2);
  quality = 'high';
  private dummy = new T.Object3D();
  private direction = new T.Vector3();
  private up = new T.Vector3(0, 1, 0);
  constructor(public host: HTMLDivElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color(0x647778);
    this.scene.fog = new T.FogExp2(0x647778, 0.011);
    const pmrem = new T.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    this.scene.environment = env.texture;
    this.scene.environmentIntensity = 0.65;
    room.dispose();
    pmrem.dispose();
    this.scene.add(new T.HemisphereLight(0xb5dcdf, 0x2a2524, 2.3));
    this.sun.position.set(30, 40, -45);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 1,
      far: 140,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    const rim = new T.DirectionalLight(0x8cd9ee, 1.8);
    rim.position.set(-20, 10, 15);
    this.scene.add(rim);
    makeWorld(this.scene);
    this.pilot.root.position.set(10, 0, 2);
    this.pilot.root.scale.setScalar(1.18);
    this.scene.add(this.pilot.root);
    this.scene.add(this.spritePilot.root);
    this.boss.position.set(177, 0, 0);
    this.scene.add(this.boss);
    this.particleMesh = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshBasicMaterial({ color: 0xffffff }),
      650,
    );
    this.particleMesh.frustumCulled = false;
    this.particleMesh.count = 0;
    this.scene.add(this.particleMesh);
    this.bulletMesh = new T.InstancedMesh(
      new T.CylinderGeometry(1, 1, 1, 6),
      new T.MeshBasicMaterial({ color: 0xffffff }),
      400,
    );
    this.bulletMesh.frustumCulled = false;
    this.bulletMesh.count = 0;
    this.scene.add(this.bulletMesh);
    this.rainPositions = new Float32Array(900 * 6);
    for (let i = 0; i < 900; i++) {
      const k = i * 6;
      this.rainPositions[k] = (Math.random() - 0.5) * 80;
      this.rainPositions[k + 1] = Math.random() * 35;
      this.rainPositions[k + 2] = (Math.random() - 0.5) * 60;
      this.rainPositions[k + 3] = this.rainPositions[k] - 0.15;
      this.rainPositions[k + 4] = this.rainPositions[k + 1] + 0.8;
      this.rainPositions[k + 5] = this.rainPositions[k + 2];
    }
    const rainGeo = new T.BufferGeometry();
    rainGeo.setAttribute(
      'position',
      new T.BufferAttribute(this.rainPositions, 3),
    );
    this.rain = new T.LineSegments(
      rainGeo,
      new T.LineBasicMaterial({
        color: 0xc7e2e8,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
    this.marker = new T.Mesh(
      new T.RingGeometry(0.42, 0.48, 28),
      new T.MeshBasicMaterial({
        color: 0x92e8cf,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      }),
    );
    (this.marker.material as T.MeshBasicMaterial).depthTest = false;
    this.marker.renderOrder = 10;
    this.scene.add(this.marker);
    this.aimLine = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineBasicMaterial({
        color: 0x92e8cf,
        transparent: true,
        opacity: 0.22,
        depthTest: false,
      }),
    );
    this.aimLine.frustumCulled = false;
    this.scene.add(this.aimLine);
    this.gate = new T.Group();
    for (let z = -7; z <= 7; z += 0.7) {
      const m = new T.Mesh(
        new T.BoxGeometry(0.06, 2, 0.04),
        new T.MeshBasicMaterial({
          color: 0xff5533,
          transparent: true,
          opacity: 0.55,
        }),
      );
      m.position.set(0, 1, z);
      this.gate.add(m);
    }
    this.scene.add(this.gate, this.flash);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new T.Vector2(1, 1), 0.38, 0.55, 1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
  setQuality(value: string) {
    this.quality = value;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, value === 'high' ? 1.5 : 1),
    );
    this.renderer.shadowMap.enabled = value === 'high';
    this.bloom.enabled = value === 'high';
    this.resize();
  }
  pointerAim(x: number, y: number, sim: Simulation) {
    const rect = this.host.getBoundingClientRect();
    // Aim exactly where the cursor crosses the side-scrolling combat plane.
    // Assistance is applied once by the simulation, never by a second picker.
    const hit = aimOnCombatPlane(
      this.ray,
      this.camera,
      ((x - rect.left) / rect.width) * 2 - 1,
      (-(y - rect.top) / rect.height) * 2 + 1,
      this.aim,
    );
    return hit ? { x: hit.x, y: hit.y, z: 0 } : sim.aimPoint;
  }
  burst(event: GameEvent) {
    const explosion = event.kind === 'explosion' || event.kind === 'victory',
      hurt = event.kind === 'hurt';
    if (
      ![
        'explosion',
        'victory',
        'impact',
        'hurt',
        'shot',
        'dash',
        'jump',
        'pickup',
        'sector',
      ].includes(event.kind)
    )
      return;
    const n = explosion
      ? Math.floor(30 * (event.size ?? 1))
      : event.kind === 'shot'
        ? 3
        : 12;
    const size = event.size ?? 1;
    const color = new T.Color(
      event.kind === 'dash' ||
        event.kind === 'pickup' ||
        event.kind === 'sector'
        ? 0x80f5d7
        : 0xff9b4d,
    );
    for (let i = 0; i < n; i++) {
      const max =
        (explosion ? 0.6 : 0.15) + Math.random() * (explosion ? 0.9 : 0.25);
      this.particles.push({
        p: new T.Vector3(event.x, event.y, event.z),
        v: new T.Vector3(
          (Math.random() - 0.5) * size * 9,
          Math.random() * size * 6,
          (Math.random() - 0.5) * size * 9,
        ),
        max,
        life: max,
        size: (explosion ? 0.12 : 0.035) * (0.5 + Math.random()) * size,
        color: color.clone().lerp(new T.Color(0xfff3bb), Math.random()),
      });
    }
    if (this.particles.length > 650)
      this.particles.splice(0, this.particles.length - 650);
    if (explosion || hurt) {
      this.shake = Math.max(
        this.shake,
        hurt ? 0.24 : Math.min(size * 0.14, 0.7),
      );
      this.flash.position.set(event.x, event.y + 1, event.z);
      this.flash.intensity = 30 * size;
    }
    if (event.kind === 'shot')
      this.shake = Math.max(this.shake, 0.025 * (event.weapon === 2 ? 3 : 1));
  }
  enemyModel(e: Enemy) {
    let model = this.enemies.get(e.id);
    if (!model) {
      if (e.kind === 'soldier') {
        const rig = operative(true);
        model = { root: rig.root, rig };
      } else model = { root: e.kind === 'drone' ? drone() : turret() };
      this.enemies.set(e.id, model);
      this.scene.add(model.root);
    }
    return model;
  }
  render(t: number, sim?: Simulation, dt = 1 / 60) {
    const inMenu = !sim || sim.mode === 'menu';
    const p = sim?.player;
    this.pilot.torso.position.y = 1.1 + Math.sin(t * 1.7) * 0.02;
    if (inMenu) {
      this.pilot.root.position.set(13, 0, 2);
      this.pilot.root.rotation.set(0, -0.2, 0);
      this.pilot.root.scale.setScalar(1.4);
      this.camera.position.set(6 + Math.sin(t * 0.09) * 0.8, 3.5, 10);
      this.camera.lookAt(8.5, 1.8, 0);
      this.gate.visible = false;
      this.marker.visible = false;
      this.aimLine.visible = false;
      this.boss.visible = false;
      this.rain.position.x = 10;
      this.pilot.root.visible = true;
      this.pilot.muzzle.visible = false;
      this.pilot.glow.intensity = 0;
      this.pilot.legs.forEach((leg) => {
        leg.rotation.z = 0;
      });
      this.pilot.torso.rotation.z = 0;
      this.pilot.gun.rotation.z = 0;
      this.pilot.gun.position.set(0.57, 0.19, 0.34);
      this.bulletMesh.count = 0;
      for (const m of this.enemies.values()) m.root.visible = false;
      for (const m of this.extras.values()) m.visible = false;
    } else if (p && sim) {
      if (this.menu) {
        this.cameraX = p.x;
        this.menu = false;
      }
      this.pilot.root.scale.setScalar(1);
      this.pilot.root.position.set(p.x, p.y, p.z);
      this.pilot.root.rotation.set(0, p.angle, 0);
      this.pilot.root.visible =
        sim.mode !== 'dead' &&
        (p.invulnerable <= 0 || p.dashTime > 0 || Math.sin(t * 65) > -0.2);
      this.pilot.torso.rotation.z =
        p.dashTime > 0 ? -0.35 : Math.sin(t * 18) * p.moving * 0.035;
      for (let i = 0; i < 2; i++)
        this.pilot.legs[i].rotation.z =
          p.y > 0.2
            ? i === 0
              ? 0.5
              : -0.8
            : Math.sin(t * 16 + i * Math.PI) * p.moving * 0.7;
      this.pilot.muzzle.visible = p.flash > 0 && sim.mode === 'playing';
      this.pilot.glow.intensity = this.pilot.muzzle.visible ? 9 : 0;
      this.pilot.gun.position.set(0.18 - (p.flash > 0 ? 0.07 : 0), 0.3, 0.34);
      this.pilot.gun.rotation.z = p.aimPitch;
      this.marker.visible = sim.mode === 'playing';
      this.marker.position.set(sim.aimPoint.x, sim.aimPoint.y, 0.6);
      this.marker.scale.setScalar(sim.targetLocked ? 1.3 : 0.8);
      (this.marker.material as T.MeshBasicMaterial).color.setHex(
        sim.targetLocked ? 0xffdc82 : 0x92e8cf,
      );
      this.aimLine.visible = sim.mode === 'playing';
      const line = this.aimLine.geometry.attributes.position;
      line.setXYZ(0, p.x, p.y + 1.4, 0.5);
      line.setXYZ(1, sim.aimPoint.x, sim.aimPoint.y, 0.5);
      line.needsUpdate = true;
      this.cameraX = T.MathUtils.lerp(this.cameraX, p.x, 1 - Math.exp(-dt * 5));
      // Fixed side view: every fighter shares the XY plane while perspective
      // scenery retains depth and parallax. Frame both pilot and boss on entry.
      frameCombatCamera(
        this.camera,
        this.cameraX,
        sim.boss.active,
        window.innerHeight > window.innerWidth,
      );
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.sun.position.set(this.cameraX + 25, 40, -45);
      this.sun.target.position.set(this.cameraX, 0, 0);
      this.sun.target.updateMatrixWorld();
      const living = new Set(sim.enemies.map((e) => e.id));
      for (const [id, m] of this.enemies)
        if (!living.has(id)) {
          m.root.removeFromParent();
          this.enemies.delete(id);
        }
      for (const e of sim.enemies) {
        const m = this.enemyModel(e);
        m.root.visible = e.sector === sim.sector && Math.abs(e.x - p.x) < 32;
        if (!m.root.visible) continue;
        m.root.position.set(e.x, e.y, e.z);
        m.root.rotation.y = e.kind === 'turret' ? e.angle - Math.PI : e.angle;
        if (m.rig) {
          m.rig.legs.forEach((leg, i) => {
            leg.rotation.z = e.active
              ? Math.sin(t * 8 + e.id + i * Math.PI) * 0.3
              : 0;
          });
          m.rig.torso.position.y = 1.1 + Math.sin(t * 3 + e.id) * 0.025;
          m.rig.muzzle.visible = e.cooldown > 2.05 && e.cooldown < 2.13;
        }
        if (e.kind === 'drone') {
          m.root.rotation.z = Math.sin(t * 3 + e.id) * 0.12;
          m.root.rotation.x = Math.sin(t * 2 + e.id) * 0.13;
        }
      }
      this.boss.visible = sim.boss.x - p.x < 58;
      this.boss.position.set(sim.boss.x, Math.sin(t * 1.5) * 0.04, sim.boss.z);
      this.boss.rotation.z = Math.sin(t * 2) * 0.015;
      if (sim.mode === 'won') {
        this.boss.rotation.z = -Math.min(1.1, (t % 1000) * 0.0003 + 0.25);
        this.boss.position.y = -1.8;
      }
      this.gate.visible = sim.sector < 3 && sim.remaining() > 0;
      this.gate.position.x = [57, 109, 158][sim.sector] ?? 190;
      let bi = 0;
      for (const b of sim.bullets) {
        if (bi >= 400) break;
        this.dummy.position.set(b.x, b.y, b.z);
        this.direction.set(b.vx, b.vy, b.vz).normalize();
        this.dummy.quaternion.setFromUnitVectors(this.up, this.direction);
        this.dummy.scale.set(
          b.friendly ? 0.065 : 0.18,
          b.friendly ? (b.weapon === 2 ? 2.2 : 1) : 0.34,
          b.friendly ? 0.065 : 0.18,
        );
        this.dummy.updateMatrix();
        this.bulletMesh.setMatrixAt(bi, this.dummy.matrix);
        this.bulletMesh.setColorAt(
          bi,
          new T.Color(
            b.friendly ? (b.weapon === 2 ? 0x9bffee : 0xffdf86) : 0xff387b,
          ),
        );
        bi++;
      }
      this.bulletMesh.count = bi;
      this.bulletMesh.instanceMatrix.needsUpdate = true;
      if (this.bulletMesh.instanceColor)
        this.bulletMesh.instanceColor.needsUpdate = true;
      const aliveExtras = new Set<number>();
      for (const m of this.extras.values()) m.visible = true;
      for (const g of sim.grenades) {
        aliveExtras.add(g.id);
        let obj = this.extras.get(g.id);
        if (!obj) {
          obj = new T.Mesh(new T.IcosahedronGeometry(0.19, 1), palette.fire);
          this.extras.set(g.id, obj);
          this.scene.add(obj);
        }
        obj.position.set(g.x, g.y, g.z);
        obj.rotation.x = t * 12;
      }
      for (const item of sim.pickups) {
        aliveExtras.add(item.id);
        let obj = this.extras.get(item.id);
        if (!obj) {
          const group = new T.Group();
          const a = new T.Mesh(
              new T.BoxGeometry(0.6, 0.15, 0.15),
              palette.cyan,
            ),
            b = new T.Mesh(new T.BoxGeometry(0.15, 0.6, 0.15), palette.cyan);
          group.add(a, b);
          obj = group;
          this.extras.set(item.id, obj);
          this.scene.add(obj);
        }
        obj.position.set(item.x, 1 + Math.sin(t * 3) * 0.15, item.z);
        obj.rotation.y = t * 1.6;
      }
      for (const h of sim.hazards) {
        aliveExtras.add(h.id);
        let obj = this.extras.get(h.id);
        if (!obj) {
          obj = new T.Mesh(
            new T.RingGeometry(0.85, 1, 40),
            new T.MeshBasicMaterial({
              color: 0xff4422,
              transparent: true,
              opacity: 0.8,
              side: T.DoubleSide,
              depthWrite: false,
            }),
          );
          // Vertical warning disc, visible from the side (ground rings were edge-on).
          obj.rotation.x = 0;
          this.extras.set(h.id, obj);
          this.scene.add(obj);
        }
        obj.position.set(h.x, 1.15, 0.8);
        obj.scale.set(h.radius, 1.2 + Math.sin(t * 18) * 0.1, 1);
        obj.visible = !h.exploded;
      }
      for (const [id, obj] of this.extras)
        if (!aliveExtras.has(id)) {
          obj.removeFromParent();
          this.extras.delete(id);
        }
      this.rain.position.x = this.cameraX;
    }
    const useSprite = this.characterStyle === '2d' && this.spritePilot.ready;
    this.spritePilot.root.visible = useSprite && this.pilot.root.visible;
    if (useSprite) {
      this.spritePilot.update(p, inMenu ? t : sim!.time, inMenu);
      this.pilot.root.visible = false;
      this.pilot.glow.intensity = 0;
    }
    this.host.dataset.characterRenderer = useSprite ? '2d' : '3d';
    this.host.dataset.spriteFrame = useSprite
      ? String(this.spritePilot.frame)
      : '';
    this.shake *= Math.exp(-dt * 13);
    this.flash.intensity *= Math.exp(-dt * 12);
    for (let i = 0; i < 900; i++) {
      const k = i * 6;
      this.rainPositions[k + 1] -= dt * 19;
      this.rainPositions[k + 4] -= dt * 19;
      if (this.rainPositions[k + 1] < -3) {
        this.rainPositions[k + 1] = 32;
        this.rainPositions[k + 4] = 32.8;
      }
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    this.particles = this.particles.filter((particle) => particle.life > 0);
    let pi = 0;
    for (const particle of this.particles) {
      particle.life -= dt;
      particle.v.y -= dt * 7;
      particle.p.addScaledVector(particle.v, dt);
      this.dummy.position.copy(particle.p);
      this.dummy.rotation.set(t, t * 2, 0);
      this.dummy.scale.setScalar(
        particle.size * Math.max(0, particle.life / particle.max),
      );
      this.dummy.updateMatrix();
      this.particleMesh.setMatrixAt(pi, this.dummy.matrix);
      this.particleMesh.setColorAt(pi, particle.color);
      pi++;
    }
    this.particleMesh.count = pi;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor)
      this.particleMesh.instanceColor.needsUpdate = true;
    this.composer.render();
  }
  dispose() {
    this.spritePilot.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
      }
    });
    this.scene.environment?.dispose();
  }
}
