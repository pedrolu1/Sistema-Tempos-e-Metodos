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
  // sem Date.setMonth: no dia 31 ele pularia dois meses
  let a = Number(s.slice(0, 4));
  let m = Number(s.slice(5, 7));
  if (Number(s.slice(8, 10)) >= 16) m++;
  if (m > 12) {
    m = 1;
    a++;
  }
  return `${a}_${p2(m)}`;
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

// ---------------------------------------------------------------------------
// Semanas e boletins de medição (BM). Como na planilha e na medição, a semana
// inteira (segunda a domingo) pertence ao BM da sua segunda-feira: um forno que
// fecha no dia 16, numa sexta, ainda conta na semana que começou antes do corte.
// ---------------------------------------------------------------------------
export const bmDaSemana = (s) => bm(inicioDaSemana(s));

/** Semanas de um BM: as que começam (segunda-feira) entre o dia 16 e o dia 15. */
export function semanasDoBm(id) {
  const { inicio, fim } = periodoBm(id);
  let seg = inicioDaSemana(inicio);
  if (seg < inicio) seg = somarDias(seg, 7);
  const semanas = [];
  for (; seg <= fim; seg = somarDias(seg, 7)) semanas.push({ semana: semana(seg), ini: seg, fim: somarDias(seg, 6) });
  return semanas;
}

/** BMs de `de` até `ate` (inclusive), em ordem. */
export function bmsEntre(de, ate) {
  const lista = [];
  let [a, m] = de.split('_').map(Number);
  const [a2, m2] = ate.split('_').map(Number);
  while (a < a2 || (a === a2 && m <= m2)) {
    lista.push(`${a}_${p2(m)}`);
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return lista;
}

/** "2026_11" → "Out - Nov_2026" (como no resumo da medição). */
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export function referenciaBm(id) {
  const [a, m] = id.split('_').map(Number);
  const anterior = MESES_CURTOS[(m + 10) % 12];
  return `${anterior} - ${MESES_CURTOS[m - 1]}_${a}`;
}

/** "2026_11" → "Out-Nov/26" (16/10 a 15/11), como nas abas do resumo da medição. */
export function rotuloBm(id) {
  const [a, m] = id.split('_').map(Number);
  return `${MESES_CURTOS[(m + 10) % 12]}-${MESES_CURTOS[m - 1]}/${String(a).slice(2)}`;
}
