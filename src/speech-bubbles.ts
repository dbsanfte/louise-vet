import type { ClinicInfo } from './clinic-identity.ts';
export type BubbleCandidate<T> = {
  target: T;
  key: string;
  info: ClinicInfo;
  priority: number;
};
export type Bubble<T> = BubbleCandidate<T> & {
  source: 'inspect' | 'reaction';
  expires: number;
};
/** One bubble across the whole scene. Pointer movement never extends its life. */
export class BubbleDirector<T> {
  current?: Bubble<T>;
  private seen = new Map<T, string>();
  private spoken = new Map<T, number>();
  private quietUntil = 0;
  private variants = new Map<T, Map<string, number>>();
  private vary(target: T, info: ClinicInfo) {
    if (!info.messages?.length || !info.feeling) return info;
    let counts = this.variants.get(target);
    if (!counts) this.variants.set(target, (counts = new Map()));
    const n = counts.get(info.feeling) ?? 0;
    counts.set(info.feeling, n + 1);
    return { ...info, feeling: info.messages[n % info.messages.length] };
  }
  inspect(target: T, info: ClinicInfo, now: number) {
    this.current = {
      target,
      info: this.vary(target, info),
      key: JSON.stringify(info),
      priority: 10,
      source: 'inspect',
      expires: now + 5000,
    };
  }
  refresh(info: ClinicInfo) {
    const bubble = this.current;
    if (bubble?.source !== 'inspect') return;
    const key = JSON.stringify(info);
    if (bubble.key === key) return;
    bubble.key = key;
    bubble.info = this.vary(bubble.target, info);
  }
  clear(now: number) {
    this.current = undefined;
    this.quietUntil = now + 2000;
  }
  update(now: number, candidates: BubbleCandidate<T>[]) {
    if (this.current && now >= this.current.expires) this.clear(now);
    if (this.current?.source === 'inspect') return;
    if (
      this.current &&
      !candidates.some(
        (c) => c.target === this.current!.target && c.key === this.current!.key,
      )
    )
      this.clear(now);
    if (this.current || now < this.quietUntil) return;
    const next = candidates
      .filter((c) => this.seen.get(c.target) !== c.key)
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          (this.spoken.get(a.target) ?? -1) - (this.spoken.get(b.target) ?? -1),
      )[0];
    if (!next) return;
    this.seen.set(next.target, next.key);
    this.spoken.set(next.target, now);
    this.current = {
      ...next,
      info: this.vary(next.target, next.info),
      source: 'reaction',
      expires: now + 5000,
    };
  }
}
