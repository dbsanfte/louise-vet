import * as THREE from 'three';
import type { World } from './world';
import type { TownSimulation } from './town-simulation';
import type { Progress } from './game';
import {
  floorPrice,
  toClinic,
  type Placement,
  type FloorCell,
} from './clinic-build';
import type { Point } from './town-map';
import { shelterTrees } from './town-weather';

/** The editor pauses town time; only safe unloading runs while an item is lifted. */
export class ClinicBuildEditor {
  active = false;
  private tool: 'items' | 'camera' | FloorCell['surface'] | 'erase' = 'items';
  private selected?: string;
  private lifting = false;
  private ghost?: THREE.Group;
  private cursor: Placement = { x: 0, z: 1, rotation: 0 };
  private corner?: Point;
  private filter = 'all';
  private message = 'Choose furniture to move, or build some new space.';
  private error?: string;
  private lastHover = 0;
  constructor(
    private world: World,
    private sim: TownSimulation,
    private progress: Progress,
    private changed: () => void,
    private close: () => void,
    private shop: () => void,
  ) {
    const canvas = world.buildCanvas;
    const hit = (e: PointerEvent) => world.buildHit(e.clientX, e.clientY);
    let press: { x: number; y: number; cell?: Point } | undefined;
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.active || this.tool === 'camera' || e.button !== 0) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const p = hit(e).point;
        press = {
          x: e.clientX,
          y: e.clientY,
          cell: p ? { x: Math.floor(p.x), z: Math.floor(p.z) } : undefined,
        };
        canvas.setPointerCapture(e.pointerId);
      },
      { capture: true },
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (!this.active || this.tool === 'camera') return;
        if (e.buttons & 2) return;
        e.stopImmediatePropagation();
        if (performance.now() - this.lastHover < 90) return;
        this.lastHover = performance.now();
        const p = hit(e).point;
        if (p && !this.lifting) {
          this.cursor = {
            x: Math.round(p.x * 2) / 2,
            z: Math.round(p.z * 2) / 2,
            rotation: this.cursor.rotation,
          };
          this.preview();
        }
      },
      { capture: true },
    );
    canvas.addEventListener(
      'pointerup',
      (e) => {
        if (!this.active || this.tool === 'camera' || e.button !== 0) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!press) return;
        const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
        if (moved > 8 && this.tool !== 'items' && !this.corner)
          this.corner = press.cell;
        press = undefined;
        const h = hit(e);
        if (h.point)
          this.cursor = {
            x: Math.round(h.point.x * 2) / 2,
            z: Math.round(h.point.z * 2) / 2,
            rotation: this.cursor.rotation,
          };
        if (moved > 8 && this.tool === 'items') return;
        if (this.tool === 'items' && !this.selected && h.id) this.pick(h.id);
        else this.place();
      },
      { capture: true },
    );
    canvas.addEventListener(
      'pointercancel',
      () => {
        press = undefined;
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
    else if (action === 'filter') {
      this.filter = b.dataset.value!;
      this.render();
    } else if (action === 'tool') {
      this.cancel();
      this.tool = b.dataset.value as typeof this.tool;
      this.message =
        this.tool === 'items'
          ? 'Pick furniture in the clinic or from your collection.'
          : this.tool === 'camera'
            ? 'Drag to look around. Use arrows to move and scroll or pinch to zoom.'
            : 'Tap one corner, move to the opposite corner, then tap again to build.';
      this.render();
    } else if (action === 'rotate') this.rotate();
    else if (action === 'place') this.place();
    else if (action === 'cancel') {
      this.cancel();
      this.render();
    } else if (action === 'store') this.store();
    else if (action === 'done') this.exit();
    else if (action === 'shop') {
      this.cancel();
      this.shop();
    } else if (action === 'plot') this.world.focusBuildPlot();
    else if (action === 'nudge') {
      const [dx, dz] = b.dataset.value!.split(',').map(Number);
      this.cursor.x += dx;
      this.cursor.z += dz;
      this.preview();
    }
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
    this.message = 'Choose a spot. Rotate with R or the Rotate button.';
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
    this.clearGhost();
    if (this.selected) {
      const model = this.world.town!.furniture.itemModels.get(this.selected);
      if (model)
        model.visible = Boolean(this.sim.build.placement(this.selected));
    }
    this.selected = undefined;
    this.lifting = false;
    this.corner = undefined;
    this.error = undefined;
    this.sim.leisure.endMove();
    this.world.town!.furniture.scenery.preview.visible = false;
    this.message = 'Choose furniture to move, or build some new space.';
  }
  private rotate() {
    this.cursor.rotation = (this.cursor.rotation + Math.PI / 2) % (Math.PI * 2);
    this.preview();
    this.render();
  }
  private cell() {
    return { x: Math.floor(this.cursor.x), z: Math.floor(this.cursor.z) };
  }
  private floor(a: Point, b: Point, apply = false) {
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
    return this.sim.build.floor(
      a,
      b,
      this.tool as FloorCell['surface'] | 'erase',
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
    } else if (['room', 'garden', 'erase'].includes(this.tool)) {
      const a = this.corner ?? this.cell(),
        b = this.cell();
      const result = this.floor(a, b);
      this.error = result.error;
      scenery.showPreview(
        (a.x + b.x + 1) / 2,
        (a.z + b.z + 1) / 2,
        Math.abs(a.x - b.x) + 1,
        Math.abs(a.z - b.z) + 1,
        0,
        !this.error,
      );
      this.message = this.corner
        ? `${Math.abs(a.x - b.x) + 1} × ${Math.abs(a.z - b.z) + 1} tiles · ${result.cost} coins. Choose Build space to confirm.`
        : 'Tap the first corner of your new space.';
    }
    const status = document.getElementById('build-feedback');
    if (status) status.textContent = this.error ?? this.message;
    const button = document.querySelector<HTMLButtonElement>(
      '[data-build="place"]',
    );
    if (button) button.disabled = Boolean(this.error || this.lifting);
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
    } else if (['room', 'garden', 'erase'].includes(this.tool)) {
      if (!this.corner) {
        this.corner = this.cell();
        this.preview();
        this.render();
        return;
      }
      const result = this.floor(this.corner, this.cell(), true);
      if (result.error) {
        this.error = result.error;
        this.render();
        return;
      }
      this.progress.coins -= result.cost;
      this.corner = undefined;
      this.afterChange(
        this.tool === 'erase'
          ? 'Floor removed. Your items are safe in the clinic or collection.'
          : 'Your new space is ready. Add something cosy!',
      );
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
    this.world.town!.furniture.scenery.preview.visible = false;
    this.render();
  }
  render() {
    if (!this.active) return;
    const sidebar = document.getElementById('sidebar')!,
      old = sidebar.querySelector('.build-list')?.scrollTop ?? 0;
    const items = this.sim.build.items.filter((i) => {
      const r = this.sim.build.recipe(i.id);
      return (
        this.filter === 'all' ||
        (this.filter === 'stored' && !i.placement) ||
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
    sidebar.setAttribute('aria-label', 'Build collection');
    sidebar.innerHTML = `<div class="build-heading"><h2>Build your clinic</h2>${button('Shop', 'shop')}</div><nav class="build-tools" aria-label="Build tools">${[
      ['items', 'Furniture'],
      ['room', 'Room'],
      ['garden', 'Garden'],
      ['erase', 'Remove floor'],
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
      )}</nav><p class="build-price">${this.progress.coins} coins · ${this.sim.build.state.credits} free floor tiles · then ${floorPrice} coins/tile</p><nav class="build-filters" aria-label="Collection filters">${[
      ['all', 'All'],
      ['stored', 'Stored'],
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
      )}</nav><div class="build-list">${items.map((i) => button(`<strong>${this.sim.build.recipe(i.id).name}</strong><small>${i.placement ? 'Placed · pick up' : 'Stored · place'}</small>`, 'pick', `data-id="${i.id}" aria-pressed="${this.selected === i.id}"`, this.lifting)).join('') || '<p>Buy more lovely things in the shop.</p>'}</div><p id="build-feedback" role="status">${this.error ?? this.message}</p><div class="build-nudges" aria-label="Position selected item">${[
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
            (!this.selected &&
              !['room', 'garden', 'erase'].includes(this.tool)),
        ),
      )
      .join(
        '',
      )}${button('Rotate ↻', 'rotate', '', !this.selected || this.lifting)}</div>`;
    sidebar.querySelector('.build-list')!.scrollTop = old;
    document.getElementById('scene-title')!.innerHTML =
      '<span class="eyebrow">BUILD MODE</span><h2>Make room for happy paws</h2>';
    document.getElementById('scene-goal')!.innerHTML = '';
    document.getElementById('scene-caption')!.innerHTML = '';
    document.getElementById('zones')!.innerHTML = '';
    document.getElementById('precision')!.innerHTML = '';
    document.getElementById('stage-footer')!.innerHTML =
      `<div class="build-actions">${button('Whole plot', 'plot')}${button(this.selected ? 'Place item' : this.tool === 'items' || this.tool === 'camera' ? 'Choose item' : this.corner ? (this.tool === 'erase' ? 'Remove floor' : 'Build space') : 'First corner', 'place', '', this.lifting || Boolean(this.error) || this.tool === 'camera' || (this.tool === 'items' && !this.selected))}${button('Store', 'store', '', !this.selected || this.lifting)}${button('Cancel', 'cancel')}${button('Done', 'done')}</div>`;
  }
}
