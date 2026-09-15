// Isolated UI fixture; never imported by the production game.
import { CareSkill, type CareTool } from '../../src/care-skill';
import { Mesh } from 'three';
import type { CareScene } from '../../src/care-scene';
import { visits } from '../../src/game';
import { CareSkillView } from '../../src/care-skill-view';
let view: CareSkillView | null = null;
declare global {
  interface Window {
    openCare: (tool: CareTool) => void;
    normalCareGraphics: (enabled: boolean) => void;
    careGeometry: () => { count: number; depth: number; frames: number };
  }
}
window.normalCareGraphics = (enabled) => {
  const scene = (view as unknown as { scene: CareScene }).scene;
  (scene as unknown as { software: boolean }).software = !enabled;
  scene.renderer.setPixelRatio(
    enabled ? Math.min(devicePixelRatio, 1.75) : 0.5,
  );
};
window.careGeometry = () => {
  const scene = (view as unknown as { scene?: CareScene })?.scene;
  const bandage = scene?.scene.getObjectByName('BandageWrappedAroundPaw');
  if (bandage instanceof Mesh) {
    bandage.geometry.computeBoundingBox();
    return {
      count: bandage.geometry.drawRange.count,
      depth:
        bandage.geometry.boundingBox!.max.z -
        bandage.geometry.boundingBox!.min.z,
      frames: scene!.renderer.info.render.frame,
    };
  }
  return { count: 0, depth: 0, frames: scene?.renderer.info.render.frame ?? 0 };
};
window.openCare = (tool) => {
  view?.dispose();
  document.body.innerHTML = '<div id="fixture"></div><p id="outcome"></p>';
  const done = (text: string) => {
    view?.dispose();
    view = null;
    document.getElementById('outcome')!.textContent = text;
  };
  view = new CareSkillView(
    new CareSkill(tool, false, visits.find((v) => v.treatment === tool)!.zone),
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
