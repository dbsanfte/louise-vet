import * as THREE from 'three';
import type { World } from './world';
import type { TownSimulation } from './town-simulation';
import type { Progress } from './game';
import {
  buildRecipes,
  buildableCells,
  furnitureType,
  floorPrice,
  floorRectangle,
  toClinic,
  type Placement,
  type FloorCell,
  type BuildState,
} from './clinic-build';
import {
  nearestWall,
  wallKey,
  snapSpaceCorner,
  type WallEdge,
} from './clinic-spaces';
import { BuildTouchNavigation } from './build-touch';
import {
  clinicPrefabs,
  prefabCandidates,
  type ClinicPrefab,
} from './clinic-prefabs';
import { catalogueImage } from './catalogue';
import { icon } from './icons';
import type { Point } from './town-map';
import { shelterTrees } from './town-weather';

const buildLand = new Set(buildableCells.map((p) => `${p.x},${p.z}`));

/** The editor pauses town time; only safe unloading runs while an item is lifted. */
export class ClinicBuildEditor {
  active = false;
  private mode: 'items' | 'spaces' = 'items';
  private spaceTool: FloorCell['surface'] = 'room';
  private spaceHistory: { state: BuildState; cost: number }[] = [];
  private eraseDialog?: HTMLDialogElement;
  private tool: 'items' | 'camera' | 'door' | FloorCell['surface'] | 'erase' =
    'items';
  private selected?: string;
  private prefab?: ClinicPrefab;
  private prefabLayout?: { start: Point; end: Point };
  private touch: BuildTouchNavigation;
  private prefabPress?: {
    id: number;
    x: number;
    y: number;
    target: HTMLElement;
    dragged: boolean;
  };
  private lastPrefabPointer = -Infinity;
  private lifting = false;
  private ghost?: THREE.Group;
  private cursor: Placement = { x: 0, z: 1, rotation: 0 };
  private corner?: Point;
  private rawCursor: Point = { x: 0, z: 1 };
  private automaticDoors: WallEdge[] = [];
  private draft?: {
    start: Point;
    end: Point;
    surface: FloorCell['surface'] | 'erase';
  };
  private doorway?: WallEdge;
  private removeWall = false;
  private filter = 'all';
  private message =
    'Tap furniture in the clinic to move it. Your inventory holds spare items.';
  private error?: string;
  private lastHover = 0;
  private press?: {
    id: number;
    x: number;
    y: number;
    cursor: Placement;
    rawCursor: Point;
    corner?: Point;
    dragged: boolean;
  };
  constructor(
    private world: World,
    private sim: TownSimulation,
    private progress: Progress,
    private changed: () => void,
    private close: () => void,
    private shop: () => void,
  ) {
    const canvas = world.buildCanvas;
    this.touch = new BuildTouchNavigation(
      world,
      () => this.active,
      () => this.tool === 'camera',
      () => {
        this.cancelPress();
        this.releasePrefabPress();
        if (this.prefab || this.draft) this.preview();
        this.render();
      },
      (x, y) => {
        if (!this.draft) return;
        const point = this.world.buildHit(x, y, false).point;
        if (!point || !this.inDraft(point)) {
          this.cancel();
          this.render();
        }
      },
    );
    document.getElementById('sidebar')!.addEventListener('pointerdown', (e) => {
      const card = (e.target as Element).closest<HTMLElement>('[data-prefab]');
      if (
        !this.active ||
        !card ||
        e.button !== 0 ||
        (e.pointerType === 'touch' &&
          !(e.target as Element).closest('.catalogue-image'))
      )
        return;
      e.preventDefault();
      this.choosePrefab(card.dataset.prefab!, false);
      this.prefabPress = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        target: card,
        dragged: false,
      };
      card.setPointerCapture(e.pointerId);
    });
    document.addEventListener(
      'pointermove',
      (e) => {
        const press = this.prefabPress;
        if (!press || press.id !== e.pointerId) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        press.dragged ||=
          Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8;
        if (this.overCanvas(e.clientX, e.clientY)) {
          const p = world.buildHit(e.clientX, e.clientY, false).point;
          if (p && this.moveCursor(p)) this.preview();
        } else this.world.town!.furniture.scenery.hidePreview();
      },
      { capture: true },
    );
    document.addEventListener(
      'pointerup',
      (e) => {
        const press = this.prefabPress;
        if (press?.id === e.pointerId) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.releasePrefabPress();
          this.lastPrefabPointer = performance.now();
          if (press.dragged) {
            if (this.overCanvas(e.clientX, e.clientY)) {
              const p = world.buildHit(e.clientX, e.clientY, false).point;
              if (p) this.moveCursor(p);
              this.preview();
              this.place();
            } else this.cancel();
          }
          this.render();
        } else if (
          this.active &&
          this.draft &&
          e.target !== canvas &&
          !(e.target as Element).closest(
            'button,input,select,a,[role="dialog"]',
          )
        ) {
          this.cancel();
          this.render();
        }
      },
      { capture: true },
    );
    for (const event of ['pointercancel', 'lostpointercapture'])
      document.addEventListener(
        event,
        (e) => {
          if (this.prefabPress?.id === (e as PointerEvent).pointerId) {
            this.releasePrefabPress();
            this.cancel();
            this.render();
          }
        },
        { capture: true },
      );
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.active || this.tool === 'camera' || e.button !== 0) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        // Drawing owns one pointer; the touch navigator takes over when
        // a second finger joins, without buying accidental floor.
        if (this.press) {
          this.cancelPress();
          return;
        }
        if (!e.isPrimary || this.lifting) return;
        const p = world.buildHit(e.clientX, e.clientY, false).point;
        if (!p) return;
        if (this.draft && this.draft.surface !== 'erase') this.cancel();
        this.press = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          cursor: { ...this.cursor },
          rawCursor: { ...this.rawCursor },
          corner: this.corner ? { ...this.corner } : undefined,
          dragged: false,
        };
        canvas.setPointerCapture(e.pointerId);
        this.moveCursor(p);
        if (this.drawing && !this.draft && !this.prefab)
          this.corner ??= this.cell();
        this.preview();
      },
      { capture: true },
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (!this.active || this.tool === 'camera' || e.buttons & 2) return;
        e.stopImmediatePropagation();
        if (!e.isPrimary || (this.press && this.press.id !== e.pointerId))
          return;
        if (this.press)
          this.press.dragged ||=
            Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) >
            (this.drawing ? 2 : 8);
        // Floor corners update as each grid line is crossed; don't throttle
        // touch rectangles behind the furniture hover cadence.
        if (this.tool === 'items' && performance.now() - this.lastHover < 90)
          return;
        this.lastHover = performance.now();
        const p = world.buildHit(e.clientX, e.clientY, false).point;
        if (
          p &&
          !this.lifting &&
          !this.draft &&
          this.tool !== 'door' &&
          this.moveCursor(p)
        )
          this.preview();
      },
      { capture: true },
    );
    canvas.addEventListener(
      'pointerup',
      (e) => {
        if (!this.active || this.tool === 'camera' || e.button !== 0) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const press = this.press;
        if (!press || press.id !== e.pointerId) return;
        const rect = canvas.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          this.cancelPress();
          return;
        }
        const hit = world.buildHit(
          e.clientX,
          e.clientY,
          this.tool === 'items' && !this.selected,
        );
        if (!hit.point) {
          this.cancelPress();
          return;
        }
        const dragged =
          press.dragged ||
          Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8;
        this.releasePress();
        if (this.draft) {
          if (!dragged && !this.inDraft(hit.point)) {
            this.cancel();
            this.render();
          }
          return;
        }
        if (this.prefab) {
          this.moveCursor(hit.point);
          this.preview();
          this.place();
          return;
        }
        if (this.tool === 'door') {
          if (!dragged) {
            const edge = nearestWall(hit.point, this.doorOptions(), 1);
            if (edge) this.doorway = edge;
            this.preview();
            this.render();
          }
          return;
        }
        this.moveCursor(hit.point);
        this.preview();
        if (this.tool === 'items') {
          if (dragged) return;
          if (!this.selected && hit.id) this.pick(hit.id);
          else this.place();
        } else if (dragged || press.corner) this.finishDrawing();
        else this.render(); // First tap anchors; the second builds a valid space.
      },
      { capture: true },
    );
    for (const event of ['pointercancel', 'lostpointercapture'])
      canvas.addEventListener(
        event,
        (e) => {
          if ((e as PointerEvent).pointerId === this.press?.id)
            this.cancelPress();
        },
        { capture: true },
      );
    document.addEventListener('keydown', (e) => {
      if (!this.active || document.querySelector('[role="dialog"]')) return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'z' &&
        !e.shiftKey
      ) {
        e.preventDefault();
        this.undoSpace();
        return;
      }
      if (
        e.key.toLowerCase() === 'c' &&
        !e.ctrlKey &&
        !e.metaKey &&
        ['room', 'garden'].includes(this.tool) &&
        !this.prefab
      ) {
        e.preventDefault();
        if (this.draft) this.cancel();
        this.place();
        return;
      }
      if (e.key.toLowerCase() === 'r' && (this.selected || this.prefab)) {
        e.preventDefault();
        this.rotate();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.cancel();
        if (this.tool === 'door') this.preview();
        this.render();
      }
    });
    document
      .getElementById('sidebar')!
      .addEventListener('click', (e) => this.action(e));
    document
      .getElementById('stage-footer')!
      .addEventListener('click', (e) => this.action(e));
  }
  enter() {
    this.active = true;
    document.getElementById('app')!.dataset.building = 'true';
    this.world.setBuildMode(true);
    this.world.focusClinic('all');
    this.render();
  }
  exit() {
    this.cancel();
    this.spaceHistory = [];
    this.touch.reset();
    this.active = false;
    delete document.getElementById('app')!.dataset.building;
    this.world.setBuildMode(false);
    this.changed();
    this.close();
  }
  private action(event: MouseEvent) {
    if (!this.active) return;
    const b = (event.target as Element).closest<HTMLButtonElement>(
      '[data-build]',
    );
    if (!b || b.disabled) return;
    const action = b.dataset.build;
    if (action === 'prefab' || action === 'kit') {
      if (performance.now() - this.lastPrefabPointer > 300)
        this.choosePrefab(b.dataset.id!);
    } else if (action === 'mode') {
      this.cancel();
      this.mode = b.dataset.value as typeof this.mode;
      this.tool = this.mode === 'items' ? 'items' : this.spaceTool;
      this.preview();
      this.render();
      document.querySelector('.build-list')!.scrollTop = 0;
    } else if (action === 'pick') this.pick(b.dataset.id!);
    else if (action === 'filter') {
      this.filter = b.dataset.value!;
      this.render();
    } else if (action === 'tool') {
      const next = b.dataset.value as typeof this.tool;
      if (next === 'room' || next === 'garden') {
        this.mode = 'spaces';
        this.spaceTool = next;
      }
      if (next === 'items') this.mode = 'items';
      if (!(this.draft && (next === 'camera' || next === this.draft.surface)))
        this.cancel();
      this.tool = next;
      this.message =
        this.tool === 'items'
          ? 'Pick furniture in the clinic or from your collection.'
          : this.tool === 'camera'
            ? 'Drag to look around. Use arrows to move and scroll or pinch to zoom.'
            : this.tool === 'door'
              ? 'Choose a blue wall opening, then place your doorway.'
              : 'Draw your own space, or drag a room picture onto the clinic.';
      this.preview();
      this.render();
      if (next !== 'camera' || !this.draft)
        document.querySelector('.build-list')!.scrollTop = 0;
    } else if (action === 'next-door') {
      const options = this.doorOptions();
      this.doorway =
        options[
          (options.findIndex(
            (e) => this.doorway && wallKey(e) === wallKey(this.doorway),
          ) +
            1) %
            options.length
        ];
      this.preview();
      this.render();
    } else if (action === 'door-mode') {
      this.removeWall = b.dataset.value === 'wall';
      this.preview();
      this.render();
    } else if (action === 'redraw') {
      if (this.draft) this.tool = this.draft.surface;
      this.cancel();
      this.render();
      document.querySelector('.build-list')!.scrollTop = 0;
    } else if (action === 'rotate') this.rotate();
    else if (action === 'place') this.place();
    else if (action === 'undo') this.undoSpace();
    else if (action === 'cancel') {
      this.cancel();
      if (this.tool === 'door') this.preview();
      this.render();
    } else if (action === 'store') this.store();
    else if (action === 'done') this.exit();
    else if (action === 'shop') {
      this.cancel();
      this.spaceHistory = [];
      this.shop();
    } else if (action === 'plot') this.world.focusBuildPlot();
    else if (action === 'nudge') {
      const [dx, dz] = b.dataset.value!.split(',').map(Number);
      const scale = this.tool === 'items' ? 1 : 2;
      this.cursor.x += dx * scale;
      this.cursor.z += dz * scale;
      this.rawCursor = { x: this.cursor.x, z: this.cursor.z };
      this.preview();
    }
  }
  private moveCursor(point: Point) {
    this.rawCursor = { ...point };
    const step = this.tool === 'items' ? 2 : 1;
    const { x, z } =
      this.drawing && this.tool !== 'erase' && !this.prefab
        ? snapSpaceCorner(point, this.sim.build.tiles)
        : {
            x: Math.round(point.x * step) / step,
            z: Math.round(point.z * step) / step,
          };
    const changed = x !== this.cursor.x || z !== this.cursor.z;
    this.cursor = { x, z, rotation: this.cursor.rotation };
    return changed || Boolean(this.corner && this.press);
  }
  private releasePress() {
    const press = this.press;
    this.press = undefined;
    if (press && this.world.buildCanvas.hasPointerCapture(press.id))
      this.world.buildCanvas.releasePointerCapture(press.id);
    return press;
  }
  private cancelPress() {
    const press = this.releasePress();
    if (!press) return;
    this.cursor = press.cursor;
    this.rawCursor = press.rawCursor;
    this.corner = press.corner;
    this.error = undefined;
    if (this.selected || this.corner || this.prefab || this.draft)
      this.preview();
    else {
      this.world.town!.furniture.scenery.hidePreview();
      this.message = 'Drawing cancelled. Drag from a corner to try again.';
    }
    this.render();
  }
  private actors() {
    return [
      ...this.sim.households.filter((h) => h.inClinic).map((h) => h.position),
      ...this.world.town!.clinicOccupants(),
      ...[...this.sim.leisure.pets.values()].map((p) => p.position),
    ].filter((p) => this.sim.build.contains(toClinic(p)));
  }
  private pick(id: string) {
    this.cancel();
    this.spaceHistory = [];
    this.mode = 'items';
    const item = this.sim.build.items.find((i) => i.id === id);
    if (!item) return;
    this.tool = 'items';
    this.selected = id;
    this.cursor = { ...(item.placement ?? { x: 0, z: 1, rotation: 0 }) };
    this.lifting = Boolean(item.placement);
    if (this.lifting) {
      this.sim.leisure.beginMove(id);
      this.message = 'Let everyone step off safely…';
    } else this.readyToMove();
    this.render();
  }
  private readyToMove() {
    this.lifting = false;
    const model = this.world.town!.furniture.itemModels.get(this.selected!)!;
    this.ghost = model.clone(true);
    this.ghost.visible = true;
    this.ghost.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = false;
        const clone = (m: THREE.Material) => {
          const c = m.clone();
          c.transparent = true;
          c.opacity = 0.5;
          c.depthWrite = false;
          return c;
        };
        o.material = Array.isArray(o.material)
          ? o.material.map(clone)
          : clone(o.material);
      }
    });
    this.world.town!.furniture.group.add(this.ghost);
    model.visible = false;
    this.message = `${this.sim.build.recipe(this.selected!).name}: choose a spot, then Place item. Rotate turns the furniture.`;
    this.preview();
    this.render();
  }
  update(dt: number) {
    if (!this.active || !this.lifting || !this.selected) return;
    // Raised rides complete their lap and cats/birds climb or fly down. The
    // object stays solid and visible until its occupants have left its footprint.
    this.sim.leisure.movingReady(this.selected, this.sim.households);
    this.sim.leisure.update(
      Math.min(dt, 0.1),
      this.sim.households,
      this.sim.tickets,
      (id) => this.sim.visit(id),
    );
    if (this.sim.leisure.movingReady(this.selected, this.sim.households))
      this.readyToMove();
  }
  private clearGhost() {
    if (this.ghost) {
      this.ghost.removeFromParent();
      this.ghost.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        }
      });
      this.ghost = undefined;
    }
  }
  cancel(resetSpaceHistory = false) {
    this.eraseDialog?.remove();
    this.eraseDialog = undefined;
    if (resetSpaceHistory) this.spaceHistory = [];
    this.releasePress();
    this.releasePrefabPress();
    this.prefab = undefined;
    this.prefabLayout = undefined;
    this.clearGhost();
    if (this.selected) {
      const model = this.world.town!.furniture.itemModels.get(this.selected);
      if (model)
        model.visible = Boolean(this.sim.build.placement(this.selected));
    }
    this.selected = undefined;
    this.lifting = false;
    this.corner = undefined;
    this.automaticDoors = [];
    this.draft = undefined;
    this.doorway = undefined;
    this.error = undefined;
    this.sim.leisure.endMove();
    this.world.town!.furniture.scenery.hidePreview();
    this.message =
      'Tap furniture in the clinic to move it. Your inventory holds spare items.';
  }
  private rotate() {
    this.cursor.rotation = (this.cursor.rotation + Math.PI / 2) % (Math.PI * 2);
    this.preview();
    this.render();
  }
  private cell() {
    return { x: Math.round(this.cursor.x), z: Math.round(this.cursor.z) };
  }
  private endCorner() {
    const end = this.cell(),
      start = this.corner;
    if (!start || this.tool === 'erase') return end;
    for (const axis of ['x', 'z'] as const) {
      if (end[axis] !== start[axis]) continue;
      const delta = this.rawCursor[axis] - start[axis];
      // Minimum-width strokes must grow on the dragged side of their anchor.
      if (Math.abs(delta) > 0.12) end[axis] += Math.sign(delta);
      else {
        const middle = { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 };
        const positive = { ...middle, [axis]: start[axis] + 0.5 };
        const negative = { ...middle, [axis]: start[axis] - 0.5 };
        if (
          this.sim.build.contains(positive) &&
          !this.sim.build.contains(negative)
        )
          end[axis]--;
      }
    }
    return end;
  }
  private get drawing() {
    return ['room', 'garden', 'erase'].includes(this.tool);
  }
  private doorOptions() {
    if (this.draft && this.draft.surface !== 'erase')
      return this.sim.build.doorOptions(this.draft.start, this.draft.end);
    return this.tool === 'door' ? this.sim.build.editableWalls() : [];
  }
  private finishDrawing() {
    if (!this.corner || !this.drawing) return;
    this.draft = {
      start: { ...this.corner },
      end: this.endCorner(),
      surface: this.tool as FloorCell['surface'] | 'erase',
    };
    this.doorway = undefined;
    this.preview();
    if (this.draft.surface !== 'erase') this.place();
    else this.confirmErasure();
    document.querySelector('.build-list')!.scrollTop = 0;
  }
  private floor(start: Point, end: Point, apply = false) {
    const { from: a, to: b } = floorRectangle(start, end);
    const surface =
      this.prefab?.surface ??
      this.draft?.surface ??
      (this.tool as FloorCell['surface'] | 'erase');
    if (surface === 'erase') return this.sim.build.erase(a, b, apply);
    const sheltered = [...this.sim.weather.active.values()].some((s) => {
      const p = toClinic(shelterTrees[s.tree]);
      return (
        p.x >= Math.min(a.x, b.x) - 1 &&
        p.x < Math.max(a.x, b.x) + 2 &&
        p.z >= Math.min(a.z, b.z) - 1 &&
        p.z < Math.max(a.z, b.z) + 2
      );
    });
    if (sheltered)
      return {
        error:
          'A family is sheltering there. Let them finish before building here.',
        cost: 0,
      };
    const result = this.sim.build.autoSpace(
      start,
      end,
      surface,
      this.progress.coins,
      this.actors(),
      apply,
    );
    this.doorway = result.door;
    this.automaticDoors = result.doors;
    return result;
  }
  private confirmErasure() {
    if (this.draft?.surface !== 'erase' || this.eraseDialog) return;
    const { from, to } = floorRectangle(this.draft.start, this.draft.end);
    const plan = this.sim.build.erase(from, to);
    if (plan.error || (!plan.removed && !plan.stored.length)) {
      this.error =
        plan.error ?? 'There is no removable floor or furniture here.';
      this.render();
      return;
    }
    this.render();
    const dialog = document.createElement('dialog');
    dialog.className = 'build-erase-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-labelledby', 'erase-title');
    dialog.setAttribute('aria-describedby', 'erase-description');
    const items = new Map<string, number>();
    for (const id of plan.stored) {
      const name = this.sim.build.recipe(id).name;
      items.set(name, (items.get(name) ?? 0) + 1);
    }
    dialog.innerHTML = `<h2 id="erase-title">Erase this space?</h2><div id="erase-description"><p>Remove ${plan.removed} floor tile${plan.removed === 1 ? '' : 's'}${plan.stored.length ? ` and return ${plan.stored.length} furniture item${plan.stored.length === 1 ? '' : 's'} to your collection` : ''}?</p>${items.size ? `<ul>${[...items].map(([name, count]) => `<li>${name}${count > 1 ? ` × ${count}` : ''}</li>`).join('')}</ul><p>You still own these items. Place them again from the furniture picker.</p>` : ''}<p>People and pets will move safely out of the way. Remaining edges get walls or fences.${plan.detached ? ' Separated spaces stay in place but need reconnecting before anyone can use them.' : ''}</p><p>No coins are spent or returned. The entrance, counter and exam room stay in place. You can Undo afterward.</p></div><div class="erase-dialog-actions"><button type="button" class="secondary" data-erase-answer="no" autofocus>No, keep it</button><button type="button" class="primary" data-erase-answer="yes">Yes, erase space</button></div>`;
    const dismiss = () => {
      this.cancel();
      this.render();
      document
        .querySelector<HTMLButtonElement>(
          '[data-build="tool"][data-value="erase"]',
        )
        ?.focus();
    };
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      dismiss();
    });
    dialog.addEventListener('click', (e) => {
      const answer = (e.target as Element).closest<HTMLElement>(
        '[data-erase-answer]',
      )?.dataset.eraseAnswer;
      if (answer === 'no') dismiss();
      if (answer !== 'yes') return;
      const before = this.sim.build.snapshot();
      const result = this.sim.build.erase(from, to, true);
      if (result.error) {
        dismiss();
        this.error = result.error;
        this.render();
        return;
      }
      this.spaceHistory.push({ state: before, cost: 0 });
      this.cancel();
      this.afterChange(
        'Space erased. Furniture is back in your collection, ready to place again.',
        before,
      );
      document.querySelector<HTMLButtonElement>('[data-build="undo"]')?.focus();
    });
    document.body.append(dialog);
    this.eraseDialog = dialog;
    dialog.showModal();
  }
  private preview() {
    if (this.lifting) return;
    const scenery = this.world.town!.furniture.scenery;
    if (this.prefab) {
      const plans = prefabCandidates(
        this.sim.build,
        this.prefab,
        this.cursor,
        this.cursor.rotation,
      );
      let picked = plans[0],
        result: { error?: string; cost: number } = {
          error: 'Drop beside existing floor, clear of paths and other rooms.',
          cost: 0,
        };
      for (const plan of plans) {
        let clear = true;
        for (let x = plan.start.x; x < plan.end.x && clear; x++)
          for (let z = plan.start.z; z < plan.end.z; z++)
            if (
              !buildLand.has(`${x},${z}`) ||
              this.sim.build.contains({ x: x + 0.5, z: z + 0.5 })
            ) {
              clear = false;
              break;
            }
        if (!clear) continue;
        const candidate = this.floor(plan.start, plan.end);
        picked = plan;
        result = candidate;
        if (!candidate.error || candidate.cost > this.progress.coins) break;
      }
      this.prefabLayout = picked;
      this.error = result.error;
      const { from, width, depth } = floorRectangle(picked.start, picked.end);
      scenery.showPreview(
        from.x + width / 2,
        from.z + depth / 2,
        width,
        depth,
        0,
        !this.error,
      );
      scenery.showDoorHints(
        this.error ? [] : this.automaticDoors,
        this.automaticDoors,
        !this.error,
      );
      this.message = `${this.prefab.name} · ${width} × ${depth} tiles · ${result.cost} coins. Drop to build; the door connects automatically.`;
    } else if (this.selected) {
      const r = this.sim.build.recipe(this.selected);
      this.error = this.sim.build.proposal(
        this.selected,
        this.cursor,
        this.actors(),
      );
      if (this.ghost) {
        this.ghost.position.set(this.cursor.x, 0, this.cursor.z);
        this.ghost.rotation.y = this.cursor.rotation;
      }
      scenery.showPreview(
        this.cursor.x,
        this.cursor.z,
        r.width,
        r.depth,
        this.cursor.rotation,
        !this.error,
      );
    } else if (
      this.drawing &&
      !this.draft &&
      (!this.corner ||
        (this.press && !this.press.dragged && !this.press.corner))
    ) {
      const anchor = this.corner ?? this.cell();
      this.error = undefined;
      scenery.showPreview(anchor.x, anchor.z, 0.18, 0.18, 0, true);
      scenery.showDoorHints([]);
      this.message = 'Start at this corner, then drag out your space.';
    } else if (this.draft || this.drawing) {
      const a = this.draft?.start ?? this.corner ?? this.cell(),
        b = this.draft?.end ?? this.endCorner();
      const result = this.floor(a, b);
      const { from, width, depth } = floorRectangle(a, b);
      this.error = result.error;
      scenery.showPreview(
        from.x + width / 2,
        from.z + depth / 2,
        width,
        depth,
        0,
        !this.error,
      );
      const surface = this.draft?.surface ?? this.tool;
      this.message = `${width} × ${depth} tiles · ${result.cost} coins. ${this.draft ? (surface === 'erase' ? 'Review the floor to remove.' : 'Draw again to build. Nothing spent.') : this.corner ? (this.press ? (surface === 'erase' ? 'Release to mark floor.' : 'Release to build.') : 'Choose the opposite corner.') : 'Draw a rectangle.'}`;
      scenery.showDoorHints(
        surface !== 'erase' && !this.error ? this.automaticDoors : [],
        this.automaticDoors,
        !this.error,
      );
    } else if (this.tool === 'door') {
      scenery.preview.visible = false;
      scenery.showDoorHints(this.doorOptions(), this.doorway);
      this.error = undefined;
      this.message = this.doorway
        ? this.removeWall
          ? 'Remove this wall section to join the spaces.'
          : this.sim.build.architecture.doors.some(
                (e) => wallKey(e) === wallKey(this.doorway!),
              )
            ? 'Close this doorway? Another way through must stay open.'
            : 'Place a doorway here. Both sides stay reachable.'
        : 'Choose a blue hint or use Suggested door.';
    }
    const status = document.getElementById('build-feedback');
    if (status) status.textContent = this.error ?? this.message;
    const button = document.querySelector<HTMLButtonElement>(
      '[data-build="place"]',
    );
    if (button) {
      button.disabled = this.placeDisabled();
      button.textContent = this.placeLabel();
    }
  }
  private placeDisabled() {
    return (
      this.lifting ||
      Boolean(this.error) ||
      (this.draft || this.prefab
        ? false
        : this.tool === 'door'
          ? !this.doorway
          : this.tool === 'camera' || (this.tool === 'items' && !this.selected))
    );
  }
  private placeLabel() {
    if (this.prefab) return 'Place space';
    if (this.selected) return 'Place item';
    if (this.draft) return 'Remove floor';
    if (this.tool === 'door')
      return this.removeWall
        ? 'Remove wall'
        : this.doorway &&
            this.sim.build.architecture.doors.some(
              (e) => wallKey(e) === wallKey(this.doorway!),
            )
          ? 'Close doorway'
          : 'Place doorway';
    return this.drawing
      ? this.corner
        ? 'Plan space'
        : 'First corner'
      : 'Choose item';
  }

  private place() {
    if (this.lifting) return;
    if (this.selected) {
      const error = this.sim.build.place(
        this.selected,
        this.cursor,
        this.actors(),
      );
      if (error) {
        this.error = error;
        this.render();
        return;
      }
      this.cancel();
      this.afterChange('Lovely! Everything has a clear way through.');
    } else if (this.draft || (this.prefab && this.prefabLayout)) {
      if (this.draft?.surface === 'erase') {
        this.confirmErasure();
        return;
      }
      if (this.prefab && this.error) {
        this.render();
        return;
      }
      const plan = this.draft ?? this.prefabLayout!;
      const before = this.sim.build.snapshot();
      const result = this.floor(plan.start, plan.end, true);
      if (result.error) {
        this.error = result.error;
        this.render();
        return;
      }
      if (JSON.stringify(before) !== JSON.stringify(this.sim.build.state))
        this.spaceHistory.push({ state: before, cost: result.cost });
      this.progress.coins -= result.cost;
      this.cancel();
      this.afterChange(
        'Your new space is ready! Undo returns its coins and floor tiles.',
      );
    } else if (this.tool === 'door' && this.doorway) {
      const before = this.sim.build.snapshot();
      const error = this.sim.build.editDoor(
        this.doorway,
        this.removeWall,
        this.actors(),
      );
      if (error) {
        this.error = error;
        this.render();
        return;
      }
      this.spaceHistory.push({ state: before, cost: 0 });
      this.doorway = undefined;
      this.afterChange('Entrance updated. Everyone can still get through.');
      this.world.town!.furniture.scenery.showDoorHints(this.doorOptions());
    } else if (this.drawing) {
      if (!this.corner) {
        this.corner = this.cell();
        this.preview();
        this.render();
      } else this.finishDrawing();
    }
  }

  private undoSpace() {
    const previous = this.spaceHistory.at(-1);
    if (!previous || this.lifting || this.mode !== 'spaces') return;
    this.cancel();
    const before = this.sim.build.snapshot();
    if (!this.sim.build.restore(previous.state)) {
      this.error = 'This space cannot be undone. Your clinic has not changed.';
      this.render();
      return;
    }
    this.spaceHistory.pop();
    this.progress.coins += previous.cost;
    this.afterChange(
      'Change undone. Your coins and floor tiles are back.',
      before,
    );
  }
  private store() {
    if (!this.selected || this.lifting) return;
    const error = this.sim.build.place(this.selected, undefined, this.actors());
    if (error) {
      this.error = error;
      this.render();
      return;
    }
    this.cancel();
    this.afterChange('Stored safely in your collection.');
  }
  private afterChange(message: string, before?: BuildState) {
    if (before) {
      const moved = this.sim.leisure.reconcileBuild(
        this.sim.households,
        before.tiles,
      );
      this.world.town!.reconcileClinicBuild(moved);
    }
    this.sim.leisure.replan(this.sim.households);
    this.sim.revision++;
    this.world.setUpgrades(this.progress.upgrades);
    this.changed();
    this.message = message;
    this.error = undefined;
    this.world.town!.furniture.scenery.hidePreview();
    this.render();
  }
  private spaceGuide(
    button: (
      text: string,
      action: string,
      extra?: string,
      disabled?: boolean,
    ) => string,
  ) {
    if (this.mode !== 'spaces') return undefined;
    const surface =
      this.draft?.surface ??
      (this.tool === 'camera' ? this.spaceTool : this.tool);
    const options = this.doorOptions();
    const entrance = button(
      this.doorway ? 'Next entrance' : 'Suggested door',
      'next-door',
      '',
      !options.length,
    );
    if (surface === 'door')
      return `<section class="space-guide"><h3>Make a way through</h3><div class="space-options">${button('Doorways', 'door-mode', `data-value="door" aria-pressed="${!this.removeWall}"`)}${button('Remove wall', 'door-mode', `data-value="wall" aria-pressed="${this.removeWall}"`)}</div><p>Tap a blue wall frame, or choose a suggestion.</p>${entrance}<p>Confirm below to change this entrance. Doorways cost no extra coins. Keep a clear way into every space.</p><p>The front door and examination route stay in place.</p></section>`;
    const erase = surface === 'erase';
    if (erase)
      return `<section class="space-guide"><h3>Erase space</h3><p>Drag a rectangle, or tap two corners. On release, choose Yes to erase or No to keep everything.</p><p>Furniture returns to your collection. People and pets move safely clear, and remaining edges get walls or fences. Undo brings the space and furniture back.</p></section>`;
    const plans = clinicPrefabs
      .filter((p) => p.surface === this.spaceTool)
      .sort((a, b) => {
        const credits = (id: string) =>
          this.sim.build.unusedRoomKits.some((kit) => kit.id === id);
        return (
          Number(credits(b.id)) - Number(credits(a.id)) ||
          Number(b.id === 'sun-courtyard') - Number(a.id === 'sun-courtyard')
        );
      });
    const cards = `<div class="prefab-grid" aria-label="${this.spaceTool === 'garden' ? 'Garden' : 'Floor'} prefabs">${plans.map((p) => this.prefabCard(p, button, this.sim.build.unusedRoomKits.find((kit) => kit.id === p.id)?.credits)).join('')}</div>`;
    return `${cards}<section class="space-guide"><h3>${this.prefab ? this.prefab.name : this.draft ? 'Check your plan' : this.spaceTool === 'garden' ? 'Garden shapes' : 'Floor shapes'}</h3><p class="space-instruction">${this.draft ? 'Nothing was built. Draw another rectangle to try again.' : this.prefab ? 'Tap a clear spot or drag to place. Doors connect automatically.' : 'Draw and release to build, or tap two corners. Doors connect automatically.'}</p></section><section class="space-help"><p>Gardens join together. Rooms get doors automatically. Undo returns the last space and its cost.</p><p>Pinch to zoom, drag two fingers to pan, and twist to turn.</p>${!matchMedia('(pointer: coarse)').matches ? '<p>Keyboard: C sets each corner; nudge arrows position it. Ctrl/Cmd+Z undoes a space.</p>' : ''}<p>Floor plans only. Add furniture in Place furniture mode.</p></section>`;
  }

  private prefabCard(
    prefab: ClinicPrefab,
    button: (
      text: string,
      action: string,
      extra?: string,
      disabled?: boolean,
    ) => string,
    credits?: number,
  ) {
    return `<article class="build-card prefab-card ${credits !== undefined ? 'build-room-kit' : ''}" ${credits !== undefined ? `data-kit="${prefab.id}"` : ''} data-selected="${this.prefab?.id === prefab.id}">${button(`<img class="catalogue-image" src="/images/catalogue/prefab-${prefab.id}.webp" width="256" height="256" alt="${prefab.name} floor plan" draggable="false"><span class="build-card-text"><strong>${prefab.name}</strong><span>${prefab.use}</span><small>${prefab.width} × ${prefab.depth} tiles</small><small>${credits !== undefined ? `${credits} floor tiles available · ${Math.max(0, prefab.width * prefab.depth - this.sim.build.state.credits) * floorPrice} coins` : `${Math.max(0, prefab.width * prefab.depth - this.sim.build.state.credits) * floorPrice} coins`}</small><small>Drag picture or tap to choose</small></span>`, credits !== undefined ? 'kit' : 'prefab', `data-prefab="${prefab.id}" data-id="${prefab.id}" data-value="${prefab.surface}"`)}</article>`;
  }
  private choosePrefab(id: string, render = true) {
    this.cancel();
    this.prefab = clinicPrefabs.find((p) => p.id === id);
    if (!this.prefab) return;
    this.mode = 'spaces';
    this.spaceTool = this.prefab.surface;
    this.tool = this.prefab.surface;
    this.cursor = { x: -5 - this.prefab.width / 2, z: 0, rotation: 0 };
    this.preview();
    if (render) this.render();
  }
  private overCanvas(x: number, y: number) {
    const rect = this.world.buildCanvas.getBoundingClientRect();
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  }
  private inDraft(p: Point) {
    if (!this.draft) return false;
    const { from, width, depth } = floorRectangle(
      this.draft.start,
      this.draft.end,
    );
    return (
      p.x >= from.x &&
      p.x <= from.x + width &&
      p.z >= from.z &&
      p.z <= from.z + depth
    );
  }
  private releasePrefabPress() {
    const press = this.prefabPress;
    this.prefabPress = undefined;
    if (press?.target.hasPointerCapture(press.id))
      press.target.releasePointerCapture(press.id);
  }

  render() {
    if (!this.active) return;
    const sidebar = document.getElementById('sidebar')!,
      old = sidebar.querySelector('.build-list')?.scrollTop ?? 0;
    const focused = sidebar.contains(document.activeElement)
      ? { ...(document.activeElement as HTMLElement).dataset }
      : undefined;
    const cards = buildRecipes.filter((r) => {
      if (
        furnitureType(r.id) !== r.id ||
        !this.sim.build.copies(r.id).some((i) => !i.placement)
      )
        return false;
      return (
        this.filter === 'all' ||
        (this.filter === 'seats' &&
          r.stations.some(
            (id) =>
              id.startsWith('seat') ||
              id.startsWith('game') ||
              id.startsWith('puzzle'),
          )) ||
        (this.filter === 'pets' &&
          r.stations.some(
            (id) =>
              !id.startsWith('seat') &&
              !id.startsWith('game') &&
              !id.startsWith('puzzle'),
          )) ||
        (this.filter === 'decor' && !r.stations.length)
      );
    });
    const button = (
      text: string,
      action: string,
      extra = '',
      disabled = false,
    ) =>
      `<button class="secondary" data-build="${action}" ${extra} ${disabled ? 'disabled' : ''}>${text}</button>`;
    const collection = cards
      .map((r) => {
        const copies = this.sim.build.copies(r.id),
          stored = copies.filter((i) => !i.placement),
          selected = stored.some((i) => i.id === this.selected),
          next = stored.find((i) => i.id === this.selected) ?? stored[0];
        return `<article class="build-card" data-recipe="${r.id}" data-available="${stored.length}" data-selected="${selected}">
        ${button(`${catalogueImage(r.id)}<span class="build-card-text"><strong>${r.name}</strong><span class="build-available">${stored.length} available</span><small>Place one</small></span>`, 'pick', `data-id="${next?.id ?? r.id}" aria-pressed="${Boolean(next && next.id === this.selected)}"`, !stored.length || this.lifting)}
      </article>`;
      })
      .join('');
    const modeButton = (
      value: 'items' | 'spaces',
      name: string,
      glyph: string,
    ) =>
      button(
        `${icon(glyph)}<span>${name}</span>`,
        'mode',
        `data-value="${value}" aria-pressed="${this.mode === value}"`,
      );
    const control = (
      name: string,
      glyph: string,
      action: string,
      extra = '',
      disabled = false,
    ) => button(`${icon(glyph)}<span>${name}</span>`, action, extra, disabled);
    const controls =
      this.mode === 'spaces'
        ? `${control('Undo', 'undo', 'undo', 'aria-label="Undo last space"', !this.spaceHistory.length || this.lifting)}${control('Erase', 'erase', 'tool', `data-value="erase" aria-pressed="${this.tool === 'erase'}"`)}${this.prefab ? control('Rotate', 'rotate', 'rotate') : control('Doors', 'door', 'tool', `data-value="door" aria-pressed="${this.tool === 'door'}"`)}${control('Camera', 'search', 'tool', `data-value="camera" aria-pressed="${this.tool === 'camera'}"`)}`
        : control(
            'Camera',
            'search',
            'tool',
            `data-value="camera" aria-pressed="${this.tool === 'camera'}"`,
          );
    sidebar.setAttribute('aria-label', 'Build editor');
    sidebar.dataset.buildMode = this.mode;
    sidebar.innerHTML = `<div class="build-heading"><h2>Build your clinic</h2>${button('Shop', 'shop')}</div><nav class="build-modes" aria-label="Build mode">${modeButton('items', 'Place furniture', 'chair')}${modeButton('spaces', 'Build spaces', 'grid')}</nav>${this.mode === 'spaces' ? `<nav class="build-surfaces" aria-label="Space surface">${button(`${icon('grid')}<span>Floor</span>`, 'tool', `data-value="room" aria-pressed="${this.tool === 'room'}"`)}${button(`${icon('leaf')}<span>Garden</span>`, 'tool', `data-value="garden" aria-pressed="${this.tool === 'garden'}"`)}</nav>` : ''}<nav class="build-controls" aria-label="${this.mode === 'spaces' ? 'Space editing' : 'Furniture'} controls">${controls}</nav><p class="build-price">${this.progress.coins} coins · ${this.sim.build.state.credits} free floor tiles · then ${floorPrice} coins/tile</p><nav class="build-filters" aria-label="Collection filters" ${this.mode === 'spaces' ? 'hidden' : ''}>${[
      ['all', 'All'],
      ['seats', 'Seats'],
      ['pets', 'Pets'],
      ['decor', 'Decor'],
    ]
      .map(([v, n]) =>
        button(
          n,
          'filter',
          `data-value="${v}" aria-pressed="${this.filter === v}"`,
        ),
      )
      .join(
        '',
      )}</nav><div class="build-list" tabindex="0" aria-label="Build collection">${this.spaceGuide(button) ?? (collection || '<p>Nothing stored yet. Tap furniture in the clinic to move it, or buy something in Shop.</p>')}</div><p id="build-feedback" role="status">${this.error ?? this.message}</p><div class="build-nudges" aria-label="Position selected item" ${this.draft || this.tool === 'door' ? 'hidden' : ''}>${[
      [-0.5, 0, '←'],
      [0.5, 0, '→'],
      [0, -0.5, '↑'],
      [0, 0.5, '↓'],
    ]
      .map(([x, z, n]) =>
        button(
          String(n),
          'nudge',
          `data-value="${x},${z}" aria-label="Move selection ${n}"`,
          this.lifting ||
            Boolean(this.draft) ||
            (!this.selected && !this.drawing),
        ),
      )
      .join(
        '',
      )}${this.mode === 'spaces' ? '' : button('Rotate ↻', 'rotate', '', !this.selected || this.lifting)}</div>`;
    sidebar.querySelector('.build-list')!.scrollTop = old;
    if (focused?.build) {
      const target = [
        ...sidebar.querySelectorAll<HTMLButtonElement>('[data-build]'),
      ].find((b) =>
        ['build', 'id', 'recipe', 'value'].every(
          (key) => b.dataset[key] === focused[key],
        ),
      );
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
    document.getElementById('scene-title')!.innerHTML =
      `<span class="eyebrow">BUILD MODE</span><h2>${this.mode === 'spaces' ? 'Build spaces' : 'Place furniture'}</h2>`;
    document.getElementById('scene-goal')!.innerHTML = '';
    document.getElementById('scene-caption')!.innerHTML = '';
    document.getElementById('zones')!.innerHTML = '';
    document.getElementById('precision')!.innerHTML = '';
    document.getElementById('stage-footer')!.innerHTML =
      `<div class="build-actions">${button('Whole plot', 'plot')}${this.mode === 'spaces' && !this.prefab && this.tool !== 'erase' && this.tool !== 'door' ? '' : button(this.placeLabel(), 'place', '', this.placeDisabled())}${this.mode === 'items' ? button('Store', 'store', '', !this.selected || this.lifting) : ''}${button('Cancel', 'cancel')}${button('Done', 'done')}</div>`;
  }
}
