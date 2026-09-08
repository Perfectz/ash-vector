import * as T from 'three';
import type { CharacterId, Simulation } from './simulation';

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

export function rosterFrame(
  character: CharacterId,
  p: Simulation['player'],
  time: number,
) {
  if (character === 'operative') return operativeFrame(p, time);
  if (time - p.lastDamage < 0.18) return 3;
  if (character === 'patrick' && p.meleeTime > 0)
    return 12 + Math.min(3, Math.floor((0.34 - p.meleeTime) / 0.085));
  if (p.dashTime > 0) return 11;
  if (character === 'su' && p.jumpBurst > 0)
    return 12 + Math.min(3, Math.floor((0.38 - p.jumpBurst) / 0.095));
  if (p.jumps > 0 || Math.abs(p.vy) > 0.1)
    return p.vy > 3 ? 8 : p.vy < -3 ? 10 : 9;
  if (p.moving > 0.1) return 4 + (Math.floor(time * 11) % 4);
  if (p.aimPitch > 0.32) return 2;
  if (p.flash > 0) return 1;
  return 0;
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
  character: CharacterId;
  constructor(character: CharacterId = 'operative') {
    this.character = character;
    this.root.name = '2D operative';
    const canvasSize = character === 'operative' ? 384 : 512;
    this.root.center.set(
      (character === 'operative' ? 160 : 220) / canvasSize,
      (character === 'operative' ? 34 : 42) / canvasSize,
    );
    this.root.visible = false;
    this.readyPromise = this.load();
    // Also handle construction failures before GameScene can attach its loader.
    void this.readyPromise.catch(() => {});
  }
  async load() {
    const source = new Image();
    source.src = `/sprites/${this.character}-sheet-v1.png`;
    await source.decode();
    if (this.disposed) return;
    if (
      this.character === 'operative' &&
      (source.naturalWidth !== 1254 || source.naturalHeight !== 1254)
    )
      throw new Error('Unexpected operative sheet dimensions');
    const frames =
      this.character === 'operative'
        ? spriteFrames
        : this.character === 'patrick'
          ? [
              [15, 0, 290, 334, 149, 326],
              [325, 0, 305, 334, 451, 326],
              [660, 0, 255, 334, 765, 326],
              [980, 0, 270, 334, 1110, 326],
              [10, 343, 300, 278, 173, 610],
              [352, 343, 270, 278, 479, 610],
              [650, 343, 278, 278, 788, 610],
              [960, 343, 290, 278, 1103, 610],
              [18, 625, 280, 291, 162, 910],
              [365, 630, 245, 220, 475, 910],
              [640, 638, 295, 280, 786, 910],
              [937, 675, 316, 205, 1090, 910],
              [5, 880, 275, 350, 147, 1219],
              [272, 905, 357, 326, 451, 1219],
              [610, 960, 425, 270, 775, 1219],
              [975, 935, 278, 298, 1107, 1219],
            ]
          : Array.from({ length: 16 }, (_, i) => {
              const x = Math.round(((i % 4) * 1254) / 4),
                right = Math.round((((i % 4) + 1) * 1254) / 4);
              const y = [0, 330, 624, 931][Math.floor(i / 4)],
                bottom = [322, 620, 930, 1254][Math.floor(i / 4)];
              return [
                x,
                y,
                right - x,
                bottom - y,
                x + 157,
                [312, 609, 915, 1220][Math.floor(i / 4)],
              ] as const;
            });
    for (const [index, [x, y, w, h, anchorX, baseline]] of frames.entries()) {
      const crop = document.createElement('canvas');
      crop.width = w;
      crop.height = h;
      const ctx = crop.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Sprite canvas unavailable');
      const scale = source.naturalWidth / 1254;
      ctx.drawImage(
        source,
        x * scale,
        y * scale,
        w * scale,
        h * scale,
        0,
        0,
        w,
        h,
      );
      const pixels = ctx.getImageData(0, 0, w, h);
      clearSpriteBackground(pixels.data, w, h);
      ctx.putImageData(pixels, 0, 0);
      // These two poses cross the nominal row boundary in the source sheet.
      // Exclude the adjacent boot / raised muzzle without trimming either pose.
      if (this.character === 'operative') {
        if (index === 9) ctx.clearRect(510 - x, 885 - y, w, h);
        if (index === 13) ctx.clearRect(0, 0, 440 - x, 950 - y);
      }
      if (this.character === 'patrick') {
        if (index === 8) ctx.clearRect(80 - x, 883 - y, w, h);
        if (index === 12) ctx.clearRect(0, 0, 90 - x, 926 - y);
        if (index === 14) {
          ctx.clearRect(940 - x, 0, w, 1060 - y);
          ctx.clearRect(940 - x, 1113 - y, w, h);
        }
        if (index === 15) ctx.clearRect(0, 1070 - y, 1035 - x, 46);
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = this.character === 'operative' ? 384 : 512;
      const frame = canvas.getContext('2d');
      if (!frame) throw new Error('Sprite canvas unavailable');
      frame.drawImage(
        crop,
        (this.character === 'operative' ? 160 : 220) - (anchorX - x),
        (this.character === 'operative' ? 350 : 470) - (baseline - y),
      );
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
      menu || !p
        ? this.character === 'operative'
          ? Math.floor(time * 4) % 4
          : 0
        : rosterFrame(this.character, p, time);
    if (frame !== this.frame) {
      this.frame = frame;
      this.material.map = this.textures[frame];
      this.material.needsUpdate = true;
    }
    const facing = !menu && p && Math.cos(p.angle) < 0 ? -1 : 1;
    const size =
      (this.character === 'operative' ? 384 : 512) *
      (2.25 / (this.character === 'operative' ? 270 : 300)) *
      (menu ? 1.4 : 1);
    this.textures[frame].repeat.x = facing;
    this.textures[frame].offset.x = facing < 0 ? 1 : 0;
    const center = this.character === 'operative' ? 160 / 384 : 220 / 512;
    this.root.center.x = facing < 0 ? 1 - center : center;
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
