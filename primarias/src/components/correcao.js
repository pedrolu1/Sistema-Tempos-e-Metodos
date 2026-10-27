// Pedido de correção: quem é de campo não altera nem apaga um lançamento;
// pede ao planejador, que aprova ou recusa no painel.
import { el } from '../../../src/utils/dom.js';
import { abrirFolha, etiquetaEtapa } from './base.js';
import { etapaPorId } from '../data/obra.js';
import { resumoAlvos } from '../lib/calculo.js';
import { pedirCorrecao } from '../lib/store.js';
import { toast } from '../../../src/lib/toast.js';
import { completa, hoje, somarDias } from '../lib/datas.js';
import { autorDe } from '../lib/sessao.js';

export function abrirPedidoCorrecao(lanc, perfil) {
  const e = etapaPorId[lanc.etapa];
  const st = { tipo: 'excluir', motivo: '', novaData: lanc.data };
  const folha = abrirFolha({ titulo: 'Pedir correção', subtitulo: 'O planejador recebe na hora e decide', corpo: [] });
  desenhar();

  function desenhar() {
    const opcao = (tipo, titulo, texto) => el('button', {
      type: 'button', class: `menu-item${st.tipo === tipo ? ' ativo' : ''}`, 'aria-pressed': String(st.tipo === tipo),
      style: st.tipo === tipo ? { borderColor: 'var(--accent-400)', background: 'var(--bg-3)' } : null,
      onclick: () => { st.tipo = tipo; desenhar(); }
    }, [el('div', {}, [el('strong', {}, titulo), el('small', {}, texto)])]);
    const enviar = el('button', { type: 'button', class: 'btn btn-brasa', disabled: st.motivo.trim().length < 5, onclick: confirmar }, 'Enviar pedido');
    folha.montar({
      corpo: [
        el('div', { class: `resumo-lanc cor-${e.id}` }, [
          el('div', { class: 'entre' }, [etiquetaEtapa(e), el('span', { class: 'fraco', style: { fontSize: '13px' } }, `dia ${completa(lanc.data)}`)]),
          el('ul', {}, resumoAlvos(lanc.prims, e.id).map((l) => el('li', {}, [el('span', { class: 'ponto' }), l])))
        ]),
        el('div', { class: 'menu-list' }, [
          opcao('excluir', 'Apagar o lançamento', 'Foi lançado errado ou em dobro.'),
          opcao('data', 'Trocar o dia', 'O serviço foi feito em outro dia.'),
          opcao('outro', 'Outro ajuste', 'Primária ou forno errado; o planejador corrige.')
        ]),
        st.tipo === 'data'
          ? el('div', { class: 'field' }, [
              el('label', { class: 'field-label', for: 'corr-data' }, 'Dia certo'),
              el('input', { id: 'corr-data', class: 'input', type: 'date', value: st.novaData, max: hoje(), min: somarDias(hoje(), -30), onchange: (ev) => { st.novaData = ev.target.value; } })
            ])
          : null,
        el('div', { class: 'field' }, [
          el('label', { class: 'field-label', for: 'corr-motivo' }, 'O que aconteceu?'),
          el('textarea', { id: 'corr-motivo', class: 'textarea', rows: 3, placeholder: 'Ex.: lancei o F07 mas era o F08', value: st.motivo, oninput: (ev) => { st.motivo = ev.target.value; enviar.disabled = st.motivo.trim().length < 5; } })
        ])
      ],
      pe: [enviar]
    });
  }

  function confirmar() {
    pedirCorrecao({ lancId: lanc.id, tipo: st.tipo, motivo: st.motivo, novaData: st.tipo === 'data' ? st.novaData : '', autor: autorDe(perfil) });
    folha.fechar();
    toast('Pedido enviado ao planejador. O lançamento segue valendo até ele decidir.', 'ok', 4200);
  }
}
