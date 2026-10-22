/**
 * Lista de atividades que podem ser escolhidas num lançamento — a mesma
 * regra no app de campo, na edição pelo celular e na edição pelo painel:
 *   - com projeto: as atividades planejadas do projeto (produtivas ou
 *     improdutividades), já com o tempo e a equipe planejados;
 *   - sem projeto (avulso): o catálogo geral.
 * Cada opção vem normalizada: { value, label, atividadeId, etapaId, nome,
 * tipo, classificacao, duracaoPadraoMin, efetivoPadrao }.
 */
export function opcoesAtividade({ tipoRegistro, projeto, atividades = [], contrato = '' }) {
  const produtiva = tipoRegistro !== 'improdutividade';

  if (projeto && produtiva) {
    return (projeto.etapas || []).map((e) => ({
      value: e.id,
      label: e.codigo ? `${e.codigo} — ${e.nome}` : e.nome,
      atividadeId: e.atividadeId,
      etapaId: e.id,
      nome: e.nome,
      tipo: 'produtiva',
      classificacao: e.classificacao,
      duracaoPadraoMin: Number(e.duracaoMin) || 0,
      efetivoPadrao: e.efetivo || {}
    }));
  }
  if (projeto && !produtiva && (projeto.improdutividades || []).length) {
    return projeto.improdutividades.map((i) => ({
      value: i.id,
      label: i.nome,
      atividadeId: i.atividadeId,
      etapaId: '',
      nome: i.nome,
      tipo: 'improdutiva',
      classificacao: i.classificacao,
      duracaoPadraoMin: 0,
      efetivoPadrao: {}
    }));
  }
  return atividades
    .filter((a) => a.ativo !== false && a.tipo === (produtiva ? 'produtiva' : 'improdutiva') && (!produtiva || !contrato || a.contrato === contrato))
    .map((a) => ({
      value: a.id,
      label: a.codigo ? `${a.codigo} — ${a.nome}` : a.nome,
      atividadeId: a.id,
      etapaId: '',
      nome: a.nome,
      tipo: a.tipo,
      classificacao: a.classificacao,
      duracaoPadraoMin: produtiva ? Number(a.duracaoPadraoMin) || 0 : 0,
      efetivoPadrao: produtiva ? a.efetivoPadrao || {} : {}
    }));
}

/** A opção que corresponde a um lançamento já gravado (para abrir a edição com ela marcada). */
export function opcaoDoLancamento(opcoes, l) {
  return opcoes.find((o) => (l.etapaId && o.etapaId === l.etapaId) || (!l.etapaId && o.atividadeId === l.atividadeId)) || null;
}
