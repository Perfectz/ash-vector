import * as T from 'three';
export const combatWidth = (aspect: number, boss = false, portrait = false) =>
  Math.max(13.5 * aspect, boss || (aspect >= 1 && !portrait) ? 27 : 17.5);

// Kept separate from WebGL so framing and screen-to-world aiming can be verified
// against the same camera used in the game, without a browser or GPU.
export function frameCombatCamera(
  camera: T.PerspectiveCamera,
  trackedX: number,
  boss: boolean,
  portrait = false,
) {
  const width = combatWidth(camera.aspect, boss, portrait);
  const height = width / camera.aspect;
  const focusX = boss ? 169 : trackedX + Math.min(5, width * 0.18);
  camera.position.set(
    focusX,
    4.6,
    height / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))),
  );
  camera.lookAt(focusX, 4.6, 0);
  camera.updateMatrixWorld();
}

const combatPlane = new T.Plane(new T.Vector3(0, 0, 1), 0);
export function aimOnCombatPlane(
  ray: T.Raycaster,
  camera: T.Camera,
  x: number,
  y: number,
  target: T.Vector3,
) {
  ray.setFromCamera(new T.Vector2(x, y), camera);
  return ray.ray.intersectPlane(combatPlane, target);
}
