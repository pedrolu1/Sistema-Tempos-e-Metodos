import { defineSecret, defineString } from 'firebase-functions/params';

// Segredos (firebase functions:secrets:set NOME)
export const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
export const META_APP_SECRET = defineSecret('META_APP_SECRET');
// 32 bytes em base64. Gere com: openssl rand -base64 32
export const TOKEN_KEY = defineSecret('TOKEN_KEY');

// Parâmetros (functions/.env ou perguntados no deploy)
export const META_APP_ID = defineString('META_APP_ID');
// URL pública da função metaRetorno (ou da reescrita /api/meta/retorno no Hosting)
export const META_REDIRECT_URI = defineString('META_REDIRECT_URI');
export const META_GRAPH_VERSION = defineString('META_GRAPH_VERSION', { default: 'v23.0' });
export const CLAUDE_MODEL = defineString('CLAUDE_MODEL', { default: 'claude-opus-5' });
export const FUSO = defineString('FUSO', { default: 'America/Sao_Paulo' });

export const REGIAO = 'southamerica-east1';

// Lê um parâmetro com valor padrão (fora do deploy, .value() pode vir vazio).
export function valor(param, padrao) {
  try {
    return param.value() || padrao;
  } catch {
    return padrao;
  }
}
export const modelo = () => valor(CLAUDE_MODEL, 'claude-opus-5');
export const versaoGraph = () => valor(META_GRAPH_VERSION, 'v23.0');
export const fuso = () => valor(FUSO, 'America/Sao_Paulo');
export const SEGREDOS_IA = [ANTHROPIC_API_KEY, TOKEN_KEY, META_APP_SECRET];
