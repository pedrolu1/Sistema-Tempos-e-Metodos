// Modelos das planilhas de controle guardados neste aparelho (IndexedDB):
// o planejador escolhe o arquivo uma vez e o app preenche a partir dele.
const BANCO = 'prim-modelos';
const LOJA = 'arquivos';

function abrir() {
  return new Promise((ok, erro) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => erro(pedido.error);
  });
}

async function operar(modo, fn) {
  const db = await abrir();
  try {
    return await new Promise((ok, erro) => {
      const t = db.transaction(LOJA, modo);
      const pedido = fn(t.objectStore(LOJA));
      t.oncomplete = () => ok(pedido?.result);
      t.onerror = () => erro(t.error);
      t.onabort = () => erro(t.error);
    });
  } finally {
    db.close();
  }
}

/** { nome, tamanho, salvoEm, bytes } ou null. */
export async function lerModelo(chave) {
  try {
    return (await operar('readonly', (loja) => loja.get(chave))) || null;
  } catch {
    return null;
  }
}

export async function guardarModelo(chave, arquivo) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const modelo = { nome: arquivo.name, tamanho: bytes.length, salvoEm: Date.now(), bytes };
  try {
    await operar('readwrite', (loja) => loja.put(modelo, chave));
  } catch {
    /* sem IndexedDB (aba anônima): vale só até fechar a página */
  }
  return modelo;
}

export async function apagarModelo(chave) {
  try {
    await operar('readwrite', (loja) => loja.delete(chave));
  } catch {
    /* nada a apagar */
  }
}
