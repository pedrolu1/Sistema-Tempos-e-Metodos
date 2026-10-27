// Retorno imediato a cada ação: vibração, faíscas, som curto e comemorações.
// Tudo respeita "reduzir movimento" do aparelho e o botão de som do perfil.
import { el } from '../../../src/utils/dom.js';
import { ic } from './icones.js';

const semMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const vibrar = (padrao = 12) => navigator.vibrate?.(padrao);

// ---------------------------------------------------------------------------
// Som: dois tons curtos sintetizados (sem arquivo de áudio para baixar)
// ---------------------------------------------------------------------------
const CHAVE_SOM = 'prim.som';
export function somLigado() {
  try {
    return localStorage.getItem(CHAVE_SOM) !== 'off';
  } catch {
    return true;
  }
}
export function alternarSom(ligado) {
  try {
    localStorage.setItem(CHAVE_SOM, ligado ? 'on' : 'off');
  } catch {
    /* sem armazenamento: vale até recarregar */
  }
}
let audio;
export function tocar(tipo = 'ok') {
  if (!somLigado()) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const notas = { ok: [660, 990], forno: [523, 659, 784, 1047], nivel: [392, 523, 659, 784, 1047] }[tipo] || [660];
    notas.forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      const t = audio.currentTime + i * 0.085;
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
  } catch {
    /* navegador sem áudio: segue em silêncio */
  }
}

// ---------------------------------------------------------------------------
// Faíscas que sobem de um ponto da tela (brasa saindo do forno)
// ---------------------------------------------------------------------------
let tela;
let particulas = [];
let rodando = false;
const CORES_BRASA = ['#ffb02e', '#ff8a1f', '#ff6a1a', '#ffd27a', '#ff5a14'];

export function faiscas(origem, { quantidade = 28, cores = CORES_BRASA, forca = 1 } = {}) {
  if (semMovimento()) return;
  const r = origem?.getBoundingClientRect ? origem.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : origem?.x ?? innerWidth / 2;
  const y = r ? r.top + r.height / 2 : origem?.y ?? innerHeight / 2;
  if (!tela) {
    tela = el('canvas', { class: 'faiscas', 'aria-hidden': 'true' });
    document.body.appendChild(tela);
  }
  const dpr = Math.min(2, devicePixelRatio || 1);
  tela.width = innerWidth * dpr;
  tela.height = innerHeight * dpr;
  for (let i = 0; i < quantidade; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25;
    const vel = (2.2 + Math.random() * 4.4) * forca;
    particulas.push({
      x, y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel - 1.2,
      vida: 1,
      decai: 0.012 + Math.random() * 0.018,
      raio: 1.4 + Math.random() * 2.6,
      cor: cores[i % cores.length]
    });
  }
  if (!rodando) {
    rodando = true;
    requestAnimationFrame(quadro);
  }
}

function quadro() {
  const ctx = tela.getContext('2d');
  const dpr = tela.width / innerWidth;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  particulas = particulas.filter((p) => p.vida > 0);
  for (const p of particulas) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 - 0.035; // brasa sobe com o calor
    p.vida -= p.decai;
    ctx.globalAlpha = Math.max(0, p.vida);
    ctx.fillStyle = p.cor;
    ctx.shadowColor = p.cor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.raio * (0.5 + p.vida / 2), 0, Math.PI * 2);
    ctx.fill();
  }
  if (particulas.length) requestAnimationFrame(quadro);
  else {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    rodando = false;
  }
}

// ---------------------------------------------------------------------------
// Números que sobem até o valor (contadores do painel e do perfil)
// ---------------------------------------------------------------------------
export function contar(no, ate, { de = Number(no.dataset.valor || 0), dur = 700, formato = (v) => Math.round(v).toLocaleString('pt-BR') } = {}) {
  no.dataset.valor = ate;
  if (semMovimento() || de === ate) {
    no.textContent = formato(ate);
    return;
  }
  const t0 = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    no.textContent = formato(de + (ate - de) * e);
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

/** "+30 XP" que sobe e some a partir de um elemento. */
export function xpFlutuante(origem, texto) {
  const r = origem.getBoundingClientRect();
  const n = el('div', { class: 'xp-flutuante', style: { left: `${r.left + r.width / 2}px`, top: `${r.top}px` } }, texto);
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 1300);
}

// ---------------------------------------------------------------------------
// Comemorações: forno fechado, bloco aceso, nível novo e conquista
// ---------------------------------------------------------------------------
export function comemorar({ titulo, texto, icone = ic.chama(46), grande = false, som = 'forno' }) {
  vibrar(grande ? [30, 50, 30, 50, 60] : [25, 40, 40]);
  tocar(som);
  const n = el('div', { class: `festa${grande ? ' festa-grande' : ''}`, role: 'status' }, [
    el('div', { class: 'festa-cartao' }, [
      el('div', { class: 'festa-icone', html: icone }),
      el('strong', {}, titulo),
      texto ? el('p', {}, texto) : null,
      el('small', {}, 'Toque para continuar')
    ])
  ]);
  const fechar = () => {
    n.classList.add('saindo');
    setTimeout(() => n.remove(), 260);
  };
  n.addEventListener('click', fechar);
  document.body.appendChild(n);
  requestAnimationFrame(() => faiscas({ x: innerWidth / 2, y: innerHeight / 2 }, { quantidade: grande ? 90 : 50, forca: grande ? 1.6 : 1.2 }));
  setTimeout(fechar, grande ? 3600 : 2600);
}

export function anunciarConquista(c) {
  const n = el('div', { class: 'conquista-aviso', role: 'status' }, [
    el('span', { class: 'conquista-selo', html: ic.medalha(22) }),
    el('div', {}, [el('small', {}, 'Conquista nova'), el('strong', {}, c.nome)])
  ]);
  document.body.appendChild(n);
  setTimeout(() => n.classList.add('saindo'), 2800);
  setTimeout(() => n.remove(), 3200);
}
