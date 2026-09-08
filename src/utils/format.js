export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}

export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Duração em minutos entre dois horários HH:MM, assumindo virada de turno se término < início. */
export function durationMinutes(horaInicio, horaTermino) {
  if (!horaInicio || !horaTermino) return 0;
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaTermino.split(':').map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export function formatMinutes(totalMinutes) {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

export function formatDateBR(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function weekdayShort(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

/** Categorias de efetivo (mão de obra + equipamento) apontadas em cada lançamento. */
export const EFETIVO_CAMPOS = [
  { key: 'mecanicos', label: 'Mecânicos' },
  { key: 'refratarios', label: 'Refratários' },
  { key: 'montadoresAndaime', label: 'Montadores de andaime' },
  { key: 'operadoresMaquinas', label: 'Operadores de máquinas' },
  { key: 'caminhaoMunk', label: 'Caminhão munk' }
];

export function efetivoTotal(efetivo) {
  if (!efetivo) return 0;
  return EFETIVO_CAMPOS.reduce((sum, c) => sum + (Number(efetivo[c.key]) || 0), 0);
}

export function formatEfetivo(efetivo) {
  const partes = EFETIVO_CAMPOS.filter((c) => Number(efetivo?.[c.key]) > 0).map((c) => `${c.label}: ${efetivo[c.key]}`);
  return partes.length ? partes.join(' · ') : '—';
}

/** Verdadeiro se a mão de obra real ultrapassa o padrão configurado em alguma função. */
export function efetivoExcedido(efetivoReal, efetivoPadrao) {
  if (efetivoTotal(efetivoPadrao) <= 0) return false; // sem padrão definido, não há como exceder
  return EFETIVO_CAMPOS.some((c) => (Number(efetivoReal?.[c.key]) || 0) > (Number(efetivoPadrao?.[c.key]) || 0));
}

/**
 * Escalas de turno suportadas. `horasPadrao` é a jornada típica da escala
 * (ponto de partida — o setor pode ajustar). Para calcular a capacidade de
 * um período usamos a fração de dias trabalhados do ciclo, exceto ADM, que
 * conta só dias úteis (seg–sex).
 */
export const ESCALAS = [
  { value: 'adm', label: 'ADM (seg–sex)', horasPadrao: 8, apenasDiasUteis: true },
  { value: '6x1', label: '6x1', horasPadrao: 8, cicloDias: 7, diasTrabalhados: 6 },
  { value: '5x2', label: '5x2', horasPadrao: 8, cicloDias: 7, diasTrabalhados: 5 },
  { value: '4x4', label: '4x4', horasPadrao: 12, cicloDias: 8, diasTrabalhados: 4 },
  { value: '3x3', label: '3x3', horasPadrao: 12, cicloDias: 6, diasTrabalhados: 3 }
];

export function escalaInfo(value) {
  return ESCALAS.find((e) => e.value === value) || ESCALAS[0];
}

export function escalaLabel(value) {
  return escalaInfo(value).label;
}

function diasEntre(fromISO, toISO) {
  const a = new Date(`${fromISO}T12:00:00`);
  const b = new Date(`${toISO}T12:00:00`);
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

function diasUteisEntre(fromISO, toISO) {
  let count = 0;
  const d = new Date(`${fromISO}T12:00:00`);
  const end = new Date(`${toISO}T12:00:00`);
  while (d <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Capacidade de trabalho de um setor num período [fromISO, toISO], em
 * minutos, considerando a escala, a jornada e o número de turmas
 * simultâneas. É uma estimativa — serve para medir a ocupação do turno.
 */
export function capacidadeMinutosSetor(setor, fromISO, toISO) {
  if (!setor || !fromISO || !toISO) return 0;
  const info = escalaInfo(setor.escala);
  const horas = Number(setor.horasPorTurno) || info.horasPadrao;
  const turmas = Math.max(1, Number(setor.turmas) || 1);
  const diasEfetivos = info.apenasDiasUteis
    ? diasUteisEntre(fromISO, toISO)
    : diasEntre(fromISO, toISO) * (info.diasTrabalhados / info.cicloDias);
  return diasEfetivos * horas * 60 * turmas;
}

/**
 * Classificação Lean de cada minuto apontado — VA (Valor Agregado), DN
 * (Desperdício Necessário / semi valor agregado) ou DNN (Desperdício Não
 * Necessário). Toda improdutividade é DNN por definição; dentro do que é
 * "atividade" (produtiva), cada etapa do catálogo é marcada como VA ou DN
 * pelo admin (ver Cadastros). Cor reaproveita as semânticas do sistema:
 * verde = bom/valor, amarelo = atenção/necessário mas não ideal,
 * vermelho = desperdício a eliminar.
 */
export const CLASSIFICACAO_INFO = {
  VA: { label: 'Valor Agregado', short: 'VA', color: 'var(--ok-500)' },
  DN: { label: 'Desperdício Necessário', short: 'DN', color: 'var(--warn-500)' },
  DNN: { label: 'Desperdício Não Necessário', short: 'DNN', color: 'var(--danger-500)' }
};

/**
 * Deriva a classificação de um lançamento a partir do que foi salvo nele
 * (herdado da atividade escolhida no momento do lançamento). Atividade
 * (produtiva) é VA ou DN; improdutividade é DN (parada necessária/
 * inevitável — chuva, intervalo, troca de turno) ou DNN (desperdício
 * evitável — falta de material, defeito de equipamento, atraso). Sem
 * classificação salva, o padrão é o mais conservador: DN pra atividade,
 * DNN pra improdutividade.
 */
export function classificacaoDoLancamento(l) {
  if (l.tipoRegistro === 'improdutividade') {
    return l.classificacao === 'DN' ? 'DN' : 'DNN';
  }
  return l.classificacao === 'VA' ? 'VA' : 'DN';
}

/**
 * Reparte a duração de UM lançamento entre VA/DN/DNN em minutos, aplicando a
 * regra do tempo padrão (estilo MS Project): numa atividade produtiva, o
 * tempo até o padrão vale pela classificação da etapa (VA ou DN) e o tempo
 * que passou do padrão (excedente) sempre vira DN. Improdutividade vai
 * inteira para DN ou DNN. Retorna { VA, DN, DNN } em minutos.
 */
export function classificacaoBreakdown(l) {
  const out = { VA: 0, DN: 0, DNN: 0 };
  const total = Number(l.duracaoMinutos) || 0;
  if (l.tipoRegistro === 'improdutividade') {
    out[l.classificacao === 'DN' ? 'DN' : 'DNN'] += total;
    return out;
  }
  const base = l.classificacao === 'VA' ? 'VA' : 'DN';
  const padrao = Number(l.duracaoPadraoMin) || 0;
  const excedente = padrao > 0 ? Math.max(0, total - padrao) : 0;
  const dentro = total - excedente;
  out[base] += dentro;
  out.DN += excedente; // excedente do padrão é sempre desperdício necessário
  return out;
}

/** Minutos que passaram do tempo padrão da atividade (0 se sem padrão). */
export function excedenteMinutos(l) {
  const padrao = Number(l.duracaoPadraoMin) || 0;
  if (padrao <= 0 || l.tipoRegistro === 'improdutividade') return 0;
  return Math.max(0, (Number(l.duracaoMinutos) || 0) - padrao);
}

/** Um lançamento tem desperdício quando estourou o tempo padrão ou o efetivo padrão. */
export function temDesperdicio(l) {
  return excedenteMinutos(l) > 0 || l.efetivoExcede === true;
}
