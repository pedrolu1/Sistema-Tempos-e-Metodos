import { useSyncExternalStore } from 'react';

let lista = [];
const ouvintes = new Set();
let seq = 0;

function emitir() {
  ouvintes.forEach((f) => f());
}

// toast('Post aprovado', { tipo: 'ok', agente: 'disparo', acao: { rotulo, onClick } })
export function toast(texto, opcoes = {}) {
  const id = ++seq;
  const item = { id, texto, tipo: 'info', duracao: 4200, ...opcoes };
  lista = [...lista.slice(-3), item];
  emitir();
  if (item.duracao) setTimeout(() => fecharToast(id), item.duracao);
  return id;
}

export function fecharToast(id) {
  lista = lista.filter((t) => t.id !== id);
  emitir();
}

export function useToasts() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => lista
  );
}
