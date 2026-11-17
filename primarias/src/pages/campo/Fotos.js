// Fotos do checklist: os fornos que esperam as 8 fotos (4 por lado). Toque
// no forno, tire as fotos na ordem e envie. Funciona sem internet.
import { el } from '../../../../src/utils/dom.js';
import { statusChip } from '../../components/base.js';
import { abrirChecklistFotos } from '../../components/checklistFotos.js';
import { SLOTS_FOTO, rotulo } from '../../data/obra.js';
import { checklists } from '../../lib/calculo.js';
import { completa } from '../../lib/datas.js';

export function paginaFotos({ calc, perfil }) {
  const linhas = Object.entries(checklists(calc)).map(([fid, c]) => ({ fid, ...c }));
  const porData = (a, b) => (a.concluidoEm || '9').localeCompare(b.concluidoEm || '9') || a.fid.localeCompare(b.fid);
  const devolvidos = linhas.filter((c) => c.status === 'devolvido').sort(porData);
  const aFazer = linhas.filter((c) => c.concluidoEm && ['pendente', 'rascunho'].includes(c.status)).sort(porData);
  const emObra = linhas.filter((c) => !c.concluidoEm && c.status === 'rascunho').sort(porData);
  const enviados = linhas.filter((c) => c.status === 'enviado').sort(porData);
  const aprovados = linhas.filter((c) => c.status === 'aprovado' && c.origem !== 'planilha').sort((a, b) => b.numero - a.numero);
  const daPlanilha = linhas.filter((c) => c.origem === 'planilha').length;

  const cartao = (c) => el('button', { type: 'button', class: 'check-forno', onclick: () => abrirChecklistFotos(c.fid, { perfil, modo: 'campo' }) }, [
    el('div', {}, [
      el('strong', {}, rotulo(c.fid)),
      el('small', {}, c.status === 'devolvido' && c.motivoDevolucao ? `Ajustar: ${c.motivoDevolucao}` : c.concluidoEm ? `Concluído em ${completa(c.concluidoEm)}` : 'Forno em obra'),
      c.status !== 'aprovado' ? el('div', { class: 'check-barra' }, el('i', { style: { width: `${(c.nFotos / SLOTS_FOTO.length) * 100}%` } })) : null
    ]),
    statusChip(c.status, c.status === 'aprovado' ? `Nº ${c.numero}` : c.status === 'enviado' ? 'Enviado' : c.status === 'devolvido' ? 'Devolvido' : `${c.nFotos}/8`)
  ]);
  const secao = (titulo, lista, extra = null) => el('section', { class: 'pilha' }, [
    el('div', { class: 'titulo-secao' }, [titulo, el('small', {}, String(lista.length))]),
    el('div', { class: 'pilha', style: { gap: '8px' } }, lista.map(cartao)),
    extra
  ]);

  return [
    el('h2', { style: { fontSize: '28px' } }, 'Fotos do checklist'),
    el('p', { class: 'fraco', style: { fontSize: '14px', marginTop: '-10px' } }, 'Cada forno concluído precisa de 8 fotos: em cada lado, a abóbada inteira e as 3 manilhas instaladas e revestidas. Enviou, o planejador aprova e o número entra na medição.'),
    devolvidos.length ? secao('Devolvidos para ajuste', devolvidos) : null,
    aFazer.length
      ? secao('Para fotografar', aFazer)
      : el('section', { class: 'pilha' }, [
          el('div', { class: 'titulo-secao' }, ['Para fotografar', el('small', {}, '0')]),
          el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nenhum forno esperando fotos'), 'Quando a última massa 1200 de um forno for lançada, ele aparece aqui.'])
        ]),
    emObra.length ? secao('Começados antes de fechar', emObra) : null,
    enviados.length ? secao('Esperando aprovação', enviados) : null,
    aprovados.length || daPlanilha
      ? secao('Aprovados no app', aprovados.slice(0, 8), daPlanilha ? el('p', { class: 'fraco', style: { fontSize: '13px', textAlign: 'center' } }, `${aprovados.length > 8 ? `e mais ${aprovados.length - 8} · ` : ''}${daPlanilha} aprovados antes do app, pela planilha`) : null)
      : null
  ];
}
