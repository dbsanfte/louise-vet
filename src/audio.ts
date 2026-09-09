import { HEARTBEAT_PEAK, heartbeatPhase } from './clinical';

// Original, gently synthesised sound effects. No external recordings or tracking.
export class Audio {
  private context?: AudioContext;
  enabled = false;
  private heartSource?: AudioBufferSourceNode;
  private heartBpm?: number;
  private lastSiren = -1;
  siren(now: number, active: boolean) {
    if (!this.enabled || !active) {
      this.lastSiren = -1;
      return;
    }
    const beat = Math.floor(now / 700);
    if (beat === this.lastSiren) return;
    this.lastSiren = beat;
    this.context ??= new AudioContext();
    if (this.context.state !== 'running') void this.context.resume();
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain(),
      start = this.context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(beat % 2 ? 620 : 880, start);
    oscillator.frequency.linearRampToValueAtTime(
      beat % 2 ? 880 : 620,
      start + 0.6,
    );
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.035, start + 0.04);
    gain.gain.linearRampToValueAtTime(0, start + 0.66);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.7);
  }
  heartbeat(now: number, bpm: number | null) {
    if (
      !this.enabled ||
      !bpm ||
      (typeof document !== 'undefined' && document.hidden)
    ) {
      this.heartSource?.stop();
      this.heartSource?.disconnect();
      this.heartSource = undefined;
      this.heartBpm = undefined;
      return;
    }
    this.context ??= new AudioContext();
    if (this.context.state !== 'running') void this.context.resume();
    if (this.heartBpm === bpm) return;
    this.heartbeat(now, null);
    const ctx = this.context;
    const period = 60 / bpm;
    const buffer = ctx.createBuffer(
      1,
      Math.round(ctx.sampleRate * period),
      ctx.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    const duration = Math.min(0.13, period * 0.26);
    const pulse = (time: number, hz: number, level: number) => {
      if (time < 0 || time >= duration) return 0;
      const fraction = time / duration;
      const envelope = Math.sin(Math.PI * fraction) ** 2 * (1 - fraction);
      return (
        level *
        envelope *
        Math.sin(
          2 *
            Math.PI *
            (hz * time + ((35 - hz) * time * time) / (2 * duration)),
        )
      );
    };
    for (let i = 0; i < samples.length; i++) {
      const time = ((i / samples.length - HEARTBEAT_PEAK + 1) % 1) * period;
      samples[i] = pulse(time, 64, 0.16) + pulse(time - period * 0.28, 83, 0.1);
    }
    // The audio clock loops one complete lub-dub per cardiac cycle, including
    // between slow WebGL frames. It never queues a burst of missed beats.
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = buffer.duration / period;
    source.connect(ctx.destination);
    source.start(ctx.currentTime, heartbeatPhase(now, bpm) * buffer.duration);
    this.heartSource = source;
    this.heartBpm = bpm;
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.play('hello');
    } else this.heartbeat(0, null);
    return this.enabled;
  }
  play(kind: 'hello' | 'success' | 'tap') {
    if (!this.enabled) return;
    this.context ??= new AudioContext();
    if (this.context.state !== 'running') void this.context.resume();
    const notes =
      kind === 'success'
        ? [523.25, 659.25, 783.99]
        : kind === 'hello'
          ? [659.25, 523.25]
          : [440];
    notes.forEach((hz, i) => {
      const ctx = this.context!;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.13;
      oscillator.type = 'sine';
      oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.045, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.36);
    });
  }
}
