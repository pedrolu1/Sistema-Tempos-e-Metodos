import { Radar, Compass, PenTool, Feather, Send, ScanSearch } from 'lucide-react';

// A equipe da agência. A ordem é a ordem do fluxo de produção.
export const AGENTES = [
  {
    id: 'radar',
    nome: 'Radar',
    papel: 'Pesquisa de tendências',
    cor: 'var(--radar)',
    hex: '#5b7cff',
    Icone: Radar,
    faz: 'Vasculha Instagram, Facebook e a web atrás do que está em alta no seu nicho.'
  },
  {
    id: 'compasso',
    nome: 'Compasso',
    papel: 'Estratégia e calendário',
    cor: 'var(--compasso)',
    hex: '#ffc53d',
    Icone: Compass,
    faz: 'Cruza tendências com os horários em que seu público está online e monta o calendário.'
  },
  {
    id: 'traco',
    nome: 'Traço',
    papel: 'Direção de arte',
    cor: 'var(--traco)',
    hex: '#ff4fa3',
    Icone: PenTool,
    faz: 'Cria as artes a partir das suas fotos, com as cores, fontes e o jeito da sua marca.'
  },
  {
    id: 'verbo',
    nome: 'Verbo',
    papel: 'Legendas e chamadas',
    cor: 'var(--verbo)',
    hex: '#34e0b4',
    Icone: Feather,
    faz: 'Escreve legenda, chamada para ação e hashtags no tom de voz da marca.'
  },
  {
    id: 'disparo',
    nome: 'Disparo',
    papel: 'Publicação',
    cor: 'var(--disparo)',
    hex: '#ff7a45',
    Icone: Send,
    faz: 'Espera o seu ok e publica cada post no horário de maior alcance.'
  },
  {
    id: 'lupa',
    nome: 'Lupa',
    papel: 'Análise e crescimento',
    cor: 'var(--lupa)',
    hex: '#b98cff',
    Icone: ScanSearch,
    faz: 'Lê os resultados todo dia e sugere o que mudar para as redes crescerem.'
  }
];

export const AGENTE = Object.fromEntries(AGENTES.map((a) => [a.id, a]));

export const STATUS_AGENTE = {
  trabalhando: 'Trabalhando',
  ocioso: 'Em espera',
  aguardando: 'Esperando você',
  erro: 'Precisa de atenção'
};

export const STATUS_POST = {
  planejado: { rotulo: 'Na pauta', agente: 'compasso' },
  criando: { rotulo: 'Em criação', agente: 'traco' },
  precisa_foto: { rotulo: 'Falta foto', agente: 'traco' },
  aguardando: { rotulo: 'Esperando seu ok', agente: null },
  ajustando: { rotulo: 'Em ajuste', agente: 'verbo' },
  agendado: { rotulo: 'Agendado', agente: 'disparo' },
  publicando: { rotulo: 'Publicando', agente: 'disparo' },
  publicado: { rotulo: 'Publicado', agente: 'disparo' },
  falhou: { rotulo: 'Falhou', agente: 'disparo' },
  descartado: { rotulo: 'Descartado', agente: null }
};
