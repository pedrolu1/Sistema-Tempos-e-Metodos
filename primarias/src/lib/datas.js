// Datas sempre como texto "AAAA-MM-DD" no horário local: é o mesmo formato
// do lançamento e evita o dia "pular" por causa de fuso.
const p2 = (n) => String(n).padStart(2, '0');

export function iso(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export const hoje = () => iso(new Date());
export function paraData(s) {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}
export function somarDias(s, n) {
  const d = paraData(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export const diaDaSemana = (s) => paraData(s).getDay(); // 0 = domingo
export const diaUtil = (s) => ![0, 6].includes(diaDaSemana(s));

/** Último dia útil antes de `s` (para a sequência de dias não quebrar no fim de semana). */
export function diaUtilAnterior(s) {
  let d = somarDias(s, -1);
  while (!diaUtil(d)) d = somarDias(d, -1);
  return d;
}

/** Semana ISO no formato da planilha: "S-44". */
export function semana(s) {
  const d = paraData(s);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return `S-${1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)}`;
}
export const inicioDaSemana = (s) => somarDias(s, -((diaDaSemana(s) + 6) % 7));

/** Período do boletim de medição: do dia 16 ao dia 15 do mês seguinte. "2026_11" = 16/10 a 15/11. */
export function bm(s) {
  const d = paraData(s);
  if (d.getDate() >= 16) d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}_${p2(d.getMonth() + 1)}`;
}
export function periodoBm(id) {
  const [a, m] = id.split('_').map(Number);
  const fim = new Date(a, m - 1, 15);
  const ini = new Date(a, m - 2, 16);
  return { inicio: iso(ini), fim: iso(fim) };
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const curta = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
export const completa = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '');
export const nomeDia = (s) => DIAS[diaDaSemana(s)];
export const porExtenso = (s) => `${nomeDia(s)}, ${Number(s.slice(8, 10))} de ${MESES[Number(s.slice(5, 7)) - 1]}`;
export const nomeBm = (id) => {
  const { inicio, fim } = periodoBm(id);
  return `${curta(inicio)} a ${curta(fim)}`;
};

/** "agora", "há 5 min", "há 2 h", "ontem 14:20"… para o feed ao vivo. */
export function haQuanto(ms) {
  const seg = Math.round((Date.now() - ms) / 1000);
  if (seg < 45) return 'agora';
  if (seg < 3600) return `há ${Math.round(seg / 60)} min`;
  if (seg < 6 * 3600) return `há ${Math.round(seg / 3600)} h`;
  const d = new Date(ms);
  const hora = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  const dia = iso(d);
  if (dia === hoje()) return `hoje ${hora}`;
  if (dia === somarDias(hoje(), -1)) return `ontem ${hora}`;
  return `${curta(dia)} ${hora}`;
}
