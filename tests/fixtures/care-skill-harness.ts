// Isolated UI fixture; never imported by the production game.
import { CareSkill, type CareTool } from '../../src/care-skill';
import { CareSkillView } from '../../src/care-skill-view';
let view: CareSkillView | null = null;
declare global {
  interface Window {
    openCare: (tool: CareTool) => void;
  }
}
window.openCare = (tool) => {
  view?.dispose();
  document.body.innerHTML = '<div id="fixture"></div><p id="outcome"></p>';
  const done = (text: string) => {
    view?.dispose();
    view = null;
    document.getElementById('outcome')!.textContent = text;
  };
  view = new CareSkillView(
    new CareSkill(tool),
    document.getElementById('fixture')!,
    {
      finish: () => done('Care completed'),
      cancel: () => done('Cancelled'),
      stop: () => done('Stopped with no reward'),
    },
  );
};
let last = performance.now();
function frame(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (!document.hidden) view?.update(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
