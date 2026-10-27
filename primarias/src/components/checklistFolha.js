// Checklist de entrega do forno: o campo marca os itens e envia; o
// planejador aprova (aí recebe o número, como na medição) ou devolve.
import { el } from '../../../src/utils/dom.js';
import { abrirFolha, statusChip } from './base.js';
import { ic } from '../lib/icones.js';
import { calcular, checklists } from '../lib/calculo.js';
import { assinar, salvarChecklist } from '../lib/store.js';
import { completa } from '../lib/datas.js';
import { vibrar, tocar, faiscas } from '../lib/efeitos.js';
import { toast } from '../../../src/lib/toast.js';

const NOME_STATUS = { pendente: 'Pendente', rascunho: 'Em preenchimento', enviado: 'Enviado para aprovação', aprovado: 'Aprovado' };

export function abrirChecklist(fid, { perfil, gestao = false, leitura = false }) {
  const folha = abrirFolha({ titulo: `Checklist · ${fid.replace('-', ' · ')}`, corpo: [], aoFechar: () => parar() });
  let obs = null;
  const parar = assinar((estado) => desenhar(calcular(estado)));

  function desenhar(calc) {
    const ck = checklists(calc)[fid];
    const fc = calc.fornos[fid];
    const itens = calc.estado.config.checklist;
    if (obs === null) obs = ck.obs || '';
    const travado = leitura || ck.status === 'aprovado' || (ck.status === 'enviado' && !gestao);
    const marcados = ck.itens.filter(Boolean).length;
    const alternar = (i) => {
      if (travado) return;
      vibrar(8);
      const novos = [...ck.itens];
      novos[i] = !novos[i];
      salvarChecklist(fid, { itens: novos, status: ck.status === 'pendente' ? 'rascunho' : ck.status, por: perfil.nome });
    };
    const acoes = [];
    if (!travado && !gestao) {
      acoes.push(el('button', {
        type: 'button', class: 'btn btn-brasa', disabled: marcados < itens.length,
        onclick: (ev) => {
          salvarChecklist(fid, { itens: ck.itens, obs, status: 'enviado', enviadoPor: perfil.nome, enviadoEm: Date.now() });
          tocar('ok');
          faiscas(ev.currentTarget);
          toast('Checklist enviado. O planejador aprova no painel.', 'ok');
          folha.fechar();
        }
      }, marcados < itens.length ? `Faltam ${itens.length - marcados} itens` : 'Enviar para aprovação'));
    }
    if (gestao && !leitura && ck.status === 'enviado') {
      acoes.push(el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => { salvarChecklist(fid, { status: 'rascunho', devolvidoPor: perfil.nome, obs }); toast('Checklist devolvido para o campo.', 'info'); } }, 'Devolver'));
      acoes.push(el('button', {
        type: 'button', class: 'btn btn-brasa', style: { flex: 1 },
        onclick: (ev) => {
          const numero = Math.max(0, ...Object.values(checklists(calcular(calc.estado))).map((c) => c.numero || 0)) + 1;
          salvarChecklist(fid, { status: 'aprovado', numero, aprovadoPor: perfil.nome, aprovadoEm: Date.now(), obs });
          tocar('forno');
          faiscas(ev.currentTarget, { quantidade: 50 });
          toast(`Checklist nº ${numero} aprovado.`, 'ok');
        }
      }, 'Aprovar checklist'));
    }
    folha.montar({
      subtitulo: fc.concluidoEm ? `Forno concluído em ${completa(fc.concluidoEm)}` : 'Forno ainda em obra',
      corpo: [
        el('div', { class: 'entre' }, [statusChip(ck.status, ck.numero ? `Nº ${ck.numero} · ${NOME_STATUS[ck.status]}` : NOME_STATUS[ck.status]), el('span', { class: 'fraco', style: { fontSize: '13px' } }, `${marcados} de ${itens.length}`)]),
        ck.origem === 'planilha' ? el('p', { class: 'fraco', style: { fontSize: '13.5px' } }, 'Aprovado antes do app, conforme a planilha de medição.') : null,
        el('div', { class: 'pilha', style: { gap: '8px' } }, itens.map((t, i) => el('button', { type: 'button', class: `item-check${ck.itens[i] ? ' ok' : ''}`, disabled: travado, 'aria-pressed': String(Boolean(ck.itens[i])), onclick: () => alternar(i) }, [el('span', { class: 'caixa', html: ic.check(20) }), el('span', {}, t)]))),
        el('div', { class: 'field' }, [
          el('label', { class: 'field-label', for: 'ck-obs' }, 'Observações'),
          el('textarea', { id: 'ck-obs', class: 'textarea', rows: 2, disabled: travado && !gestao, value: obs, oninput: (ev) => { obs = ev.target.value; } })
        ]),
        travado && !leitura && !gestao && ck.status === 'enviado' ? el('div', { class: 'bloqueado-nota' }, [el('span', { html: ic.lock(14) }), 'Enviado. Para mudar algo, peça ao planejador para devolver.']) : null
      ],
      pe: acoes.length ? acoes : null
    });
  }
}
