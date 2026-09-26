// Teste sem internet e sem chave: sobe um servidor que imita a API do Claude,
// roda Verbo, Traço e a pesquisa do Radar contra ele e confere o formato das chamadas.
// Uso: node teste-offline.js
import http from 'node:http';
import assert from 'node:assert/strict';

const pedidos = [];

// gera um exemplo mínimo válido a partir do JSON schema pedido
function exemplo(s) {
  if (s.enum) return s.enum[0];
  if (s.type === 'object') return Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, exemplo(v)]));
  if (s.type === 'array') return [exemplo(s.items)];
  if (s.type === 'boolean') return false;
  if (s.type === 'integer') return 0;
  return 'texto — com travessão e **negrito**';
}

const servidor = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => (corpo += c));
  req.on('end', () => {
    const b = JSON.parse(corpo);
    pedidos.push({ headers: req.headers, corpo: b });
    const esquema = b.output_config?.format?.schema;
    const content = esquema
      ? [{ type: 'text', text: JSON.stringify(exemplo(esquema)) }]
      : [
          { type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'x' } },
          { type: 'web_search_tool_result', tool_use_id: 'srv_1', content: [{ type: 'web_search_result', url: 'https://exemplo.com', title: 'Exemplo', encrypted_content: 'x' }] },
          { type: 'text', text: 'Anotações: #cafeespecial está em alta.' }
        ];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: b.model, content, stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});

await new Promise((ok) => servidor.listen(0, ok));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${servidor.address().port}`;
process.env.ANTHROPIC_API_KEY = 'teste';

const { escrever } = await import('./agentes/verbo.js');
const { desenhar } = await import('./agentes/traco.js');
const { pesquisarNaWeb } = await import('./lib/claude.js');

const marca = { nome: 'Café Aurora', nicho: 'cafeteria', cidade: 'Belo Horizonte', voz: { tom: 70, emojis: 'pouco' }, cta: { tipo: 'whatsapp' } };
const post = { id: 'p1', formato: 'feed', pauta: { tipo: 'produto', tema: 'pão de fermentação natural', objetivo: 'vendas' } };
const fotos = [{ id: 'f1', descricao: 'pão sobre a bancada', usos: 0, analise: { zonaTexto: 'topo', focal: { x: 0.4, y: 0.6 }, claridade: 0.5 } }];

const texto = await escrever({ marca, post, design: { template: 'recorte', titulo: 'Pão da casa' }, foto: fotos[0] });
assert.ok(!/[—–]/.test(texto.legenda), 'legenda não pode ter travessão');
assert.ok(!texto.legenda.includes('**'), 'legenda não pode ter negrito');
assert.ok(texto.hashtags.every((h) => h.startsWith('#') && h === h.toLowerCase()), 'hashtags normalizadas');

const arte = await desenhar({ marca, post, fotos });
assert.equal(arte.precisaFoto, false);
assert.equal(arte.design.template, 'manchete');

const web = await pesquisarNaWeb({ sistema: 'teste', pergunta: 'tendências', cidade: 'Belo Horizonte' });
assert.equal(web.fontes[0].url, 'https://exemplo.com');

for (const { headers, corpo } of pedidos) {
  assert.equal(corpo.model, 'claude-opus-5');
  assert.equal(corpo.fallbacks, 'default');
  assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(corpo.thinking.type, 'adaptive');
  assert.ok(!('budget_tokens' in corpo.thinking));
}
assert.equal(pedidos[2].corpo.tools[0].type, 'web_search_20260209');
console.log(`ok: ${pedidos.length} chamadas conferidas`);
servidor.close();
