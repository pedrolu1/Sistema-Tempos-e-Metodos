// RDO do dia no celular: as atividades e os materiais saem sozinhos dos
// lançamentos; o apontador só confere o efetivo, o clima e as observações.
import { el } from '../../../../src/utils/dom.js';
import { passoNumero, statusChip, etiquetaEtapa } from '../../components/base.js';
import { segmented } from '../../../../src/components/ui.js';
import { ic } from '../../lib/icones.js';
import { EFETIVO_MODELO } from '../../data/obra.js';
import { rdoDoDia } from '../../lib/calculo.js';
import { salvarRdo } from '../../lib/store.js';
import { hoje, somarDias, porExtenso, completa } from '../../lib/datas.js';

let dia = null;
const STATUS = { rascunho: 'Em preenchimento', fechado: 'Fechado pelo planejador', assinado: 'Assinado', planilha: 'Emitido na planilha' };

export function paginaRdo(ctx) {
  const { calc, perfil } = ctx;
  dia ||= hoje();
  const r = rdoDoDia(calc, dia);
  const salvo = r.salvo || {};
  const travado = r.status !== 'rascunho';
  const efetivo = salvo.efetivo || {};
  const clima = salvo.clima || { diurno: 'estavel' };
  const salvar = (mud) => salvarRdo(dia, { ...mud, atualizadoPor: perfil.nome, atualizadoEm: Date.now() });
  const redesenhar = (ev) => ev.currentTarget.closest('.campo-conteudo').replaceChildren(...paginaRdo(ctx));

  const linhaEfetivo = ([funcao, prev]) => {
    const valor = efetivo[funcao] ?? prev;
    return el('div', { class: 'efetivo-linha' }, [
      el('span', {}, [funcao, el('small', {}, `previsto ${prev}`)]),
      passoNumero({ valor, previsto: prev, desativado: travado, aoMudar: (v) => salvar({ efetivo: { ...efetivo, [funcao]: v } }) })
    ]);
  };
  const totalReal = (lista) => lista.reduce((s, [f, p]) => s + (efetivo[f] ?? p), 0);
  const totalPrev = (lista) => lista.reduce((s, [, p]) => s + p, 0);

  return [
    el('div', { class: 'entre' }, [
      el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Dia anterior', html: ic.chevronLeft(18), onclick: (ev) => { dia = somarDias(dia, -1); redesenhar(ev); } }),
      el('div', { style: { textAlign: 'center' } }, [el('h2', { style: { fontSize: '26px' } }, r.numero ? `RDO nº ${r.numero}` : 'RDO'), el('span', { class: 'fraco', style: { fontSize: '13.5px' } }, porExtenso(dia))]),
      el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Próximo dia', disabled: dia >= hoje(), html: ic.chevronLeft(18), style: { transform: 'scaleX(-1)' }, onclick: (ev) => { dia = somarDias(dia, 1); redesenhar(ev); } })
    ]),
    el('div', { class: 'entre' }, [statusChip(r.status, STATUS[r.status]), salvo.atualizadoPor ? el('span', { class: 'fraco', style: { fontSize: '12.5px' } }, `salvo por ${salvo.atualizadoPor}`) : el('span', { class: 'fraco', style: { fontSize: '12.5px' } }, 'salva sozinho')]),
    travado ? el('div', { class: 'bloqueado-nota' }, [el('span', { html: ic.lock(14) }), r.status === 'planilha' ? 'Este dia já teve o RDO emitido na planilha, antes do app.' : 'O planejador já fechou este RDO. Para mudar algo, fale com ele.']) : null,

    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Atividades do dia', el('small', {}, 'dos lançamentos')]),
      r.atividades.length
        ? el('div', { class: 'card card-pad pilha', style: { gap: '14px' } }, r.atividades.map((a) => el('div', { class: 'pilha', style: { gap: '6px' } }, [
            el('div', { class: 'entre' }, [etiquetaEtapa(a.etapa), el('span', { class: 'fraco', style: { fontSize: '13px' } }, `${a.prims.length} primárias`)]),
            el('div', { style: { fontSize: '13.5px', color: 'var(--text-1)', lineHeight: '1.6' } }, a.linhas.join(' · '))
          ])))
        : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nada lançado neste dia'), 'As atividades entram aqui conforme a equipe lança.'])
    ]),

    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Clima', el('small', {}, 'turno diurno')]),
      segmented([{ value: 'estavel', label: 'Tempo estável' }, { value: 'chuvoso', label: 'Tempo chuvoso' }], clima.diurno, (v) => !travado && salvar({ clima: { ...clima, diurno: v } }))
    ]),

    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Mão de obra direta', el('small', {}, `${totalReal(EFETIVO_MODELO.mod)} de ${totalPrev(EFETIVO_MODELO.mod)}`)]),
      el('div', { class: 'card card-pad', style: { padding: '6px 14px' } }, EFETIVO_MODELO.mod.map((l) => linhaEfetivo(l)))
    ]),
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Mão de obra indireta', el('small', {}, `${totalReal(EFETIVO_MODELO.moi)} de ${totalPrev(EFETIVO_MODELO.moi)}`)]),
      el('div', { class: 'card card-pad', style: { padding: '6px 14px' } }, EFETIVO_MODELO.moi.map((l) => linhaEfetivo(l)))
    ]),
    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, 'Equipamentos'),
      el('div', { class: 'card card-pad', style: { padding: '6px 14px' } }, EFETIVO_MODELO.equipamentos.map((l) => linhaEfetivo(l)))
    ]),

    el('section', { class: 'pilha' }, [
      el('div', { class: 'titulo-secao' }, ['Materiais aplicados', el('small', {}, 'calculados')]),
      el('div', { class: 'card card-pad', style: { padding: '6px 14px' } }, r.materiais.map((m) => el('div', { class: 'efetivo-linha', style: { gridTemplateColumns: '1fr auto' } }, [
        el('span', {}, [m.nome, el('small', {}, `acumulado ${m.acumulado.toLocaleString('pt-BR')} ${m.unidade}`)]),
        el('strong', { class: 'num', style: { fontSize: '20px' } }, `${m.aplicado.toLocaleString('pt-BR')} ${m.unidade}`)
      ])))
    ]),

    el('section', { class: 'field' }, [
      el('label', { class: 'field-label', for: 'rdo-obs' }, 'Observações do dia'),
      el('textarea', {
        id: 'rdo-obs', class: 'textarea', rows: 4, disabled: travado, value: salvo.obs || '',
        placeholder: 'Ex.: equipe direcionada para 5S no bloco B4; abastecimento de andaime na interligação B5-B6.',
        onchange: (ev) => salvar({ obs: ev.target.value })
      })
    ]),
    el('p', { class: 'fraco', style: { fontSize: '12.5px', textAlign: 'center' } }, `Dia ${completa(dia)} · o planejador fecha e imprime pelo painel`)
  ];
}
