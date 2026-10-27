// Só na demonstração: líderes "virtuais" lançando de tempos em tempos, para
// ver o painel e o mapa mudando sozinhos. Roda só na aba em que foi ligada.
import { calcular, alvosDoForno } from './calculo.js';
import { estadoAtual, lancar } from './store.js';
import { FORNOS, ETAPAS, contratoAtivo, primariaPorId } from '../data/obra.js';
import { hoje } from './datas.js';
import { PERFIS_DEMO, autorDe } from './sessao.js';

const CHAVE = 'prim.simular';
let timer = null;

export function simulando() {
  try {
    return sessionStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

export function alternarSimulacao(ligar) {
  try {
    sessionStorage.setItem(CHAVE, ligar ? '1' : '0');
  } catch {
    /* sem armazenamento: vale até recarregar */
  }
  clearTimeout(timer);
  timer = null;
  if (ligar) agendar();
}

function agendar() {
  timer = setTimeout(() => {
    passo();
    agendar();
  }, 5000 + Math.random() * 5000);
}

function passo() {
  const calc = calcular(estadoAtual());
  const bat = contratoAtivo().bateria;
  const abertos = FORNOS.filter((f) => f.bateria === bat && !calc.fornos[f.id].concluidoEm);
  const candidatos = [];
  for (const f of abertos) {
    for (let e = ETAPAS.length - 1; e >= 0; e--) {
      const livres = alvosDoForno(calc, ETAPAS[e].id, f.id).filter((a) => a.ok);
      if (livres.length) {
        candidatos.push({ etapa: ETAPAS[e], livres });
        break;
      }
    }
    if (candidatos.length >= 6) break;
  }
  if (!candidatos.length) return;
  const c = candidatos[Math.floor(Math.random() * candidatos.length)];
  // por primária, lança um lado de cada vez, como a equipe costuma fazer
  let alvos = c.livres.map((a) => a.id);
  if (c.etapa.nivel === 'primaria') {
    const lado = primariaPorId[alvos[0]].lado;
    alvos = alvos.filter((id) => primariaPorId[id].lado === lado);
  }
  const quem = PERFIS_DEMO.filter((p) => ['lider', 'apontador'].includes(p.papel));
  lancar({ etapa: c.etapa.id, alvos, data: hoje(), autor: autorDe(quem[Math.floor(Math.random() * quem.length)]) });
}

if (simulando()) agendar();
