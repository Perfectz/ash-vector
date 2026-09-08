import assert from 'node:assert/strict';
import {
  Simulation,
  weapons,
  cover,
  neutralInput,
} from '../app/game/simulation.ts';
for (const character of ['patrick', 'su']) {
  for (let weapon = 0; weapon < weapons.length; weapon++) {
    const s = new Simulation(character);
    s.start();
    let deaths = 0;
    for (let frame = 0; frame < 60 * 240 && s.mode !== 'won'; frame++) {
      if (s.mode === 'dead') {
        deaths++;
        if (deaths > 5) break;
        s.retry();
      }
      s.player.weapon = weapon;
      const target = s.enemies
        .filter((e) => e.sector === s.sector)
        .sort(
          (a, b) => Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x),
        )[0];
      const range = [11, 7, 13, 9, 10, 3, 7, 6][weapon];
      const wantX = s.boss.active
        ? weapon === 5
          ? 173
          : weapon === 7
            ? 171
            : 166
        : target
          ? Math.max(s.player.x, target.x - range)
          : [58, 110, 159][s.sector];
      const blocked = cover.some((c) => Math.abs(s.player.x - c.x) < 3);
      s.step(1 / 60, {
        ...neutralInput(),
        mx: s.player.x < wantX ? 1 : 0,
        fire: true,
        autoAim: true,
        jump: frame % 58 === 0 || (blocked && frame % 20 === 0),
        dash: frame % 137 === 0,
      });
      s.events = [];
    }
    console.log(
      character,
      weapons[weapon].short,
      JSON.stringify({
        mode: s.mode,
        seconds: Math.round(s.time),
        kills: s.kills,
        sector: s.sector,
        hp: s.player.hp,
        boss: s.boss.hp,
        deaths,
      }),
    );
    assert.equal(
      s.mode,
      'won',
      `${character}/${weapons[weapon].short} must be viable through a full mission`,
    );
  }
}
