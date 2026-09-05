import type { Visit, Species } from './game';

// Authored game readings: the baseline varies with the animal's species.
const baseline: Record<Species, number> = {
  dog: 88,
  cat: 144,
  rabbit: 180,
  hamster: 320,
  gerbil: 300,
  goldfish: 120,
};
export function clinicalProfile(visit: Visit) {
  const c = visit.clinical ?? {};
  return {
    skin: c.skin ?? 'healthy',
    fracture: c.fracture ?? false,
    ear: c.ear ?? 'healthy',
    teeth: c.teeth ?? 'healthy',
    heart: c.heart ?? 'normal',
    bpm: Math.round(baseline[visit.species] * (c.heart === 'fast' ? 1.45 : 1)),
    water: c.water ?? 'clear',
    dentalFamily: ['dog', 'cat'].includes(visit.species)
      ? 'carnivore'
      : 'rodent',
  };
}
export function ecg(phase: number) {
  const pulse = (center: number, width: number, height: number) =>
    height * Math.exp(-(((phase - center) / width) ** 2));
  return (
    pulse(0.16, 0.045, 0.12) +
    pulse(0.36, 0.014, -0.16) +
    pulse(0.4, 0.012, 1) +
    pulse(0.44, 0.018, -0.25) +
    pulse(0.68, 0.075, 0.27)
  );
}
