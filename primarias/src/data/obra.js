// Estrutura da obra e cadastros fixos, tirados das planilhas de controle
// (Gestão Visual, RDO PLAN-RFX-002 e Curva S). O que ainda depende de
// confirmação está marcado com "a confirmar".

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

// As 6 etapas, na ordem em que acontecem. `nivel` diz como o líder lança:
// andaime por cabeceira (forno + lado), 5S e sopragem por forno, o resto por
// primária. Cores validadas para daltonismo no fundo escuro do app; azul,
// laranja e amarelo seguem as da planilha de Gestão Visual.
export const ETAPAS = [
  { id: 'andaime', nome: 'Montagem de andaime', curto: 'Andaime', nivel: 'cabeceira', cor: '#3987e5' },
  { id: 'demolicao', nome: 'Demolição de manilhas', curto: 'Demolição', nivel: 'primaria', cor: '#d95926' },
  { id: 'sopragem', nome: '5S e sopragem dos fornos', curto: '5S e sopragem', nivel: 'forno', cor: '#199e70' },
  { id: 'assentamento', nome: 'Assentamento de manilhas', curto: 'Assentamento', nivel: 'primaria', cor: '#c98500' },
  { id: 'siplate', nome: 'Aplicação de siplate', curto: 'Siplate', nivel: 'primaria', cor: '#9085e9' },
  { id: 'massa1200', nome: 'Aplicação de massa 1200', curto: 'Massa 1200', nivel: 'primaria', cor: '#1f9a3a' }
];
export const etapaPorId = Object.fromEntries(ETAPAS.map((e, i) => [e.id, { ...e, ordem: i }]));
/** Nome curto no meio de uma frase: "Lançar massa 1200", mas "Lançar 5S e sopragem". */
export const noMeio = (e) => (/^[0-9A-Z]{2}/.test(e.curto) ? e.curto : e.curto[0].toLowerCase() + e.curto.slice(1));
export const NIVEL_NOME = { primaria: 'por primária', cabeceira: 'por cabeceira (forno + lado)', forno: 'por forno' };

// Consumo por primária (aba RASCUNHO do RDO). A etapa em que cada material
// é aplicado ainda está a confirmar para siplate e massa 1200.
export const MATERIAIS = [
  { id: 'manilha', nome: 'Manilha refratária (monolítica)', unidade: 'PÇ', porPrimaria: 1, etapa: 'assentamento' },
  { id: 'castfire', nome: 'Concreto isolante (Cast Fire I RC)', unidade: 'KG', porPrimaria: 50, etapa: 'assentamento' },
  { id: 'didurit', nome: 'Concreto refratário denso (Didurit F55-5-BR)', unidade: 'KG', porPrimaria: 25, etapa: 'assentamento' },
  { id: 'injetbar', nome: 'Sílica líquida (Injetbar CK)', unidade: 'KG', porPrimaria: 30, etapa: 'siplate', aConfirmar: true },
  { id: 'silplate', nome: 'Massa de fibra isolante (Silplate 1200 WR)', unidade: 'KG', porPrimaria: 100, etapa: 'massa1200', aConfirmar: true }
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

// Checklist de entrega do forno. Modelo provisório montado a partir das
// etapas; o planejador troca pelos itens oficiais em Configuração.
export const CHECKLIST_MODELO = [
  'Andaime montado e liberado nos dois lados',
  'Manilhas antigas demolidas e entulho retirado',
  '5S feito e forno soprado',
  'Manilhas novas assentadas e alinhadas (P01 a P06)',
  'Siplate aplicado',
  'Massa 1200 aplicada e acabamento conferido',
  'Área limpa e organizada',
  'Fotos do antes e depois registradas',
  'Forno liberado pela operação Ternium'
];

// RDO: um por dia; a numeração continua a da planilha atual.
export const RDO_ULTIMO = { numero: 234, data: '2026-10-23' };

export const PAPEIS = {
  apontador: { nome: 'Apontador', campo: true },
  lider: { nome: 'Líder', campo: true },
  planejador: { nome: 'Planejador', gestao: true },
  gestor: { nome: 'Gestor', somenteLeitura: true },
  admin: { nome: 'Administrador', gestao: true }
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
