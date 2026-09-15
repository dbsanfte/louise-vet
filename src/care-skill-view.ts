import { CareSkill } from './care-skill';
import { CareScene, loadCareModels, type CareModels } from './care-scene';
import { toolInfo, visits } from './game';
import { icon } from './icons';
import type { TracePoint } from './bandage-pattern';
/** The same contact controls serve the rendered tool, touch and keyboard. */
export class CareSkillView {
  readonly dialog = document.createElement('dialog');
  private scene?: CareScene;
  private disposed = false;
  private pointer: number | null = null;
  private offset: TracePoint = { x: 0, y: 0 };
  private lastMessage = '';
  constructor(
    readonly skill: CareSkill,
    mount: HTMLElement,
    callbacks: { finish: () => void; cancel: () => void; stop: () => void },
    models?: CareModels,
  ) {
    const kind = skill.spec.kind;
    this.dialog.className = 'skill-dialog';
    this.dialog.dataset.skill = kind;
    this.dialog.dataset.tool = skill.tool;
    this.dialog.dataset.ready = 'false';
    this.dialog.setAttribute('aria-labelledby', 'skill-title');
    this.dialog.setAttribute('aria-describedby', 'skill-instructions');
    const slider =
      kind === 'pressure' || kind === 'pour'
        ? `<label for="skill-position">${kind === 'pressure' ? 'Plunger pressure' : 'Bottle tilt'} <span class="pressure-guide">${kind === 'pressure' ? 'Gentle: 32–62%' : 'Slow pour: 25–60%'}</span></label><input id="skill-position" type="range" min="0" max="100" step="2" value="0" aria-label="${kind === 'pressure' ? 'Plunger pressure' : 'Bottle tilt'}"><span class="skill-input-value">0%</span>`
        : '';
    const action = ['aim', 'pull', 'pressure'].includes(kind)
      ? `<button class="primary" data-skill-action>${skill.spec.action}</button>`
      : '';
    const guide =
      kind === 'wrap'
        ? '<svg class="care-wrap-guide" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path class="care-wrap-path"/></svg>' +
          Array.from(
            { length: 7 },
            (_, i) =>
              `<span class="care-wrap-marker" data-wrap-marker="${i}" aria-hidden="true">${i + 1}</span>`,
          ).join('')
        : kind === 'pull'
          ? '<svg class="care-wrap-guide" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true"><path class="care-wrap-path" d="M.35,.65 L.7,.27"/></svg>' +
            [1, 2, 3]
              .map(
                (i) =>
                  `<span class="care-wrap-marker" style="left:${(0.35 + (i * 0.35) / 3) * 100}%;top:${(0.65 - (i * 0.38) / 3) * 100}%" aria-hidden="true">${i}</span>`,
              )
              .join('')
          : '';
    this.dialog.innerHTML = `<header class="skill-header"><span class="mini-badge">${icon(toolInfo[skill.tool].icon)}</span><div><small>${toolInfo[skill.tool].name}</small><h2 id="skill-title">${skill.spec.title}</h2></div><button class="icon-button" data-skill-cancel aria-label="Cancel care activity">${icon('close')}</button></header><div class="care-viewport"><div class="skill-canvas" tabindex="0" role="group" aria-label="${kind === 'wrap' ? 'Bandage wrapping around the 3D paw' : 'Apply ' + toolInfo[skill.tool].name + ' to the patient'}"><span class="care-loading">Loading your patient…</span>${guide}<span class="care-target" aria-hidden="true"></span><span class="care-cursor" aria-hidden="true">+</span>${Array.from({ length: 6 }, (_, i) => `<span class="care-mark" data-care-mark="${i}" aria-hidden="true"></span>`).join('')}</div><p class="skill-step"></p></div><div class="care-instructions"><p id="skill-instructions">${skill.spec.hint}</p><p class="skill-keyhint">${kind === 'wrap' ? 'Arrow keys move the roll along the coils. Stop to pause.' : 'Arrow keys aim. Hold Space to apply. Release to pause.'}</p><div class="skill-controls">${slider}${action}<button class="primary" data-skill-start disabled>Start when ready</button><button class="primary" data-skill-retry hidden>Try gently again</button></div><div class="care-meters"><label>Care progress<div class="skill-progress" role="meter" aria-label="Care progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></label><label class="care-comfort" ${kind === 'wrap' || kind === 'comb' || kind === 'aim' ? 'hidden' : ''}>Discomfort <span class="care-comfort-label">Comfortable</span><div class="skill-pain" role="meter" aria-label="Discomfort" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div></label></div><p class="skill-feedback" role="status"></p></div><footer><button class="secondary" data-skill-stop>← Stop visit</button><button class="primary" data-skill-finish disabled>Finish care</button></footer>`;
    mount.append(this.dialog);
    const bind = (selector: string, fn: () => void) =>
      this.dialog.querySelector(selector)?.addEventListener('click', fn);
    bind('[data-skill-cancel]', callbacks.cancel);
    bind('[data-skill-stop]', callbacks.stop);
    bind('[data-skill-finish]', () => {
      if (skill.complete) callbacks.finish();
    });
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      callbacks.cancel();
    });
    const board = this.dialog.querySelector<HTMLElement>('.skill-canvas')!;
    bind('[data-skill-start]', () => {
      if (!this.scene) return;
      skill.start();
      this.refresh();
      board.focus({ preventScroll: true });
    });
    bind('[data-skill-retry]', () => {
      skill.restart();
      this.refresh();
      board.focus({ preventScroll: true });
    });
    bind('[data-skill-action]', () => {
      skill.act();
      this.refresh();
    });
    const point = (e: PointerEvent) => {
      const r = board.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) / r.width,
        y: (e.clientY - r.top) / r.height,
      };
    };
    board.addEventListener('pointerdown', (e) => {
      if (
        !e.isPrimary ||
        e.button !== 0 ||
        this.pointer !== null ||
        !this.scene ||
        !skill.started ||
        skill.complete ||
        skill.startled
      )
        return;
      e.preventDefault();
      const p = point(e);
      if (kind === 'wrap') {
        if (!skill.beginWrap(p)) {
          this.refresh();
          return;
        }
        this.offset = {
          x: p.x - skill.wrapPosition.x,
          y: p.y - skill.wrapPosition.y,
        };
      } else skill.press(p, e.pressure);
      this.pointer = e.pointerId;
      board.setPointerCapture(e.pointerId);
      board.focus({ preventScroll: true });
      this.refresh();
    });
    board.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointer) return;
      const p = point(e);
      if (kind === 'wrap')
        skill.traceWrap({ x: p.x - this.offset.x, y: p.y - this.offset.y });
      else skill.move(p, e.pressure);
      this.refresh();
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      board.addEventListener(event, (e) => {
        if ((e as PointerEvent).pointerId === this.pointer) this.pause();
      });
    board.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const d: Record<string, TracePoint> = {
        ArrowLeft: { x: -0.015, y: 0 },
        ArrowRight: { x: 0.015, y: 0 },
        ArrowUp: { x: 0, y: -0.015 },
        ArrowDown: { x: 0, y: 0.015 },
      };
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) skill.press(skill.position);
      } else if (d[e.key]) {
        e.preventDefault();
        if (kind === 'wrap') {
          if (!skill.wrapping) skill.beginWrap(skill.wrapPosition);
          skill.traceWrap({
            x: skill.wrapPosition.x + d[e.key].x,
            y: skill.wrapPosition.y + d[e.key].y,
          });
        } else
          skill.move({
            x: skill.position.x + d[e.key].x,
            y: skill.position.y + d[e.key].y,
          });
      }
      this.refresh();
    });
    board.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.pause();
      }
    });
    board.addEventListener('blur', () => this.pause());
    const input =
      this.dialog.querySelector<HTMLInputElement>('#skill-position');
    if (input) {
      input.addEventListener('input', () => {
        skill.input(Number(input.value) / 100);
        this.refresh();
      });
      let drag: number | null = null;
      const move = (e: PointerEvent) => {
        if (e.pointerId !== drag) return;
        const b = input.getBoundingClientRect();
        skill.input((e.clientX - b.left - 16) / Math.max(1, b.width - 32));
        this.refresh();
      };
      input.addEventListener('pointerdown', (e) => {
        if (input.disabled || !e.isPrimary || e.button !== 0) return;
        e.preventDefault();
        input.focus({ preventScroll: true });
        drag = e.pointerId;
        input.setPointerCapture(e.pointerId);
        move(e);
      });
      input.addEventListener('pointermove', move);
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        input.addEventListener(event, (e) => {
          if ((e as PointerEvent).pointerId === drag) {
            drag = null;
            skill.input(0);
            this.refresh();
          }
        });
      input.addEventListener('blur', () => {
        drag = null;
        skill.input(0);
        this.refresh();
      });
    }
    this.dialog.showModal();
    const prepare = (models: CareModels) => {
      if (this.disposed) return;
      this.scene = new CareScene(board, skill, models);
      this.dialog.dataset.ready = 'true';
      this.dialog.querySelector('.care-loading')!.remove();
      this.refresh();
      this.dialog.querySelector<HTMLElement>('[data-skill-start]')!.focus();
    };
    if (models) prepare(models);
    else {
      const visit =
        visits.find(
          (v) => v.treatment === skill.tool && v.zone === skill.zone,
        ) ?? visits.find((v) => v.treatment === skill.tool)!;
      void loadCareModels(visit)
        .then(prepare)
        .catch(() => {
          if (!this.disposed) {
            this.dialog.querySelector('.care-loading')!.textContent =
              'The patient could not load. Close this activity and try again.';
          }
        });
    }
    this.refresh();
  }
  refresh() {
    const s = this.skill,
      k = s.spec.kind;
    this.dialog.dataset.complete = String(s.complete);
    this.dialog.dataset.started = String(s.started);
    this.dialog.dataset.startled = String(s.startled);
    const start =
      this.dialog.querySelector<HTMLButtonElement>('[data-skill-start]')!;
    start.hidden = s.started;
    start.disabled = !this.scene;
    this.dialog.querySelector<HTMLButtonElement>('[data-skill-retry]')!.hidden =
      !s.startled;
    const input =
      this.dialog.querySelector<HTMLInputElement>('#skill-position');
    if (input) {
      input.disabled =
        !s.started ||
        s.complete ||
        s.startled ||
        (k === 'pressure' && !s.gripped);
      input.value = String(Math.round(s.value * 100));
      this.dialog.querySelector('.skill-input-value')!.textContent =
        `${Math.round(s.value * 100)}%`;
    }
    const action = this.dialog.querySelector<HTMLButtonElement>(
      '[data-skill-action]',
    );
    if (action) {
      action.disabled = !s.started || s.complete || s.startled;
      action.hidden =
        !s.started ||
        s.startled ||
        ((k === 'pull' || k === 'pressure') && s.gripped);
    }
    const target = this.dialog.querySelector<HTMLElement>('.care-target')!;
    target.hidden =
      !['aim', 'pull', 'steady', 'pressure', 'pour'].includes(k) || s.complete;
    const p = s.targetPoint;
    target.style.left = `${p.x * 100}%`;
    target.style.top = `${p.y * 100}%`;
    target.dataset.x = String(p.x);
    target.dataset.y = String(p.y);
    target.style.setProperty(
      '--alignment',
      `${Math.min(1, s.stable / (k === 'steady' ? 4 : 0.45)) * 100}%`,
    );
    const cursor = this.dialog.querySelector<HTMLElement>('.care-cursor')!;
    const pos = k === 'wrap' ? s.wrapPosition : s.position;
    cursor.style.left = `${pos.x * 100}%`;
    cursor.style.top = `${pos.y * 100}%`;
    cursor.hidden = !s.started || s.complete;
    if (k === 'wrap') {
      this.dialog
        .querySelector('.care-wrap-path')!
        .setAttribute(
          'd',
          s.wrapPath.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' '),
        );
      this.dialog
        .querySelectorAll<HTMLElement>('[data-wrap-marker]')
        .forEach((m, i) => {
          const p = s.wrapPath[i * 16];
          m.style.left = `${p.x * 100}%`;
          m.style.top = `${p.y * 100}%`;
          m.classList.toggle('done', i * 16 <= s.wrapProgress);
        });
      this.dialog.querySelector<HTMLElement>(
        '.skill-canvas',
      )!.dataset.wrapProgress = String(s.wrapProgress);
    }
    this.dialog
      .querySelectorAll<HTMLElement>('[data-care-mark]')
      .forEach((mark, i) => {
        const p = k === 'comb' ? s.fleaPosition(i) : s.patchPoint(i);
        mark.style.left = `${p.x * 100}%`;
        mark.style.top = `${p.y * 100}%`;
        mark.dataset.x = String(p.x);
        mark.dataset.y = String(p.y);
        mark.hidden =
          !['comb', 'brush', 'spread'].includes(k) ||
          (k === 'brush' && i >= 3) ||
          s.covered.has(i);
        mark.textContent = k === 'comb' ? '' : String(i + 1);
        mark.classList.toggle('flea-target', k === 'comb');
      });
    const steps =
      k === 'comb'
        ? `${s.covered.size}/6 fleas caught`
        : k === 'spread'
          ? `${s.covered.size}/6 patches soothed`
          : k === 'brush'
            ? `${s.covered.size}/3 ${s.surface === 'teeth' ? 'teeth cleaned' : 'tangles smoothed'}`
            : k === 'wrap'
              ? `${Math.floor(s.wrapProgress / 32)}/3 wraps`
              : k === 'aim'
                ? `${s.stage}/3 storybook drops`
                : k === 'pull'
                  ? `${s.stage}/3 gentle steps`
                  : k === 'pour'
                    ? `Water level ${Math.round(s.waterLevel * 100)}% · Fill line 65%`
                    : `${Math.round(s.progress * 100)}% complete`;
    this.dialog.querySelector('.skill-step')!.textContent = s.complete
      ? 'Ready to finish'
      : steps;
    for (const [selector, value] of [
      ['.skill-progress', s.progress],
      ['.skill-pain', s.pain],
    ] as const) {
      const meter = this.dialog.querySelector<HTMLElement>(selector)!;
      meter.setAttribute('aria-valuenow', String(Math.round(value * 100)));
      (meter.firstElementChild as HTMLElement).style.width = `${value * 100}%`;
    }
    this.dialog.querySelector('.care-comfort-label')!.textContent = s.startled
      ? 'Needs a calm retry'
      : s.pain > 0.6
        ? 'Lift for a break'
        : s.pain > 0.2
          ? 'A gentler touch'
          : 'Comfortable';
    if (s.message !== this.lastMessage) {
      this.dialog.querySelector('.skill-feedback')!.textContent = s.message;
      this.lastMessage = s.message;
    }
    this.dialog.querySelector<HTMLButtonElement>(
      '[data-skill-finish]',
    )!.disabled = !s.complete;
  }
  pause() {
    const pointer = this.pointer;
    this.pointer = null;
    const board = this.dialog.querySelector<HTMLElement>('.skill-canvas');
    if (pointer !== null && board?.hasPointerCapture(pointer))
      board.releasePointerCapture(pointer);
    this.skill.release();
    this.refresh();
  }
  update(dt: number) {
    this.skill.update(dt);
    this.scene?.draw();
    this.refresh();
  }
  dispose() {
    this.disposed = true;
    this.pause();
    this.scene?.dispose();
    this.dialog.close();
    this.dialog.remove();
  }
}
