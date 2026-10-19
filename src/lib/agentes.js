import { EFETIVO_CAMPOS, formatMinutes, formatDateBR, todayISO, efetivoTotal } from '../utils/format.js';
import { resumoProjeto } from '../utils/planejamento.js';
import { calcularIndicadores } from '../utils/indicadores.js';
import { percentil, pct } from '../utils/estudos.js';

/**
 * Assistentes por regras (sem IA externa: funcionam offline e de graça).
 * Cada regra olha os dados e, se encontra algo, devolve um "achado":
 *   { id, nivel, area, titulo, detalhe, sugestao, acao? }
 * `id` é estável (mesmo problema → mesmo id) para que "dispensar" funcione.
 * `acao` descreve o que a tela pode fazer com um clique — a regra nunca
 * altera dados sozinha.
 */

export const NIVEIS = {
  critico: { label: 'Crítico', ordem: 0, tone: 'danger' },
  atencao: { label: 'Atenção', ordem: 1, tone: 'warn' },
  oportunidade: { label: 'Oportunidade', ordem: 2, tone: 'ok' },
  info: { label: 'Informação', ordem: 3, tone: 'info' }
};

/** Biblioteca de contramedidas para as causas de improdutividade mais comuns em campo. */
const CONTRAMEDIDAS = [
  [/\bapr\b|\bpt\b|permiss|libera[çc][ãa]o/i, 'Antecipe a liberação: emita APR/PT no turno anterior, com check-list pronto, e combine o horário do liberador da área.'],
  [/materia|insumo|tijolo|massa|concreto|refrat/i, 'Monte o kit de materiais da etapa na véspera (kanban de reposição) e confirme a entrega antes de mobilizar a equipe.'],
  [/chuva|clima|vento|temporal/i, 'Tenha um plano B para chuva: frentes cobertas ou tarefas preparadas para não parar a equipe.'],
  [/equipament|munk|guindaste|m[áa]quina|ferrament|quebr|defeito|pane/i, 'Faça check-list de equipamentos no início do turno e reserve munk/guindaste com antecedência.'],
  [/desloc|transporte|[ôo]nibus|acesso|andaime/i, 'Reduza deslocamentos: aproxime estoque e canteiro da frente de trabalho e garanta o acesso (andaime) antes de começar.'],
  [/refei|almo[çc]|caf[ée]|lanche|intervalo/i, 'Encaixe refeição e intervalo entre etapas, para não interromper uma tarefa no meio.'],
  [/aguard|espera|opera[çc][ãa]o|produ[çc][ãa]o|cliente/i, 'Combine com o cliente as janelas de liberação da área e registre as esperas para negociar.'],
  [/dds|reuni|treinament|palestra/i, 'Padronize a duração do DDS/reuniões e faça-os no próprio local de trabalho.']
];

export function contramedida(causa = '') {
  const achado = CONTRAMEDIDAS.find(([re]) => re.test(causa));
  return achado ? achado[1] : 'Investigue a causa raiz com a equipe (5 Porquês) e defina uma ação com responsável e prazo.';
}

const minutosDoDia = (hhmm) => {
  const [h, m] = String(hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
};

/** Pares de lançamentos do mesmo autor e dia com horários sobrepostos. */
export function sobreposicoes(lancamentos) {
  const grupos = new Map();
  lancamentos.forEach((l) => {
    const k = `${l.criadoPorUid}|${l.data}`;
    if (!grupos.has(k)) grupos.set(k, []);
    const ini = minutosDoDia(l.horaInicio);
    grupos.get(k).push({ l, ini, fim: ini + (Number(l.duracaoMinutos) || 0) });
  });
  const pares = [];
  grupos.forEach((itens) => {
    itens.sort((a, b) => a.ini - b.ini);
    for (let i = 1; i < itens.length; i++) {
      if (itens[i].ini < itens[i - 1].fim) pares.push([itens[i - 1].l, itens[i].l]);
    }
  });
  return pares;
}

function diasAtras(n, hoje = todayISO()) {
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

/** Valor mais frequente de uma lista de números. */
function moda(valores) {
  const c = new Map();
  valores.forEach((v) => c.set(v, (c.get(v) || 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

// =====================================================================
// Assistente do planejador
// =====================================================================
export function analisarPlanejamento({ lancamentos = [], projetos = [], atividades = [], estudos = [], saude = [], ultimoBackup, hoje = todayISO() }) {
  const achados = [];
  const add = (a) => achados.push(a);
  const recentes = lancamentos.filter((l) => l.data >= diasAtras(29, hoje) && l.data <= hoje);

  // ---- 1. projetos: planejado × real por etapa, prazo e ritmo de apontamento
  projetos.filter((p) => p.status !== 'concluido').forEach((p) => {
    const r = resumoProjeto(p, lancamentos);

    if (!(p.etapas || []).length) {
      add({ id: `sem-etapas:${p.id}`, nivel: 'atencao', area: 'Dados', titulo: `"${p.nome}" não tem etapas planejadas`,
        detalhe: 'Sem etapas, o apontador lança como avulso e não há como comparar planejado × real.',
        sugestao: 'Abra o projeto e adicione as etapas do catálogo.', acao: { tipo: 'abrir', label: 'Abrir projetos', page: 'projetos' } });
    }
    const semDuracao = (p.etapas || []).filter((e) => !(e.duracaoMin > 0));
    if (semDuracao.length) {
      add({ id: `etapa-sem-duracao:${p.id}:${semDuracao.length}`, nivel: 'info', area: 'Dados', titulo: `${semDuracao.length} etapa(s) de "${p.nome}" sem duração planejada`,
        detalhe: semDuracao.slice(0, 4).map((e) => e.nome).join(' · '),
        sugestao: 'Use uma cronoanálise ou os tempos históricos para definir a duração.', acao: { tipo: 'abrir', label: 'Abrir estudos', page: 'estudos' } });
    }

    r.etapas.forEach((e) => {
      const ls = r.lancamentos.filter((l) => l.etapaId === e.etapa.id && l.tipoRegistro !== 'improdutividade');
      if (ls.length < 3 || !(e.etapa.duracaoMin > 0)) return;
      const mediana = Math.round(percentil(ls.map((l) => l.duracaoMinutos), 0.5));
      const desvio = (mediana - e.etapa.duracaoMin) / e.etapa.duracaoMin;
      if (Math.abs(desvio) >= 0.2) {
        const acima = desvio > 0;
        add({
          id: `duracao:${p.id}:${e.etapa.id}:${mediana}`,
          nivel: acima ? 'atencao' : 'oportunidade',
          area: 'Planejamento',
          titulo: `"${e.etapa.nome}" ${acima ? 'leva mais' : 'leva menos'} que o planejado`,
          detalhe: `${p.nome}: em ${ls.length} apontamentos a mediana foi ${formatMinutes(mediana)}, planejado ${formatMinutes(e.etapa.duracaoMin)} (${acima ? '+' : ''}${pct(desvio)}).`,
          sugestao: acima
            ? 'Se o método está certo, o planejado está otimista: ajuste para não esconder atraso. Se não, faça uma cronoanálise para achar a perda.'
            : 'A equipe está mais rápida que o plano — ajuste para liberar capacidade e prazos mais realistas.',
          acao: { tipo: 'ajustarDuracaoEtapa', label: `Ajustar para ${formatMinutes(mediana)}`, projetoId: p.id, etapaId: e.etapa.id, min: mediana }
        });
      }
      // efetivo: a mesma função diferente do plano na maioria das vezes
      const difs = EFETIVO_CAMPOS.map((c) => {
        const plan = Number(e.etapa.efetivo?.[c.key]) || 0;
        const reais = ls.map((l) => Number(l.efetivo?.[c.key]) || 0);
        const diferentes = reais.filter((v) => v !== plan).length;
        return { c, plan, real: moda(reais), freq: diferentes / reais.length };
      }).filter((d) => d.freq >= 0.6 && d.real !== d.plan);
      if (difs.length && efetivoTotal(e.etapa.efetivo) > 0) {
        const novo = { ...e.etapa.efetivo };
        difs.forEach((d) => { novo[d.c.key] = d.real; });
        add({
          id: `mod:${p.id}:${e.etapa.id}:${difs.map((d) => `${d.c.key}${d.real}`).join('')}`,
          nivel: 'atencao',
          area: 'Equipe',
          titulo: `Equipe real de "${e.etapa.nome}" difere do planejado`,
          detalhe: `${p.nome}: ${difs.map((d) => `${d.c.label} planejado ${d.plan}, em campo quase sempre ${d.real}`).join(' · ')}.`,
          sugestao: 'Confirme com o encarregado. Se a equipe real é a necessária, atualize a MOD da etapa para o custo e o prazo refletirem a realidade.',
          acao: { tipo: 'ajustarMODEtapa', label: 'Atualizar MOD da etapa', projetoId: p.id, etapaId: e.etapa.id, efetivo: novo }
        });
      }
    });

    // prazo: tempo decorrido × etapas iniciadas
    if (p.dataInicio && p.dataFim && p.dataFim >= p.dataInicio && (p.etapas || []).length) {
      const total = diasEntre(p.dataInicio, p.dataFim) + 1;
      const decorrido = Math.min(1, Math.max(0, (diasEntre(p.dataInicio, hoje) + 1) / total));
      if (hoje > p.dataFim) {
        add({ id: `prazo-vencido:${p.id}`, nivel: 'critico', area: 'Prazo', titulo: `Prazo de "${p.nome}" venceu em ${formatDateBR(p.dataFim)}`,
          detalhe: `${r.iniciadas} de ${r.etapas.length} etapas iniciadas.`,
          sugestao: 'Atualize o término previsto ou marque o projeto como concluído.', acao: { tipo: 'abrir', label: 'Abrir projetos', page: 'projetos' } });
      } else if (decorrido - r.progresso >= 0.25 && decorrido >= 0.2) {
        add({ id: `prazo-risco:${p.id}:${Math.round(decorrido * 10)}`, nivel: 'critico', area: 'Prazo', titulo: `"${p.nome}" pode atrasar`,
          detalhe: `${pct(decorrido)} do prazo já passou, mas só ${pct(r.progresso)} das etapas começaram.`,
          sugestao: 'Reveja a sequência, reforce a equipe nas etapas críticas ou renegocie o prazo agora — não no fim.' });
      }
    }

    // projeto em andamento sem apontamentos recentes
    if (p.status === 'andamento') {
      const ultimo = r.lancamentos.map((l) => l.data).sort().pop();
      const parado = ultimo ? diasEntre(ultimo, hoje) : null;
      if (parado === null || parado >= 3) {
        add({ id: `sem-lancamento:${p.id}:${ultimo || 'nunca'}`, nivel: 'atencao', area: 'Campo',
          titulo: `"${p.nome}" sem apontamentos ${ultimo ? `há ${parado} dias` : 'até agora'}`,
          detalhe: ultimo ? `Último apontamento em ${formatDateBR(ultimo)}.` : 'O projeto está em andamento, mas ninguém lançou nele.',
          sugestao: 'Confirme se a frente está parada ou se o apontador está lançando como avulso.' });
      }
    }
  });

  // ---- 2. Lean e improdutividade nos últimos 30 dias
  const ind = calcularIndicadores(recentes);
  if (ind.totalMin >= 8 * 60) {
    const va = ind.lean.VA / ind.totalMin;
    const dnn = ind.lean.DNN / ind.totalMin;
    if (va < 0.5) {
      add({ id: `lean-va:${Math.round(va * 20)}`, nivel: va < 0.3 ? 'critico' : 'atencao', area: 'Lean',
        titulo: `Só ${pct(va)} do tempo é Valor Agregado`,
        detalhe: `Últimos 30 dias: VA ${formatMinutes(ind.lean.VA)}, DN ${formatMinutes(ind.lean.DN)}, DNN ${formatMinutes(ind.lean.DNN)}.`,
        sugestao: 'Ataque primeiro o desperdício não necessário (DNN) e questione cada preparação (DN): eliminar, combinar, simplificar.' });
    }
    if (dnn >= 0.15) {
      add({ id: `lean-dnn:${Math.round(dnn * 20)}`, nivel: 'critico', area: 'Lean', titulo: `Desperdício evitável em ${pct(dnn)} do tempo`,
        detalhe: `${formatMinutes(ind.lean.DNN)} de DNN nos últimos 30 dias.`, sugestao: 'Veja os cartões de improdutividade: cada causa traz uma contramedida.' });
    }
    ind.topImprodutividades.slice(0, 3).forEach((c) => {
      const parte = c.value / ind.totalMin;
      if (parte < 0.05) return;
      add({ id: `improd:${c.label}:${Math.round(parte * 20)}`, nivel: parte >= 0.15 ? 'critico' : 'atencao', area: 'Improdutividade',
        titulo: `"${c.label}" consumiu ${formatMinutes(c.value)} (${pct(parte)})`,
        detalhe: 'Somatório dos últimos 30 dias, todos os projetos.', sugestao: contramedida(c.label) });
    });
    const topEx = ind.topExcedente[0];
    // não repete o aviso se a mesma atividade já apareceu como etapa acima do planejado
    const jaAvisada = topEx && achados.some((x) => x.id.startsWith('duracao:') && x.titulo.includes(`"${topEx.label}"`));
    if (topEx && topEx.value >= 60 && !jaAvisada) {
      add({ id: `excedente:${topEx.label}:${Math.round(topEx.value / 60)}`, nivel: 'atencao', area: 'Planejamento',
        titulo: `"${topEx.label}" é a atividade que mais passa do planejado`,
        detalhe: `${formatMinutes(topEx.value)} de excedente nos últimos 30 dias.`,
        sugestao: 'Faça uma cronoanálise dessa atividade para separar perda de método de planejado irreal.', acao: { tipo: 'abrir', label: 'Abrir estudos', page: 'estudos' } });
    }
  }

  // ---- 3. catálogo sem padrão, mas com histórico suficiente
  atividades.filter((a) => a.tipo === 'produtiva' && a.ativo !== false && !(a.duracaoPadraoMin > 0)).forEach((a) => {
    const tempos = lancamentos.filter((l) => l.atividadeId === a.id && l.tipoRegistro !== 'improdutividade').map((l) => l.duracaoMinutos);
    if (tempos.length < 5) return;
    const mediana = Math.round(percentil(tempos, 0.5));
    add({ id: `padrao:${a.id}`, nivel: 'oportunidade', area: 'Catálogo', titulo: `"${a.nome}" ainda não tem tempo padrão`,
      detalhe: `Já são ${tempos.length} apontamentos; a mediana é ${formatMinutes(mediana)}.`,
      sugestao: 'Com um padrão, o app passa a detectar desperdício nessa atividade.',
      acao: { tipo: 'definirPadrao', label: `Definir ${formatMinutes(mediana)}`, atividadeId: a.id, min: mediana } });
  });

  // ---- 4. estudos com amostra insuficiente
  estudos.filter((e) => e.tipo === 'cronoanalise' && e.resultado?.necessarios > e.resultado?.n).forEach((e) => {
    add({ id: `amostra:${e.id}`, nivel: 'info', area: 'Estudos', titulo: `Cronoanálise "${e.titulo}" com poucos ciclos`,
      detalhe: `${e.resultado.n} ciclos medidos de ${e.resultado.necessarios} necessários.`,
      sugestao: 'Antes de levar o resultado para o planejamento, complete a amostra em uma nova medição.' });
  });

  // ---- 5. qualidade dos apontamentos
  const pares = sobreposicoes(recentes);
  if (pares.length) {
    const [a, b] = pares[0];
    add({ id: `sobreposicao:${pares.length}:${a.id}`, nivel: 'atencao', area: 'Dados', titulo: `${pares.length} par(es) de lançamentos com horários sobrepostos`,
      detalhe: `Ex.: ${a.criadoPorNome || ''} em ${formatDateBR(a.data)} — ${a.horaInicio}–${a.horaTermino} e ${b.horaInicio}–${b.horaTermino}.`,
      sugestao: 'Horários sobrepostos contam o mesmo tempo duas vezes. Confira em Lançamentos.', acao: { tipo: 'abrir', label: 'Abrir lançamentos', page: 'lancamentos' } });
  }
  const longos = recentes.filter((l) => l.duracaoMinutos > 12 * 60);
  if (longos.length) {
    add({ id: `longos:${longos.length}:${longos[0].id}`, nivel: 'atencao', area: 'Dados', titulo: `${longos.length} lançamento(s) com mais de 12 horas`,
      detalhe: `Ex.: "${longos[0].atividadeNome}" em ${formatDateBR(longos[0].data)} (${longos[0].horaInicio}–${longos[0].horaTermino}).`,
      sugestao: 'Provável término digitado errado (virada da meia-noite). Corrija para não distorcer os indicadores.', acao: { tipo: 'abrir', label: 'Abrir lançamentos', page: 'lancamentos' } });
  }

  // ---- 6. saúde do app e backup (o "relatório" da auto-recuperação para o planejador)
  const semana = saude.filter((e) => (e.emLocal || 0) >= Date.now() - 7 * 86400000);
  const falhas = semana.filter((e) => e.tipo === 'erro');
  const pendentes = falhas.filter((e) => !e.recuperado);
  const recuperacoes = semana.filter((e) => e.tipo === 'recuperacao').length + falhas.length - pendentes.length;
  if (falhas.length || recuperacoes) {
    add({ id: `saude:${hoje}:${falhas.length}:${recuperacoes}`, nivel: pendentes.length ? 'atencao' : 'info', area: 'Sistema',
      titulo: pendentes.length ? `${pendentes.length} falha(s) do app precisam de verificação` : `O app se recuperou sozinho ${recuperacoes} vez(es) nesta semana`,
      detalhe: `Últimos 7 dias: ${falhas.length} falha(s) registrada(s), ${recuperacoes} recuperação(ões) automática(s).`,
      sugestao: pendentes.length ? 'Veja os detalhes em Sistema. Se a falha se repetir com várias pessoas, envie o print ao suporte.' : 'Nada a fazer — fica registrado para acompanhamento.',
      acao: { tipo: 'abrir', label: 'Abrir sistema', page: 'sistema' } });
  }
  const ultimo = ultimoBackup?.ultimoEmLocal;
  if (!ultimo || Date.now() - ultimo > 7 * 86400000) {
    add({ id: `backup:${hoje}`, nivel: 'atencao', area: 'Sistema', titulo: ultimo ? `Último backup há ${Math.floor((Date.now() - ultimo) / 86400000)} dias` : 'Nenhum backup feito ainda',
      detalhe: 'O backup é um arquivo com todos os dados, guardado fora do sistema.', sugestao: 'Faça o backup semanal com um clique e guarde o arquivo na rede da empresa.',
      acao: { tipo: 'abrir', label: 'Fazer backup', page: 'sistema' } });
  }

  return achados.sort((a, b) => NIVEIS[a.nivel].ordem - NIVEIS[b.nivel].ordem);
}

// =====================================================================
// Assistente do apontador (app de campo)
// =====================================================================
export function analisarApontador({ lancamentos = [], projetos = [], hoje = todayISO(), agora = new Date() }) {
  const dicas = [];
  const pendentes = lancamentos.filter((l) => l._sincronizado === false).length;
  if (pendentes) {
    dicas.push({ id: `pendentes:${hoje}`, nivel: 'info', titulo: `${pendentes} lançamento(s) guardado(s) no celular`,
      texto: 'Eles sobem sozinhos quando a internet voltar. Não precisa lançar de novo.' });
  }

  const semana = lancamentos.filter((l) => l.data >= diasAtras(6, hoje));
  const pares = sobreposicoes(semana);
  if (pares.length) {
    const [a, b] = pares[0];
    dicas.push({ id: `sobreposicao:${a.id}:${b.id}`, nivel: 'atencao', titulo: 'Horários se cruzando',
      texto: `Em ${formatDateBR(a.data)}: "${a.atividadeNome}" ${a.horaInicio}–${a.horaTermino} e "${b.atividadeNome}" ${b.horaInicio}–${b.horaTermino}. Confira na aba Consultar.` });
  }
  const longo = semana.find((l) => l.duracaoMinutos > 12 * 60);
  if (longo) {
    dicas.push({ id: `longo:${longo.id}`, nivel: 'atencao', titulo: 'Lançamento muito longo',
      texto: `"${longo.atividadeNome}" em ${formatDateBR(longo.data)} ficou com ${formatMinutes(longo.duracaoMinutos)}. O término está certo?` });
  }

  // etapa que vem passando do planejado: pede uma boa justificativa
  const estouros = new Map();
  semana.filter((l) => Number(l.excedenteMin) > 0).forEach((l) => estouros.set(l.atividadeNome, (estouros.get(l.atividadeNome) || 0) + 1));
  const repetida = [...estouros.entries()].find(([, n]) => n >= 2);
  if (repetida) {
    dicas.push({ id: `estouro:${repetida[0]}:${hoje}`, nivel: 'info', titulo: `"${repetida[0]}" passou do planejado ${repetida[1]} vezes`,
      texto: 'Conte na justificativa o que atrasou (material, liberação, equipe…). É isso que ajuda o planejador a corrigir.' });
  }

  // incentivo: dias seguidos com lançamento
  const dias = new Set(lancamentos.map((l) => l.data));
  let seguidos = 0;
  for (let i = 0; i < 60 && dias.has(diasAtras(i, hoje)); i++) seguidos++;
  if (seguidos >= 3) {
    dicas.push({ id: `sequencia:${hoje}`, nivel: 'ok', titulo: `${seguidos} dias seguidos lançando`, texto: 'Dados em dia deixam o planejamento certeiro. Continue assim!' });
  } else if (!dias.has(hoje) && agora.getHours() >= 10 && lancamentos.length) {
    dicas.push({ id: `hoje:${hoje}`, nivel: 'info', titulo: 'Nada lançado hoje ainda', texto: 'Lance cada etapa logo que terminar — fica mais fácil lembrar os horários.' });
  }

  const ativos = projetos.filter((p) => p.status === 'andamento');
  if (ativos.length && !lancamentos.some((l) => l.projetoId)) {
    dicas.push({ id: 'usar-projeto', nivel: 'info', titulo: 'Escolha o projeto ao lançar', texto: 'Assim a duração e a equipe já vêm preenchidas com o planejado.' });
  }
  return dicas;
}
