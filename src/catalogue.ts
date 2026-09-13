import { furnitureType } from './clinic-build';

/** Static portraits of the actual game models; no extra WebGL contexts in menus. */
export function catalogueImage(id: string) {
  return `<img class="catalogue-image" src="/images/catalogue/${furnitureType(id)}.webp" alt="" width="256" height="256" loading="lazy" decoding="async">`;
}
