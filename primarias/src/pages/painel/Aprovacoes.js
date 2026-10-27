// Pedidos de correção do campo: o planejador aprova (o app aplica sozinho)
// ou recusa com uma resposta que volta para quem pediu.
import { el } from '../../../../src/utils/dom.js';
import { etiquetaEtapa, statusChip } from '../../components/base.js';
import { etapaPorId } from '../../data/obra.js';
import { resumoAlvos } from '../../lib/calculo.js';
import { decidirCorrecao } from '../../lib/store.js';
import { completa, haQuanto } from '../../lib/datas.js';
import { toast } from '../../../../src/lib/toast.js';

const TIPO = { excluir: 'Apagar o lançamento', data: 'Trocar o dia', outro: 'Outro ajuste' };

export function paginaAprovacoes({ calc, perfil, leitura }) {
  const pedidos = [...calc.estado.correcoes].sort((a, b) => b.criadoEm - a.criadoEm);
  const abertos = pedidos.filter((c) => c.status === 'pendente');
  const decididos = pedidos.filter((c) => c.status !== 'pendente').slice(0, 20);
  const cartao = (c) => {
    const l = calc.lancPorId[c.lancId];
    if (!l) return null;
    const e = etapaPorId[l.etapa];
    const pedido = c.tipo === 'data' ? `${TIPO.data}: ${completa(l.data)} → ${completa(c.novaData)}` : TIPO[c.tipo];
    return el('div', { class: 'pedido' }, [
      el('div', {}, [
        el('div', { class: 'linha', style: { flexWrap: 'wrap' } }, [el('strong', {}, pedido), etiquetaEtapa(e), el('small', {}, `${c.autor?.nome} · ${haQuanto(c.criadoEm)}`)]),
        el('p', {}, `“${c.motivo}”`),
        el('small', {}, `Lançamento de ${completa(l.data)}: ${resumoAlvos(l.prims, l.etapa).join(', ')}`),
        c.status !== 'pendente' && c.resposta ? el('p', { class: 'fraco' }, `Resposta: ${c.resposta}`) : null
      ]),
      c.status === 'pendente'
        ? leitura
          ? statusChip('pendente', 'Esperando o planejador')
          : el('div', { class: 'toolbar' }, [
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => {
                const resposta = prompt('Por que recusar? (a resposta volta para quem pediu)');
                if (resposta == null) return;
                decidirCorrecao(c.id, false, perfil.nome, resposta);
                toast('Pedido recusado.', 'info');
              } }, 'Recusar'),
              el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => {
                decidirCorrecao(c.id, true, perfil.nome);
                toast(c.tipo === 'outro' ? 'Aprovado. Faça o ajuste em Lançamentos.' : 'Aprovado e já aplicado.', 'ok');
              } }, c.tipo === 'outro' ? 'Aprovar' : 'Aprovar e aplicar')
            ])
        : statusChip(c.status === 'aprovada' ? 'aprovado' : 'rascunho', c.status === 'aprovada' ? `Aprovado por ${c.decididoPor}` : `Recusado por ${c.decididoPor}`)
    ]);
  };
  return [
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Esperando decisão', el('small', {}, String(abertos.length))]),
      abertos.length ? el('div', { class: 'pilha', style: { gap: '8px' } }, abertos.map(cartao)) : el('div', { class: 'cartao' }, el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nenhum pedido aberto'), 'O campo não altera lançamentos: quando alguém errar, o pedido de correção chega aqui.']))
    ]),
    decididos.length ? el('section', { class: 'pilha' }, [el('div', { class: 'titulo-secao' }, 'Decididos recentemente'), el('div', { class: 'pilha', style: { gap: '8px' } }, decididos.map(cartao))]) : null
  ];
}
