// Configuração (planejador e administrador): meta do BM, numeração do RDO,
// base histórica vinda da Gestão Visual, pesos das etapas e os cadastros.
import { el } from '../../../../src/utils/dom.js';
import { ETAPAS, MATERIAIS, EFETIVO_MODELO, CONTRATOS, NIVEL_NOME, META_FORNOS_BM, RDO_ULTIMO } from '../../data/obra.js';
import { SEED_ATE } from '../../data/seed.js';
import { pesosNormalizados, metaDoBm, rdoUltimo } from '../../lib/calculo.js';
import { salvarConfig, salvarBase } from '../../lib/banco.js';
import { guardarModelo } from '../../lib/modelos.js';
import { completa } from '../../lib/datas.js';
import { toast } from '../../../../src/lib/toast.js';

let importando = false;

export function paginaConfig(ctx) {
  const { calc, leitura } = ctx;
  const cfg = calc.estado.config || {};
  const base = calc.estado.base;
  const norm = pesosNormalizados(cfg);
  const pode = !leitura;
  const ultimo = rdoUltimo(calc);
  const redesenhar = () => location.hash.slice(2) === 'config' && ctx.redesenhar();

  const importar = () => {
    const entrada = el('input', {
      type: 'file', accept: '.xlsx,.xlsm', style: { display: 'none' },
      onchange: async (ev) => {
        const arq = ev.target.files[0];
        entrada.remove();
        if (!arq) return;
        importando = true;
        redesenhar();
        try {
          const { lerBaseDaGestaoVisual } = await import('../../lib/planilhas.js');
          const nova = lerBaseDaGestaoVisual(new Uint8Array(await arq.arrayBuffer()));
          if (!confirm(`Atualizar a base com "${arq.name}"?\n\nDados até ${completa(nova.ate)}${nova.faltando ? `; ${nova.faltando} primárias não estão na planilha e ficam pendentes` : ''}. Os lançamentos feitos no app continuam valendo por cima da base.`)) return;
          await salvarBase({ ...nova, fonte: arq.name, importadoEm: Date.now() });
          await guardarModelo('gestao-visual', arq);
          toast('Base atualizada. O mapa e a curva já usam os dados novos.', 'ok', 6000);
        } catch (err) {
          toast(err?.message?.startsWith('Não achei') || err?.message?.startsWith('A aba') ? err.message : 'Não consegui ler a planilha. Confira se é a Gestão Visual.', 'error', 7000);
        } finally {
          importando = false;
          redesenhar();
        }
      }
    });
    document.body.appendChild(entrada);
    entrada.click();
  };

  const numero = (rotulo, valor, aoMudar, extra = {}) => el('label', { class: 'field' }, [
    el('span', { class: 'field-label' }, rotulo),
    el('input', { class: 'input', type: 'number', value: valor, disabled: !pode, onchange: (ev) => aoMudar(ev.target.value), ...extra })
  ]);

  return [
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Meta e numeração'), el('p', {}, 'A meta vale para a Curva S de todos os BMs. A numeração do RDO continua a da planilha.')])]),
        el('div', { class: 'rdo-edicao' }, [
          numero('Meta de fornos por BM (16 ao 15)', metaDoBm(calc), (v) => {
            const n = Math.max(1, Math.round(Number(v) || META_FORNOS_BM));
            salvarConfig({ metaBm: n });
            toast(`Meta de ${n} fornos por BM salva.`, 'ok');
          }, { min: 1, max: 999 }),
          numero('Último RDO emitido fora do app (nº)', ultimo.numero, (v) => salvarConfig({ rdoUltimo: { ...ultimo, numero: Math.max(0, Math.round(Number(v) || RDO_ULTIMO.numero)) } }), { min: 0 }),
          el('label', { class: 'field' }, [
            el('span', { class: 'field-label' }, 'Data desse último RDO'),
            el('input', { class: 'input', type: 'date', value: ultimo.data, disabled: !pode, onchange: (ev) => ev.target.value && salvarConfig({ rdoUltimo: { ...ultimo, data: ev.target.value } }) })
          ])
        ])
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Base da planilha de Gestão Visual'), el('p', {}, 'O histórico antes do app: datas de demolição, instalação e revestimento e o andaime de cada primária. Os lançamentos do app valem por cima.')])]),
        el('p', { style: { fontSize: '14px' } }, base?.baterias
          ? `Importada de "${base.fonte || 'planilha'}"${base.importadoEm ? ` em ${new Date(base.importadoEm).toLocaleDateString('pt-BR')}` : ''}, com dados até ${completa(base.ate)}.`
          : `A que veio com o app, com dados até ${completa(SEED_ATE)}.`),
        pode ? el('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: importando, style: { alignSelf: 'flex-start' }, onclick: importar }, importando ? 'Lendo a planilha…' : 'Atualizar pela Gestão Visual') : null
      ])
    ]),
    el('div', { class: 'painel-grade' }, [
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Peso de cada etapa'), el('p', {}, 'Define o avanço físico: quanto cada etapa vale do serviço de uma primária. Pode usar horas, custo ou percentual; o app converte. Sem peso, as etapas valem igual e a desmontagem não conta.')])]),
        el('div', { class: 'pesos' }, ETAPAS.map((e, i) => el('div', { class: `peso-linha cor-${e.id}` }, [
          el('span', { class: 'ponto', style: { width: '14px', height: '14px' } }),
          el('span', {}, [e.nome, el('small', { class: 'fraco', style: { display: 'block', fontSize: '12px' } }, NIVEL_NOME[e.nivel])]),
          el('input', {
            class: 'input', type: 'number', min: 0, step: 'any', value: cfg.pesos?.[e.id] ?? '', placeholder: e.extra ? '0' : '1', disabled: !pode, 'aria-label': `Peso ${e.curto}`,
            onchange: (ev) => {
              const pesos = { ...(cfg.pesos || {}) };
              if (ev.target.value === '') delete pesos[e.id];
              else pesos[e.id] = Math.max(0, Number(ev.target.value) || 0);
              salvarConfig({ pesos });
              toast('Peso salvo. O avanço físico já foi recalculado.', 'ok');
            }
          }),
          el('output', {}, `${(norm[i] * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
        ])))
      ]),
      el('section', { class: 'cartao' }, [
        el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Materiais por primária'), el('p', {}, 'Da memória de cálculo do RDO. O consumo entra no dia em que a etapa é lançada.')])]),
        el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta' }, [
          el('thead', {}, el('tr', {}, ['Material', 'Un.', 'Por primária', 'Etapa'].map((t, i) => el('th', { class: i === 2 ? 'n' : '' }, t)))),
          el('tbody', {}, MATERIAIS.map((m) => el('tr', {}, [el('td', {}, m.nome), el('td', {}, m.unidade), el('td', { class: 'n' }, String(m.porPrimaria)), el('td', {}, ETAPAS.find((e) => e.id === m.etapa).curto)])))
        ])),
        el('div', { class: 'table-wrap' }, el('table', { class: 'data-table tabela-compacta tabela-estreita' }, [
          el('thead', {}, el('tr', {}, [el('th', {}, 'Efetivo previsto'), el('th', { class: 'n' }, 'Diurno')])),
          el('tbody', {}, [...EFETIVO_MODELO.mod, ...EFETIVO_MODELO.moi, ...EFETIVO_MODELO.equipamentos].map(([f, n]) => el('tr', {}, [el('td', {}, f), el('td', { class: 'n' }, String(n))])))
        ])),
        el('div', { class: 'pilha', style: { gap: '6px', fontSize: '14px' } }, CONTRATOS.map((c) => el('div', { class: 'entre' }, [el('span', {}, `${c.nome} · bateria ${c.bateria}`), el('span', { class: `status-chip ${c.ativo ? 'enviado' : 'aprovado'}` }, c.ativo ? 'em andamento' : 'encerrado')])))
      ])
    ])
  ];
}
