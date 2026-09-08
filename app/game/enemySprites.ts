import * as T from 'three';
import type { Enemy } from './simulation';

// One shared alpha atlas; each enemy keeps an independent UV transform.
export class EnemySprites {
  atlas: T.Texture;
  ready = false;
  disposed = false;
  materials = new Set<T.SpriteMaterial>();
  constructor() {
    this.atlas = new T.TextureLoader().load(
      '/sprites/enemies-v1.png',
      (texture) => {
        if (this.disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = T.SRGBColorSpace;
        this.ready = true;
      },
      undefined,
      () => {
        this.ready = false;
      },
    );
    this.atlas.colorSpace = T.SRGBColorSpace;
  }
  make() {
    const texture = this.atlas.clone();
    texture.colorSpace = T.SRGBColorSpace;
    const material = new T.SpriteMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      toneMapped: false,
    });
    this.materials.add(material);
    const sprite = new T.Sprite(material);
    sprite.center.set(0.5, 0.045);
    return sprite;
  }
  update(sprite: T.Sprite, enemy: Enemy, time: number) {
    const mat = sprite.material,
      texture = mat.map!;
    if (!sprite.userData.atlasReady && this.ready) {
      texture.image = this.atlas.image;
      texture.needsUpdate = true;
      sprite.userData.atlasReady = true;
    }
    const frame =
      enemy.kind === 'creep'
        ? enemy.active
          ? 1 + (Math.floor(time * 8) % 3)
          : 0
        : enemy.guard
          ? Math.floor(time * 3) % 2
          : enemy.cooldown > 0.2
            ? 2
            : 3;
    const left = Math.cos(enemy.angle) < 0;
    texture.repeat.set(left ? 0.25 : -0.25, 0.5);
    texture.offset.set(
      (frame + (left ? 0 : 1)) / 4,
      enemy.kind === 'creep' ? 0.5 : 0,
    );
    const scale = enemy.kind === 'creep' ? 2.15 : 2.75;
    sprite.scale.set(scale, scale, 1);
    mat.color.setHex(enemy.flash > 0 ? 0xffad72 : 0xffffff);
    sprite.visible = this.ready;
  }
  remove(sprite: T.Sprite) {
    sprite.material.map?.dispose();
    this.materials.delete(sprite.material);
    sprite.material.dispose();
  }
  dispose() {
    this.disposed = true;
    for (const material of this.materials) {
      material.map?.dispose();
      material.dispose();
    }
    this.materials.clear();
    this.atlas.dispose();
  }
}
