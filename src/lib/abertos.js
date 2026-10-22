/**
 * Lançamentos "em andamento": começaram, mas o término ainda não foi
 * apontado. Ficam guardados só no celular de quem lançou (funciona sem
 * internet e não entra nos indicadores) e viram um lançamento normal quando
 * a pessoa toca em "Finalizar".
 */
const chave = (uid) => `rfx.abertos.${uid}`;

export function listarAbertos(uid) {
  try {
    const lista = JSON.parse(localStorage.getItem(chave(uid)) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravar(uid, lista) {
  try {
    localStorage.setItem(chave(uid), JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

export function guardarAberto(uid, item) {
  const lista = listarAbertos(uid);
  lista.push({ ...item, id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` });
  return gravar(uid, lista);
}

export function removerAberto(uid, id) {
  gravar(uid, listarAbertos(uid).filter((a) => a.id !== id));
}

/** Minutos decorridos desde o início (data + hora do início até agora). */
export function minutosDecorridos(a, agora = new Date()) {
  const inicio = new Date(`${a.data}T${a.horaInicio}:00`);
  return Math.max(0, Math.round((agora - inicio) / 60000));
}
