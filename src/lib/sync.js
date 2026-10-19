import { waitForPendingWrites } from 'firebase/firestore';
import { toast } from './toast.js';
import { registrarErro } from './saude.js';
import { db } from './firebase.js';

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function onConnectivityChange(callback) {
  const on = () => callback(true);
  const off = () => callback(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', off);
  };
}

/**
 * Aciona a sincronização explícita: se estiver online, aguarda a confirmação
 * do servidor para todas as escritas pendentes do cache local (é o próprio
 * Firestore que envia os dados assim que percebe rede — esta chamada só dá
 * uma confirmação visual e determinística para o botão de sincronizar).
 */
export async function syncNow() {
  if (!isOnline()) {
    return { ok: false, reason: 'offline' };
  }
  await waitForPendingWrites(db);
  return { ok: true };
}

/**
 * As escritas do Firestore (addDoc/updateDoc) só resolvem quando o SERVIDOR
 * confirma — sem internet, a promessa fica pendurada para sempre, mesmo com
 * o dado já salvo no cache do aparelho (e sincronizando sozinho depois).
 * Isto espera no máximo `ms`: se o servidor não respondeu até lá, considera
 * a gravação local suficiente e segue. Um erro que chegue depois (ex.:
 * regra de segurança recusou) ainda é avisado ao usuário.
 */
export function gravacaoLocal(promise, contexto = 'registro', ms = 1500) {
  let encerrado = false;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      encerrado = true;
      resolve(null);
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        if (!encerrado) resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        if (!encerrado) reject(err);
        if (encerrado) {
          registrarErro(`gravacao:${contexto}`, err);
          toast(`O servidor recusou um ${contexto} salvo offline. Abra o app com internet e confira.`, 'error', 7000);
        }
      }
    );
  });
}
