// Diário do líder: registra o 5S, as ocorrências, o material e a segurança
// do dia. Tudo vai para as observações do RDO, que o planejador fecha no
// painel. As atividades do dia saem sozinhas dos lançamentos.
import { el } from '../../../../src/utils/dom.js';
import { etiquetaEtapa, statusChip } from '../../components/base.js';
import { ic } from '../../lib/icones.js';
import { TIPOS_OCORRENCIA, contratoAtivo, blocosDa } from '../../data/obra.js';
import { rdoDoDia } from '../../lib/calculo.js';
import { registrarOcorrencia, removerOcorrencia } from '../../lib/banco.js';
import { autorDe } from '../../lib/acesso.js';
import { hoje, somarDias, porExtenso } from '../../lib/datas.js';
import { vibrar, tocar } from '../../lib/efeitos.js';
import { toast } from '../../../../src/lib/toast.js';

let dia = null;
let tipo = '5s';
let rascunho = '';
const NOME_TIPO = Object.fromEntries(TIPOS_OCORRENCIA.map((t) => [t.id, t.nome]));
const STATUS = { rascunho: 'RDO aberto', fechado: 'RDO fechado', assinado: 'RDO assinado', planilha: 'Emitido na planilha' };

/** Começos de frase comuns, para digitar menos na frente do forno. */
function atalhos(t, bloco) {
  return {
    '5s': [`equipe realizou 5S e sopragem dos fornos no bloco ${bloco}`, 'limpeza e organização da área no fim do turno'],
    ocorrencia: ['frente parada aguardando liberação da Ternium', 'equipe direcionada para '],
    material: ['abastecimento de andaime na interligação ', 'falta de material: '],
    seguranca: ['DDS realizado com a equipe', 'parada por sirene de emergência']
  }[t];
}

export function paginaDiario(ctx) {
  const { calc, perfil } = ctx;
  dia ||= hoje();
  const r = rdoDoDia(calc, dia);
  const aberto = r.status === 'rascunho';
  const bloco = blocosDa(contratoAtivo().bateria).find((bl) => !calc.blocos[bl].concluidoEm) || '';
  const redesenhar = () => ctx.redesenhar();

  const texto = el('textarea', {
    class: 'textarea', rows: 3, id: 'diario-texto', value: rascunho, maxlength: 600,
    placeholder: 'O que aconteceu? Ex.: equipe realizou 5S no bloco B6.',
    oninput: (ev) => { rascunho = ev.target.value; }
  });
  const registrar = (ev) => {
    const t = rascunho.trim();
    if (t.length < 4) {
      toast('Escreva o que aconteceu.', 'info');
      texto.focus();
      return;
    }
    registrarOcorrencia({ data: dia, tipo, texto: t, autor: autorDe(perfil) });
    rascunho = '';
    vibrar(12);
    tocar('ok');
    toast('Registrado. Vai para o RDO do dia.', 'ok');
    redesenhar();
  };

  const formulario = el('section', { class: 'card card-pad pilha', style: { gap: '12px' } }, [
    el('div', { class: 'tipos-ocorrencia', role: 'radiogroup', 'aria-label': 'Tipo de registro' }, TIPOS_OCORRENCIA.map((t) => el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(t.id === tipo), class: `tipo-op${t.id === tipo ? ' ativo' : ''}`,
      onclick: (ev) => { tipo = t.id; redesenhar(); }
    }, t.id === '5s' ? '5S' : t.nome.split(' ')[0]))),
    texto,
    el('div', { class: 'tipos-ocorrencia' }, atalhos(tipo, bloco).map((a) => el('button', {
      type: 'button', class: 'tipo-op', style: { height: 'auto', minHeight: '34px', padding: '6px 12px', textAlign: 'left', fontWeight: 500 },
      onclick: () => { rascunho = rascunho.trim() ? `${rascunho.trim()}; ${a}` : a; texto.value = rascunho; texto.focus(); texto.setSelectionRange(rascunho.length, rascunho.length); }
    }, a.trim() + (a.endsWith(' ') ? '…' : '')))),
    el('button', { type: 'button', class: 'btn btn-primary', onclick: registrar }, [el('span', { html: ic.plus(18) }), 'Registrar'])
  ]);

  const meus = (o) => o.autor?.uid === perfil.uid;
  const registros = el('section', { class: 'pilha' }, [
    el('div', { class: 'titulo-secao' }, ['Registros do dia', el('small', {}, String(r.ocorrencias.length))]),
    r.ocorrencias.length
      ? el('div', { class: 'card card-pad', style: { padding: '2px 14px' } }, r.ocorrencias.map((o) => el('div', { class: 'registro' }, [
          el('div', {}, [
            el('small', {}, `${NOME_TIPO[o.tipo] || o.tipo} · ${o.autor?.nome || ''}${o.criadoEmLocal ? ` · ${new Date(o.criadoEmLocal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`),
            el('p', {}, o.texto)
          ]),
          aberto && meus(o)
            ? el('button', {
                type: 'button', class: 'btn btn-ghost btn-icon btn-sm', 'aria-label': 'Apagar registro', html: ic.trash(16),
                onclick: (ev) => { if (confirm('Apagar este registro?')) { removerOcorrencia(o.id); redesenhar(); } }
              })
            : null
        ])))
      : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nada registrado'), 'O 5S, as paradas e o que faltou de material entram nas observações do RDO.'])
  ]);

  const atividades = el('section', { class: 'pilha' }, [
    el('div', { class: 'titulo-secao' }, ['Atividades do dia', el('small', {}, 'saem dos lançamentos')]),
    r.atividades.length
      ? el('div', { class: 'card card-pad pilha', style: { gap: '14px' } }, r.atividades.map((a) => el('div', { class: 'pilha', style: { gap: '6px' } }, [
          el('div', { class: 'entre' }, [etiquetaEtapa(a.etapa), el('span', { class: 'fraco', style: { fontSize: '13px' } }, `${a.prims.length} primárias`)]),
          el('div', { style: { fontSize: '13.5px', color: 'var(--text-1)', lineHeight: '1.6' } }, a.linhas.join(' · '))
        ])))
      : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nada lançado neste dia'), 'As atividades entram aqui conforme a equipe lança.'])
  ]);

  return [
    el('div', { class: 'entre' }, [
      el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Dia anterior', html: ic.chevronLeft(18), onclick: (ev) => { dia = somarDias(dia, -1); redesenhar(); } }),
      el('div', { style: { textAlign: 'center' } }, [el('h2', { style: { fontSize: '26px' } }, 'Diário'), el('span', { class: 'fraco', style: { fontSize: '13.5px' } }, porExtenso(dia))]),
      el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Próximo dia', disabled: dia >= hoje(), html: ic.chevronLeft(18), style: { transform: 'scaleX(-1)' }, onclick: (ev) => { dia = somarDias(dia, 1); redesenhar(); } })
    ]),
    el('div', { class: 'entre' }, [statusChip(r.status, r.numero ? `${STATUS[r.status]} · nº ${r.numero}` : STATUS[r.status]), el('span', { class: 'fraco', style: { fontSize: '12.5px' } }, 'o planejador fecha no painel')]),
    aberto
      ? formulario
      : el('div', { class: 'bloqueado-nota' }, [el('span', { html: ic.lock(14) }), r.status === 'planilha' ? 'Este dia teve o RDO emitido na planilha, antes do app.' : 'O RDO deste dia já foi fechado. Para incluir algo, fale com o planejador.']),
    registros,
    atividades
  ];
}
