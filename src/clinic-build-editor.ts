import * as THREE from 'three';
import type { World } from './world';
import type { TownSimulation } from './town-simulation';
import type { Progress } from './game';
import {
  buildRecipes,
  furnitureType,
  floorPrice,
  floorRectangle,
  toClinic,
  type Placement,
  type FloorCell,
} from './clinic-build';
import { nearestWall, wallKey, type WallEdge } from './clinic-spaces';
import { catalogueImage } from './catalogue';
import type { Point } from './town-map';
import { shelterTrees } from './town-weather';

/** The editor pauses town time; only safe unloading runs while an item is lifted. */
export class ClinicBuildEditor {
  active = false;
  private tool: 'items' | 'camera' | 'door' | FloorCell['surface'] | 'erase' =
    'items';
  private selected?: string;
  private lifting = false;
  private ghost?: THREE.Group;
  private cursor: Placement = { x: 0, z: 1, rotation: 0 };
  private corner?: Point;
  private draft?: {
    start: Point;
    end: Point;
    surface: FloorCell['surface'] | 'erase';
  };
  private doorway?: WallEdge;
  private enclosed = true;
  private removeWall = false;
  private filter = 'all';
  private message = 'Choose furniture to move, or build some new space.';
  private error?: string;
  private lastHover = 0;
  private press?: {
    id: number;
    x: number;
    y: number;
    cursor: Placement;
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
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.active || this.tool === 'camera' || e.button !== 0) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        // Drawing owns one pointer. A second finger cancels the stroke rather
        // than handing half a gesture to OrbitControls or buying accidental floor.
        if (this.press) {
          this.cancelPress();
          return;
        }
        if (!e.isPrimary || this.lifting) return;
        const p = world.buildHit(e.clientX, e.clientY, false).point;
        if (!p) return;
        this.press = {
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          cursor: { ...this.cursor },
          corner: this.corner ? { ...this.corner } : undefined,
          dragged: false,
        };
        canvas.setPointerCapture(e.pointerId);
        this.moveCursor(p);
        if (this.drawing && !this.draft) this.corner ??= this.cell();
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
            Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 8;
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
        if (this.draft || this.tool === 'door') {
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
        else this.render(); // First tap anchors the rectangle; the second plans it.
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
      if (e.key.toLowerCase() === 'r' && this.selected) {
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
    if (action === 'pick') this.pick(b.dataset.id!);
    else if (action === 'move') {
      const placed = this.sim.build
        .copies(b.dataset.recipe!)
        .filter((i) => i.placement);
      const next =
        placed[
          (placed.findIndex((i) => i.id === this.selected) + 1) % placed.length
        ];
      if (next) {
        this.world.focusBuildItem(next.id);
        this.pick(next.id);
      }
    } else if (action === 'filter') {
      this.filter = b.dataset.value!;
      this.render();
    } else if (action === 'tool' || action === 'kit') {
      const next = b.dataset.value as typeof this.tool;
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
              : 'Draw a rectangle. Then choose its entrance and confirm.';
      this.preview();
      this.render();
      if (next !== 'camera' || !this.draft)
        document.querySelector('.build-list')!.scrollTop = 0;
    } else if (action === 'boundary') {
      this.enclosed = b.dataset.value === 'enclosed';
      this.doorway = undefined;
      this.preview();
      this.render();
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
    else if (action === 'cancel') {
      this.cancel();
      if (this.tool === 'door') this.preview();
      this.render();
    } else if (action === 'store') this.store();
    else if (action === 'done') this.exit();
    else if (action === 'shop') {
      this.cancel();
      this.shop();
    } else if (action === 'plot') this.world.focusBuildPlot();
    else if (action === 'nudge') {
      const [dx, dz] = b.dataset.value!.split(',').map(Number);
      const scale = this.tool === 'items' ? 1 : 2;
      this.cursor.x += dx * scale;
      this.cursor.z += dz * scale;
      this.preview();
    }
  }
  private moveCursor(point: Point) {
    const step = this.tool === 'items' ? 2 : 1;
    const x = Math.round(point.x * step) / step,
      z = Math.round(point.z * step) / step;
    const changed = x !== this.cursor.x || z !== this.cursor.z;
    this.cursor = { x, z, rotation: this.cursor.rotation };
    return changed;
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
    this.corner = press.corner;
    this.error = undefined;
    if (this.selected || this.corner) this.preview();
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
  cancel() {
    this.releasePress();
    this.clearGhost();
    if (this.selected) {
      const model = this.world.town!.furniture.itemModels.get(this.selected);
      if (model)
        model.visible = Boolean(this.sim.build.placement(this.selected));
    }
    this.selected = undefined;
    this.lifting = false;
    this.corner = undefined;
    this.draft = undefined;
    this.doorway = undefined;
    this.error = undefined;
    this.sim.leisure.endMove();
    this.world.town!.furniture.scenery.hidePreview();
    this.message = 'Choose furniture to move, or build some new space.';
  }
  private rotate() {
    this.cursor.rotation = (this.cursor.rotation + Math.PI / 2) % (Math.PI * 2);
    this.preview();
    this.render();
  }
  private cell() {
    return { x: Math.round(this.cursor.x), z: Math.round(this.cursor.z) };
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
      end: this.cell(),
      surface: this.tool as FloorCell['surface'] | 'erase',
    };
    this.doorway = undefined;
    this.preview();
    this.render();
    document.querySelector('.build-list')!.scrollTop = 0;
  }
  private floor(start: Point, end: Point, apply = false) {
    const { from: a, to: b } = floorRectangle(start, end);
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
    const surface =
      this.draft?.surface ?? (this.tool as FloorCell['surface'] | 'erase');
    if (surface !== 'erase') {
      // A suggested opening previews feasibility; the player must choose one
      // explicitly before committing an enclosed room or garden.
      const door =
        this.doorway ??
        (!apply && this.enclosed
          ? this.sim.build.doorOptions(start, end)[0]
          : undefined);
      return this.sim.build.space(
        start,
        end,
        surface,
        this.enclosed,
        door,
        this.progress.coins,
        this.actors(),
        apply,
      );
    }
    return this.sim.build.floor(
      a,
      b,
      surface,
      this.progress.coins,
      this.actors(),
      apply,
    );
  }
  private preview() {
    if (this.lifting) return;
    const scenery = this.world.town!.furniture.scenery;
    if (this.selected) {
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
    } else if (this.draft || this.drawing) {
      const a = this.draft?.start ?? this.corner ?? this.cell(),
        b = this.draft?.end ?? this.cell();
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
      const chooseDoor =
        this.draft && surface !== 'erase' && this.enclosed && !this.doorway;
      this.message = `${width} × ${depth} tiles · ${result.cost} coins. ${this.draft ? (chooseDoor ? 'Choose an entrance.' : 'Ready to confirm.') : this.corner ? (this.press ? 'Release to plan.' : 'Choose the opposite corner.') : 'Draw a rectangle.'}`;
      scenery.showDoorHints(
        this.draft && surface !== 'erase' ? this.doorOptions() : [],
        this.doorway,
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
      (this.draft
        ? this.draft.surface !== 'erase' && this.enclosed && !this.doorway
        : this.tool === 'door'
          ? !this.doorway
          : this.tool === 'camera' || (this.tool === 'items' && !this.selected))
    );
  }
  private placeLabel() {
    if (this.selected) return 'Place item';
    if (this.draft)
      return this.draft.surface === 'erase' ? 'Remove floor' : 'Build space';
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
    } else if (this.draft) {
      const result = this.floor(this.draft.start, this.draft.end, true);
      if (result.error) {
        this.error = result.error;
        this.render();
        return;
      }
      const erased = this.draft.surface === 'erase';
      this.progress.coins -= result.cost;
      this.cancel();
      this.afterChange(
        erased
          ? 'Floor removed. Your items are safe in the clinic or collection.'
          : 'Your new space is ready. Choose Furniture to make it yours!',
      );
    } else if (this.tool === 'door' && this.doorway) {
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
  private afterChange(message: string) {
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
    if (!this.drawing && !this.draft && this.tool !== 'door') return undefined;
    const surface = this.draft?.surface ?? this.tool;
    const options = this.doorOptions();
    const entrance = button(
      this.doorway ? 'Next entrance' : 'Suggested door',
      'next-door',
      '',
      !options.length,
    );
    if (surface === 'door')
      return `<section class="space-guide"><h3>Make a way through</h3><div class="space-options">${button('Doorways', 'door-mode', `data-value="door" aria-pressed="${!this.removeWall}"`)}${button('Remove wall', 'door-mode', `data-value="wall" aria-pressed="${this.removeWall}"`)}</div><p>Tap a blue wall frame, or choose a suggestion.</p>${entrance}<p>Confirm below to change this entrance. Doorways cost no extra coins. Keep a clear way into every space.</p><p>The front door and examination route stay in place.</p></section>`;
    const erase = surface === 'erase',
      garden = surface === 'garden';
    const boundaries = !erase
      ? `<div class="space-options">${button(garden ? 'Picket fence' : 'With walls', 'boundary', `data-value="enclosed" aria-pressed="${this.enclosed}"`)}${button('Open space', 'boundary', `data-value="open" aria-pressed="${!this.enclosed}"`)}</div>`
      : '';
    if (this.draft)
      return `<section class="space-guide"><h3>${erase || !this.enclosed ? '2. Check your plan' : '2. Choose an entrance'}</h3><div class="space-options">${!erase ? entrance : ''}${button('Redraw', 'redraw')}</div><p>${erase ? 'Check the marked floor before removing it.' : this.enclosed ? 'Blue frames join the clinic. Tap one or choose a suggestion; green marks your entrance.' : 'Open space joins the existing floor. Add a door if a wall blocks the way.'}</p>${boundaries}<p><strong>3. ${erase ? 'Remove floor' : 'Build space'}</strong> confirms the plan. Cancel keeps your coins.</p></section>`;
    return `<section class="space-guide"><h3>1. Draw your space</h3>${boundaries}<p>Drag between grid corners, or tap two corners. Draw beside existing floor.</p><div class="space-example" data-surface="${surface}" aria-hidden="true"><span></span></div><p>${erase ? 'Remove empty floor. Move furniture and let people step clear first.' : garden ? 'A garden for rides, toys, bowls or a peaceful seat. Furnish it however you like.' : 'A lounge, pet playroom or your own idea. Furniture gives the room its purpose.'}</p><p>Release to plan. Nothing is built until you confirm.</p></section>`;
  }

  render() {
    if (!this.active) return;
    const sidebar = document.getElementById('sidebar')!,
      old = sidebar.querySelector('.build-list')?.scrollTop ?? 0;
    const focused = sidebar.contains(document.activeElement)
      ? { ...(document.activeElement as HTMLElement).dataset }
      : undefined;
    const cards = buildRecipes.filter((r) => {
      if (furnitureType(r.id) !== r.id || !this.sim.build.copies(r.id).length)
        return false;
      return (
        this.filter === 'all' ||
        (this.filter === 'stored' &&
          this.sim.build.copies(r.id).some((i) => !i.placement)) ||
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
    // Keep catalogue order within each group so buying extra copies does not
    // shuffle available types. Owned types with every copy placed follow them.
    cards.sort(
      (a, b) =>
        Number(this.sim.build.copies(b.id).some((i) => !i.placement)) -
        Number(this.sim.build.copies(a.id).some((i) => !i.placement)),
    );
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
          placed = copies.length - stored.length,
          selected = copies.some((i) => i.id === this.selected),
          next = stored.find((i) => i.id === this.selected) ?? stored[0];
        return `<article class="build-card" data-recipe="${r.id}" data-available="${stored.length}" data-selected="${selected}">
        ${button(`${catalogueImage(r.id)}<span class="build-card-text"><strong>${r.name}</strong><span class="build-available">${stored.length} available</span><small>${placed} placed${stored.length ? ' · Place one' : ' · Buy in Shop'}</small></span>`, 'pick', `data-id="${next?.id ?? r.id}" aria-pressed="${Boolean(next && next.id === this.selected)}"`, !stored.length || this.lifting)}
        ${placed ? button('Move placed' + (placed > 1 ? ' · Next copy' : ''), 'move', `data-recipe="${r.id}" aria-label="Move placed ${r.name}"`, this.lifting) : ''}
      </article>`;
      })
      .join('');
    // Floor kits lead every filter while any of their shared allowance remains.
    // They open the existing drawing tools; rooms are not movable furniture.
    const rooms = this.sim.build.unusedRoomKits
      .map(
        (
          room,
        ) => `<article class="build-card build-room-kit" data-kit="${room.id}">
        ${button(`${catalogueImage(room.id)}<span class="build-card-text"><strong>${room.name}</strong><span class="build-available">${room.credits} floor tiles available</span><small>Draw a ${room.surface === 'garden' ? 'garden' : 'room'}</small></span>`, 'kit', `data-id="${room.id}" data-value="${room.surface}"`)}
      </article>`,
      )
      .join('');
    sidebar.setAttribute('aria-label', 'Build collection');
    sidebar.innerHTML = `<div class="build-heading"><h2>Build your clinic</h2>${button('Shop', 'shop')}</div><nav class="build-tools" aria-label="Build tools">${[
      ['items', 'Furniture'],
      ['room', 'Room'],
      ['garden', 'Garden'],
      ['door', 'Doors'],
      ['erase', 'Erase'],
      ['camera', 'Camera'],
    ]
      .map(([v, n]) =>
        button(
          n,
          'tool',
          `data-value="${v}" aria-pressed="${this.tool === v}"`,
        ),
      )
      .join(
        '',
      )}</nav><p class="build-price">${this.progress.coins} coins · ${this.sim.build.state.credits} free floor tiles · then ${floorPrice} coins/tile</p><nav class="build-filters" aria-label="Collection filters" ${this.drawing || this.draft || this.tool === 'door' ? 'hidden' : ''}>${[
      ['all', 'All'],
      ['stored', 'Available'],
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
      )}</nav><div class="build-list" tabindex="0" aria-label="Build collection">${this.spaceGuide(button) ?? (rooms + collection || '<p>No spare items here yet. Buy a copy in Shop, or store something from the clinic.</p>')}</div><p id="build-feedback" role="status">${this.error ?? this.message}</p><div class="build-nudges" aria-label="Position selected item" ${this.draft || this.tool === 'door' ? 'hidden' : ''}>${[
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
      )}${this.drawing ? '' : button('Rotate ↻', 'rotate', '', !this.selected || this.lifting)}</div>`;
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
      '<span class="eyebrow">BUILD MODE</span><h2>Make room for happy paws</h2>';
    document.getElementById('scene-goal')!.innerHTML = '';
    document.getElementById('scene-caption')!.innerHTML = '';
    document.getElementById('zones')!.innerHTML = '';
    document.getElementById('precision')!.innerHTML = '';
    document.getElementById('stage-footer')!.innerHTML =
      `<div class="build-actions">${button('Whole plot', 'plot')}${button(this.placeLabel(), 'place', '', this.placeDisabled())}${this.drawing || this.draft || this.tool === 'door' ? '' : button('Store', 'store', '', !this.selected || this.lifting)}${button('Cancel', 'cancel')}${button('Done', 'done')}</div>`;
  }
}
