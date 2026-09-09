import { CareSkill } from './care-skill';
import { toolInfo } from './game';
import { icon } from './icons';
/** Small DOM activities stay responsive while the 3D patient waits safely. */
export class CareSkillView {
  readonly dialog = document.createElement('dialog');
  private painted = false;
  private padPointer: number | null = null;
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
          ? `<div class="skill-wrap"><div class="skill-paw">${icon('paw')}</div>${Array.from(
              { length: 6 },
              (_, i) => {
                const a = (i * Math.PI) / 3 - Math.PI / 2;
                return `<button data-cell="${i}" style="left:${50 + 37 * Math.cos(a)}%;top:${50 + 36 * Math.sin(a)}%" aria-label="Wrap step ${i + 1}">${i + 1}</button>`;
              },
            ).join('')}</div>`
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
            '#skill-position, [data-skill-action], [data-cell]',
          )
          ?.focus();
      });
    this.dialog
      .querySelector('#skill-position')
      ?.addEventListener('input', (e) => {
        skill.input(Number((e.target as HTMLInputElement).value) / 100);
        this.refresh();
      });
    // The pictured pad is a direct control, alongside the native keyboard slider.
    if (kind === 'steady') {
      const track = this.dialog.querySelector<HTMLElement>('.skill-rail')!;
      const movePad = (e: PointerEvent) => {
        const bounds = track.getBoundingClientRect();
        if (bounds.width > 0) {
          skill.input((e.clientX - bounds.left) / bounds.width);
          this.refresh();
        }
      };
      track.addEventListener('pointerdown', (e) => {
        if (!e.isPrimary || e.button !== 0 || !skill.started || skill.complete)
          return;
        e.preventDefault();
        this.padPointer = e.pointerId;
        track.setPointerCapture(e.pointerId);
        this.dialog.querySelector<HTMLInputElement>('#skill-position')!.focus();
        movePad(e);
      });
      track.addEventListener('pointermove', (e) => {
        if (e.pointerId === this.padPointer) movePad(e);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
        track.addEventListener(event, (e) => {
          if ((e as PointerEvent).pointerId === this.padPointer)
            this.releasePad();
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
                ? `Wrap ${Math.min(s.stage + 1, 6)} of 6 →`
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
    this.releasePad();
    if (this.skill.spec.kind === 'pressure' && !this.skill.complete)
      this.skill.value = 0;
    this.refresh();
  }
  update(dt: number) {
    this.skill.update(dt);
    this.refresh();
  }
  dispose() {
    this.releasePad();
    this.dialog.close();
    this.dialog.remove();
  }
  private releasePad() {
    const pointer = this.padPointer;
    this.padPointer = null;
    const track = this.dialog.querySelector<HTMLElement>('.skill-rail');
    if (pointer !== null && track?.hasPointerCapture(pointer))
      track.releasePointerCapture(pointer);
  }
}
