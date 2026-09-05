// Original, gently synthesised sound effects. No external recordings or tracking.
export class Audio {
  private context?: AudioContext;
  enabled = false;
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
