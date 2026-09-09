/** Local poses shared by activity movement, animals and moving toys. */
export function enrichmentPose(kind: string, elapsed: number, species: string) {
  const t = Math.min(1, Math.max(0, elapsed / 12));
  if (kind === 'aviary') {
    const a = t * Math.PI * 4;
    return {
      x: Math.sin(a) * 0.65,
      z: Math.cos(a) * 0.65,
      y: Math.sin(Math.PI * t) * 1.55,
      facing: Math.PI / 2 - a,
      motion: 'Fly' as const,
    };
  }
  if (kind === 'play-tree') {
    // Climb, linger on the top landing, then retrace the spiral to ground level.
    const climb = t < 0.4 ? t / 0.4 : t > 0.6 ? (1 - t) / 0.4 : 1;
    const a = climb * Math.PI * 2;
    return {
      x: Math.sin(a) * 0.65,
      z: Math.cos(a) * 0.65,
      y: climb * 1.55,
      facing: Math.PI / 2 - a + (t > 0.6 ? Math.PI : 0),
      motion:
        t >= 0.4 && t <= 0.6
          ? ('Idle' as const)
          : species === 'bird'
            ? ('Fly' as const)
            : ('Walk' as const),
    };
  }
  if (kind === 'bubbles') {
    const a = (elapsed * Math.PI * 2) / 9;
    return {
      x: Math.sin(a) * 0.62,
      z: 0.1 + Math.cos(a) * 0.5,
      y: Math.max(0, Math.sin(elapsed * 3)) * 0.12,
      facing: Math.PI / 2 - a,
      motion: 'Play' as const,
    };
  }
  if (kind === 'cat-nook')
    return {
      x: 0,
      z: 0.15,
      y: 0.14,
      facing: Math.PI * 0.6,
      motion: 'Sit' as const,
    };
  if (kind === 'bird-chimes') {
    const fly = t < 0.3 || t > 0.7;
    const f = t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1;
    return {
      x: Math.sin(f * Math.PI) * 0.6,
      z: 0.4,
      y: f * 1.4,
      facing: Math.PI / 2,
      motion: fly ? ('Fly' as const) : ('Play' as const),
    };
  }
  const playing = kind === 'toy-box' || kind === 'yarn';
  return {
    x: playing ? Math.sin(elapsed * 1.7) * 0.48 : 0,
    z: 0.55,
    y:
      playing && kind === 'toy-box'
        ? Math.max(0, Math.sin(elapsed * 3.4)) * 0.1
        : 0,
    facing: playing
      ? Math.cos(elapsed * 1.7) > 0
        ? Math.PI / 2
        : -Math.PI / 2
      : Math.PI,
    motion:
      playing || kind === 'treat-dispenser'
        ? ('Play' as const)
        : ('Idle' as const),
  };
}
export const isEnrichment = (kind: string) =>
  [
    'treat-dispenser',
    'water-dispenser',
    'toy-box',
    'yarn',
    'aviary',
    'play-tree',
    'bubbles',
    'cat-nook',
    'bird-chimes',
  ].includes(kind);
export const finishAtGround = (kind: string) =>
  ['coaster', 'ferris', 'aviary', 'play-tree', 'bird-chimes'].includes(kind);
