// Tokens da Meta são guardados cifrados (AES-256-GCM) numa coleção que o app não lê.
import crypto from 'node:crypto';
import { TOKEN_KEY } from './config.js';

const chave = () => {
  const k = Buffer.from(TOKEN_KEY.value(), 'base64');
  if (k.length !== 32) throw new Error('TOKEN_KEY precisa ter 32 bytes em base64 (openssl rand -base64 32).');
  return k;
};

export function cifrar(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return { iv: iv.toString('base64'), dados: dados.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

export function decifrar({ iv, dados, tag }) {
  const d = crypto.createDecipheriv('aes-256-gcm', chave(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]).toString('utf8'));
}

// "state" do OAuth: prova que o retorno da Meta pertence a este usuário e não expirou.
export function assinarEstado(dados) {
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  const sig = crypto.createHmac('sha256', chave()).update(corpo).digest('base64url');
  return `${corpo}.${sig}`;
}

export function lerEstado(estado) {
  const [corpo, sig] = String(estado || '').split('.');
  if (!corpo || !sig) throw new Error('Retorno da Meta sem identificação.');
  const esperado = crypto.createHmac('sha256', chave()).update(corpo).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Retorno da Meta com assinatura inválida.');
  const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
  if (dados.exp < Date.now()) throw new Error('A autorização expirou. Tente conectar de novo.');
  return dados;
}
