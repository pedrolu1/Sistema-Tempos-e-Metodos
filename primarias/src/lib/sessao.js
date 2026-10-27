// Quem está usando. Nesta etapa (só a interface) a pessoa escolhe com qual
// papel entrar; cada aba guarda o seu, para dar para abrir o campo numa aba e
// o painel em outra. Na etapa 2 entra o login por matrícula do Tempos & Métodos.
import { PAPEIS } from '../data/obra.js';

export const PERFIS_DEMO = [
  { uid: 'demo-apontador', nome: 'Apontador', papel: 'apontador', desc: 'Lança as etapas e preenche o RDO do dia.' },
  { uid: 'demo-lider-1', nome: 'Líder 1', papel: 'lider', desc: 'Lança o avanço da equipe no campo.' },
  { uid: 'demo-lider-2', nome: 'Líder 2', papel: 'lider', desc: 'Outro líder, para ver o tempo real entre equipes.' },
  { uid: 'demo-planejador', nome: 'Planejador', papel: 'planejador', desc: 'Acompanha tudo, aprova correções e fecha o RDO.' },
  { uid: 'demo-gestor', nome: 'Gestor', papel: 'gestor', desc: 'Só acompanha o painel, sem alterar nada.' },
  { uid: 'demo-admin', nome: 'Administrador', papel: 'admin', desc: 'Tudo do planejador e a configuração do app.' }
];

const CHAVE = 'prim.perfil';

export function perfilAtual() {
  try {
    const uid = sessionStorage.getItem(CHAVE) || localStorage.getItem(CHAVE);
    return PERFIS_DEMO.find((p) => p.uid === uid) || null;
  } catch {
    return null;
  }
}

export function entrarComo(uid) {
  try {
    sessionStorage.setItem(CHAVE, uid);
    localStorage.setItem(CHAVE, uid);
  } catch {
    /* sem armazenamento: vale só nesta página */
  }
}

export function sair() {
  try {
    sessionStorage.removeItem(CHAVE);
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a limpar */
  }
}

export const ehCampo = (p) => Boolean(PAPEIS[p.papel]?.campo);
export const podeGerir = (p) => Boolean(PAPEIS[p.papel]?.gestao);
export const somenteLeitura = (p) => Boolean(PAPEIS[p.papel]?.somenteLeitura);
export const autorDe = (p) => ({ uid: p.uid, nome: p.nome, papel: p.papel });
