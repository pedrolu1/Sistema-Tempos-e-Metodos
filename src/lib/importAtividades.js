// Importação de atividades a partir de um arquivo do admin (Excel .xlsx/.xls,
// ou texto .csv/.tsv/.txt). O objetivo é ser tolerante: aceita cabeçalhos em
// português com ou sem acento, em qualquer ordem, e se não houver cabeçalho
// reconhecível, trata cada linha como o nome de uma atividade.
//
// Colunas reconhecidas (sinônimos): nome/atividade/etapa/descrição, tipo,
// contrato, setor, codigo/código, local, classificação/lean, duração/tempo
// (em minutos).

function normalizar(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const COLUNAS = {
  nome: ['nome', 'atividade', 'etapa', 'descricao', 'descrição', 'tarefa'],
  tipo: ['tipo'],
  contrato: ['contrato'],
  setor: ['setor', 'area', 'área'],
  codigo: ['codigo', 'código', 'cod', 'cód'],
  local: ['local', 'localtipo', 'local/tipo'],
  classificacao: ['classificacao', 'classificação', 'lean', 'va/dn', 'va dn dnn'],
  duracaoPadraoMin: ['duracao', 'duração', 'tempo', 'tempopadrao', 'tempo padrao', 'tempo padrão', 'duracaopadrao', 'min', 'minutos', 'duracao (min)', 'tempo (min)']
};

function acharColuna(headerNorm) {
  for (const [campo, sinonimos] of Object.entries(COLUNAS)) {
    if (sinonimos.includes(headerNorm)) return campo;
  }
  return null;
}

function parseMinutos(v) {
  const s = String(v || '').trim();
  if (!s) return 0;
  // "00:15" -> 15 min ; "1:30" -> 90
  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  const num = parseInt(s.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

function parseTipo(v) {
  const n = normalizar(v);
  if (n.startsWith('improd')) return 'improdutiva';
  return 'produtiva';
}

function parseClassificacao(v, tipo) {
  const n = normalizar(v).toUpperCase();
  if (n.includes('DNN') || n.includes('NAO NECESS')) return 'DNN';
  if (n.includes('VA') || n.includes('VALOR')) return 'VA';
  if (n.includes('DN') || n.includes('NECESS')) return 'DN';
  return tipo === 'produtiva' ? 'DN' : 'DNN';
}

/** Converte uma matriz de linhas (array de arrays) em objetos de atividade. */
function linhasParaAtividades(matriz) {
  const linhas = matriz.filter((r) => Array.isArray(r) && r.some((c) => String(c || '').trim() !== ''));
  if (linhas.length === 0) return [];

  // detecta cabeçalho: se alguma célula da 1ª linha casar com "nome"/sinônimos
  const primeira = linhas[0].map((c) => normalizar(c));
  const temHeader = primeira.some((h) => COLUNAS.nome.includes(h));

  let mapa = {};
  let dados;
  if (temHeader) {
    primeira.forEach((h, i) => {
      const campo = acharColuna(h);
      if (campo && mapa[campo] === undefined) mapa[campo] = i;
    });
    dados = linhas.slice(1);
  } else {
    // sem cabeçalho: primeira coluna é o nome
    mapa = { nome: 0 };
    dados = linhas;
  }

  const out = [];
  for (const r of dados) {
    const get = (campo) => (mapa[campo] !== undefined ? r[mapa[campo]] : undefined);
    const nome = String(get('nome') || '').trim();
    if (!nome) continue;
    const tipo = mapa.tipo !== undefined ? parseTipo(get('tipo')) : 'produtiva';
    out.push({
      nome,
      tipo,
      contrato: String(get('contrato') || '').trim(),
      setor: String(get('setor') || '').trim(),
      codigo: String(get('codigo') || '').trim(),
      local: String(get('local') || '').trim(),
      classificacao: parseClassificacao(get('classificacao'), tipo),
      duracaoPadraoMin: tipo === 'produtiva' ? parseMinutos(get('duracaoPadraoMin')) : 0
    });
  }
  return out;
}

function detectarDelimitador(texto) {
  const linha = texto.split(/\r?\n/).find((l) => l.trim() !== '') || '';
  const tab = (linha.match(/\t/g) || []).length;
  const ponto = (linha.match(/;/g) || []).length;
  const virg = (linha.match(/,/g) || []).length;
  if (tab >= ponto && tab >= virg) return '\t';
  if (ponto >= virg) return ';';
  return ',';
}

function parseCSV(texto, delim) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false;
      } else campo += c;
    } else if (c === '"') {
      aspas = true;
    } else if (c === delim) {
      linha.push(campo); campo = '';
    } else if (c === '\n') {
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else if (c === '\r') {
      // ignora — o \n cuida da quebra
    } else {
      campo += c;
    }
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/** Lê o arquivo e devolve a lista de atividades. Lança erro com mensagem amigável. */
export async function parseAtividadesArquivo(file) {
  const nome = (file.name || '').toLowerCase();
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error('A planilha está vazia.');
    const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
    return linhasParaAtividades(matriz);
  }
  // texto (csv/tsv/txt)
  const texto = await file.text();
  if (!texto.trim()) throw new Error('O arquivo está vazio.');
  const delim = detectarDelimitador(texto);
  return linhasParaAtividades(parseCSV(texto, delim));
}
