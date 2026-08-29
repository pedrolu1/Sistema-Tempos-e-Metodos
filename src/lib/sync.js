import { waitForPendingWrites } from 'firebase/firestore';
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
