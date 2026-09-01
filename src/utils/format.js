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

/** Deriva a classificação de um lançamento: improdutividade é sempre DNN. */
export function classificacaoDoLancamento(l) {
  if (l.tipoRegistro === 'improdutividade') return 'DNN';
  return l.classificacao === 'VA' ? 'VA' : 'DN';
}
