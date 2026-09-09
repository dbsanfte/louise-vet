const paths: Record<string, string> = {
  paw: '<ellipse cx="12" cy="16" rx="6" ry="4.5"/><ellipse cx="4.5" cy="9" rx="2.5" ry="3"/><ellipse cx="9.5" cy="5.5" rx="2.4" ry="3"/><ellipse cx="15.5" cy="5.5" rx="2.4" ry="3"/><ellipse cx="20" cy="10" rx="2.3" ry="3"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
  home: '<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8"/>',
  bag: '<path d="M4 7h16l1 14H3L4 7Zm4 0V5a4 4 0 0 1 8 0v2"/>',
  book: '<path d="M12 5C8 2 3 3 3 3v17s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Zm0 0v17"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1.5 1.5m13 13L20 20M4 20l1.5-1.5m13-13L20 4"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  stethoscope:
    '<path d="M5 3H3v6a5 5 0 0 0 10 0V3h-2M8 14v3a5 5 0 0 0 10 0v-2"/><circle cx="18" cy="12" r="3"/>',
  scan: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M6 12h12m-9-6v12m6-12v12"/>',
  drop: '<path d="M12 2S4 11 4 15a8 8 0 0 0 16 0C20 11 12 2 12 2Z"/>',
  jar: '<path d="M7 3h10v4H7V3ZM5 9h14v12H5V9Zm3 6h8m-4-3v6"/>',
  bandage:
    '<path d="m5 3 16 16-2 2L3 5l2-2Zm9 0 7 7M3 14l7 7"/><path d="m9 10 1-1m4 6 1-1"/>',
  comb: '<path d="M4 3h16v5H4V3Zm1 5v13m4-13v13m4-13v13m4-13v13m3-13v13"/>',
  leaf: '<path d="M20 3C3 1 1 12 7 17s16 1 13-14ZM4 21 16 8"/>',
  chair: '<path d="M5 12V3h14v9M3 12h18v5H3v-5Zm3 5v5m12-5v5"/>',
  megaphone: '<path d="m3 9 17-6v16L3 13V9Zm3 5 2 7h4l-2-6"/>',
  sound:
    '<path d="M3 9h4l5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  mute: '<path d="M3 9h4l5-5v16l-5-5H3V9Zm13 0 6 6m-6 0 6-6"/>',
  rotate: '<path d="M3 10a9 9 0 1 1 1 7M3 3v7h7"/>',
  star: '<path d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3m0 3v.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
};
export function icon(name: string, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="${name === 'paw' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.paw}</svg>`;
}
export function petIcon(species: string) {
  if (species === 'bird')
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20C2 13 5 4 13 4c4 0 6 4 5 7l4 2-5 2c-1 5-5 7-10 5Z" fill="currentColor"/><path d="M8 12q0 6 6 4M9 20l-1 3m5-3 1 3" fill="none" stroke="white"/><circle cx="15" cy="8" r="1.4" fill="white"/></svg>';
  const ears =
    species === 'rabbit'
      ? '<ellipse cx="8" cy="6" rx="2" ry="6"/><ellipse cx="16" cy="6" rx="2" ry="6"/>'
      : species === 'cat'
        ? '<path d="m4 12 1-9 7 5 7-5 1 9Z"/>'
        : '<ellipse cx="5" cy="10" rx="3" ry="5"/><ellipse cx="19" cy="10" rx="3" ry="5"/>';
  if (species === 'goldfish')
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 5 3c4-7 13-4 13 2s-9 9-13 2l-5 3Z" fill="currentColor"/><circle cx="17" cy="11" r="1" fill="white"/></svg>';
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor">${ears}<ellipse cx="12" cy="14" rx="8" ry="7"/></g><circle cx="9" cy="13" r="1" fill="white"/><circle cx="15" cy="13" r="1" fill="white"/><path d="m10 17 2 1 2-1" fill="none" stroke="white" stroke-linecap="round"/></svg>`;
}
