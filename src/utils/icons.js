// Conjunto de ícones próprio (stroke, 1.8px, grid 24) — mantém o app leve e
// consistente sem depender de uma biblioteca externa de ícones. Só ficam
// aqui os ícones realmente usados na interface.
const s = (inner, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const icon = {
  clock: (sz) => s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>', sz),
  plus: (sz) => s('<path d="M12 5v14M5 12h14"/>', sz),
  check: (sz) => s('<path d="M20 6 9 17l-5-5"/>', sz),
  x: (sz) => s('<path d="M18 6 6 18M6 6l12 12"/>', sz),
  users: (sz) => s('<path d="M17 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 5 18.5V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17.5 20v-1.5a3.5 3.5 0 0 0-2.3-3.29"/><path d="M14.3 4.2a3.5 3.5 0 0 1 0 6.6"/>', sz),
  list: (sz) => s('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>', sz),
  sync: (sz) => s('<path d="M21 12a9 9 0 0 1-15.3 6.4M3 12a9 9 0 0 1 15.3-6.4"/><path d="M21 4v5h-5M3 20v-5h5"/>', sz),
  grid: (sz) => s('<rect x="4" y="4" width="7" height="7" rx="1.4"/><rect x="13" y="4" width="7" height="7" rx="1.4"/><rect x="4" y="13" width="7" height="7" rx="1.4"/><rect x="13" y="13" width="7" height="7" rx="1.4"/>', sz),
  logout: (sz) => s('<path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>', sz),
  download: (sz) => s('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>', sz),
  alert: (sz) => s('<path d="M12 3 22 20H2z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none"/>', sz),
  wifiOff: (sz) => s('<path d="M3 3l18 18"/><path d="M5 12.9a13 13 0 0 1 3.5-2.3M16 10.6a13 13 0 0 1 4.5 2.3M8.5 15.8a7.5 7.5 0 0 1 7-.1M12 19.5v.01"/>', sz),
  search: (sz) => s('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', sz),
  fileText: (sz) => s('<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8.5 13h7M8.5 16.5h7M8.5 9.5h3"/>', sz),
  fileSpreadsheet: (sz) => s('<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M8 12.5h8M8 16h8M11 12.5v6.5"/>', sz),
  fileWord: (sz) => s('<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M7.5 12.5l1.3 6 1.7-4.5 1.7 4.5 1.3-6"/>', sz),
  edit: (sz) => s('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', sz),
  trash: (sz) => s('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>', sz),
  briefcase: (sz) => s('<rect x="3" y="7.5" width="18" height="12" rx="1.6"/><path d="M8 7.5V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>', sz),
  arrowUp: (sz) => s('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>', sz),
  arrowDown: (sz) => s('<path d="M12 5v14"/><path d="M18 13l-6 6-6-6"/>', sz),
  bolt: (sz) => s('<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>', sz),
  crew: (sz) => s('<path d="M4 15.5a8 8 0 0 1 16 0"/><path d="M2 15.5h20"/><circle cx="12" cy="7" r="2.3"/>', sz),
  building: (sz) => s('<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-3h4v3"/>', sz),
  upload: (sz) => s('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 21h14"/>', sz),
  target: (sz) => s('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>', sz),
  folder: (sz) => s('<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', sz),
  arrowLeft: (sz) => s('<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>', sz),
  calendar: (sz) => s('<rect x="3.5" y="5" width="17" height="15.5" rx="1.8"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', sz),
  shield: (sz) => s('<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>', sz),
  more: (sz) => s('<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>', sz),
  lightbulb: (sz) => s('<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>', sz)
};
