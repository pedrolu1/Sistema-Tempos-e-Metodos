const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export { DIAS, DIAS_LONGOS, MESES };

export function hora(d) {
  const x = new Date(d);
  return `${String(x.getHours()).padStart(2, '0')}h${x.getMinutes() ? String(x.getMinutes()).padStart(2, '0') : ''}`;
}

export function mesmoDia(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

export function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function inicioDaSemana(d) {
  const x = inicioDoDia(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function somaDias(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// "hoje às 19h", "amanhã às 12h30", "qui, 3 out às 18h"
export function quando(d) {
  const x = new Date(d);
  const hoje = new Date();
  if (mesmoDia(x, hoje)) return `hoje às ${hora(x)}`;
  if (mesmoDia(x, somaDias(hoje, 1))) return `amanhã às ${hora(x)}`;
  if (mesmoDia(x, somaDias(hoje, -1))) return `ontem às ${hora(x)}`;
  return `${DIAS[x.getDay()]}, ${x.getDate()} ${MESES[x.getMonth()]} às ${hora(x)}`;
}

export function dataCurta(d) {
  const x = new Date(d);
  return `${x.getDate()} ${MESES[x.getMonth()]}`;
}

export function haQuanto(d) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 10) return 'agora';
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h}h`;
  const dd = Math.round(h / 24);
  return `há ${dd} ${dd === 1 ? 'dia' : 'dias'}`;
}

export function faltaQuanto(d) {
  const s = Math.round((new Date(d).getTime() - Date.now()) / 1000);
  if (s <= 0) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 1) return `em ${s}s`;
  if (m < 60) return `em ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `em ${h}h${m % 60 ? ` ${m % 60}min` : ''}`;
  const dd = Math.round(h / 24);
  return `em ${dd} ${dd === 1 ? 'dia' : 'dias'}`;
}

export function compacto(n) {
  if (n == null || Number.isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} mi`;
  if (abs >= 10_000) return `${Math.round(n / 1000)} mil`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} mil`;
  return String(Math.round(n));
}

export function pct(n, casas = 1) {
  return `${(n * 100).toFixed(casas).replace('.', ',')}%`;
}
