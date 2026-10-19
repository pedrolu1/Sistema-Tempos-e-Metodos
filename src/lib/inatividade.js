/**
 * Encerra a sessão do painel depois de um tempo sem uso (computador
 * esquecido aberto). Avisa 1 minuto antes, com a opção de continuar.
 * Não é usado no app de campo: lá, sair obrigaria a ter internet para
 * entrar de novo, e o celular é pessoal.
 */
export function vigiarInatividade({ minutos = 30, aoAvisar, aoExpirar }) {
  const LIMITE = minutos * 60000;
  let ultimo = Date.now();
  let avisado = false;
  const atividade = () => {
    ultimo = Date.now();
    if (avisado) {
      avisado = false;
      aoAvisar(false);
    }
  };
  const eventos = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  eventos.forEach((e) => window.addEventListener(e, atividade, { passive: true }));
  const timer = setInterval(() => {
    const parado = Date.now() - ultimo;
    if (parado >= LIMITE) {
      clearInterval(timer);
      aoExpirar();
    } else if (parado >= LIMITE - 60000 && !avisado) {
      avisado = true;
      aoAvisar(true);
    }
  }, 5000);
  return () => {
    clearInterval(timer);
    eventos.forEach((e) => window.removeEventListener(e, atividade));
  };
}
