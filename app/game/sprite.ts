import * as T from 'three';
import type { Simulation } from './simulation';

export type CharacterStyle = '3d' | '2d';
export const characterStyleKey = 'ash-vector:character-style';

// The generated artwork has irregular gutters: authored bounds keep the raised
// barrel and dash inside their frames. Anchors register the body, not the gun.
export const spriteFrames = [
  [20, 20, 280, 295, 145, 308],
  [365, 20, 250, 295, 457, 308],
  [680, 20, 250, 295, 766, 308],
  [990, 20, 250, 295, 1080, 308],
  [20, 340, 290, 280, 157, 606],
  [390, 340, 228, 280, 466, 606],
  [635, 340, 305, 280, 777, 606],
  [962, 340, 283, 280, 1090, 606],
  [60, 690, 245, 232, 145, 911],
  [350, 635, 270, 287, 468, 911],
  [695, 635, 235, 232, 776, 911],
  [1000, 690, 240, 232, 1090, 911],
  [25, 955, 320, 278, 145, 1220],
  [370, 902, 216, 332, 468, 1220],
  [615, 1008, 350, 192, 775, 1220],
  [975, 964, 267, 270, 1090, 1220],
] as const;

export function operativeFrame(p: Simulation['player'], time: number) {
  if (time - p.lastDamage < 0.18) return 15;
  if (p.dashTime > 0) return 14;
  if (p.jumps > 0 || Math.abs(p.vy) > 0.1)
    return p.vy > 3 ? 9 : p.vy < -3 ? 11 : 10;
  if (p.moving > 0.1) return 4 + (Math.floor(time * 11) % 4);
  if (p.aimPitch > 0.32) return 13;
  if (p.flash > 0) return 12;
  return Math.floor(time * 4) % 4;
}

// Only near-white pixels connected to a frame's border are background. This
// preserves enclosed highlights and the operative's ivory armor.
export function clearSpriteBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0,
    tail = 0;
  const add = (n: number) => {
    if (visited[n]) return;
    visited[n] = 1;
    const i = n * 4;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    if (min < 225 || max - min > 18) return;
    data[i + 3] = 0;
    queue[tail++] = n;
  };
  for (let x = 0; x < width; x++) {
    add(x);
    add((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    add(y * width);
    add(y * width + width - 1);
  }
  while (head < tail) {
    const n = queue[head++],
      x = n % width;
    if (x > 0) add(n - 1);
    if (x < width - 1) add(n + 1);
    if (n >= width) add(n - width);
    if (n < width * (height - 1)) add(n + width);
  }
}

export class SpriteOperative {
  material = new T.SpriteMaterial({
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    toneMapped: false,
  });
  root = new T.Sprite(this.material);
  textures: T.CanvasTexture[] = [];
  ready = false;
  disposed = false;
  frame = -1;
  readyPromise: Promise<void>;
  constructor() {
    this.root.name = '2D operative';
    this.root.center.set(160 / 384, 34 / 384);
    this.root.visible = false;
    this.readyPromise = this.load();
  }
  async load() {
    const source = new Image();
    source.src = '/sprites/operative-sheet-v1.png';
    await source.decode();
    if (this.disposed) return;
    if (source.naturalWidth !== 1254 || source.naturalHeight !== 1254)
      throw new Error('Unexpected operative sheet dimensions');
    for (const [
      index,
      [x, y, w, h, anchorX, baseline],
    ] of spriteFrames.entries()) {
      const crop = document.createElement('canvas');
      crop.width = w;
      crop.height = h;
      const ctx = crop.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Sprite canvas unavailable');
      ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
      const pixels = ctx.getImageData(0, 0, w, h);
      clearSpriteBackground(pixels.data, w, h);
      ctx.putImageData(pixels, 0, 0);
      // These two poses cross the nominal row boundary in the source sheet.
      // Exclude the adjacent boot / raised muzzle without trimming either pose.
      if (index === 9) ctx.clearRect(510 - x, 885 - y, w, h);
      if (index === 13) ctx.clearRect(0, 0, 440 - x, 950 - y);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 384;
      const frame = canvas.getContext('2d');
      if (!frame) throw new Error('Sprite canvas unavailable');
      frame.drawImage(crop, 160 - (anchorX - x), 350 - (baseline - y));
      const texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.magFilter = T.LinearFilter;
      this.textures.push(texture);
    }
    this.ready = true;
  }
  update(p: Simulation['player'] | undefined, time: number, menu: boolean) {
    if (!this.ready) return;
    const frame =
      menu || !p ? Math.floor(time * 4) % 4 : operativeFrame(p, time);
    if (frame !== this.frame) {
      this.frame = frame;
      this.material.map = this.textures[frame];
      this.material.needsUpdate = true;
    }
    const facing = !menu && p && Math.cos(p.angle) < 0 ? -1 : 1;
    const size = 384 * (2.25 / 270) * (menu ? 1.4 : 1);
    this.textures[frame].repeat.x = facing;
    this.textures[frame].offset.x = facing < 0 ? 1 : 0;
    this.root.center.x = facing < 0 ? 1 - 160 / 384 : 160 / 384;
    this.root.scale.set(size, size, 1);
    this.root.position.set(
      menu ? 13 : p!.x,
      menu ? 0 : p!.y,
      menu ? 2 : p!.z + 0.15,
    );
  }
  dispose() {
    this.disposed = true;
    for (const texture of this.textures) texture.dispose();
    this.material.dispose();
    this.root.removeFromParent();
  }
}
