// Ícones do Primárias no mesmo traço dos do Tempos & Métodos (grid 24, 1.8px).
import { icon as base } from '../../../src/utils/icons.js';

const s = (inner, size = 20, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;

export const ic = {
  ...base,
  // etapas
  andaime: (sz) => s('<path d="M5 3v18M19 3v18M5 8h14M5 14h14M5 8l14 6M19 8 5 14"/><path d="M3 21h18"/>', sz),
  demolicao: (sz) => s('<path d="M14.5 4.5 19.5 9.5 17 12l-5-5z"/><path d="M14.7 9.8 5 19.5a1.4 1.4 0 0 1-2-2l9.7-9.7"/><path d="M19 15l1.5 1.5M16.5 17.5 18 19M21 12h1.5"/>', sz),
  sopragem: (sz) => s('<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12h15.5a2.5 2.5 0 1 1-2.5 2.5"/><path d="M3 16h7"/>', sz),
  assentamento: (sz) => s('<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="15" width="18" height="5" rx="1"/><path d="M8 9v6M16 9v6M12 4v5M12 15v5"/>', sz),
  siplate: (sz) => s('<path d="M4 20c3-1 5-3 6-6l4-4"/><path d="m13 7 4 4"/><path d="M17 3l4 4-3 3-4-4z"/><path d="M4 14c1.5.5 2.5 1.5 3 3"/>', sz),
  massa1200: (sz) => s('<path d="M12 3c.5 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1.5-4.5C10.5 9 12 7 12 3z"/><path d="M12 20.5V22M6.5 19.5l-1 1M17.5 19.5l1 1"/>', sz),
  // navegação e coisas do app
  chama: (sz) => s('<path d="M12 2.5c1 3.5 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.3 2.4-6.3.5 1.5 1.4 2.4 2.4 2.8C11.7 7.5 12.3 5 12 2.5z"/>', sz),
  casa: (sz) => s('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>', sz),
  mapa: (sz) => s('<rect x="3" y="4" width="7" height="16" rx="1.2"/><rect x="14" y="4" width="7" height="16" rx="1.2"/><path d="M3 9h7M3 14h7M14 9h7M14 14h7"/>', sz),
  prancheta: (sz) => s('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m8.5 11 1.5 1.5 3-3M8.5 16.5 10 18l3-3"/>', sz),
  diario: (sz) => s('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/>', sz),
  curva: (sz) => s('<path d="M3 20h18"/><path d="M4 18c4 0 5-3 7-7s3-6 9-7"/>', sz),
  pessoa: (sz) => s('<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>', sz),
  medalha: (sz) => s('<circle cx="12" cy="15" r="5.5"/><path d="M8.5 3h7l-2 6.8M10.5 9.8 8.5 3"/><path d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>', sz),
  pedido: (sz) => s('<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10h6"/>', sz),
  som: (sz) => s('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>', sz),
  semSom: (sz) => s('<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>', sz),
  olho: (sz) => s('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>', sz),
  engrenagem: (sz) => s('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1"/>', sz),
  imprimir: (sz) => s('<path d="M7 9V3h10v6"/><rect x="3.5" y="9" width="17" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>', sz)
};

export const iconeEtapa = (id, sz) => ic[id](sz);
