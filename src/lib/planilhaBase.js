import { EFETIVO_CAMPOS, ESCALAS, formatDateBR } from '../utils/format.js';
import { STATUS_PROJETO, updateProjeto, sanitizeEtapa, sanitizeImprodutividade } from './projetos.js';
import { vincularAtividades } from './activities.js';
import { auditar } from './auditoria.js';

/**
 * Base de planejamento editável no Excel: o planejador baixa a planilha,
 * altera horários, equipe e as atividades dos projetos, e envia de volta. Antes de
 * gravar, o app mostra exatamente o que vai mudar. Linhas são casadas pelo
 * ID — por isso a coluna de ID não deve ser alterada.
 */

const MOD_COLS = EFETIVO_CAMPOS.map((c) => ({ key: c.key, label: `MOD ${c.label}` }));
const COLS_PROJ = ['ID (não alterar)', 'Projeto', 'Cliente', 'Contrato', 'Setor', 'Situação', 'Início', 'Término', 'Escala', 'Jornada (h)', 'Chegada', 'Saída', 'Almoço início', 'Almoço fim', 'Turmas', ...MOD_COLS.map((m) => m.label), 'Restrições (separe com ;)'];
const COLS_ATV = ['ID projeto (não alterar)', 'Projeto', 'ID atividade (não alterar)', 'Tipo', 'Ordem', 'Código', 'Atividade', 'Lean', 'Tempo padrão (min)', ...MOD_COLS.map((m) => m.label)];

const LEIA_ME = [
  ['REFRAMAX Tempos & Métodos — base de planejamento'],
  [''],
  ['Como usar'],
  ['1. Aba Projetos: horários, equipe (MOD), situação, datas e restrições de cada projeto.'],
  ['2. Aba Atividades: as atividades de cada projeto — Tipo (Produtiva ou Improdutividade), Lean (VA/DN ou DN/DNN), tempo padrão e equipe.'],
  ['3. Não altere as colunas de ID — é por elas que o app reconhece cada linha.'],
  ['4. Para incluir uma atividade num projeto, crie uma linha com o ID do projeto e deixe o ID da atividade vazio.'],
  ['5. Volte ao app (Projetos → Enviar planilha editada). O app mostra tudo o que vai mudar antes de gravar.'],
  [''],
  ['O que a planilha não faz (use o app)'],
  ['• Apagar projetos ou atividades — linhas apagadas aqui são simplesmente ignoradas.'],
  ['• Criar projetos novos (é preciso escolher cliente e contrato no app).'],
  [''],
  ['A aba Lançamentos é só para consulta e análise: alterações nela não voltam para o app.']
];

// ------------------------------------------------------------ exportar
export async function exportarBase({ projetos = [], lancamentos = [] }) {
  const XLSX = await import('xlsx');
  const mod = (ef = {}) => MOD_COLS.map((m) => Number(ef[m.key]) || 0);
  const status = (v) => STATUS_PROJETO.find((s) => s.value === v)?.label || 'Planejado';
  const escala = (v) => ESCALAS.find((e) => e.value === v)?.label || v || '';

  const proj = projetos.map((p) => {
    const f = p.ficha || {};
    return [
      p.id, p.nome, p.clienteNome || '', p.contratoNome || '', p.setor || '', status(p.status), p.dataInicio || '', p.dataFim || '',
      escala(f.escala), Number(f.horasPorTurno) || 0, f.horaChegada || '', f.horaSaida || '', f.almocoInicio || '', f.almocoFim || '', Number(f.turmas) || 1,
      ...mod(f.efetivo), (f.restricoes || []).join('; ')
    ];
  });
  const atividadesProj = projetos.flatMap((p) => [
    ...(p.etapas || []).map((e, i) => [p.id, p.nome, e.id, 'Produtiva', i + 1, e.codigo || '', e.nome, e.classificacao || '', Number(e.duracaoMin) || 0, ...mod(e.efetivo)]),
    ...(p.improdutividades || []).map((m, i) => [p.id, p.nome, m.id, 'Improdutividade', i + 1, '', m.nome, m.classificacao || '', 0, ...mod({})])
  ]);
  const lanc = lancamentos.map((l) => [
    formatDateBR(l.data), l.horaInicio, l.horaTermino, Number(l.duracaoMinutos) || 0, l.tipoRegistro === 'improdutividade' ? 'Improdutividade' : 'Atividade',
    l.projetoNome || 'Avulso', l.contrato || '', l.setor || '', l.atividadeNome || '', l.classificacao || '', Number(l.duracaoPadraoMin) || 0, Number(l.excedenteMin) || 0,
    ...mod(l.efetivo), l.justificativa || '', l.criadoPorNome || ''
  ]);

  const wb = XLSX.utils.book_new();
  const aba = (nome, linhas, larguras) => {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    if (larguras) ws['!cols'] = larguras.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, nome);
  };
  aba('Leia-me', LEIA_ME, [110]);
  aba('Projetos', [COLS_PROJ, ...proj], [22, 34, 18, 18, 14, 14, 11, 11, 12, 9, 8, 8, 10, 10, 7, ...MOD_COLS.map(() => 11), 50]);
  aba('Atividades', [COLS_ATV, ...atividadesProj], [22, 30, 18, 15, 7, 9, 44, 6, 12, ...MOD_COLS.map(() => 11)]);
  aba('Lançamentos (consulta)', [
    ['Data', 'Início', 'Término', 'Duração (min)', 'Tipo', 'Projeto', 'Contrato', 'Setor', 'Atividade', 'Lean', 'Planejado (min)', 'Excedente (min)', ...MOD_COLS.map((m) => m.label.replace('MOD', 'Real')), 'Justificativa', 'Lançado por'],
    ...lanc
  ]);
  const d = new Date();
  XLSX.writeFile(wb, `reframax-base-planejamento-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.xlsx`);
}

// ------------------------------------------------------------ ler e comparar
const txt = (v) => String(v ?? '').trim();
const numero = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Excel guarda hora como fração do dia; texto pode vir "7:00" ou "07:00:00". */
function hora(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') {
    const min = Math.round((v % 1) * 1440);
    return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  }
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}

/** Aceita AAAA-MM-DD, DD/MM/AAAA ou número de série do Excel. */
function data(v, XLSX) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : '';
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

const lean = (v, tipo) => {
  const s = txt(v).toUpperCase();
  if (tipo === 'improdutiva') return s === 'DN' ? 'DN' : 'DNN';
  return s === 'VA' ? 'VA' : 'DN';
};
const efetivoDe = (linha) => Object.fromEntries(MOD_COLS.map((m) => [m.key, Math.max(0, Math.round(numero(linha[m.label])))]));
const mesmoEfetivo = (a = {}, b = {}) => EFETIVO_CAMPOS.every((c) => (Number(a[c.key]) || 0) === (Number(b[c.key]) || 0));

/**
 * Lê a planilha enviada e compara com os dados atuais. Não grava nada:
 * devolve um "plano" com as alterações e os erros encontrados.
 */
export async function lerBase(file, { projetos = [] }) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const linhas = (nome) => (wb.Sheets[nome] ? XLSX.utils.sheet_to_json(wb.Sheets[nome], { defval: '', raw: true }) : []);
  const plano = { projetosAlterados: new Map(), erros: [] };
  const mudancaProjeto = (p) => {
    if (!plano.projetosAlterados.has(p.id)) plano.projetosAlterados.set(p.id, { projeto: p, patch: {}, itens: [] });
    return plano.projetosAlterados.get(p.id);
  };

  if (!wb.Sheets.Projetos && !wb.Sheets.Atividades) {
    plano.erros.push('Esta não parece ser a planilha de planejamento do app (faltam as abas Projetos e Atividades). Baixe uma nova em "Baixar planilha".');
    plano.projetosAlterados = [];
    plano.total = 0;
    return plano;
  }

  // ---- Projetos (ficha)
  linhas('Projetos').forEach((r, i) => {
    const id = txt(r[COLS_PROJ[0]]);
    if (!id) return;
    const p = projetos.find((x) => x.id === id);
    if (!p) return plano.erros.push(`Projetos, linha ${i + 2}: ID "${id}" não existe no app.`);
    const f = p.ficha || {};
    const st = STATUS_PROJETO.find((s) => s.label.toLowerCase() === txt(r['Situação']).toLowerCase() || s.value === txt(r['Situação']).toLowerCase());
    const esc = ESCALAS.find((e) => e.label.toLowerCase() === txt(r.Escala).toLowerCase() || e.value === txt(r.Escala).toLowerCase());
    const novaFicha = {
      ...f,
      escala: esc?.value || f.escala,
      horasPorTurno: Math.round(numero(r['Jornada (h)'])) || f.horasPorTurno,
      horaChegada: hora(r.Chegada) || f.horaChegada,
      horaSaida: hora(r['Saída']) || f.horaSaida,
      almocoInicio: hora(r['Almoço início']),
      almocoFim: hora(r['Almoço fim']),
      turmas: Math.max(1, Math.round(numero(r.Turmas)) || 1),
      efetivo: efetivoDe(r),
      restricoes: txt(r['Restrições (separe com ;)']).split(';').map((x) => x.trim()).filter(Boolean)
    };
    const patch = {};
    const nome = txt(r.Projeto);
    if (nome && nome !== p.nome) patch.nome = nome;
    if (txt(r.Setor) !== (p.setor || '')) patch.setor = txt(r.Setor);
    if (st && st.value !== (p.status || 'planejado')) patch.status = st.value;
    const ini = data(r['Início'], XLSX);
    const fim = data(r['Término'], XLSX);
    if (ini !== (p.dataInicio || '')) patch.dataInicio = ini;
    if (fim !== (p.dataFim || '')) patch.dataFim = fim;
    const fichaMudou =
      ['escala', 'horasPorTurno', 'horaChegada', 'horaSaida', 'almocoInicio', 'almocoFim', 'turmas'].some((k) => String(novaFicha[k] ?? '') !== String(f[k] ?? '')) ||
      !mesmoEfetivo(novaFicha.efetivo, f.efetivo) ||
      novaFicha.restricoes.join('|') !== (f.restricoes || []).join('|');
    if (fichaMudou) patch.ficha = novaFicha;
    if (Object.keys(patch).length) {
      const m = mudancaProjeto(p);
      Object.assign(m.patch, patch);
      const NOMES = { ficha: 'horários/equipe/restrições', nome: 'nome', setor: 'setor', status: 'situação', dataInicio: 'início', dataFim: 'término' };
      m.itens.push(`ficha: ${Object.keys(patch).map((k) => NOMES[k] || k).join(', ')}`);
    }
  });

  // ---- Atividades dos projetos (produtivas e improdutividades)
  const porProjeto = new Map();
  linhas('Atividades').forEach((r, i) => {
    const pid = txt(r[COLS_ATV[0]]);
    if (!pid) return;
    if (!porProjeto.has(pid)) porProjeto.set(pid, []);
    porProjeto.get(pid).push({ r, linha: i + 2 });
  });
  porProjeto.forEach((rows, pid) => {
    const p = projetos.find((x) => x.id === pid);
    if (!p) return plano.erros.push(`Atividades: projeto com ID "${pid}" não existe no app.`);
    rows.sort((a, b) => numero(a.r.Ordem) - numero(b.r.Ordem));
    [['produtiva', 'etapas'], ['improdutiva', 'improdutividades']].forEach(([tipo, campo]) => {
      const atuais = p[campo] || [];
      const usadas = new Set();
      const lista = [];
      let alteradas = 0;
      let incluidas = 0;
      rows.filter(({ r }) => /improd/i.test(txt(r.Tipo)) === (tipo === 'improdutiva')).forEach(({ r, linha }) => {
        const id = txt(r['ID atividade (não alterar)']);
        const nome = txt(r.Atividade);
        const campos = tipo === 'produtiva'
          ? { codigo: txt(r['Código']), nome, classificacao: lean(r.Lean, tipo), duracaoMin: Math.max(0, Math.round(numero(r['Tempo padrão (min)']))), efetivo: efetivoDe(r) }
          : { nome, classificacao: lean(r.Lean, tipo) };
        if (id) {
          const atual = atuais.find((e) => e.id === id);
          if (!atual) return plano.erros.push(`Atividades, linha ${linha}: a atividade "${id}" não existe no projeto "${p.nome}".`);
          usadas.add(id);
          const nova = { ...atual, ...campos, nome: nome || atual.nome };
          const mudou = Object.keys(campos).some((k) => (k === 'efetivo' ? !mesmoEfetivo(nova.efetivo, atual.efetivo) : String(nova[k] ?? '') !== String(atual[k] ?? '')));
          if (mudou) alteradas++;
          lista.push(nova);
          return;
        }
        if (!nome) return plano.erros.push(`Atividades, linha ${linha}: informe o nome da atividade.`);
        incluidas++;
        lista.push(tipo === 'produtiva' ? sanitizeEtapa(campos) : sanitizeImprodutividade(campos));
      });
      // o que sumiu da planilha continua no projeto (apagar só pelo app)
      atuais.filter((e) => !usadas.has(e.id)).forEach((e) => lista.push(e));
      const reordenou = lista.filter((e) => atuais.some((a) => a.id === e.id)).map((e) => e.id).join() !== atuais.map((e) => e.id).join();
      if (alteradas || incluidas || reordenou) {
        const m = mudancaProjeto(p);
        m.patch[campo] = lista;
        m.itens.push(`${tipo === 'produtiva' ? 'atividades' : 'improdutividades'}: ${[alteradas && `${alteradas} alterada(s)`, incluidas && `${incluidas} nova(s)`, reordenou && 'ordem'].filter(Boolean).join(', ')}`);
      }
    });
  });

  plano.projetosAlterados = [...plano.projetosAlterados.values()];
  plano.total = plano.projetosAlterados.length;
  return plano;
}

/** Grava o plano aprovado (atividades novas entram no catálogo interno automaticamente). */
export async function aplicarBase(plano, { atividades = [], profile }) {
  auditar('importou', 'planilha', '', `${plano.projetosAlterados.length} projeto(s) alterado(s)`);
  for (const x of plano.projetosAlterados) {
    const patch = { ...x.patch };
    if (patch.etapas) patch.etapas = await vincularAtividades(patch.etapas, 'produtiva', atividades, { contrato: x.projeto.contratoNome, criadoPor: profile.uid });
    if (patch.improdutividades) patch.improdutividades = await vincularAtividades(patch.improdutividades, 'improdutiva', atividades, { criadoPor: profile.uid });
    await updateProjeto(x.projeto.id, patch);
  }
}
