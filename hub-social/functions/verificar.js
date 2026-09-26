// Confere se todos os módulos carregam (sintaxe e imports) sem precisar de deploy.
import * as funcoes from './index.js';
import { montarJanelas, matrizPadrao, paraISO } from './lib/horarios.js';

const nomes = Object.keys(funcoes);
console.log('funções exportadas:', nomes.join(', '));

const j = montarJanelas({ matriz: matrizPadrao(), ritmo: { feed: 4, stories: 5 }, padrao: true });
console.log(`janelas geradas para 14 dias: ${j.length}`, j.slice(0, 3));
const iso = paraISO(2026, 9, 1, 19, 5, 'America/Sao_Paulo');
if (iso !== '2026-10-01T22:05:00.000Z') throw new Error(`fuso errado: ${iso}`);
console.log('conversão de fuso ok:', iso);
