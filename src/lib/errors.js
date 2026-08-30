import { toast } from './toast.js';

/**
 * Handler padrão de erro para onSnapshot — sem isso, uma consulta que falha
 * (índice composto faltando, regra de segurança bloqueando) simplesmente
 * para de atualizar em silêncio, e a tela fica "vazia" sem explicação.
 */
export function reportSnapshotError(context) {
  return (err) => {
    // eslint-disable-next-line no-console
    console.error(`[Firestore] ${context}:`, err);
    if (err?.code === 'failed-precondition') {
      toast(
        `"${context}" precisa de um índice do Firestore que ainda não existe. Abra o console do navegador (F12) — o próprio erro traz um link para criá-lo em 1 clique.`,
        'error',
        9000
      );
    } else if (err?.code === 'permission-denied') {
      toast(`Sem permissão para carregar "${context}". Verifique as regras de segurança do Firestore.`, 'error', 7000);
    } else {
      toast(`Não foi possível carregar "${context}" agora.`, 'error');
    }
  };
}
