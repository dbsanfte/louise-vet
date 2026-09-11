import type { ClinicInfo } from './clinic-identity';

export const clinicInspectionSlot = `<section class="clinic-inspection" role="status" aria-label="In the clinic" hidden><button class="icon-button" data-action="close-inspection" aria-label="Close clinic info">×</button><strong class="inspection-name"></strong><span class="inspection-description"></span><p class="inspection-feeling"></p></section>`;

/** Share the existing list space, so looking never moves the camera or controls. */
export function renderClinicInspection(root: HTMLElement, info?: ClinicInfo) {
  for (const card of root.querySelectorAll<HTMLElement>('.clinic-inspection')) {
    card.hidden = !info;
    card.parentElement!.classList.toggle('inspecting', Boolean(info));
    for (const [selector, value] of [
      ['.inspection-name', info?.name],
      ['.inspection-description', info?.description],
      ['.inspection-feeling', info?.feeling],
    ]) {
      const field = card.querySelector<HTMLElement>(selector!)!;
      if (field.textContent !== (value ?? '')) field.textContent = value ?? '';
      field.hidden = !value;
    }
  }
}
