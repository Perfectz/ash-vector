import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const palette = {
  armor: new T.MeshStandardMaterial({
    color: 0xc9c6b5,
    metalness: 0.65,
    roughness: 0.34,
  }),
  dark: new T.MeshStandardMaterial({
    color: 0x19262b,
    metalness: 0.8,
    roughness: 0.36,
  }),
  steel: new T.MeshStandardMaterial({
    color: 0x496069,
    metalness: 0.72,
    roughness: 0.4,
  }),
  orange: new T.MeshStandardMaterial({
    color: 0xc74016,
    metalness: 0.55,
    roughness: 0.38,
  }),
  black: new T.MeshStandardMaterial({
    color: 0x0a1318,
    metalness: 0.5,
    roughness: 0.5,
  }),
  cyan: new T.MeshStandardMaterial({
    color: 0x8effed,
    emissive: 0x39edcd,
    emissiveIntensity: 3,
  }),
  fire: new T.MeshStandardMaterial({
    color: 0xffc16e,
    emissive: 0xff5715,
    emissiveIntensity: 4,
  }),
  red: new T.MeshStandardMaterial({
    color: 0xff483c,
    emissive: 0xff1709,
    emissiveIntensity: 2.6,
  }),
};
const boxGeo = new T.BoxGeometry(1, 1, 1);
const sphereGeo = new T.IcosahedronGeometry(1, 1);
const cylinderGeo = new T.CylinderGeometry(1, 1, 1, 10);
export function box(
  g: T.Object3D,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const mesh = new T.Mesh(boxGeo, m);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export function sphere(
  g: T.Object3D,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  r: number,
) {
  const mesh = new T.Mesh(sphereGeo, m);
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(r);
  mesh.castShadow = true;
  g.add(mesh);
  return mesh;
}
export function cylinder(
  g: T.Object3D,
  m: T.Material,
  x: number,
  y: number,
  z: number,
  r: number,
  length: number,
) {
  const mesh = new T.Mesh(cylinderGeo, m);
  mesh.position.set(x, y, z);
  mesh.scale.set(r, length, r);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
function beam(
  g: T.Object3D,
  m: T.Material,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
) {
  const p = a.clone().add(b).multiplyScalar(0.5);
  const c = cylinder(g, m, p.x, p.y, p.z, r, a.distanceTo(b));
  c.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  return c;
}

export type Rig = {
  root: T.Group;
  torso: T.Group;
  legs: T.Group[];
  gun: T.Group;
  muzzle: T.Mesh;
  glow: T.PointLight;
};
export function operative(enemy = false): Rig {
  const root = new T.Group(),
    torso = new T.Group();
  root.add(torso);
  torso.position.y = 1.1;
  const a = enemy ? palette.orange : palette.armor;
  box(torso, palette.dark, 0, 0.25, 0, 0.59, 0.74, 0.42);
  box(torso, a, 0.1, 0.35, 0, 0.5, 0.57, 0.56).rotation.z = -0.12;
  box(torso, a, 0.25, 0.58, 0, 0.26, 0.22, 0.59);
  box(torso, palette.black, 0.37, 0.34, 0, 0.13, 0.3, 0.35);
  for (let i = 0; i < 3; i++)
    box(torso, palette.steel, 0.44, 0.26 + i * 0.08, 0, 0.04, 0.035, 0.26);
  box(
    torso,
    enemy ? palette.red : palette.cyan,
    0.458,
    0.53,
    0,
    0.025,
    0.045,
    0.28,
  );
  sphere(torso, palette.dark, -0.03, 0.87, 0, 0.26);
  box(torso, a, 0.015, 0.89, 0, 0.4, 0.35, 0.43);
  box(torso, palette.black, 0.22, 0.88, 0, 0.06, 0.14, 0.39);
  box(
    torso,
    enemy ? palette.red : palette.cyan,
    0.258,
    0.9,
    0,
    0.04,
    0.07,
    0.31,
  );
  box(torso, palette.orange, -0.04, 1.085, -0.01, 0.2, 0.045, 0.26);
  box(torso, palette.dark, -0.4, 0.35, 0, 0.22, 0.58, 0.42);
  for (const s of [-1, 1]) {
    cylinder(torso, palette.steel, -0.48, 0.29, s * 0.17, 0.11, 0.5);
    sphere(torso, palette.dark, 0.01, 0.53, s * 0.4, 0.2);
    box(torso, a, 0.04, 0.51, s * 0.39, 0.4, 0.29, 0.23);
    const arm = box(torso, palette.dark, 0.19, 0.23, s * 0.38, 0.22, 0.45, 0.2);
    arm.rotation.z = 0.65;
    box(torso, a, 0.37, 0.11, s * 0.33, 0.47, 0.21, 0.23);
    box(torso, palette.dark, 0.04, -0.36, s * 0.33, 0.26, 0.21, 0.14);
  }
  const gun = new T.Group();
  gun.position.set(0.57, 0.19, 0.34);
  torso.add(gun);
  box(gun, palette.dark, 0.32, 0, 0, 0.94, 0.23, 0.19);
  box(gun, palette.steel, 0.21, 0.13, 0, 0.55, 0.06, 0.15);
  box(gun, palette.orange, 0.12, -0.05, 0, 0.32, 0.23, 0.23);
  box(gun, palette.dark, 0.22, -0.25, 0, 0.16, 0.3, 0.14).rotation.z = -0.2;
  const barrel = cylinder(gun, palette.dark, 0.94, 0, 0, 0.085, 0.42);
  barrel.rotation.z = Math.PI / 2;
  for (let i = 0; i < 3; i++)
    box(
      gun,
      enemy ? palette.red : palette.cyan,
      0.5 + i * 0.09,
      0.03,
      0.103,
      0.045,
      0.05,
      0.01,
    );
  const muzzle = sphere(gun, palette.fire, 1.23, 0, 0, 0.22);
  muzzle.scale.set(0.55, 0.13, 0.13);
  muzzle.visible = false;
  const glow = new T.PointLight(enemy ? 0xff461b : 0xffd2a2, 0, 4, 2);
  glow.position.set(1.3, 0, 0);
  gun.add(glow);
  box(root, palette.dark, 0, 1.02, 0, 0.54, 0.22, 0.44);
  const legs: T.Group[] = [];
  for (const s of [-1, 1]) {
    const leg = new T.Group();
    leg.position.set(0, 1, s * 0.21);
    root.add(leg);
    legs.push(leg);
    box(leg, palette.dark, 0, -0.27, 0, 0.24, 0.5, 0.25);
    box(leg, a, 0.09, -0.23, 0, 0.22, 0.38, 0.31);
    sphere(leg, palette.steel, 0.02, -0.5, 0, 0.15);
    box(leg, palette.dark, -0.035, -0.7, 0, 0.22, 0.39, 0.21);
    box(leg, a, 0.065, -0.72, 0, 0.23, 0.35, 0.29);
    box(leg, palette.dark, 0.07, -0.92, 0, 0.46, 0.19, 0.3);
  }
  return { root, torso, legs, gun, muzzle, glow };
}

export function drone() {
  const g = new T.Group();
  sphere(g, palette.dark, 0, 0, 0, 0.5);
  box(g, palette.orange, 0, 0.1, 0, 0.8, 0.32, 0.75);
  sphere(g, palette.red, -0.48, 0, 0, 0.16);
  for (const s of [-1, 1]) {
    box(g, palette.steel, 0, 0.08, s * 0.8, 0.22, 0.14, 1.2);
    const ring = new T.Mesh(
      new T.TorusGeometry(0.43, 0.09, 8, 20),
      palette.dark,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.08, s * 1.15);
    g.add(ring);
    cylinder(g, palette.fire, 0, -0.02, s * 1.15, 0.22, 0.05);
    box(g, palette.dark, 0, 0.12, s * 1.15, 0.9, 0.04, 0.08);
  }
  return g;
}

export function turret() {
  const g = new T.Group();
  cylinder(g, palette.dark, 0, 0.15, 0, 0.83, 0.3);
  cylinder(g, palette.steel, 0, 0.53, 0, 0.36, 0.65);
  box(g, palette.orange, 0, 1, 0, 1, 0.6, 0.75);
  box(g, palette.dark, -0.6, 1, 0, 0.8, 0.22, 0.38);
  for (const z of [-0.23, 0.23]) {
    const b = cylinder(g, palette.steel, -0.82, 1, z, 0.11, 1.1);
    b.rotation.z = Math.PI / 2;
  }
  box(g, palette.red, -0.52, 1.22, 0, 0.08, 0.13, 0.24);
  return g;
}

export function siegeMech() {
  const g = new T.Group();
  for (const s of [-1, 1]) {
    box(g, palette.dark, -0.4, 0.35, s * 2.1, 3.4, 0.7, 1.45);
    for (let j = 0; j < 6; j++)
      box(g, palette.steel, -1.8 + j * 0.55, 0.45, s * 2.85, 0.35, 0.6, 0.11);
    sphere(g, palette.steel, 0.2, 1.1, s * 2, 0.65);
    const shin = box(g, palette.armor, 0.1, 1.6, s * 2, 1.1, 2, 1.15);
    shin.rotation.z = -0.24;
    sphere(g, palette.dark, -0.1, 2.6, s * 2, 0.65);
    const thigh = box(g, palette.orange, 0.45, 3.1, s * 1.75, 1.35, 1.8, 1.4);
    thigh.rotation.z = 0.45;
    beam(
      g,
      palette.steel,
      new T.Vector3(-0.65, 1, s * 2),
      new T.Vector3(-0.75, 2.8, s * 1.85),
      0.14,
    );
    box(g, palette.armor, 0, 5.2, s * 2.5, 2.8, 1.25, 1.3);
    box(g, palette.orange, -0.2, 5.4, s * 2.5, 1.9, 0.4, 1.4);
    const cannon = new T.Group();
    cannon.position.set(-0.7, 4.25, s * 2.55);
    g.add(cannon);
    cylinder(cannon, palette.dark, 0, 0, 0, 0.6, 0.7).rotation.z = Math.PI / 2;
    for (let j = 0; j < 5; j++) {
      const ang = (j * Math.PI * 2) / 5;
      const z = Math.sin(ang) * 0.33,
        y = Math.cos(ang) * 0.33;
      cylinder(cannon, palette.steel, -0.7, y, z, 0.13, 2.1).rotation.z =
        Math.PI / 2;
      cylinder(cannon, palette.fire, -1.77, y, z, 0.095, 0.05).rotation.z =
        Math.PI / 2;
    }
    box(g, palette.dark, 0.8, 6.15, s * 1.4, 1.3, 0.8, 0.95);
    for (let j = 0; j < 4; j++)
      sphere(
        g,
        palette.fire,
        0.1,
        6.05 + (j % 2) * 0.3,
        s * (1.15 + Math.floor(j / 2) * 0.35),
        0.12,
      );
  }
  box(g, palette.dark, 0.45, 4.45, 0, 2.5, 2.4, 3.15);
  box(g, palette.armor, -0.5, 4.8, 0, 1.5, 1.3, 2.6).rotation.z = -0.18;
  box(g, palette.orange, -1.2, 4.9, 0, 0.25, 0.7, 1.7);
  const core = cylinder(g, palette.fire, -1.38, 4.5, 0, 0.5, 0.16);
  core.rotation.z = Math.PI / 2;
  const ring = new T.Mesh(new T.TorusGeometry(0.65, 0.11, 8, 24), palette.dark);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(-1.5, 4.5, 0);
  g.add(ring);
  box(g, palette.dark, -0.32, 6.04, 0, 1.6, 0.6, 1.55);
  box(g, palette.red, -1.14, 6.07, 0, 0.08, 0.14, 1.22);
  for (let i = 0; i < 6; i++)
    box(g, palette.steel, 1.74, 4.0 + i * 0.26, 0, 0.16, 0.1, 1.8);
  const light = new T.PointLight(0xff4400, 8, 9);
  light.position.set(-2, 4.5, 0);
  g.add(light);
  return g;
}

export function makeWorld(scene: T.Scene) {
  let seed = 84;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const env = new T.Group();
  scene.add(env);
  const ground = new T.MeshStandardMaterial({
    color: 0x263a40,
    metalness: 0.72,
    roughness: 0.3,
  });
  // Modular deck plates, recessed rails and exposed structural supports.
  for (let x = -16; x < 204; x += 8) {
    box(env, ground, x, -0.42, 0, 7.92, 0.8, 15);
    for (const z of [-7.5, 7.5]) {
      box(env, palette.dark, x, -0.8, z, 8, 1.4, 0.6);
      box(env, palette.steel, x, 0.11, z, 8, 0.22, 0.35);
      box(env, palette.fire, x, 0.25, z * 0.955, 3, 0.035, 0.08);
      box(env, palette.steel, x, -3, z * 0.79, 1, 5, 1);
      const support = box(env, palette.dark, x, -2.5, z * 0.78, 8, 0.5, 0.55);
      support.rotation.z = z > 0 ? 0.4 : -0.4;
      box(env, palette.dark, x + 0.3, 0.48, z, 0.2, 0.95, 0.15);
      box(env, palette.steel, x, 0.98, z, 8, 0.1, 0.1);
    }
    for (const z of [-5.1, 5.1]) {
      box(env, palette.black, x, 0.007, z, 8, 0.016, 0.18);
      box(env, palette.steel, x, 0.017, z + 0.16, 8, 0.015, 0.025);
    }
    for (const z of [-0.14, 0.14])
      box(env, palette.armor, x, 0.016, z, 3, 0.018, 0.07);
    for (let i = 0; i < 4; i++)
      box(env, palette.steel, x - 3 + i * 2, 0.02, 6.2, 1.2, 0.025, 0.35);
  }
  // Gantries frame the route, with cross-bracing and suspended industrial equipment.
  for (let x = 8; x < 190; x += 32) {
    for (const z of [-8.8, 8.8]) {
      box(env, palette.dark, x, 5, z, 0.85, 12, 1.1);
      box(env, palette.orange, x, 2.2, z, 0.92, 1.2, 1.2);
      box(env, palette.steel, x + 0.48, 5, z, 0.13, 11, 0.32);
      beam(
        env,
        palette.steel,
        new T.Vector3(x, 8, z),
        new T.Vector3(x + 4, -1, z),
        0.15,
      );
    }
    box(env, palette.dark, x, 10.8, 0, 1, 1.2, 19);
    box(env, palette.steel, x, 11.55, 0, 0.4, 0.35, 19.3);
    for (const z of [-5, 0, 5]) {
      box(env, palette.black, x, 9.97, z, 1.4, 0.3, 1.8);
      box(env, palette.armor, x, 9.8, z, 1.1, 0.06, 1.5);
    }
    box(env, palette.orange, x, 9.8, -8, 0.2, 1.4, 2.5);
  }
  // Background skyline is instanced to keep the large environment inexpensive.
  const buildings = new T.InstancedMesh(
    boxGeo,
    new T.MeshStandardMaterial({
      color: 0x1f333c,
      metalness: 0.45,
      roughness: 0.62,
    }),
    125,
  );
  const windows = new T.InstancedMesh(
    boxGeo,
    new T.MeshBasicMaterial({ color: 0x93a5a3 }),
    800,
  );
  const matrix = new T.Object3D();
  let wi = 0;
  for (let i = 0; i < 125; i++) {
    const x = -130 + rand() * 450,
      z = -36 - rand() * 180,
      h = 12 + rand() * 85,
      w = 6 + rand() * 14;
    matrix.position.set(x, h / 2 - 21, z);
    matrix.scale.set(w, h, 7 + rand() * 14);
    matrix.updateMatrix();
    buildings.setMatrixAt(i, matrix.matrix);
    for (let j = 0; j < 6 && wi < 800; j++) {
      matrix.position.set(
        x + (rand() - 0.5) * w * 0.6,
        h * 0.2 + rand() * h * 0.6 - 21,
        z + 11,
      );
      matrix.scale.set(w * 0.34, 0.12, 0.12);
      matrix.updateMatrix();
      windows.setMatrixAt(wi++, matrix.matrix);
    }
    if (i < 14) {
      box(env, palette.dark, x, h - 20, z, 0.3, 8, 0.3);
      sphere(env, palette.red, x, h - 16, z, 0.15);
    }
  }
  windows.count = wi;
  env.add(buildings, windows);
  // Huge conduit pipes and lower city decks give the bridge physical depth.
  for (const z of [-14, -17]) {
    const p = cylinder(env, palette.dark, 90, -5, z, 1.15, 290);
    p.rotation.z = Math.PI / 2;
    for (let x = -40; x < 230; x += 8) {
      const r = cylinder(env, palette.steel, x, -5, z, 1.3, 0.24);
      r.rotation.z = Math.PI / 2;
    }
  }
  box(env, palette.dark, 80, -20, -55, 360, 5, 55);
  const sun = new T.Mesh(
    new T.SphereGeometry(11, 32, 24),
    new T.MeshBasicMaterial({ color: 0xffaf70, fog: false }),
  );
  sun.position.set(100, 42, -190);
  env.add(sun);
  // Cargo has a readable collision silhouette; crates are also jumpable cover.
  const crates = [
    { x: 27, z: -3 },
    { x: 44, z: 3.4 },
    { x: 69, z: -4 },
    { x: 91, z: 3 },
    { x: 119, z: -3.5 },
    { x: 139, z: 4 },
  ];
  for (const c of crates) {
    box(env, palette.dark, c.x, 0.65, c.z, 2.6, 1.3, 2.2);
    box(env, palette.orange, c.x, 1.31, c.z, 2.65, 0.08, 2.25);
    for (const dx of [-1.1, 1.1]) {
      box(env, palette.steel, c.x + dx, 0.68, c.z, 0.12, 1.25, 2.24);
    }
    for (let j = 0; j < 6; j++)
      box(
        env,
        palette.steel,
        c.x - 0.85 + j * 0.34,
        0.68,
        c.z + 1.12,
        0.08,
        0.88,
        0.025,
      );
  }
  // Landing lights point toward the final arena.
  for (let z = -6; z <= 6; z += 3) {
    box(env, palette.orange, 151, 0.025, z, 1.3, 0.025, 1);
    box(env, palette.dark, 152, 0.026, z, 0.3, 0.027, 1);
  }
  // Bake static architecture by material. Hundreds of pieces become a handful of draw calls.
  env.updateMatrixWorld(true);
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const removed: T.Mesh[] = [];
  env.traverse((o) => {
    if (
      o instanceof T.Mesh &&
      !(o instanceof T.InstancedMesh) &&
      o.material instanceof T.Material
    ) {
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const list = batches.get(o.material) ?? [];
      list.push(geometry);
      batches.set(o.material, list);
      removed.push(o);
    }
  });
  for (const mesh of removed) mesh.removeFromParent();
  for (const [mat, parts] of batches) {
    const geometry = mergeGeometries(parts, false);
    if (geometry) {
      const mesh = new T.Mesh(geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      env.add(mesh);
    }
    parts.forEach((g) => g.dispose());
  }
  return { env, crates };
}
