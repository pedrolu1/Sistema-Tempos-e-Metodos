import { el, mount } from '../../utils/dom.js';
import { badge, button, emptyState } from '../../components/ui.js';
import { abrirEdicaoLancamento, confirmarExclusaoLancamento } from '../../components/EditarLancamento.js';
import { icon } from '../../utils/icons.js';
import { formatDateBR, formatMinutes, weekdayShort, efetivoTotal, formatEfetivo, temDesperdicio, excedenteMinutos, todayISO } from '../../utils/format.js';

const PAGINA = 40;

/**
 * Aba Consultar do app de campo: os lançamentos da pessoa, agrupados por
 * dia, com editar e excluir sempre disponíveis (mesmo depois de
 * sincronizados — toda alteração fica na auditoria).
 */
export function renderHistoryPage({ lancamentos, atividades, projetos = [] }) {
  const root = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
  let limite = PAGINA;

  function refresh(lista, novos = {}) {
    lancamentos = lista;
    if (novos.projetos) projetos = novos.projetos;
    if (novos.atividades) atividades = novos.atividades;
    paint();
  }

  const ontem = (() => {
    const d = new Date(`${todayISO()}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const tituloDia = (data) => (data === todayISO() ? 'Hoje' : data === ontem ? 'Ontem' : `${weekdayShort(data)} · ${formatDateBR(data)}`);

  function paint() {
    if (lancamentos.length === 0) {
      mount(root, [emptyState({ icon: icon.list(40), title: 'Nenhum lançamento ainda', message: 'Os registros que você criar na aba Lançar aparecem aqui.' })]);
      return;
    }
    const visiveis = lancamentos.slice(0, limite);
    const dias = new Map();
    visiveis.forEach((l) => {
      if (!dias.has(l.data)) dias.set(l.data, []);
      dias.get(l.data).push(l);
    });
    mount(root, [
      ...[...dias.entries()].map(([data, ls]) =>
        el('div', { class: 'hist-dia' }, [
          el('div', { class: 'hist-dia-head' }, [
            el('strong', {}, tituloDia(data)),
            el('span', { class: 'mono' }, `${ls.length} lanç. · ${formatMinutes(ls.reduce((s, l) => s + (Number(l.duracaoMinutos) || 0), 0))}`)
          ]),
          ...ls.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)).map(itemCard)
        ])
      ),
      lancamentos.length > limite
        ? button({ label: `Mostrar mais (${lancamentos.length - limite})`, variant: 'outline', block: true, onClick: () => { limite += PAGINA; paint(); } })
        : null
    ]);
  }

  function itemCard(l) {
    const improd = l.tipoRegistro === 'improdutividade';
    return el('div', { class: `card card-pad hist-item${improd ? ' improd' : ''}` }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' } }, [
        el('div', { style: { minWidth: '0' } }, [
          el('div', { style: { fontFamily: 'var(--font-display)', fontWeight: '600', fontSize: '14.5px' } }, l.atividadeNome || '—'),
          l.projetoNome ? el('div', { style: { fontSize: '11.5px', color: 'var(--text-2)', marginTop: '1px' } }, l.projetoNome) : null
        ]),
        badge(l._sincronizado ? 'Enviado' : 'No celular', l._sincronizado ? 'ok' : 'warn', true)
      ]),
      el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '13px', color: 'var(--text-1)' } }, [
        rowInfo(icon.clock(14), `${l.horaInicio}–${l.horaTermino} (${formatMinutes(l.duracaoMinutos)})`),
        efetivoTotal(l.efetivo) > 0 ? el('span', { title: formatEfetivo(l.efetivo) }, rowInfo(icon.crew(14), `Equipe: ${efetivoTotal(l.efetivo)}`)) : null
      ]),
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
        badge(improd ? 'Improdutividade' : 'Atividade', improd ? 'danger' : 'ok'),
        temDesperdicio(l) ? badge(excedenteMinutos(l) > 0 ? `Passou +${formatMinutes(excedenteMinutos(l))}` : 'Equipe acima do planejado', 'warn', true) : null
      ]),
      el('div', { style: { display: 'flex', gap: '8px' } }, [
        button({ label: 'Editar', variant: 'outline', size: 'sm', icon: icon.edit(14), onClick: () => abrirEdicaoLancamento(l, { projetos, atividades }) }),
        button({ label: 'Excluir', variant: 'ghost', size: 'sm', icon: icon.trash(14), onClick: () => confirmarExclusaoLancamento(l) })
      ])
    ]);
  }

  function rowInfo(iconHtml, text) {
    return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
      el('span', { html: iconHtml, style: { display: 'inline-flex', color: 'var(--text-3)' } }),
      text
    ]);
  }

  paint();
  return { node: root, refresh };
}
