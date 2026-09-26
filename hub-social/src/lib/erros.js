const MENSAGENS = {
  'auth/invalid-credential': 'E-mail ou senha não conferem.',
  'auth/wrong-password': 'E-mail ou senha não conferem.',
  'auth/user-not-found': 'E-mail ou senha não conferem.',
  'auth/invalid-email': 'Esse e-mail não parece válido.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail. Tente entrar.',
  'auth/weak-password': 'Senha fraca. Use pelo menos 8 caracteres com letras e números.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet. Confira sua rede.',
  'auth/popup-closed-by-user': 'A janela foi fechada antes de terminar.',
  'auth/popup-blocked': 'O navegador bloqueou a janela. Libere pop-ups para este site.',
  'auth/expired-action-code': 'Esse link expirou ou já foi usado. Peça um novo.',
  'auth/invalid-action-code': 'Esse link expirou ou já foi usado. Peça um novo.',
  'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.'
};

export function mensagemDeErro(e) {
  if (!e) return '';
  return MENSAGENS[e.code] || e.message || 'Algo deu errado. Tente de novo.';
}

// Força da senha: 0 a 3
export function forcaSenha(s = '') {
  let f = 0;
  if (s.length >= 8) f++;
  if (/[a-zA-Z]/.test(s) && /\d/.test(s)) f++;
  if (s.length >= 12 || /[^a-zA-Z0-9]/.test(s)) f++;
  if (/^(12345678|senha123|password|qwerty)/i.test(s)) f = 0;
  return f;
}

export const ROTULO_FORCA = ['Fraca', 'Fraca', 'Boa', 'Forte'];
