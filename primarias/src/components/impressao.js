// Folha de impressão: o documento em papel branco, por cima do painel, com
// "Imprimir ou salvar PDF". Na impressão só a folha aparece.
import { el } from '../../../src/utils/dom.js';
import { ic } from '../lib/icones.js';

export function abrirImpressao({ titulo, subtitulo = '', conteudo, paisagem = false }) {
  const estilo = el('style', {}, `@media print { @page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 10mm; } }`);
  const aoTeclar = (e) => e.key === 'Escape' && fechar();
  const folha = el('div', { class: 'doc-folha', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo }, [
    el('div', { class: 'doc-barra' }, [
      el('strong', {}, titulo),
      el('span', { class: 'doc-dica' }, 'Para PDF, escolha "Salvar como PDF" na janela de impressão.'),
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => window.print() }, [el('span', { html: ic.imprimir(15), style: { display: 'inline-flex' } }), 'Imprimir ou salvar PDF']),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => fechar() }, 'Fechar')
    ]),
    el('article', { class: `doc-papel${paisagem ? ' paisagem' : ''}` }, [
      el('header', { class: 'doc-cab' }, [
        el('div', {}, [el('h1', {}, titulo), subtitulo ? el('p', {}, subtitulo) : null]),
        el('div', { class: 'doc-marca' }, ['REFRAMAX', el('small', {}, 'Substituição das primárias · Coqueria Ternium')])
      ]),
      ...conteudo,
      el('footer', { class: 'doc-rodape' }, `Gerado pelo app Primárias em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
    ])
  ]);
  function fechar() {
    folha.remove();
    estilo.remove();
    document.body.classList.remove('com-documento');
    removeEventListener('keydown', aoTeclar);
  }
  document.head.appendChild(estilo);
  document.body.appendChild(folha);
  document.body.classList.add('com-documento');
  addEventListener('keydown', aoTeclar);
  return { fechar };
}
