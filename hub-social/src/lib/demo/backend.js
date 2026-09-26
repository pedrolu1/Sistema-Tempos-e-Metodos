// MODO DEMONSTRAÇÃO: tudo roda no navegador. Contas ficam no localStorage, fotos no
// IndexedDB e os agentes são simulados por regras. Nada é publicado de verdade.
import { get as idbGetBruto, set as idbSetBruto, del as idbDelBruto } from 'idb-keyval';
import { Backend, ESTADO_INICIAL } from '../store.jsx';
import { AGENTES, AGENTE } from '../agents.js';
import { toast } from '../toast.js';
import { quando } from '../tempo.js';
import { carregarImagem, reduzirArquivo, analisarImagem, descreverAnalise } from '../imagem.js';
import { nichoDe } from './nichos.js';
import { escreverLegenda, desenharArte, montarPautas, precisaDeFoto, hashTexto } from './redacao.js';
import { gerarInsights, sugestoesDemo } from './metricas.js';

const K_USUARIOS = 'pulso.demo.usuarios';
const K_SESSAO = 'pulso.demo.sessao';
const K_RESET = 'pulso.demo.reset';
const kDados = (uid) => `pulso.demo.dados.${uid}`;

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

// IndexedDB pode estar bloqueado (janela anônima, iframe): nesse caso as fotos
// ficam só na memória desta aba.
const memoria = new Map();
const idbGet = async (k) => {
  try {
    return (await idbGetBruto(k)) ?? memoria.get(k);
  } catch {
    return memoria.get(k);
  }
};
const idbSet = async (k, v) => {
  memoria.set(k, v);
  try {
    await idbSetBruto(k, v);
  } catch {
    /* segue em memória */
  }
};
const idbDel = async (k) => {
  memoria.delete(k);
  try {
    await idbDelBruto(k);
  } catch {
    /* nada a apagar */
  }
};
const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function ler(chave, padrao, area) {
  try {
    area ||= localStorage;
    const v = area.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor, area) {
  try {
    area ||= localStorage;
    area.setItem(chave, JSON.stringify(valor));
  } catch {
    /* armazenamento cheio ou bloqueado: segue só em memória */
  }
}

async function hashSenha(senha, sal) {
  const dados = new TextEncoder().encode(`${sal}:${senha}`);
  const buf = await crypto.subtle.digest('SHA-256', dados);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.code = codigo;
  return e;
}

function agentesIniciais() {
  return Object.fromEntries(
    AGENTES.map((a) => [a.id, { status: 'ocioso', tarefa: '', progresso: 0, atualizadoEm: new Date().toISOString() }])
  );
}

export class DemoBackend extends Backend {
  constructor() {
    super();
    this.urls = new Map();
    this.rodando = false;
    this.relogio = null;
  }

  async iniciar() {
    let sessao = ler(K_SESSAO, null);
    try {
      sessao ||= ler(K_SESSAO, null, sessionStorage);
    } catch {
      /* sem sessionStorage */
    }
    if (sessao?.uid) {
      const usuarios = ler(K_USUARIOS, {});
      const u = Object.values(usuarios).find((x) => x.uid === sessao.uid);
      if (u) await this.abrirSessao(u);
    }
    this.set({ pronto: true });
  }

  // ---------- persistência ----------
  salvar() {
    const { usuario, perfil, marca, conexoes, fotos, posts, agentes, atividade, tendencias, insights } = this.estado;
    if (!usuario) return;
    gravar(kDados(usuario.uid), {
      perfil,
      marca,
      conexoes,
      fotos: fotos.map(({ url, ...resto }) => resto),
      posts,
      agentes,
      atividade: atividade.slice(0, 80),
      tendencias,
      insights
    });
  }

  atualizar(patch) {
    this.set(patch);
    this.salvar();
  }

  async abrirSessao(u) {
    const dados = ler(kDados(u.uid), null) || {};
    const fotos = [];
    for (const f of dados.fotos || []) {
      const blob = await idbGet(`foto:${u.uid}:${f.id}`).catch(() => null);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      this.urls.set(f.id, url);
      fotos.push({ ...f, url });
    }
    const agentes = { ...agentesIniciais(), ...(dados.agentes || {}) };
    // se a aba foi fechada no meio de um trabalho, os agentes voltam para a espera
    for (const a of Object.values(agentes)) if (a.status === 'trabalhando') Object.assign(a, { status: 'ocioso', progresso: 0 });
    this.set({
      usuario: { uid: u.uid, email: u.email, nome: u.nome, emailVerificado: true },
      perfil: dados.perfil || { onboarding: 'marca', criadoEm: u.criadoEm },
      marca: dados.marca || null,
      conexoes: dados.conexoes || { instagram: null, facebook: null },
      fotos,
      posts: dados.posts || [],
      agentes,
      atividade: dados.atividade || [],
      tendencias: dados.tendencias || null,
      insights: dados.insights || null
    });
    this.ligarRelogio();
  }

  // ---------- conta ----------
  async cadastrar({ nome, email, senha }) {
    await esperar(500);
    email = email.trim().toLowerCase();
    const usuarios = ler(K_USUARIOS, {});
    if (usuarios[email]) throw erro('auth/email-already-in-use', 'Já existe uma conta com esse e-mail.');
    const sal = id();
    const u = { uid: id(), nome: nome.trim(), email, sal, senha: await hashSenha(senha, sal), criadoEm: new Date().toISOString() };
    usuarios[email] = u;
    gravar(K_USUARIOS, usuarios);
    gravar(K_SESSAO, { uid: u.uid });
    await this.abrirSessao(u);
    this.registrar('lupa', `Boas-vindas, ${u.nome.split(' ')[0]}. Sua agência está sendo montada.`, 'feito');
  }

  async entrar({ email, senha, lembrar = true }) {
    await esperar(450);
    const usuarios = ler(K_USUARIOS, {});
    const u = usuarios[email.trim().toLowerCase()];
    if (!u || (await hashSenha(senha, u.sal)) !== u.senha) throw erro('auth/invalid-credential', 'E-mail ou senha não conferem.');
    if (lembrar) gravar(K_SESSAO, { uid: u.uid });
    else {
      try {
        gravar(K_SESSAO, { uid: u.uid }, sessionStorage);
      } catch {
        /* sem sessionStorage */
      }
    }
    await this.abrirSessao(u);
  }

  // Atalho do modo demonstração: conta de exemplo já configurada, com fotos e redes simuladas.
  async entrarComExemplo() {
    const email = 'exemplo@pulso.demo';
    const usuarios = ler(K_USUARIOS, {});
    if (usuarios[email]) {
      await this.entrar({ email, senha: 'exemplo123' });
      return;
    }
    const sal = id();
    const u = { uid: id(), nome: 'Ana Souza', email, sal, senha: await hashSenha('exemplo123', sal), criadoEm: new Date().toISOString() };
    usuarios[email] = u;
    gravar(K_USUARIOS, usuarios);
    gravar(K_SESSAO, { uid: u.uid });
    const marca = {
      nome: 'Café Aurora',
      usuario: 'cafeaurora',
      nicho: 'Cafeteria',
      cidade: 'Belo Horizonte',
      publico: 'quem trabalha no centro e passa antes do expediente',
      descricao: 'Café coado na hora e pão de fermentação natural, feitos por quem ama o que faz.',
      logo: null,
      cores: { primaria: '#26355d', secundaria: '#e8e1f4', destaque: '#ff8a3d', clara: '#f8f6f2', escura: '#1d1b29' },
      fontes: 'editorial',
      voz: { tom: 65, emojis: 'pouco', valores: ['Feito à mão', 'Atendimento próximo'], evitar: 'barato' },
      cta: { tipo: 'whatsapp', whatsapp: '', site: '' },
      ritmo: { feed: 4, stories: 5 }
    };
    const insights = gerarInsights(u.uid + marca.nome);
    const conectadoEm = new Date().toISOString();
    // tudo gravado antes de abrir a sessão: a conta já nasce pronta, sem passar pelo onboarding
    gravar(kDados(u.uid), {
      perfil: { onboarding: 'pronto', criadoEm: u.criadoEm, concluidoEm: conectadoEm },
      marca,
      insights: { ...insights, sugestoes: sugestoesDemo(insights, []) },
      conexoes: {
        instagram: { status: 'conectado', usuario: 'cafeaurora', nome: 'Café Aurora', seguidores: insights.kpis.seguidores.valor, conectadoEm, demo: true },
        facebook: { status: 'conectado', nome: 'Café Aurora', seguidores: Math.round(insights.kpis.seguidores.valor * 0.46), conectadoEm, demo: true }
      },
      posts: [],
      atividade: [],
      fotos: []
    });
    await this.abrirSessao(u);
    const arquivos = await Promise.all(
      ['coffee.png', 'chelsea.png'].map(async (n) => new File([await (await fetch(`./exemplos/${n}`)).blob()], n, { type: 'image/png' }))
    ).catch(() => []);
    if (arquivos.length) await this.enviarFotos(arquivos, { silencioso: true });
    this.registrar('disparo', 'Instagram e Facebook conectados (simulação). Pronto para publicar quando você aprovar.', 'feito');
    setTimeout(() => this.rodarAgentes(), 600);
  }

  async entrarComGoogle() {
    throw erro('demo/sem-google', 'Entrar com Google funciona quando o Firebase estiver configurado.');
  }

  async sair() {
    clearInterval(this.relogio);
    try {
      localStorage.removeItem(K_SESSAO);
      sessionStorage.removeItem(K_SESSAO);
    } catch {
      /* armazenamento bloqueado */
    }
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls.clear();
    this.set({ ...ESTADO_INICIAL, pronto: true });
  }

  // No demo não há servidor de e-mail: devolvemos o link para abrir direto.
  async enviarRecuperacao(email) {
    await esperar(600);
    const usuarios = ler(K_USUARIOS, {});
    const u = usuarios[email.trim().toLowerCase()];
    if (!u) return { enviado: true };
    const codigo = id() + id();
    const pedidos = ler(K_RESET, {});
    pedidos[codigo] = { email: u.email, expira: Date.now() + 60 * 60 * 1000 };
    gravar(K_RESET, pedidos);
    return { enviado: true, linkDemo: `#/redefinir-senha?oobCode=${codigo}` };
  }

  async verificarCodigoRecuperacao(codigo) {
    const p = ler(K_RESET, {})[codigo];
    if (!p || p.expira < Date.now()) throw erro('auth/expired-action-code', 'Esse link expirou ou já foi usado.');
    return p.email;
  }

  async redefinirSenha(codigo, novaSenha) {
    await esperar(500);
    const pedidos = ler(K_RESET, {});
    const p = pedidos[codigo];
    if (!p || p.expira < Date.now()) throw erro('auth/expired-action-code', 'Esse link expirou ou já foi usado.');
    const usuarios = ler(K_USUARIOS, {});
    const u = usuarios[p.email];
    u.sal = id();
    u.senha = await hashSenha(novaSenha, u.sal);
    gravar(K_USUARIOS, usuarios);
    delete pedidos[codigo];
    gravar(K_RESET, pedidos);
  }

  async trocarSenha(atual, nova) {
    const usuarios = ler(K_USUARIOS, {});
    const u = usuarios[this.estado.usuario.email];
    if ((await hashSenha(atual, u.sal)) !== u.senha) throw erro('auth/wrong-password', 'A senha atual não confere.');
    u.sal = id();
    u.senha = await hashSenha(nova, u.sal);
    gravar(K_USUARIOS, usuarios);
  }

  // ---------- marca e onboarding ----------
  async salvarMarca(parcial, etapa) {
    const marca = { ...(this.estado.marca || {}), ...parcial };
    const perfil = etapa ? { ...this.estado.perfil, onboarding: etapa } : this.estado.perfil;
    this.atualizar({ marca, perfil });
  }

  async concluirOnboarding() {
    const base = this.estado.insights || gerarInsights(this.estado.usuario.uid + (this.estado.marca?.nome || ''));
    const insights = { ...base, sugestoes: base.sugestoes || sugestoesDemo(base, this.estado.posts) };
    this.atualizar({ perfil: { ...this.estado.perfil, onboarding: 'pronto', concluidoEm: new Date().toISOString() }, insights });
    setTimeout(() => this.rodarAgentes(), 900);
  }

  // Simula a autorização da Meta. No modo real isso abre a janela oficial do Facebook.
  async conectarMeta() {
    await esperar(1400);
    const base = (this.estado.marca?.nome || 'suamarca').toLowerCase().normalize('NFD').replace(/[^\w]/g, '');
    const seguidores = this.estado.insights?.kpis?.seguidores?.valor || 2340;
    const conexoes = {
      instagram: { status: 'conectado', usuario: base, nome: this.estado.marca?.nome || 'Sua marca', seguidores, conectadoEm: new Date().toISOString(), demo: true },
      facebook: { status: 'conectado', nome: this.estado.marca?.nome || 'Sua página', seguidores: Math.round(seguidores * 0.46), conectadoEm: new Date().toISOString(), demo: true }
    };
    this.atualizar({ conexoes });
    this.registrar('disparo', 'Instagram e Facebook conectados. Pronto para publicar quando você aprovar.', 'feito');
    return conexoes;
  }

  async desconectar(rede) {
    this.atualizar({ conexoes: { ...this.estado.conexoes, [rede]: null } });
  }

  // ---------- fotos ----------
  async enviarFotos(arquivos, { silencioso = false } = {}) {
    const novas = [];
    for (const arquivo of arquivos) {
      if (!arquivo.type.startsWith('image/')) continue;
      const { blob, largura, altura } = await reduzirArquivo(arquivo);
      const fid = id();
      await idbSet(`foto:${this.estado.usuario.uid}:${fid}`, blob);
      const url = URL.createObjectURL(blob);
      this.urls.set(fid, url);
      const img = await carregarImagem(url);
      const analise = analisarImagem(img);
      novas.push({ id: fid, nome: arquivo.name, url, largura, altura, analise, usos: 0, criadoEm: new Date().toISOString() });
    }
    if (!novas.length) return [];
    this.atualizar({ fotos: [...novas, ...this.estado.fotos] });
    if (!silencioso) {
      this.registrar('traco', novas.length === 1 ? `Foto nova no acervo. ${descreverAnalise(novas[0].analise)}` : `${novas.length} fotos novas no acervo. Já olhei luz, cor e onde cabe texto em cada uma.`, 'feito');
      // posts que estavam esperando foto ganham uma agora
      setTimeout(() => this.usarFotosPendentes(), 700);
    }
    return novas;
  }

  async apagarFoto(fid) {
    await idbDel(`foto:${this.estado.usuario.uid}:${fid}`).catch(() => {});
    const url = this.urls.get(fid);
    if (url) URL.revokeObjectURL(url);
    this.atualizar({ fotos: this.estado.fotos.filter((f) => f.id !== fid) });
  }

  fotoParaPauta(pauta) {
    const livres = [...this.estado.fotos].sort((a, b) => a.usos - b.usos);
    if (!livres.length) return null;
    const r = hashTexto(pauta.tema) % Math.min(3, livres.length);
    return livres[r];
  }

  marcarUso(fid) {
    this.set({ fotos: this.estado.fotos.map((f) => (f.id === fid ? { ...f, usos: f.usos + 1 } : f)) });
  }

  // ---------- agentes ----------
  agente(aid, patch) {
    this.set({
      agentes: { ...this.estado.agentes, [aid]: { ...this.estado.agentes[aid], ...patch, atualizadoEm: new Date().toISOString() } }
    });
  }

  registrar(agente, texto, tipo = 'info', extra = {}) {
    const item = { id: id(), agente, texto, tipo, criadoEm: new Date().toISOString(), ...extra };
    this.set({ atividade: [item, ...this.estado.atividade].slice(0, 120) });
    this.salvar();
  }

  async passo(aid, tarefa, ms, progresso) {
    this.agente(aid, { status: 'trabalhando', tarefa, progresso });
    this.registrar(aid, tarefa);
    await esperar(ms);
  }

  async rodarAgentes(somente) {
    if (this.rodando) {
      toast('Os agentes já estão trabalhando. Acompanhe no Estúdio.', { agente: 'radar' });
      return;
    }
    this.rodando = true;
    try {
      if (!somente || somente === 'radar') await this.radar();
      if (!somente || somente === 'compasso') await this.compasso();
      if (!somente || somente === 'traco' || somente === 'verbo') await this.produzir();
      if (!somente || somente === 'lupa') await this.lupa();
      this.avisarMesa();
    } finally {
      this.rodando = false;
      this.salvar();
    }
  }

  async radar() {
    const { marca } = this.estado;
    const nicho = nichoDe(marca?.nicho);
    const tag = nicho.hashtags[0];
    await this.passo('radar', `Lendo os posts mais recentes com ${tag}`, 1800, 0.2);
    await this.passo('radar', `Comparando perfis do nicho "${marca?.nicho || 'seu ramo'}"`, 1600, 0.5);
    if (marca?.cidade) await this.passo('radar', `Olhando o que se fala em ${marca.cidade}`, 1300, 0.75);
    await this.passo('radar', 'Separando o que é moda passageira do que tem fôlego', 1200, 0.9);
    const tendencias = { criadoEm: new Date().toISOString(), demo: true, itens: nicho.tendencias.map((t) => ({ ...t, hashtags: nicho.hashtags.slice(0, 3) })) };
    this.set({ tendencias });
    this.agente('radar', { status: 'ocioso', tarefa: `${tendencias.itens.length} temas em alta encontrados`, progresso: 1 });
    this.registrar('radar', `Encontrei ${tendencias.itens.length} temas em alta. O mais forte agora: ${tendencias.itens[1].tema.toLowerCase()}.`, 'feito');
  }

  async compasso() {
    const { marca, tendencias, insights, posts } = this.estado;
    await this.passo('compasso', 'Cruzando os temas com os horários em que seu público está online', 1700, 0.3);
    await this.passo('compasso', 'Equilibrando formatos: carrossel para salvar, story para conversar', 1400, 0.65);
    const ativos = posts.filter((p) => !['descartado', 'publicado', 'falhou'].includes(p.status));
    const pautas = montarPautas({ marca, tendencias, horarios: insights.horarios, jaTem: ativos });
    const novos = pautas.map((p) => ({
      id: id(),
      status: 'planejado',
      formato: p.formato,
      redes: ['instagram', 'facebook'],
      agendadoPara: p.agendadoPara,
      motivoHorario: p.motivoHorario,
      pauta: p.pauta,
      criadoEm: new Date().toISOString()
    }));
    this.set({ posts: [...this.estado.posts, ...novos] });
    const feed = novos.filter((p) => p.formato === 'feed').length;
    this.agente('compasso', { status: 'ocioso', tarefa: `Calendário das próximas 2 semanas pronto`, progresso: 1 });
    this.registrar('compasso', novos.length ? `Calendário pronto: ${feed} posts no feed e ${novos.length - feed} stories nas próximas duas semanas.` : 'O calendário já estava completo. Nada novo a encaixar.', 'feito');
  }

  // Traço e Verbo produzem o conteúdo dos próximos 7 dias
  async produzir() {
    const limite = Date.now() + 7 * 24 * 3600 * 1000;
    const fila = this.estado.posts
      .filter((p) => (p.status === 'planejado' || p.status === 'precisa_foto') && new Date(p.agendadoPara).getTime() < limite)
      .slice(0, 8);
    let i = 0;
    for (const post of fila) {
      i++;
      const progresso = i / (fila.length + 0.001);
      await this.criarConteudo(post, progresso);
    }
    this.agente('traco', { status: this.estado.posts.some((p) => p.status === 'precisa_foto') ? 'aguardando' : 'ocioso', tarefa: this.estado.posts.some((p) => p.status === 'precisa_foto') ? 'Esperando fotos para alguns posts' : 'Artes da semana prontas', progresso: 1 });
    this.agente('verbo', { status: 'ocioso', tarefa: 'Legendas da semana prontas', progresso: 1 });
  }

  async criarConteudo(post, progresso = 0.5, { variacao = 0, pedido = '', foto: fotoForcada } = {}) {
    const { marca } = this.estado;
    this.editarPost(post.id, { status: 'criando' });
    const foto = fotoForcada || (precisaDeFoto(post.pauta) ? this.fotoParaPauta(post.pauta) : null);
    if (precisaDeFoto(post.pauta) && !foto) {
      this.editarPost(post.id, { status: 'precisa_foto' });
      this.agente('traco', { status: 'aguardando', tarefa: `Preciso de uma foto: ${post.pauta.pedidoFoto}`, progresso });
      this.registrar('traco', `Para o post de ${quando(post.agendadoPara)} preciso de uma foto: ${post.pauta.pedidoFoto}.`, 'alerta', { postId: post.id });
      return;
    }
    this.agente('traco', { status: 'trabalhando', tarefa: `Arte de ${quando(post.agendadoPara)}`, progresso });
    await esperar(1100);
    const design = desenharArte({ marca, pauta: post.pauta, formato: post.formato, foto, variacao });
    if (foto) this.marcarUso(foto.id);
    this.registrar('traco', `Arte pronta: "${design.titulo}" (${post.formato === 'story' ? 'story' : 'feed'}, layout ${design.template}).`, 'feito', { postId: post.id });
    this.agente('verbo', { status: 'trabalhando', tarefa: `Legenda de ${quando(post.agendadoPara)}`, progresso });
    await esperar(900);
    const texto = escreverLegenda({ marca, pauta: post.pauta, formato: post.formato, variacao, pedido });
    this.registrar('verbo', post.formato === 'story' ? `Texto do story ajustado. Chamada: "${texto.cta}"` : `Legenda escrita com chamada: "${texto.cta}"`, 'feito', { postId: post.id });
    this.editarPost(post.id, { status: 'aguardando', design, ...texto, fotoId: foto?.id || null, prontoEm: new Date().toISOString() });
  }

  async usarFotosPendentes() {
    const pendentes = this.estado.posts.filter((p) => p.status === 'precisa_foto');
    if (!pendentes.length || !this.estado.fotos.length) return;
    for (const p of pendentes.slice(0, this.estado.fotos.length)) await this.criarConteudo(p, 0.8);
    this.agente('traco', { status: 'ocioso', tarefa: 'Usei suas fotos novas nos posts que estavam parados', progresso: 1 });
    this.agente('verbo', { status: 'ocioso', tarefa: '', progresso: 1 });
    this.avisarMesa();
    this.salvar();
  }

  async lupa() {
    await this.passo('lupa', 'Lendo alcance, salvamentos e horários da última semana', 1400, 0.5);
    const insights = { ...this.estado.insights, sugestoes: sugestoesDemo(this.estado.insights, this.estado.posts), atualizadoEm: new Date().toISOString() };
    this.set({ insights });
    this.agente('lupa', { status: 'ocioso', tarefa: `${insights.sugestoes.length} sugestões novas no Painel`, progresso: 1 });
    this.registrar('lupa', `Deixei ${insights.sugestoes.length} sugestões de crescimento no Painel.`, 'feito');
  }

  avisarMesa() {
    const n = this.estado.posts.filter((p) => p.status === 'aguardando').length;
    if (n) {
      this.agente('disparo', { status: 'aguardando', tarefa: `${n} ${n === 1 ? 'post espera' : 'posts esperam'} o seu ok na Mesa`, progresso: 0 });
      toast(`${n} ${n === 1 ? 'post pronto' : 'posts prontos'} na Mesa esperando o seu ok`, { agente: 'disparo', acao: { rotulo: 'Abrir', para: '/mesa' } });
    }
  }

  // Cria um post novo a partir de uma foto que o usuário escolheu no Acervo.
  async criarDaFoto(fid, { formatos = ['feed'], intencao = 'produto', detalhe = '' } = {}) {
    const foto = this.estado.fotos.find((f) => f.id === fid);
    if (!foto) return;
    const { marca, insights, posts } = this.estado;
    const nicho = nichoDe(marca?.nicho);
    this.agente('compasso', { status: 'trabalhando', tarefa: 'Procurando o melhor horário livre', progresso: 0.4 });
    this.registrar('compasso', 'Procurando o melhor horário livre para a sua foto.');
    await esperar(900);
    const criados = [];
    for (const formato of formatos) {
      const ocupados = posts.filter((p) => p.formato === formato && !['descartado', 'falhou'].includes(p.status));
      const [slot] = montarPautas({ marca, tendencias: this.estado.tendencias, horarios: insights.horarios, jaTem: ocupados, dias: 7 }).filter((p) => p.formato === formato);
      const agendadoPara = slot?.agendadoPara || new Date(Date.now() + 26 * 3600 * 1000).toISOString();
      const post = {
        id: id(),
        status: 'criando',
        formato,
        redes: ['instagram', 'facebook'],
        agendadoPara,
        motivoHorario: slot?.motivoHorario || 'próximo horário livre com público online',
        pauta: { tipo: intencao, tema: detalhe || nicho.coisas[0], coisa: detalhe || nicho.coisas[hashTexto(fid) % nicho.coisas.length], pedidoFoto: '', objetivo: 'alcance', origem: 'foto' },
        criadoEm: new Date().toISOString()
      };
      this.set({ posts: [...this.estado.posts, post] });
      this.registrar('compasso', `Encaixei o ${formato === 'story' ? 'story' : 'post'} para ${quando(agendadoPara)}.`, 'feito', { postId: post.id });
      await this.criarConteudo(post, 0.7, { foto });
      criados.push(post.id);
    }
    this.agente('compasso', { status: 'ocioso', tarefa: '', progresso: 1 });
    this.agente('traco', { status: 'ocioso', tarefa: 'Arte da sua foto pronta', progresso: 1 });
    this.agente('verbo', { status: 'ocioso', tarefa: '', progresso: 1 });
    this.avisarMesa();
    this.salvar();
    return criados;
  }

  // ---------- mesa de aprovação ----------
  editarPost(pid, patch) {
    this.set({ posts: this.estado.posts.map((p) => (p.id === pid ? { ...p, ...patch } : p)) });
  }

  async atualizarPost(pid, patch) {
    this.editarPost(pid, patch);
    this.salvar();
  }

  async aprovar(pid) {
    const post = this.estado.posts.find((p) => p.id === pid);
    if (!post) return;
    let agendadoPara = post.agendadoPara;
    if (new Date(agendadoPara).getTime() < Date.now() + 60 * 1000) agendadoPara = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    this.editarPost(pid, { status: 'agendado', agendadoPara, aprovadoEm: new Date().toISOString() });
    this.registrar('disparo', `Aprovado. Sai ${quando(agendadoPara)} no ${post.redes.map((r) => (r === 'instagram' ? 'Instagram' : 'Facebook')).join(' e ')}.`, 'feito', { postId: pid });
    const restantes = this.estado.posts.filter((p) => p.status === 'aguardando').length;
    this.agente('disparo', restantes ? { status: 'aguardando', tarefa: `${restantes} na Mesa esperando o seu ok` } : { status: 'ocioso', tarefa: 'Tudo aprovado. Vigiando os horários.' });
    this.salvar();
  }

  async descartar(pid) {
    this.editarPost(pid, { status: 'descartado' });
    this.registrar('compasso', 'Post descartado. O horário ficou livre para a próxima pauta.', 'info', { postId: pid });
    this.salvar();
  }

  async pedirAjuste(pid, pedido) {
    const post = this.estado.posts.find((p) => p.id === pid);
    if (!post) return;
    const quem = /foto|arte|layout|cor|imagem/i.test(pedido) ? 'traco' : 'verbo';
    this.editarPost(pid, { status: 'ajustando', pedidoAjuste: pedido });
    this.agente(quem, { status: 'trabalhando', tarefa: `Ajustando: "${pedido}"`, progresso: 0.5 });
    this.registrar(quem, `Pedido recebido: "${pedido}". Refazendo.`, 'info', { postId: pid });
    await esperar(1600);
    const variacao = (post.variacao || 0) + 1;
    let foto = this.estado.fotos.find((f) => f.id === post.fotoId);
    if (/outra foto/i.test(pedido)) {
      const outras = this.estado.fotos.filter((f) => f.id !== post.fotoId);
      if (outras.length) foto = outras[variacao % outras.length];
    }
    const pauta = post.pauta;
    const marca = /divertid|descontra|leve/i.test(pedido)
      ? { ...this.estado.marca, voz: { ...this.estado.marca?.voz, tom: 85 } }
      : /formal|sério/i.test(pedido)
        ? { ...this.estado.marca, voz: { ...this.estado.marca?.voz, tom: 20 } }
        : this.estado.marca;
    const design = quem === 'traco' || /outra foto/i.test(pedido) ? desenharArte({ marca, pauta, formato: post.formato, foto, variacao }) : post.design;
    const texto = quem === 'verbo' ? escreverLegenda({ marca, pauta, formato: post.formato, variacao, pedido }) : {};
    this.editarPost(pid, { status: 'aguardando', design, ...texto, fotoId: foto?.id || post.fotoId, variacao });
    this.agente(quem, { status: 'ocioso', tarefa: 'Ajuste entregue na Mesa', progresso: 1 });
    this.registrar(quem, 'Ajuste pronto. Voltou para a Mesa.', 'feito', { postId: pid });
    this.salvar();
  }

  async publicarAgora(pid) {
    this.editarPost(pid, { status: 'agendado', agendadoPara: new Date(Date.now() + 3000).toISOString() });
    this.salvar();
  }

  // Disparo: confere a fila a cada 5 segundos
  ligarRelogio() {
    clearInterval(this.relogio);
    this.relogio = setInterval(() => this.conferirFila(), 5000);
  }

  async conferirFila() {
    const vencidos = this.estado.posts.filter((p) => p.status === 'agendado' && new Date(p.agendadoPara).getTime() <= Date.now());
    for (const p of vencidos) {
      this.editarPost(p.id, { status: 'publicando' });
      this.agente('disparo', { status: 'trabalhando', tarefa: `Publicando "${p.design?.titulo || 'post'}"`, progresso: 0.5 });
      await esperar(1800);
      const alcance = 300 + (hashTexto(p.id) % 900);
      this.editarPost(p.id, {
        status: 'publicado',
        publicadoEm: new Date().toISOString(),
        resultado: { alcance, curtidas: Math.round(alcance * 0.06), comentarios: Math.round(alcance * 0.008), salvamentos: Math.round(alcance * 0.012), demo: true }
      });
      this.registrar('disparo', `Publicado no ${p.redes.map((r) => (r === 'instagram' ? 'Instagram' : 'Facebook')).join(' e ')} (simulação do modo demonstração).`, 'feito', { postId: p.id });
      const restantes = this.estado.posts.filter((x) => x.status === 'aguardando').length;
      this.agente('disparo', restantes ? { status: 'aguardando', tarefa: `${restantes} na Mesa esperando o seu ok`, progresso: 0 } : { status: 'ocioso', tarefa: 'Vigiando os próximos horários', progresso: 1 });
      toast(`Publicado: ${p.design?.titulo || 'post'}`, { agente: 'disparo', tipo: 'ok' });
      this.salvar();
    }
  }

  nomeAgente(aid) {
    return AGENTE[aid]?.nome || aid;
  }
}
