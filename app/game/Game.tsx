'use client';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowUpRight,
  Maximize,
  Volume2,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Crosshair,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { GameScene } from './scene';
import { Simulation, neutralInput, weapons, type Input } from './simulation';
import { Soundscape } from './audio';

type Snapshot = {
  mode: Simulation['mode'];
  hp: number;
  score: number;
  sector: number;
  remaining: number;
  weapon: number;
  grenades: number;
  dash: number;
  bossHp: number;
  bossPhase: number;
  bossActive: boolean;
  combo: number;
  notice: string;
  noticeTime: number;
  time: number;
  progress: number;
  kills: number;
  bestCombo: number;
  checkpoint: number;
  hurt: boolean;
};
function snapshot(s: Simulation): Snapshot {
  return {
    mode: s.mode,
    hp: s.player.hp,
    score: s.score,
    sector: s.sector,
    remaining: s.remaining(),
    weapon: s.player.weapon,
    grenades: s.player.grenades,
    dash: s.player.dashCooldown,
    bossHp: s.boss.hp,
    bossPhase: s.boss.phase,
    bossActive: s.boss.active,
    combo: s.combo,
    notice: s.notice,
    noticeTime: s.noticeTime,
    time: s.time,
    progress: (s.player.x / 190) * 100,
    kills: s.kills,
    bestCombo: s.bestCombo,
    checkpoint: s.checkpoint,
    hurt: s.time - s.player.lastDamage < 0.25,
  };
}
const sectors = [
  'SKYBRIDGE BREACH',
  'FOUNDRY APPROACH',
  'THE KILLING FLOOR',
  'SIEGE ENGINE',
];
function clock(t: number) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(t % 60)
    .toString()
    .padStart(2, '0')}`;
}

export default function Game() {
  const host = useRef<HTMLDivElement>(null),
    sim = useRef<Simulation | null>(null),
    scene = useRef<GameScene | null>(null),
    sound = useRef<Soundscape | null>(null);
  const control = useRef<Input>(neutralInput()),
    keys = useRef(new Set<string>()),
    pointer = useRef({ x: 0, y: 0, used: false, down: false }),
    touch = useRef({ x: 0, z: 0, fire: false });
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [muted, setMuted] = useState(false),
    [quality, setQuality] = useState('high');
  const [view, setView] = useState<Snapshot>(() => snapshot(new Simulation()));
  const [help, setHelp] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const introIsOpen = useRef(false);
  const cursor = useRef<HTMLDivElement>(null);
  const deploy = () => {
    const s = sim.current;
    if (!s) return;
    if (s.mode === 'menu') s.start();
    else if (s.mode === 'paused') s.togglePause();
    else if (s.mode === 'won') {
      sim.current = new Simulation();
      sim.current.start();
      scene.current!.menu = true;
    } else if (s.mode === 'dead') s.retry();
    keys.current.clear();
    control.current = neutralInput();
    touch.current = { x: 0, z: 0, fire: false };
    pointer.current.down = false;
    void sound.current?.start().catch(() => {});
    setView(snapshot(sim.current!));
  };
  const pause = () => {
    sim.current?.togglePause();
    if (sim.current) setView(snapshot(sim.current));
  };
  const toggleMute = () => {
    setMuted((v) => {
      sound.current?.setMuted(!v);
      return !v;
    });
  };
  useEffect(() => {
    if (!host.current) return;
    const s = new Simulation();
    sim.current = s;
    sound.current = new Soundscape();
    let frame = 0,
      last = 0,
      uiTime = 0,
      accumulator = 0;
    let running = true;
    let resize: () => void = () => {};
    try {
      const world = new GameScene(host.current);
      scene.current = world;
      resize = () => world.resize();
      window.addEventListener('resize', resize);
      let firstFrame = true;
      const loop = (timestamp: number) => {
        if (!running) return;
        const delta = Math.min((timestamp - last) / 1000 || 1 / 60, 0.08);
        last = timestamp;
        const current = sim.current!;
        const held = keys.current,
          input = control.current;
        input.mx =
          (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
          (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0) +
          touch.current.x;
        input.mz =
          (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0) -
          (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) +
          touch.current.z;
        input.fire =
          pointer.current.down || held.has('KeyJ') || touch.current.fire;
        input.autoAim = held.has('KeyJ') || touch.current.fire;
        if (pointer.current.used)
          input.aim = world.pointerAim(
            pointer.current.x,
            pointer.current.y,
            current,
          );
        const gp = navigator.getGamepads?.()[0];
        if (gp) {
          const dead = (x: number) => (Math.abs(x) > 0.18 ? x : 0);
          input.mx += dead(gp.axes[0] ?? 0);
          input.mz += dead(gp.axes[1] ?? 0);
          if (gp.buttons[7]?.pressed) {
            input.fire = true;
            input.autoAim = true;
          }
          if (Math.hypot(gp.axes[2] ?? 0, gp.axes[3] ?? 0) > 0.2) {
            input.aim = {
              x: current.player.x + (gp.axes[2] ?? 0) * 20,
              y: current.player.y + 1.4,
              z: current.player.z + (gp.axes[3] ?? 0) * 20,
            };
            input.autoAim = false;
          }
        }
        accumulator += delta;
        while (accumulator >= 1 / 60) {
          current.step(1 / 60, input);
          input.jump = false;
          input.dash = false;
          input.grenade = false;
          input.switchWeapon = false;
          accumulator -= 1 / 60;
        }
        for (const e of current.events) {
          world.burst(e);
          sound.current?.effect(e.kind, e.weapon);
        }
        current.events = [];
        sound.current?.tick(current.mode === 'playing', current.boss.active);
        world.render(timestamp / 1000, current, delta);
        if (firstFrame) {
          setReady(true);
          firstFrame = false;
        }
        if (timestamp - uiTime > 80) {
          setView(snapshot(current));
          uiTime = timestamp;
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    } catch (e) {
      queueMicrotask(() => {
        if (running)
          setError(e instanceof Error ? e.message : 'WebGL could not start.');
      });
    }
    const action = (code: string) => {
      if (code === 'Space') control.current.jump = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight')
        control.current.dash = true;
      if (code === 'KeyE') control.current.grenade = true;
      if (code === 'KeyQ') control.current.switchWeapon = true;
    };
    const keydown = (e: KeyboardEvent) => {
      if (introIsOpen.current) return;
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
          e.code,
        )
      )
        e.preventDefault();
      if (e.repeat) return;
      keys.current.add(e.code);
      const current = sim.current!;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        current.togglePause();
        keys.current.clear();
        pointer.current.down = false;
      }
      if (e.code === 'Enter' && current.mode !== 'playing') {
        if (current.mode === 'menu') current.start();
        else if (current.mode === 'paused') current.togglePause();
        else if (current.mode === 'dead') current.retry();
        else {
          sim.current = new Simulation();
          sim.current.start();
          scene.current!.menu = true;
        }
        void sound.current?.start().catch(() => {});
      }
      if (e.code === 'KeyR' && current.mode === 'dead') current.retry();
      if (e.code === 'KeyM')
        setMuted((v) => {
          sound.current?.setMuted(!v);
          return !v;
        });
      action(e.code);
      setView(snapshot(sim.current!));
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => {
      keys.current.clear();
      pointer.current.down = false;
      touch.current = { x: 0, z: 0, fire: false };
      control.current = neutralInput();
      if (sim.current?.mode === 'playing') sim.current.togglePause();
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      pointer.current.used = true;
      if (cursor.current)
        cursor.current.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
    };
    const up = () => {
      pointer.current.down = false;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || sim.current?.mode !== 'playing') return;
      if (e.button === 0) pointer.current.down = true;
      if (e.button === 2) control.current.grenade = true;
    };
    const context = (e: Event) => e.preventDefault();
    const node = host.current;
    node.addEventListener('pointerdown', down);
    node.addEventListener('contextmenu', context);
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    const visibility = () => {
      if (document.hidden) blur();
    };
    document.addEventListener('visibilitychange', visibility);
    // Gamepad buttons use rising edges, so jumps and grenades cannot retrigger every frame.
    let previousButtons: boolean[] = [];
    const poll = setInterval(() => {
      const gp = navigator.getGamepads?.()[0];
      if (!gp) {
        previousButtons = [];
        return;
      }
      for (const [i, code] of [
        [0, 'Space'],
        [1, 'ShiftLeft'],
        [2, 'KeyQ'],
        [4, 'KeyE'],
      ] as const) {
        if (gp.buttons[i]?.pressed && !previousButtons[i]) action(code);
      }
      if (gp.buttons[9]?.pressed && !previousButtons[9])
        sim.current?.togglePause();
      previousButtons = gp.buttons.map((b) => b.pressed);
    }, 30);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      clearInterval(poll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.removeEventListener('visibilitychange', visibility);
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('contextmenu', context);
      scene.current?.dispose();
      scene.current = null;
      sound.current?.dispose();
    };
  }, []);
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  const touchMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    touch.current.x = Math.max(
      -1,
      Math.min(1, (e.clientX - r.left - r.width / 2) / 35),
    );
    touch.current.z = Math.max(
      -1,
      Math.min(1, (e.clientY - r.top - r.height / 2) / 35),
    );
  };
  const touchAction = (key: 'jump' | 'dash' | 'grenade') => {
    control.current[key] = true;
  };
  const inMission = view.mode !== 'menu',
    playing = view.mode === 'playing';
  return (
    <main
      className={`game-shell ${inMission ? 'in-mission' : ''} ${playing ? 'is-playing' : ''}`}
    >
      <div
        className="world"
        ref={host}
        aria-label="3D industrial skybridge battlefield"
      />
      <div className="cinema-shade" />
      <div className={`damage-vignette ${view.hurt ? 'visible' : ''}`} />
      <header className="game-header">
        <button
          className="wordmark"
          onClick={() => {
            sim.current = new Simulation();
            if (scene.current) {
              scene.current.menu = true;
              scene.current.pilot.root.visible = true;
            }
            setView(snapshot(sim.current));
          }}
          aria-label="Ash Vector home"
        >
          <span className="brand-symbol">Λ</span> ASH VECTOR
          <span className="wordmark-suffix">{'//'}</span>
        </button>
        <div className="header-status">
          <i /> {inMission ? 'OPERATION BLACK RAIN' : 'ALL SYSTEMS ONLINE'}
        </div>
        <div className="utilities">
          <button
            aria-label={muted ? 'Enable sound' : 'Mute sound'}
            onClick={toggleMute}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="quality-button"
            aria-label={`Graphics quality ${quality}. Click to change.`}
            onClick={() => {
              const value = quality === 'high' ? 'performance' : 'high';
              setQuality(value);
              scene.current?.setQuality(value);
            }}
          >
            {quality === 'high' ? 'HQ' : 'LQ'}
          </button>
          <button aria-label="Fullscreen" onClick={fullscreen}>
            <Maximize size={18} />
          </button>
          {inMission && (
            <button
              aria-label={playing ? 'Pause game' : 'Resume game'}
              onClick={pause}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
          )}
        </div>
      </header>
      {!inMission && (
        <section className="title-screen">
          <div className="eyebrow">
            <span /> OPERATION 01 / BLACK RAIN
          </div>
          <h1>
            ASH
            <br />
            <span>VECTOR</span>
            <b>™</b>
          </h1>
          <p className="intro">
            One operative. A city under siege.
            <br />
            Bring the machine to its knees.
          </p>
          <button
            className="deploy"
            disabled={!ready || !!error}
            onClick={deploy}
          >
            <span>
              {error
                ? 'GRAPHICS UNAVAILABLE'
                : ready
                  ? 'DEPLOY OPERATIVE'
                  : 'INITIALIZING'}
            </span>
            <ArrowUpRight size={24} />
          </button>
          <button
            className="watch-intro"
            onClick={() => {
              introIsOpen.current = true;
              setIntroOpen(true);
            }}
          >
            <Play size={14} /> WATCH INTRO <span>00:20</span>
          </button>
          {error && (
            <p className="error">
              {error} Try a browser with hardware acceleration enabled.
            </p>
          )}
          <div className="mission-meta">
            <span>
              SECTOR <b>09</b>
            </span>
            <span>
              THREAT <b>EXTREME</b>
            </span>
            <span>
              OPERATOR <b>01</b>
            </span>
          </div>
        </section>
      )}
      {!inMission && (
        <div className="scene-caption">
          <span>THE CITADEL</span>
          <strong>35° 41′ N / 139° 41′ E</strong>
          <small>UPPER TRANSIT // ELEVATION 840M</small>
        </div>
      )}
      {inMission && (
        <>
          <section className="player-hud" aria-label="Operative status">
            <div className="operator-line">
              <Shield size={17} />
              <span>OPERATIVE / 01</span>
              <b>
                {Math.ceil(view.hp)}
                <small> / 100</small>
              </b>
            </div>
            <Progress
              value={view.hp}
              className={`health-bar ${view.hp < 30 ? 'critical' : ''}`}
              aria-label="Armor"
            />
            <div className="hud-subline">
              <span>VITAL SYSTEMS {view.hp > 30 ? 'STABLE' : 'CRITICAL'}</span>
              <span className="score">
                {view.score.toString().padStart(7, '0')}
              </span>
            </div>
          </section>
          <section className="objective-hud">
            <div className="objective-eyebrow">
              {clock(view.time)} <span>/</span> SECTOR 0{view.sector + 1}
            </div>
            <h2>{sectors[view.sector]}</h2>
            <p>
              {view.bossActive
                ? 'Destroy the MANTICORE siege engine'
                : view.remaining
                  ? `${view.remaining} hostiles remaining. Clear the lockdown.`
                  : 'Sector clear. Advance to the next gate.'}
              <ChevronRight size={15} />
            </p>
            <div className="route-line">
              <i style={{ width: `${view.progress}%` }} />
              <b style={{ left: `${Math.min(view.progress, 98)}%` }} />
              {[30, 58, 84].map((n) => (
                <span key={n} style={{ left: `${n}%` }} />
              ))}
            </div>
          </section>
          {view.bossActive && view.bossHp > 0 && (
            <section className="boss-hud">
              <div>
                <span>MANTICORE</span>
                <small>SIEGE ENGINE / PHASE 0{view.bossPhase}</small>
              </div>
              <Progress
                value={view.bossHp / 10}
                aria-label="Siege engine armor"
              />
            </section>
          )}
          {view.noticeTime > 0 && playing && (
            <div
              className={`mission-notice ${view.bossActive ? 'danger' : ''}`}
              key={view.notice}
            >
              <span>COMMAND LINK</span>
              <p>{view.notice}</p>
            </div>
          )}
          {view.combo > 1 && (
            <div className="combo">
              <b>
                {view.combo}
                <small>×</small>
              </b>
              <span>CHAIN</span>
            </div>
          )}
          <section className="loadout">
            <div className="weapon-slot">
              <Crosshair size={23} />
              <div>
                <small>0{view.weapon + 1} / ACTIVE WEAPON</small>
                <strong>{weapons[view.weapon].name}</strong>
              </div>
              <span className="infinite">∞</span>
            </div>
            <div className="weapon-options">
              {weapons.map((w, i) => (
                <button
                  key={w.short}
                  className={view.weapon === i ? 'selected' : ''}
                  onClick={() => {
                    if (sim.current) sim.current.player.weapon = i;
                  }}
                >
                  {i + 1} {w.short}
                </button>
              ))}
              <kbd>Q</kbd>
            </div>
          </section>
          <div className="ability-hud">
            <div className={`dash-meter ${view.dash <= 0 ? 'ready' : ''}`}>
              <Zap size={18} />
              <span>
                DASH{' '}
                <b>{view.dash <= 0 ? 'READY' : `${view.dash.toFixed(1)}s`}</b>
              </span>
              <kbd>SHIFT</kbd>
            </div>
            <div>
              <span className="grenade-icon">◆</span>
              <span>
                GRENADES{' '}
                <b>
                  {'▮'.repeat(view.grenades)}
                  <em>{view.grenades === 0 ? 'EMPTY' : ''}</em>
                </b>
              </span>
              <kbd>E</kbd>
            </div>
          </div>
          <div ref={cursor} className="crosshair" aria-hidden="true">
            <i />
            <b />
          </div>
        </>
      )}
      {view.mode === 'paused' && (
        <section className="state-overlay">
          <div className="state-panel">
            <div className="eyebrow">MISSION SUSPENDED</div>
            <h2>HOLD POSITION.</h2>
            <p>Take a breath. The city can wait.</p>
            <button className="deploy" onClick={deploy}>
              <span>RESUME OPERATION</span>
              <Play size={21} />
            </button>
            <div className="pause-controls">
              <p>
                <kbd>W A S D</kbd> Move in 3D <kbd>SPACE</kbd> Double jump
              </p>
              <p>
                <kbd>MOUSE</kbd> Aim + hold to fire <kbd>J</kbd> Auto-aim fire
              </p>
              <p>
                <kbd>SHIFT</kbd> Dash <kbd>E</kbd> Grenade <kbd>Q</kbd> Weapon
              </p>
              <p>
                <kbd>ESC</kbd> Pause / resume
              </p>
              <small>
                Controller: left stick move · right stick aim · RT fire
                <br />A jump · B dash · X weapon · LB grenade
              </small>
            </div>
          </div>
        </section>
      )}
      {(view.mode === 'dead' || view.mode === 'won') && (
        <section
          className={`state-overlay ${view.mode === 'won' ? 'victory' : ''}`}
        >
          <div className="state-panel">
            <div className="eyebrow">
              {view.mode === 'won'
                ? 'OPERATION BLACK RAIN // COMPLETE'
                : 'OPERATIVE SIGNAL LOST'}
            </div>
            <h2>{view.mode === 'won' ? 'MACHINE DOWN.' : 'SIGNAL LOST.'}</h2>
            <p>
              {view.mode === 'won'
                ? 'The skybridge is yours. The city has a fighting chance.'
                : `Checkpoint 0${view.checkpoint + 1} secured. Get back into the fight.`}
            </p>
            <div className="result-stats">
              <div>
                <small>SCORE</small>
                <b>{view.score.toLocaleString()}</b>
              </div>
              <div>
                <small>TIME</small>
                <b>{clock(view.time)}</b>
              </div>
              <div>
                <small>BEST CHAIN</small>
                <b>{view.bestCombo}×</b>
              </div>
            </div>
            <button className="deploy" onClick={deploy}>
              <span>
                {view.mode === 'won'
                  ? 'RUN IT AGAIN'
                  : 'REDEPLOY AT CHECKPOINT'}
              </span>
              <RotateCcw size={22} />
            </button>
          </div>
        </section>
      )}
      {playing && (
        <div className="touch-controls">
          <div
            className="touch-stick"
            aria-label="Touch movement joystick"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              touchMove(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) touchMove(e);
            }}
            onPointerUp={() => {
              touch.current.x = 0;
              touch.current.z = 0;
            }}
            onPointerCancel={() => {
              touch.current.x = 0;
              touch.current.z = 0;
            }}
          >
            <span>MOVE</span>
          </div>
          <div className="touch-actions">
            <button onPointerDown={() => touchAction('grenade')}>E</button>
            <button onPointerDown={() => touchAction('dash')}>DASH</button>
            <button onPointerDown={() => touchAction('jump')}>JUMP</button>
            <button
              className="touch-fire"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                touch.current.fire = true;
              }}
              onPointerUp={() => {
                touch.current.fire = false;
              }}
              onPointerCancel={() => {
                touch.current.fire = false;
              }}
            >
              FIRE
            </button>
          </div>
        </div>
      )}
      <footer className="game-footer">
        <div>
          <kbd>W A S D</kbd>
          <span>MOVE</span>
          <kbd>MOUSE</kbd>
          <span>AIM + FIRE</span>
          <kbd>SPACE</kbd>
          <span>JUMP ×2</span>
          <kbd>SHIFT</kbd>
          <span>DASH</span>
          <button className="help-button" onClick={() => setHelp(!help)}>
            CONTROLS {help ? '−' : '+'}
          </button>
        </div>
        <span className="build-label">TACTICAL ACTION / 3D</span>
      </footer>
      {help && (
        <aside className="help-sheet">
          <button aria-label="Close controls" onClick={() => setHelp(false)}>
            ×
          </button>
          <h3>FIELD MANUAL</h3>
          <p>
            <kbd>W A S D</kbd> Move across and along the bridge.
          </p>
          <p>
            <kbd>MOUSE</kbd> Aim. Hold left click to fire.
          </p>
          <p>
            <kbd>J</kbd> Hold to fire with automatic targeting.
          </p>
          <p>
            <kbd>SPACE</kbd> Jump. Press again for a double jump.
          </p>
          <p>
            <kbd>SHIFT</kbd> Dash through enemy fire.
          </p>
          <p>
            <kbd>E</kbd> Grenade. <kbd>Q</kbd> Cycle weapons.
          </p>
          <p>
            <kbd>ESC</kbd> Pause. <kbd>M</kbd> Mute.
          </p>
          <small>
            Clear every hostile to open the sector gate. Checkpoints restore
            armor and grenades. Armor slowly repairs after five seconds without
            damage.
          </small>
        </aside>
      )}
      <Dialog
        open={introOpen}
        onOpenChange={(open) => {
          introIsOpen.current = open;
          setIntroOpen(open);
        }}
      >
        <DialogContent className="intro-dialog">
          <DialogTitle>OPERATION BLACK RAIN</DialogTitle>
          <DialogDescription>
            ASH VECTOR — cinematic introduction
          </DialogDescription>
          {introOpen && (
            <video
              controls
              autoPlay
              playsInline
              preload="metadata"
              src="/media/ash-vector-intro.mp4"
              aria-label="ASH VECTOR cinematic introduction"
            >
              <track
                kind="captions"
                src="/media/intro.en.vtt"
                srcLang="en"
                label="English"
              />
            </video>
          )}
          <a href="/media/ash-vector-intro.mp4" download>
            Download intro video
          </a>
        </DialogContent>
      </Dialog>
    </main>
  );
}
