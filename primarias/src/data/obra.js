// Estrutura da obra e cadastros fixos, tirados das planilhas de controle
// (Gestão Visual, RDO PLAN-RFX-002, Curva S e Resumo da medição).

export const CLIENTE = 'Complexo Siderúrgico Ternium Brasil';
export const SERVICO = 'Substituição das Válvulas Primárias dos Fornos das Baterias da Coqueria da Ternium';
export const CODIGO_RDO = 'PLAN-RFX-002-R0';

// Cada bateria tem 8 blocos de 18 fornos; cada forno tem 6 primárias,
// 3 no lado máquina (P01 a P03) e 3 no lado coque (P04 a P06).
export const BATERIAS = ['A', 'B', 'C'];
export const BLOCOS_POR_BATERIA = 8;
export const FORNOS_POR_BLOCO = 18;
export const LADOS = [
  { id: 'LM', nome: 'Lado máquina', prims: [1, 2, 3] },
  { id: 'LC', nome: 'Lado coque', prims: [4, 5, 6] }
];

// Contratos: cada um cobre uma bateria inteira (144 fornos, 864 primárias).
export const CONTRATOS = [
  { id: 'c1', nome: '1º contrato', bateria: 'A', ativo: false },
  { id: 'c2', nome: '2º contrato', bateria: 'C', ativo: false },
  { id: 'c3', nome: '3º contrato', bateria: 'B', ativo: true, inicio: '2026-06-16' }
];
export const contratoAtivo = () => CONTRATOS.find((c) => c.ativo);

// Meta de revestimento: fornos concluídos por boletim de medição (dia 16 ao dia 15).
export const META_FORNOS_BM = 36;

// As etapas, na ordem do serviço. Andaime é lançado por lado do forno
// (cabeceira); o resto, por primária. A desmontagem do andaime fecha o
// serviço no lado, mas não muda a cor do mapa (o forno já está revestido).
// Cores validadas para daltonismo no fundo escuro; cada quadradinho do mapa
// também leva o número da etapa.
export const ETAPAS = [
  { id: 'andaime', nome: 'Montagem de andaime', curto: 'Montagem de andaime', rdo: 'MONTAGEM DE ANDAIME', nivel: 'cabeceira', cor: '#3987e5' },
  { id: 'demolicao', nome: 'Demolição de manilhas', curto: 'Demolição', rdo: 'DEMOLIÇÃO DAS MANILHAS', nivel: 'primaria', cor: '#d95926' },
  { id: 'assentamento', nome: 'Assentamento / concretagem de manilhas', curto: 'Assentamento', rdo: 'ASSENTAMENTO / CONCRETAGEM DAS MANILHAS', nivel: 'primaria', cor: '#9085e9' },
  { id: 'injetbar', nome: 'Revestimento com Injetbar', curto: 'Injetbar', rdo: 'REVESTIMENTO COM INJETBAR', nivel: 'primaria', cor: '#d55181' },
  { id: 'massa1200', nome: 'Revestimento com massa 1200', curto: 'Massa 1200', rdo: 'REVESTIMENTO COM MASSA 1200', nivel: 'primaria', cor: '#1f9a3a' },
  { id: 'desmontagem', nome: 'Desmontagem de andaime', curto: 'Desmontagem de andaime', rdo: 'DESMONTAGEM DE ANDAIME', nivel: 'cabeceira', cor: '#7f8aa3', extra: true }
];
export const etapaPorId = Object.fromEntries(ETAPAS.map((e, i) => [e.id, { ...e, ordem: i }]));
/** Etapas que fazem a primária avançar no mapa (todas menos a desmontagem). */
export const ETAPAS_MAPA = ETAPAS.filter((e) => !e.extra);
/** Nome curto no meio de uma frase: "Lançar massa 1200", mas "Lançar Injetbar". */
export const noMeio = (e) => (/^[0-9A-Z]{2}|^Injetbar/.test(e.curto) ? e.curto : e.curto[0].toLowerCase() + e.curto.slice(1));
export const NIVEL_NOME = { primaria: 'por primária', cabeceira: 'por lado do forno', forno: 'por forno' };

// Consumo por primária (aba RASCUNHO do RDO) e a etapa em que é aplicado.
export const MATERIAIS = [
  { id: 'manilha', nome: 'Manilha refratária (monolítica)', unidade: 'PÇ', porPrimaria: 1, etapa: 'assentamento' },
  { id: 'castfire', nome: 'Concreto isolante (Cast Fire I RC)', unidade: 'KG', porPrimaria: 50, etapa: 'assentamento' },
  { id: 'didurit', nome: 'Concreto refratário denso (Didurit F55-5-BR)', unidade: 'KG', porPrimaria: 25, etapa: 'assentamento' },
  { id: 'injetbar', nome: 'Sílica líquida (Injetbar CK)', unidade: 'KG', porPrimaria: 30, etapa: 'injetbar' },
  { id: 'silplate', nome: 'Massa de fibra isolante (Silplate 1200 WR)', unidade: 'KG', porPrimaria: 100, etapa: 'massa1200' }
];

// Efetivo previsto do modelo de RDO (turno diurno).
export const EFETIVO_MODELO = {
  moi: [
    ['Coordenador de Produção', 1],
    ['Supervisor de Manutenção', 1],
    ['Técnico de Segurança do Trabalho', 1],
    ['Técnico de Planejamento', 1],
    ['Assistente Administrativo', 1],
    ['Almoxarife', 1]
  ],
  mod: [
    ['Líder de Manutenção', 3],
    ['Operador de Manutenção Refratária', 22],
    ['Montador de Andaimes', 6],
    ['Operador de Caminhão Munck', 1]
  ],
  equipamentos: [['Caminhão Munck', 1]]
};
export const HORARIO = [
  { dias: 'Seg. a qui.', horas: '09:00 às 16:00' },
  { dias: 'Sex.', horas: '09:00 às 13:00' }
];

// Motivos de desvio já usados na planilha de resumo (sem repetições).
export const MOTIVOS_DESVIO = [
  'Falta de material', 'Preparação e abastecimento', '5S obrigatório', 'Alteração de estratégia',
  'Equipe atendimento ao Alto Forno', 'Absenteísmo', 'Baixa produtividade', 'Manobra para medição',
  'Falha na logística', 'Calor extremo', 'Acidente de trabalho', 'Treinamentos operacionais',
  'Engrenando a produção', 'Tempo chuvoso', 'Segurança pública', 'Atraso Engevale',
  'Interferência de andaimes', 'Restrição de acesso (FTE)', 'Atraso refeitório / ônibus',
  'Descumprimento do planejamento', 'Sirene de emergência'
];
export const EMPRESAS_DESVIO = ['Reframax', 'Ternium', 'Não aplicável'];

// Registros do dia que vão para as observações do RDO.
export const TIPOS_OCORRENCIA = [
  { id: '5s', nome: '5S (organização e limpeza)' },
  { id: 'ocorrencia', nome: 'Ocorrência' },
  { id: 'material', nome: 'Material / abastecimento' },
  { id: 'seguranca', nome: 'Segurança' }
];

// Fotos do checklist de entrega: por lado do forno, uma da abóbada inteira e
// uma de cada manilha instalada e revestida. 4 por lado, 8 por forno.
export const SLOTS_FOTO = [
  { id: 'LM-abobada', lado: 'LM', nome: 'Abóbada', desc: 'Abóbada inteira, lado máquina' },
  { id: 'LM-P01', lado: 'LM', nome: 'P01', desc: 'Manilha P01 instalada e revestida' },
  { id: 'LM-P02', lado: 'LM', nome: 'P02', desc: 'Manilha P02 instalada e revestida' },
  { id: 'LM-P03', lado: 'LM', nome: 'P03', desc: 'Manilha P03 instalada e revestida' },
  { id: 'LC-abobada', lado: 'LC', nome: 'Abóbada', desc: 'Abóbada inteira, lado coque' },
  { id: 'LC-P04', lado: 'LC', nome: 'P04', desc: 'Manilha P04 instalada e revestida' },
  { id: 'LC-P05', lado: 'LC', nome: 'P05', desc: 'Manilha P05 instalada e revestida' },
  { id: 'LC-P06', lado: 'LC', nome: 'P06', desc: 'Manilha P06 instalada e revestida' }
];

// RDO: um por dia útil; a numeração continua a da planilha (ajustável em Configuração).
export const RDO_ULTIMO = { numero: 234, data: '2026-10-23' };

export const PAPEIS = {
  lider: { nome: 'Líder', desc: 'Lança o avanço e tira as fotos do checklist', campo: true },
  planejador: { nome: 'Planejador', desc: 'Acompanha tudo, aprova e gera os documentos', gestao: true },
  admin: { nome: 'Administrador', desc: 'Tudo do planejador e a liberação de usuários', gestao: true, admin: true },
  gestor: { nome: 'Gestor', desc: 'Só acompanha painel, curva, mapa e documentos', somenteLeitura: true }
};

// ---------------------------------------------------------------------------
// Lista de primárias e códigos. Código igual ao da planilha, sem espaços:
// primária "B2-F03-LM-P01", cabeceira "B2-F03-LM", forno "B2-F03".
// ---------------------------------------------------------------------------
const dois = (n) => String(n).padStart(2, '0');
export const fornoId = (bloco, forno) => `${bloco}-F${dois(forno)}`;
export const ladoDe = (p) => (p <= 3 ? 'LM' : 'LC');
export const primariaId = (bloco, forno, p) => `${fornoId(bloco, forno)}-${ladoDe(p)}-P${dois(p)}`;

export const PRIMARIAS = [];
export const FORNOS = [];
for (const bat of BATERIAS) {
  for (let b = 1; b <= BLOCOS_POR_BATERIA; b++) {
    const bloco = `${bat}${b}`;
    for (let f = 1; f <= FORNOS_POR_BLOCO; f++) {
      const fid = fornoId(bloco, f);
      const prims = [];
      for (let p = 1; p <= 6; p++) {
        const id = primariaId(bloco, f, p);
        prims.push(id);
        PRIMARIAS.push({ id, bateria: bat, bloco, forno: f, fornoId: fid, lado: ladoDe(p), cab: `${fid}-${ladoDe(p)}`, p, idx: PRIMARIAS.length });
      }
      FORNOS.push({ id: fid, bateria: bat, bloco, forno: f, prims });
    }
  }
}
export const primariaPorId = Object.fromEntries(PRIMARIAS.map((p) => [p.id, p]));
export const fornoPorId = Object.fromEntries(FORNOS.map((f) => [f.id, f]));
export const blocosDa = (bat) => Array.from({ length: BLOCOS_POR_BATERIA }, (_, i) => `${bat}${i + 1}`);

/** Primárias cobertas por um alvo de lançamento (primária, cabeceira ou forno). */
export function primariasDoAlvo(alvo) {
  if (primariaPorId[alvo]) return [alvo];
  if (fornoPorId[alvo]) return fornoPorId[alvo].prims;
  const [bloco, f, lado] = alvo.split('-');
  const forno = fornoPorId[`${bloco}-${f}`];
  return forno ? forno.prims.filter((id) => primariaPorId[id].lado === lado) : [];
}

/** "B6-F07-LM-P01" → "B6 · F07 · LM · P01" (como aparece na tela). */
export const rotulo = (id) => id.replaceAll('-', ' · ');
/** "B6-F07" → "B6 - 7 - LC/LM" (como na relação da medição). */
export const localMedicao = (fid) => `${fornoPorId[fid].bloco} - ${fornoPorId[fid].forno} - LC/LM`;
