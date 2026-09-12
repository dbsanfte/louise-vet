import { CareSkill } from './care-skill';
import { bandagePattern, type TracePoint } from './bandage-pattern';
import { toolInfo } from './game';
import { icon } from './icons';
/** Small DOM activities stay responsive while the 3D patient waits safely. */
export class CareSkillView {
  readonly dialog = document.createElement('dialog');
  private painted = false;
  private sliderDrag: {
    pointer: number;
    control: HTMLElement;
    offset: number;
  } | null = null;
  private wrapPointer: number | null = null;
  private lastMessage = '';
  constructor(
    readonly skill: CareSkill,
    mount: HTMLElement,
    callbacks: { finish: () => void; cancel: () => void; stop: () => void },
  ) {
    const kind = skill.spec.kind;
    this.dialog.className = 'skill-dialog';
    this.dialog.dataset.skill = kind;
    this.dialog.dataset.tool = skill.tool;
    this.dialog.setAttribute('aria-labelledby', 'skill-title');
    this.dialog.setAttribute('aria-describedby', 'skill-instructions');
    const cells =
      kind === 'spread'
        ? `<div class="skill-patches">${Array.from({ length: 6 }, (_, i) => `<button data-cell="${i}" aria-label="Cream patch ${i + 1}"><span>${i + 1}</span></button>`).join('')}</div>`
        : kind === 'wrap'
          ? this.wrapBoard()
          : '';
    const marks =
      kind === 'comb' || (kind === 'brush' && skill.surface === 'fur')
        ? '<div class="skill-fur">' +
          Array.from(
            { length: 6 },
            (_, i) => `<span data-clean="${Math.floor(i / 2)}">•</span>`,
          ).join('') +
          '</div>'
        : kind === 'brush'
          ? '<div class="skill-teeth">' +
            Array.from(
              { length: 3 },
              (_, i) => `<span data-clean="${i}">✦</span>`,
            ).join('') +
            '</div>'
          : '';
    const liquid =
      kind === 'pour'
        ? '<div class="skill-bowl"><div class="skill-water"></div><span class="skill-fill-line">Fill line</span></div>'
        : '';
    const rail = !cells
      ? `<div class="skill-rail ${kind}"><span class="skill-target"></span><span class="skill-marker">${kind === 'aim' ? '↓' : kind === 'pull' ? '⌁' : kind === 'steady' ? '▰' : kind === 'comb' || kind === 'brush' ? '↔' : '│'}</span></div>`
      : '';
    const slider = ['comb', 'brush', 'aim', 'pull', 'steady'].includes(kind)
      ? `<label class="skill-slider-label" for="skill-position">${skill.spec.action === 'Grip splinter' ? 'Ease the forceps' : kind === 'aim' ? 'Aim the nozzle' : skill.spec.action}</label><input id="skill-position" type="range" min="0" max="100" step="2" value="${skill.value * 100}" aria-describedby="skill-instructions">`
      : '';
    const action = ['aim', 'pull', 'pressure', 'pour'].includes(kind)
      ? `<button class="primary skill-action" data-skill-action>${skill.spec.action}</button>`
      : '';
    this.dialog.innerHTML = `<header class="skill-header"><span class="mini-badge">${icon(toolInfo[skill.tool].icon)}</span><div><small>${toolInfo[skill.tool].name}</small><h2 id="skill-title">${skill.spec.title}</h2></div><button class="icon-button" data-skill-cancel aria-label="Cancel care activity">${icon('close')}</button></header><p id="skill-instructions">${skill.spec.hint}</p><div class="skill-board">${cells}${marks}${liquid}${rail}<p class="skill-step"></p></div><div class="skill-controls">${slider}${action}<button class="primary" data-skill-start>Start when ready</button></div><div class="skill-progress" role="meter" aria-label="Care progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div><p class="skill-feedback" aria-live="polite"></p><footer><button class="secondary" data-skill-stop>← Stop visit</button><button class="primary" data-skill-finish disabled>Finish care</button></footer>`;
    mount.append(this.dialog);
    this.dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      callbacks.cancel();
    });
    this.dialog
      .querySelector('[data-skill-cancel]')!
      .addEventListener('click', callbacks.cancel);
    this.dialog
      .querySelector('[data-skill-stop]')!
      .addEventListener('click', callbacks.stop);
    this.dialog
      .querySelector('[data-skill-finish]')!
      .addEventListener('click', () => {
        if (skill.complete) callbacks.finish();
      });
    this.dialog
      .querySelector('[data-skill-start]')!
      .addEventListener('click', () => {
        skill.start();
        this.refresh();
        this.dialog
          .querySelector<HTMLElement>(
            '#skill-position, [data-skill-action], [data-cell], .skill-wrap',
          )
          ?.focus();
      });
    const input =
      this.dialog.querySelector<HTMLInputElement>('#skill-position');
    input?.addEventListener('input', (e) => {
      skill.input(Number((e.target as HTMLInputElement).value) / 100);
      this.refresh();
    });
    // Both the pictured tool and its labelled range accept the same gesture.
    // Capture keeps a finger controlling the tool even beyond the track's edges.
    if (input) {
      const rail = this.dialog.querySelector<HTMLElement>('.skill-rail')!;
      rail.dataset.draggable = 'true';
      for (const control of [rail, input]) {
        const metrics = () => {
          const bounds = control.getBoundingClientRect();
          // Native range thumbs travel between inset centres, unlike the picture.
          const inset =
            control === input
              ? (parseFloat(
                  getComputedStyle(input).getPropertyValue(
                    '--skill-thumb-size',
                  ),
                ) || 32) / 2
              : 0;
          return {
            left: bounds.left + inset,
            width: Math.max(1, bounds.width - inset * 2),
          };
        };
        const move = (e: PointerEvent) => {
          const drag = this.sliderDrag;
          if (
            !drag ||
            drag.pointer !== e.pointerId ||
            drag.control !== control ||
            input.disabled
          )
            return;
          const bounds = metrics();
          skill.input((e.clientX - bounds.left - drag.offset) / bounds.width);
          this.refresh();
        };
        control.addEventListener('pointerdown', (e) => {
          if (
            !e.isPrimary ||
            e.button !== 0 ||
            input.disabled ||
            this.sliderDrag
          )
            return;
          e.preventDefault();
          input.focus({ preventScroll: true });
          const bounds = metrics();
          const offset = e.clientX - (bounds.left + skill.value * bounds.width);
          this.sliderDrag = {
            pointer: e.pointerId,
            control,
            // Grabbing the side of a handle should not make the tool jump.
            offset: Math.abs(offset) <= 18 ? offset : 0,
          };
          control.setPointerCapture(e.pointerId);
          move(e);
        });
        control.addEventListener('pointermove', move);
        for (const event of [
          'pointerup',
          'pointercancel',
          'lostpointercapture',
        ])
          control.addEventListener(event, (e) => {
            if ((e as PointerEvent).pointerId === this.sliderDrag?.pointer)
              this.releaseSlider();
          });
      }
      input.addEventListener('blur', () => this.releaseSlider());
    }
    if (kind === 'wrap') {
      const board = this.dialog.querySelector<HTMLElement>('.skill-wrap')!;
      let offset: TracePoint = { x: 0, y: 0 };
      const position = (e: PointerEvent) => {
        const bounds = board.getBoundingClientRect();
        return {
          x: (e.clientX - bounds.left) / bounds.width,
          y: (e.clientY - bounds.top) / bounds.height,
        };
      };
      board.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary || e.button !== 0 || this.wrapPointer !== null) return;
        e.preventDefault();
        const p = position(e);
        if (skill.beginWrap(p)) {
          offset = {
            x: p.x - skill.wrapPosition.x,
            y: p.y - skill.wrapPosition.y,
          };
          this.wrapPointer = e.pointerId;
          board.setPointerCapture(e.pointerId);
          board.focus({ preventScroll: true });
        }
        this.refresh();
      });
      board.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.wrapPointer) return;
        const p = position(e);
        skill.traceWrap({ x: p.x - offset.x, y: p.y - offset.y });
        this.refresh();
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        board.addEventListener(event, (e) => {
          if ((e as PointerEvent).pointerId === this.wrapPointer) {
            this.releaseWrap();
            this.refresh();
          }
        });
      board.addEventListener('keydown', (e) => {
        const direction: Record<string, TracePoint> = {
          ArrowLeft: { x: -0.02, y: 0 },
          ArrowRight: { x: 0.02, y: 0 },
          ArrowUp: { x: 0, y: -0.02 },
          ArrowDown: { x: 0, y: 0.02 },
        };
        if (!direction[e.key] || e.altKey || e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (this.wrapPointer !== null) return;
        if (!skill.wrapping) skill.beginWrap(skill.wrapPosition);
        skill.traceWrap({
          x: skill.wrapPosition.x + direction[e.key].x,
          y: skill.wrapPosition.y + direction[e.key].y,
        });
        this.refresh();
      });
      board.addEventListener('blur', () => {
        this.releaseWrap();
        this.refresh();
      });
    }
    this.dialog
      .querySelector('[data-skill-action]')
      ?.addEventListener('click', () => {
        skill.act();
        this.refresh();
      });
    this.dialog
      .querySelectorAll<HTMLButtonElement>('[data-cell]')
      .forEach((b) =>
        b.addEventListener('click', () => {
          skill.act(Number(b.dataset.cell));
          this.refresh();
        }),
      );
    // Cream supports a continuous stroke as well as separately focused buttons.
    if (kind === 'spread') {
      const board = this.dialog.querySelector('.skill-patches')!;
      const paint = (e: PointerEvent) => {
        const b = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest<HTMLElement>('[data-cell]');
        if (b && board.contains(b)) {
          skill.act(Number(b.dataset.cell));
          this.refresh();
        }
      };
      board.addEventListener('pointerdown', (e) => {
        this.painted = true;
        paint(e as PointerEvent);
        (e.target as HTMLElement).setPointerCapture(
          (e as PointerEvent).pointerId,
        );
      });
      board.addEventListener('pointermove', (e) => {
        if (this.painted) paint(e as PointerEvent);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        board.addEventListener(event, () => (this.painted = false));
    }
    this.refresh();
    this.dialog.showModal();
    this.dialog.querySelector<HTMLElement>('[data-skill-start]')!.focus();
  }
  refresh() {
    const s = this.skill,
      kind = s.spec.kind;
    this.dialog.dataset.complete = String(s.complete);
    this.dialog.dataset.started = String(s.started);
    const start =
      this.dialog.querySelector<HTMLButtonElement>('[data-skill-start]')!;
    start.hidden = s.started;
    this.dialog
      .querySelectorAll<HTMLButtonElement | HTMLInputElement>(
        '[data-cell], [data-skill-action], #skill-position',
      )
      .forEach(
        (e) =>
          (e.disabled =
            !s.started ||
            s.complete ||
            (e.id === 'skill-position' && kind === 'pull' && !s.gripped)),
      );
    const action = this.dialog.querySelector<HTMLButtonElement>(
      '[data-skill-action]',
    );
    if (action) {
      action.hidden =
        !s.started || s.complete || (kind === 'pull' && s.gripped);
      action.textContent =
        kind === 'pressure' && s.holding
          ? 'Pause vaccine'
          : kind === 'pour' && s.holding
            ? 'Stop pouring'
            : s.spec.action;
    }
    const input =
      this.dialog.querySelector<HTMLInputElement>('#skill-position');
    if (input) {
      this.dialog.querySelector<HTMLElement>('.skill-rail')!.dataset.disabled =
        String(input.disabled);
      if (input.disabled) this.releaseSlider();
    }
    if (input && Math.abs(Number(input.value) - s.value * 100) > 0.1)
      input.value = String(s.value * 100);
    const target = this.dialog.querySelector<HTMLElement>('.skill-target');
    if (target) {
      target.hidden = ['comb', 'brush'].includes(kind);
      target.style.left = `${(s.target - s.tolerance) * 100}%`;
      target.style.width = `${s.tolerance * 200}%`;
      target.dataset.target = String(s.target);
    }
    const marker = this.dialog.querySelector<HTMLElement>('.skill-marker');
    if (marker) marker.style.left = `${Math.min(s.value, 1) * 100}%`;
    const water = this.dialog.querySelector<HTMLElement>('.skill-water');
    if (water) water.style.height = `${s.value * 100}%`;
    if (kind === 'wrap') {
      const roll = this.dialog.querySelector<HTMLElement>('.bandage-roll')!;
      roll.style.left = `${s.wrapPosition.x * 100}%`;
      roll.style.top = `${s.wrapPosition.y * 100}%`;
      this.dialog
        .querySelector('.bandage-trail')!
        .setAttribute('stroke-dasharray', `${s.progress} 1`);
      this.dialog
        .querySelectorAll<HTMLElement>('[data-wrap-marker]')
        .forEach((marker) => {
          const index = Number(marker.dataset.wrapMarker);
          marker.classList.toggle('done', index * 16 <= s.wrapProgress);
          marker.classList.toggle('next', index === s.stage + 1);
        });
      this.dialog
        .querySelector('.skill-wrap')!
        .setAttribute('aria-disabled', String(!s.started || s.complete));
    }
    this.dialog
      .querySelectorAll<HTMLElement>('[data-clean]')
      .forEach((e) =>
        e.classList.toggle(
          'clean',
          Number(e.dataset.clean) <
            Math.floor((s.stage + (kind === 'comb' ? 1 : 0)) / 2),
        ),
      );
    this.dialog
      .querySelectorAll<HTMLButtonElement>('[data-cell]')
      .forEach((b) => {
        const i = Number(b.dataset.cell),
          done = kind === 'spread' ? s.covered.has(i) : i < s.stage;
        b.classList.toggle('done', done);
        b.setAttribute('aria-pressed', String(done));
        b.classList.toggle('next', kind === 'wrap' && i === s.stage);
      });
    const step =
      kind === 'comb' || kind === 'brush'
        ? `${s.stage % 2 ? '←' : '→'} ${kind === 'comb' && s.stage % 2 ? 'Lift and return' : 'Follow the arrow'} · ${Math.min(s.stage, 6)}/6`
        : kind === 'aim'
          ? `${Math.min(s.stage, 3)}/3 drops placed`
          : kind === 'pull'
            ? `${Math.min(s.stage, 3)}/3 gentle steps${s.gripped ? ' · Pause at the guide' : ''}`
            : kind === 'steady'
              ? `${Math.round(s.progress * 100)}% settled`
              : kind === 'wrap'
                ? `${Math.floor(s.stage / 2)}/3 wraps · Next: ${Math.min(s.stage + 2, 7)}`
                : kind === 'spread'
                  ? `${s.covered.size}/6 patches covered`
                  : 'Watch the striped patch';
    this.dialog.querySelector('.skill-step')!.textContent = s.complete
      ? 'Ready to finish'
      : step;
    const progress = this.dialog.querySelector<HTMLElement>('[role="meter"]')!;
    progress.setAttribute(
      'aria-valuenow',
      String(Math.round(s.progress * 100)),
    );
    (progress.firstElementChild as HTMLElement).style.width =
      `${s.progress * 100}%`;
    if (s.message !== this.lastMessage) {
      this.dialog.querySelector('.skill-feedback')!.textContent = s.message;
      this.lastMessage = s.message;
    }
    this.dialog.querySelector<HTMLButtonElement>(
      '[data-skill-finish]',
    )!.disabled = !s.complete;
  }
  pause() {
    this.skill.holding = false;
    this.painted = false;
    this.releaseSlider();
    this.releaseWrap();
    if (this.skill.spec.kind === 'pressure' && !this.skill.complete)
      this.skill.value = 0;
    this.refresh();
  }
  update(dt: number) {
    this.skill.update(dt);
    this.refresh();
  }
  dispose() {
    this.releaseSlider();
    this.releaseWrap();
    this.dialog.close();
    this.dialog.remove();
  }
  private wrapBoard() {
    const path = bandagePattern
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * 300},${p.y * 220}`)
      .join(' ');
    return `<div class="skill-wrap" tabindex="0" role="group" aria-label="Bandage wrapping pattern" aria-describedby="skill-instructions"><div class="skill-paw">${icon('paw')}</div><svg class="bandage-ribbon" viewBox="0 0 300 220" preserveAspectRatio="none" aria-hidden="true"><path class="bandage-guide" d="${path}"/><path class="bandage-dots" d="${path}"/><path class="bandage-trail" d="${path}" pathLength="1" stroke-dasharray="0 1"/></svg>${bandagePattern
      .filter((_, i) => i % 16 === 0)
      .map(
        (p, i) =>
          `<span class="wrap-marker" data-wrap-marker="${i}" style="left:${p.x * 100}%;top:${p.y * 100}%" aria-hidden="true">${i + 1}</span>`,
      )
      .join(
        '',
      )}<span class="bandage-roll" aria-hidden="true">${icon('bandage')}</span></div>`;
  }
  private releaseWrap() {
    const pointer = this.wrapPointer;
    this.wrapPointer = null;
    this.skill.releaseWrap();
    const board = this.dialog.querySelector<HTMLElement>('.skill-wrap');
    if (pointer !== null && board?.hasPointerCapture(pointer))
      board.releasePointerCapture(pointer);
  }
  private releaseSlider() {
    const drag = this.sliderDrag;
    this.sliderDrag = null;
    if (drag?.control.hasPointerCapture(drag.pointer))
      drag.control.releasePointerCapture(drag.pointer);
  }
}
