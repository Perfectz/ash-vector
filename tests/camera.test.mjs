import assert from 'node:assert/strict';
import * as T from 'three';
import { frameCombatCamera, aimOnCombatPlane } from '../app/game/camera.ts';
import {
  Simulation,
  neutralInput,
  enemyCenter,
} from '../app/game/simulation.ts';

for (const aspect of [16 / 9, 4 / 3, 9 / 16, 21 / 9]) {
  const camera = new T.PerspectiveCamera(48, aspect, 0.1, 400);
  frameCombatCamera(camera, 20, false);
  for (const point of [new T.Vector3(20, 1.4, 0), new T.Vector3(34, 5.1, 0)]) {
    const screen = point.clone().project(camera);
    assert(
      Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1,
      'Pilot and airborne threats must stay in frame',
    );
    const aim = aimOnCombatPlane(
      new T.Raycaster(),
      camera,
      screen.x,
      screen.y,
      new T.Vector3(),
    );
    assert(
      aim.distanceTo(point) < 1e-8,
      'Aiming at the visible drone must resolve to its actual position',
    );
  }
  frameCombatCamera(camera, 161, true);
  for (const x of [156, 173.8, 179]) {
    const screen = new T.Vector3(x, 3.5, 0).project(camera);
    assert(
      Math.abs(screen.x) < 1,
      'Boss and reachable arena must fit the camera',
    );
  }
  // Project a moving drone to the screen, aim there using the game's real ray
  // mapping, then fire through the real simulation until it is destroyed.
  const sim = new Simulation();
  sim.start();
  sim.enemies = sim.enemies.filter((e) => e.kind === 'drone').slice(0, 1);
  const drone = sim.enemies[0];
  drone.x = 23;
  frameCombatCamera(camera, sim.player.x, false);
  for (let frame = 0; frame < 90 && !sim.kills; frame++) {
    const c = enemyCenter(drone);
    const screen = new T.Vector3(c.x, c.y, c.z).project(camera);
    const hit = aimOnCombatPlane(
      new T.Raycaster(),
      camera,
      screen.x,
      screen.y,
      new T.Vector3(),
    );
    sim.step(1 / 60, {
      ...neutralInput(),
      aim: { x: hit.x, y: hit.y, z: hit.z },
      fire: true,
    });
  }
  assert.equal(sim.kills, 1);
  console.log(
    `PASS Camera framing and screen-to-drone fire at aspect ${aspect.toFixed(3)}`,
  );
}
