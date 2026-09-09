// Original, gently synthesised sound effects. No external recordings or tracking.
export class Audio {
  private context?: AudioContext;
  enabled = false;
  private lastHeartbeat = -1;
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
    if (!this.enabled || !bpm) {
      this.lastHeartbeat = -1;
      return;
    }
    const beat = Math.floor((now * bpm) / 60000 - 0.4);
    if (beat === this.lastHeartbeat) return;
    this.lastHeartbeat = beat;
    this.context ??= new AudioContext();
    if (this.context.state !== 'running') void this.context.resume();
    const ctx = this.context;
    for (const [offset, hz, level] of [
      [0, 64, 0.16],
      [0.115, 83, 0.1],
    ]) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(hz, start);
      oscillator.frequency.exponentialRampToValueAtTime(35, start + 0.1);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    }
  }
  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ??= new AudioContext();
      void this.context.resume();
      this.play('hello');
    }
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
