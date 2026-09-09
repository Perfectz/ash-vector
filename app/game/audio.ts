import { soundFiles, weaponSounds, type SoundFile } from './soundLibrary';

// Recorded Foley layered with the original procedural industrial score.
export class Soundscape {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  nextBeat = 0;
  beat = 0;
  musicOn = true;
  music: GainNode | null = null;
  compressor: DynamicsCompressorNode | null = null;
  buffers = new Map<SoundFile, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private disposed = false;
  private musicScheduling = false;
  private voices = new Set<AudioBufferSourceNode>();
  private lastEffect = new Map<string, number>();
  private variation = 0;
  private abort = new AbortController();
  async start() {
    if (this.disposed) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.3;
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.18;
      this.music = this.context.createGain();
      this.music.gain.value = 0.48;
      this.music.connect(this.master);
      this.master.connect(this.compressor);
      this.compressor.connect(this.context.destination);
    }
    await this.context.resume();
    this.nextBeat = this.context.currentTime + 0.1;
    // Never block play on downloads: procedural effects remain the fallback.
    if (!this.loading) this.loading = this.loadSamples();
  }
  private async loadSamples() {
    const ctx = this.context!;
    let index = 0;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (index < soundFiles.length && !this.disposed) {
          const file = soundFiles[index++];
          try {
            const response = await fetch(`/media/audio/kenney/${file}.mp3`, {
              signal: this.abort.signal,
            });
            if (!response.ok) continue;
            const buffer = await ctx.decodeAudioData(
              await response.arrayBuffer(),
            );
            if (!this.disposed) this.buffers.set(file, buffer);
          } catch {
            /* Missing assets or unsupported decoding use synthesized Foley. */
          }
        }
      }),
    );
  }
  private sample(
    file: SoundFile,
    volume: number,
    rate = 1,
    duration = 0.6,
    pan = 0,
  ) {
    const ctx = this.context,
      buffer = this.buffers.get(file);
    if (!ctx || !buffer || !this.master || this.disposed) return false;
    if (this.voices.size >= 24) return true;
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      stereo = ctx.createStereoPanner();
    const t = ctx.currentTime;
    source.buffer = buffer;
    source.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    const length = Math.min(
      duration,
      buffer.duration / source.playbackRate.value,
    );
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + Math.min(0.006, length / 4));
    gain.gain.setValueAtTime(volume, t + Math.max(0.007, length - 0.06));
    gain.gain.linearRampToValueAtTime(0, t + length);
    stereo.pan.value = Math.max(-0.65, Math.min(0.65, pan));
    source.connect(gain);
    gain.connect(stereo);
    stereo.connect(this.master);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
      stereo.disconnect();
    };
    source.start(t);
    source.stop(t + length + 0.01);
    return true;
  }
  private duckMusic() {
    if (!this.music || !this.context) return;
    const t = this.context.currentTime,
      gain = this.music.gain;
    gain.cancelScheduledValues(t);
    gain.setTargetAtTime(0.16, t, 0.015);
    gain.setTargetAtTime(0.48, t + 0.22, 0.18);
  }
  setMuted(value: boolean) {
    this.muted = value;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        value ? 0 : 0.3,
        this.context.currentTime,
        0.05,
      );
  }
  tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    slide = frequency,
    when?: number,
  ) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const t = when ?? ctx.currentTime;
    const osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(10, slide),
      t + duration,
    );
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.musicScheduling && this.music ? this.music : this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
  noise(duration: number, volume: number, frequency = 1500, when?: number) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const t = when ?? ctx.currentTime;
    const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * duration),
        ctx.sampleRate,
      ),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicScheduling && this.music ? this.music : this.master);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  effect(kind: string, weapon = 0, pan = 0) {
    if (!this.context || this.muted || this.disposed) return;
    const now = this.context.currentTime;
    const interval =
      kind === 'impact'
        ? 0.045
        : kind === 'explosion'
          ? 0.075
          : kind === 'shot' && weapon === 5
            ? 0.095
            : 0;
    if (now - (this.lastEffect.get(kind) ?? -Infinity) < interval) return;
    this.lastEffect.set(kind, now);
    const variant = this.variation++ % 3;
    if (kind === 'shot') {
      const voice = weaponSounds[weapon] ?? weaponSounds[0];
      const file =
        weapon === 0
          ? (`laserSmall_00${variant}` as SoundFile)
          : weapon === 1
            ? (`laserLarge_00${variant % 2}` as SoundFile)
            : voice.file;
      if (this.sample(file, voice.gain, voice.rate, voice.duration, pan)) {
        if (weapon === 1 || weapon === 3) this.tone(95, 0.16, 0.13, 'sine', 28);
        if (weapon === 2) this.tone(1500, 0.18, 0.05, 'sine', 260);
        return;
      }
    } else if (kind === 'impact') {
      if (
        this.sample(`impactMetal_00${variant}` as SoundFile, 0.22, 1, 0.3, pan)
      )
        return;
    } else if (kind === 'explosion' || kind === 'victory') {
      this.duckMusic();
      if (
        this.sample(
          variant % 2 ? 'explosionCrunch_001' : 'explosionCrunch_000',
          0.9,
          kind === 'victory' ? 0.7 : 1,
          1.5,
          pan,
        )
      ) {
        this.sample('lowFrequency_explosion_000', 0.7, 0.85, 1.1, pan * 0.3);
        return;
      }
    } else if (kind === 'slash') {
      if (this.sample('forceField_000', 0.7, 1.5, 0.28, pan)) {
        this.noise(0.16, 0.18, 5000);
        this.tone(760, 0.18, 0.13, 'sawtooth', 110);
        return;
      }
    } else if (kind === 'doubleJump') {
      if (this.sample('spaceEngineSmall_000', 0.7, 1.6, 0.42, pan)) {
        this.sample('forceField_001', 0.32, 1.45, 0.28, pan);
        this.tone(400, 0.22, 0.12, 'sine', 1400);
        return;
      }
    } else if (kind === 'dash' || kind === 'jump') {
      if (
        this.sample(
          'thrusterFire_000',
          kind === 'dash' ? 0.55 : 0.22,
          kind === 'dash' ? 1.2 : 1.8,
          kind === 'dash' ? 0.28 : 0.14,
          pan,
        )
      )
        return;
    } else if (kind === 'hurt') {
      if (this.sample('impactMetal_002', 0.7, 0.7, 0.4)) {
        this.tone(90, 0.2, 0.2, 'sawtooth', 35);
        return;
      }
    } else if (kind === 'pickup' || kind === 'sector') {
      this.sample('computerNoise_000', 0.3, 1.4, 0.35);
    } else if (kind === 'enemyShot') {
      if (this.sample('laserRetro_002', 0.18, 0.85, 0.2, pan)) return;
    }
    switch (kind) {
      case 'slash':
        this.noise(0.2, 0.35, 4800);
        this.tone(720, 0.19, 0.28, 'sawtooth', 85);
        break;
      case 'doubleJump':
        this.tone(330, 0.24, 0.2, 'sine', 1200);
        this.noise(0.18, 0.13, 3200);
        break;
      case 'shot':
        this.tone(
          weapon === 2 ? 650 : 180,
          weapon === 2 ? 0.25 : 0.09,
          0.25,
          'sawtooth',
          40,
        );
        this.noise(0.08, 0.18, 3000);
        break;
      case 'enemyShot':
        this.tone(130, 0.11, 0.07, 'triangle', 65);
        break;
      case 'impact':
        this.noise(0.04, 0.07, 2400);
        break;
      case 'explosion':
      case 'victory':
        this.noise(0.7, 0.7, 650);
        this.tone(70, 0.6, 0.8, 'sine', 18);
        break;
      case 'hurt':
        this.noise(0.18, 0.3, 550);
        this.tone(90, 0.25, 0.4, 'sawtooth', 35);
        break;
      case 'jump':
      case 'dash':
        this.noise(0.16, 0.15, 1400);
        this.tone(110, 0.16, 0.15, 'sine', 440);
        break;
      case 'pickup':
      case 'sector':
        this.tone(440, 0.15, 0.2, 'sine', 880);
        this.tone(660, 0.3, 0.15, 'sine', 1320);
        break;
    }
  }
  tick(active: boolean, boss: boolean, suspended = false) {
    const ctx = this.context;
    if (suspended) {
      for (const voice of this.voices) {
        try {
          voice.stop();
        } catch {
          /* Already ended. */
        }
      }
      this.voices.clear();
    }
    if (!ctx || !this.musicOn || this.muted) return;
    if (!active) {
      this.nextBeat = ctx.currentTime + 0.1;
      return;
    }
    if (this.nextBeat < ctx.currentTime - 0.4)
      this.nextBeat = ctx.currentTime + 0.02;
    this.musicScheduling = true;
    while (this.nextBeat < ctx.currentTime + 0.12) {
      const t = this.nextBeat,
        step = this.beat % 16;
      const root = [55, 55, 49, 41.2][Math.floor(this.beat / 32) % 4];
      if (step % 4 === 0) {
        this.tone(100, 0.21, 0.6, 'sine', 27, t);
        this.noise(0.025, 0.2, 2300, t);
      }
      if (step === 4 || step === 12) this.noise(0.15, 0.25, 2100, t);
      if (step % 2 === 0 || boss) this.noise(0.035, 0.06, 6500, t);
      if (step % 2 === 0)
        this.tone(
          root * (step % 8 === 6 ? 1.5 : 1),
          0.19,
          0.105,
          'sawtooth',
          root * 0.98,
          t,
        );
      if (boss && step % 4 === 2)
        this.tone(root * 4, 0.25, 0.04, 'triangle', root * 4, t);
      this.nextBeat += 60 / 112 / 4;
      this.beat++;
    }
    this.musicScheduling = false;
  }
  dispose() {
    this.disposed = true;
    this.abort.abort();
    this.buffers.clear();
    this.voices.clear();
    if (this.context) void this.context.close();
  }
}
