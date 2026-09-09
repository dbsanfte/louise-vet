import type { Visit, Species } from './game';

// Representative awake-patient readings, not diagnostic cutoffs. References and
// the limits of the fever examples live in game-design.md#heartbeat-physiology.
// A fever has its own plausible rate; do not multiply every species by 1.45.
const heartRates: Record<
  Exclude<Species, 'goldfish'>,
  {
    normal: number;
    worried: number;
    fever: number;
  }
> = {
  dog: { normal: 100, worried: 130, fever: 150 },
  cat: { normal: 180, worried: 210, fever: 230 },
  rabbit: { normal: 240, worried: 280, fever: 300 },
  hamster: { normal: 450, worried: 500, fever: 540 },
  gerbil: { normal: 360, worried: 410, fever: 440 },
  bird: { normal: 400, worried: 460, fever: 500 },
};
function ratesFor(visit: Visit) {
  // Fish have water/fin checks, not a chestpiece ECG or mammalian fever model.
  if (visit.species === 'goldfish') return null;
  if (visit.species === 'dog') {
    if (/terrier/i.test(visit.breed))
      return { normal: 110, worried: 140, fever: 160 };
    if (/retriever/i.test(visit.breed))
      return { normal: 90, worried: 120, fever: 140 };
  }
  if (visit.species === 'bird') {
    if (/cockatiel/i.test(visit.breed))
      return { normal: 300, worried: 350, fever: 380 };
    if (/canary/i.test(visit.breed))
      return { normal: 600, worried: 680, fever: 720 };
  }
  return heartRates[visit.species];
}
export function clinicalProfile(visit: Visit) {
  const c = visit.clinical ?? {};
  const rates = ratesFor(visit);
  const fast = Boolean(rates && (c.fever || c.heart === 'fast'));
  return {
    skin: c.skin ?? 'healthy',
    fracture: c.fracture ?? false,
    ear: c.ear ?? 'healthy',
    teeth: c.teeth ?? 'healthy',
    heart: fast ? 'fast' : 'normal',
    bpm: rates
      ? rates[c.fever ? 'fever' : c.heart === 'fast' ? 'worried' : 'normal']
      : null,
    water: c.water ?? 'clear',
    temperature: c.fever ? 'Fever' : 'Comfortable',
    dentalFamily: ['dog', 'cat'].includes(visit.species)
      ? 'carnivore'
      : 'rodent',
  };
}
export const HEARTBEAT_PEAK = 0.4;
export const ECG_WINDOW_MS = 2500;
export function heartbeatPhase(now: number, bpm: number) {
  return ((((now * bpm) / 60000) % 1) + 1) % 1;
}
export function ecg(phase: number) {
  const pulse = (center: number, width: number, height: number) =>
    height * Math.exp(-(((phase - center) / width) ** 2));
  return (
    pulse(0.16, 0.045, 0.12) +
    pulse(0.36, 0.014, -0.16) +
    pulse(HEARTBEAT_PEAK, 0.012, 1) +
    pulse(0.44, 0.018, -0.25) +
    pulse(0.68, 0.075, 0.27)
  );
}
