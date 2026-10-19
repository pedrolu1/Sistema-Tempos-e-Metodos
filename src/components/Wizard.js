import { el, mount } from '../utils/dom.js';
import { button } from './ui.js';
import { icon } from '../utils/icons.js';
import { toast } from '../lib/toast.js';

/**
 * Rascunho local de um assistente: guarda o estado a cada passo para que um
 * estudo em andamento sobreviva a recarregar a página, perder a rede ou o
 * app atualizar no meio da cronometragem.
 */
export function rascunho(chave) {
  const k = `rfx.rascunho.${chave}`;
  return {
    ler() {
      try {
        const raw = localStorage.getItem(k);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    salvar(estado) {
      try {
        localStorage.setItem(k, JSON.stringify(estado));
      } catch {
        /* sem armazenamento local: o assistente segue funcionando, só não guarda rascunho */
      }
    },
    limpar() {
      try {
        localStorage.removeItem(k);
      } catch {
        /* idem */
      }
    }
  };
}

/**
 * Assistente passo a passo. Cada passo tem título, um texto "como funciona"
 * (a parte didática) e um `render(estado, atualizar)` que devolve o conteúdo
 * — ou `{ node, destruir }` quando precisa limpar algo ao sair (ex.: o
 * cronômetro). `validar(estado)` devolve a mensagem que impede avançar.
 * O estado é um único objeto compartilhado entre os passos.
 */
export function wizard({ titulo, iconeHtml, passos, estado, rascunhoChave, aoConcluir, aoSair, rotuloConcluir = 'Salvar estudo' }) {
  const draft = rascunhoChave ? rascunho(rascunhoChave) : null;
  let idx = Math.min(estado._passo || 0, passos.length - 1);
  let destruirPasso = null;
  let salvando = false;

  const head = el('div', { class: 'wiz-head' });
  const progress = el('div', { class: 'wiz-progress' });
  const help = el('div');
  const body = el('div', { class: 'wiz-body' });
  const foot = el('div', { class: 'wiz-foot' });
  const node = el('div', { class: 'wiz' }, [head, progress, help, body, foot]);

  function guardar() {
    estado._passo = idx;
    if (draft) draft.salvar(estado);
  }

  /**
   * Chamado pelos próprios passos: guarda o rascunho e redesenha o conteúdo
   * do passo. `{ repintar: false }` só guarda (para campos que se atualizam
   * sozinhos e perderiam o foco se a tela fosse redesenhada).
   */
  function atualizar(opts) {
    guardar();
    if (opts?.repintar === false) return;
    pintarPasso();
  }

  function pintarPasso() {
    if (destruirPasso) destruirPasso();
    destruirPasso = null;
    const out = passos[idx].render(estado, atualizar);
    if (out && out.node) {
      mount(body, [out.node]);
      destruirPasso = out.destruir || null;
    } else {
      mount(body, [out]);
    }
  }

  function pintar() {
    const passo = passos[idx];
    mount(head, [
      el('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', title: 'Sair do assistente', onclick: sair }, el('span', { html: icon.arrowLeft(18), style: { display: 'inline-flex' } })),
      iconeHtml ? el('span', { class: 'wiz-icon', html: iconeHtml }) : null,
      el('div', { style: { minWidth: '0' } }, [
        el('div', { class: 'wiz-title' }, titulo),
        el('div', { class: 'wiz-sub' }, `Passo ${idx + 1} de ${passos.length} · ${passo.titulo}`)
      ])
    ]);
    mount(progress, passos.map((p, i) => el('span', { class: i < idx ? 'done' : i === idx ? 'on' : '', title: p.titulo })));
    mount(help, passo.ajuda
      ? [el('div', { class: 'wiz-help' }, [
          el('span', { html: icon.lightbulb(16), style: { display: 'inline-flex', flexShrink: '0', color: 'var(--info-500)' } }),
          el('div', {}, [].concat(passo.ajuda).map((t) => el('p', {}, t)))
        ])]
      : []);
    pintarPasso();

    const ultimo = idx === passos.length - 1;
    mount(foot, [
      idx > 0 ? button({ label: 'Voltar', variant: 'ghost', size: 'lg', onClick: () => ir(idx - 1) }) : el('span'),
      button({
        label: ultimo ? rotuloConcluir : 'Próximo',
        variant: 'primary',
        size: 'lg',
        icon: ultimo ? icon.check(18) : null,
        onClick: ultimo ? concluir : () => ir(idx + 1)
      })
    ]);
  }

  function ir(novo) {
    if (novo > idx) {
      const erro = passos[idx].validar?.(estado);
      if (erro) {
        toast(erro, 'error');
        return;
      }
    }
    idx = novo;
    guardar();
    pintar();
    node.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  async function concluir() {
    const erro = passos[idx].validar?.(estado);
    if (erro) return toast(erro, 'error');
    if (salvando) return;
    salvando = true;
    try {
      await aoConcluir(estado);
      if (draft) draft.limpar();
      destruir();
    } catch {
      toast('Não foi possível salvar o estudo. Seus dados continuam aqui — tente de novo.', 'error');
    } finally {
      salvando = false;
    }
  }

  function sair() {
    guardar(); // o rascunho fica: dá para continuar depois
    destruir();
    aoSair?.();
  }

  function destruir() {
    if (destruirPasso) destruirPasso();
    destruirPasso = null;
  }

  pintar();
  return { node, destruir };
}
