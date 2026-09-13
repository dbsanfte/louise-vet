/** One compact layout for phones and tablets, including rotation mid-visit. */
export const compactExamination = window.matchMedia('(max-width: 1200px)');

export function arrangeExamination() {
  const app = document.getElementById('app')!;
  const active = ['examine', 'diagnose', 'treat', 'place-vaccine'].includes(
    app.dataset.mode ?? '',
  );
  const compact = active && compactExamination.matches;
  app.dataset.compactExam = String(compact);
  const world = document.getElementById('world')!;
  const controls = document.getElementById('scene-controls')!;
  const camera = document.getElementById('exam-camera')!;
  (compact ? camera : world).append(controls);
  const guides = document.getElementById('exam-guides')!;
  const zones = document.getElementById('zones')!;
  for (const button of document.querySelectorAll('.body-spot')) {
    if (active) (compact ? guides : zones).append(button);
    else button.remove();
  }
  guides.hidden = !compact || !guides.childElementCount;
  const readout = document.querySelector('.examination-readout');
  if (readout)
    (compact ? document.getElementById('instrument-dock')! : world).append(
      readout,
    );
}

compactExamination.addEventListener('change', arrangeExamination);
