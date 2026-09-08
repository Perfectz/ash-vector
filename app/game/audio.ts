// An original, procedural industrial score and synthesized weapon Foley.
export class Soundscape {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  nextBeat = 0;
  beat = 0;
  musicOn = true;
  async start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.nextBeat = this.context.currentTime + 0.1;
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
    gain.connect(this.master);
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
    gain.connect(this.master);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  effect(kind: string, weapon = 0) {
    if (!this.context || this.muted) return;
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
  tick(active: boolean, boss: boolean) {
    const ctx = this.context;
    if (!ctx || !this.musicOn || this.muted) return;
    if (!active) {
      this.nextBeat = ctx.currentTime + 0.1;
      return;
    }
    if (this.nextBeat < ctx.currentTime - 0.4)
      this.nextBeat = ctx.currentTime + 0.02;
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
  }
  dispose() {
    if (this.context) void this.context.close();
  }
}
