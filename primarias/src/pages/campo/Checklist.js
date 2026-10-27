// Checklist de entrega: fornos concluídos esperando o checklist do campo.
import { el } from '../../../../src/utils/dom.js';
import { statusChip } from '../../components/base.js';
import { abrirChecklist } from '../../components/checklistFolha.js';
import { checklists } from '../../lib/calculo.js';
import { completa } from '../../lib/datas.js';

export function paginaChecklist({ calc, perfil }) {
  const mapa = checklists(calc);
  const total = calc.estado.config.checklist.length;
  const linhas = Object.entries(mapa).map(([fid, c]) => ({ fid, ...c, concluidoEm: calc.fornos[fid].concluidoEm }));
  const aFazer = linhas.filter((c) => ['pendente', 'rascunho'].includes(c.status)).sort((a, b) => (a.concluidoEm || '').localeCompare(b.concluidoEm || ''));
  const enviados = linhas.filter((c) => c.status === 'enviado');
  const aprovados = linhas.filter((c) => c.status === 'aprovado').sort((a, b) => b.numero - a.numero);

  const cartao = (c) => {
    const marcados = c.itens.filter(Boolean).length;
    return el('button', { type: 'button', class: 'check-forno', onclick: () => abrirChecklist(c.fid, { perfil }) }, [
      el('div', {}, [
        el('strong', {}, c.fid.replace('-', ' · ')),
        el('small', {}, c.concluidoEm ? `Concluído em ${completa(c.concluidoEm)}` : 'Em obra'),
        c.status !== 'aprovado' ? el('div', { class: 'check-barra' }, el('i', { style: { width: `${(marcados / total) * 100}%` } })) : null
      ]),
      statusChip(c.status, c.status === 'aprovado' ? `Nº ${c.numero}` : c.status === 'enviado' ? 'Enviado' : `${marcados}/${total}`)
    ]);
  };

  return [
    el('h2', { style: { fontSize: '28px' } }, 'Checklist de entrega'),
    el('p', { class: 'fraco', style: { fontSize: '14px', marginTop: '-10px' } }, 'Cada forno concluído precisa do checklist. Marque os itens na frente do forno e envie; o planejador aprova e o número entra na medição.'),
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Para preencher', el('small', {}, String(aFazer.length))]),
      aFazer.length ? el('div', { class: 'pilha', style: { gap: '8px' } }, aFazer.map(cartao)) : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nada pendente'), 'Quando um forno fechar, o checklist dele aparece aqui.'])
    ]),
    enviados.length ? el('section', { class: 'pilha' }, [el('div', { class: 'titulo-secao' }, ['Esperando aprovação', el('small', {}, String(enviados.length))]), el('div', { class: 'pilha', style: { gap: '8px' } }, enviados.map(cartao))]) : null,
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Aprovados', el('small', {}, String(aprovados.length))]),
      el('div', { class: 'pilha', style: { gap: '8px' } }, aprovados.slice(0, 6).map(cartao)),
      aprovados.length > 6 ? el('p', { class: 'fraco', style: { fontSize: '13px', textAlign: 'center' } }, `e mais ${aprovados.length - 6} no painel`) : null
    ])
  ];
}
