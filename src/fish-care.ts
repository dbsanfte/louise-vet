/** Storybook water care: one fixed dropper, a swimming fish, and patient timing. */
export class FishCare {
  readonly position = { x: -0.4, y: 0 };
  heading = Math.PI / 2;
  drops = 0;
  misses = 0;
  dropProgress: number | null = null;
  cooldown = 0;
  splash = 0;
  result: 'safe' | 'fish' | null = null;
  private from = { ...this.position };
  private to = { x: 0.4, y: 0 };
  private travel = 0;
  private duration = 2.8;
  private rest = 0;
  private readonly random: () => number;
  constructor(random: () => number = Math.random) {
    this.random = random;
  }
  get clear() {
    // Includes the fish's tail and a little room around the falling drop.
    return Math.hypot(this.position.x, this.position.y) > 0.29;
  }
  drop() {
    if (this.dropProgress !== null || this.cooldown > 0 || this.drops >= 5)
      return false;
    this.dropProgress = 0;
    this.cooldown = 0.85;
    this.result = null;
    return true;
  }
  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.splash = Math.max(0, this.splash - dt);
    if (this.rest > 0) this.rest = Math.max(0, this.rest - dt);
    else {
      this.travel = Math.min(this.duration, this.travel + dt);
      const t = this.travel / this.duration,
        ease = t * t * (3 - 2 * t);
      this.position.x = this.from.x + (this.to.x - this.from.x) * ease;
      this.position.y = this.from.y + (this.to.y - this.from.y) * ease;
      const angle = Math.atan2(
        this.to.x - this.from.x,
        this.to.y - this.from.y,
      );
      this.heading +=
        Math.atan2(
          Math.sin(angle - this.heading),
          Math.cos(angle - this.heading),
        ) * Math.min(1, dt * 6);
      if (this.travel >= this.duration) {
        this.from = { ...this.to };
        // Different chords cross the drop spot; curved turns and pauses signal direction.
        const next =
          Math.atan2(this.to.y, this.to.x) +
          Math.PI +
          (this.random() - 0.5) * 0.8;
        this.to = { x: Math.cos(next) * 0.4, y: Math.sin(next) * 0.4 };
        this.travel = 0;
        this.duration = 2.4 + this.random() * 1.2;
        this.rest = 0.3 + this.random() * 0.5;
      }
    }
    if (this.dropProgress !== null) {
      this.dropProgress = Math.min(1, this.dropProgress + dt / 0.35);
      if (this.dropProgress >= 1) {
        this.result = this.clear ? 'safe' : 'fish';
        if (this.clear) this.drops++;
        else this.misses++;
        this.dropProgress = null;
        this.splash = 0.65;
      }
    }
  }
}
