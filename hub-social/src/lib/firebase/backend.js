// MODO REAL: Firebase Auth + Firestore + Storage. O trabalho pesado dos agentes
// (Claude, API da Meta, publicação) roda nas Cloud Functions em /functions.
// O app só lê o estado em tempo real e registra pedidos na coleção "execucoes".
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Backend, ESTADO_INICIAL } from '../store.jsx';
import { carregarImagem, reduzirArquivo, analisarImagem } from '../imagem.js';
import { toast } from '../toast.js';

const agora = () => new Date().toISOString();
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export class FirebaseBackend extends Backend {
  precisaDaArte = true;

  constructor(config) {
    super();
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.auth.languageCode = 'pt-BR';
    this.db = getFirestore(this.app);
    this.storage = getStorage(this.app);
    this.functions = getFunctions(this.app, import.meta.env.VITE_FUNCTIONS_REGION || 'southamerica-east1');
    this.desligar = [];
  }

  iniciar() {
    onAuthStateChanged(this.auth, (u) => {
      this.desligar.forEach((f) => f());
      this.desligar = [];
      if (!u) {
        this.set({ ...ESTADO_INICIAL, pronto: true });
        return;
      }
      this.set({ usuario: { uid: u.uid, email: u.email, nome: u.displayName || u.email.split('@')[0], emailVerificado: u.emailVerified } });
      this.ouvir(u.uid);
    });
  }

  caminho(...partes) {
    return ['usuarios', this.estado.usuario.uid, ...partes].join('/');
  }

  ouvir(uid) {
    const base = `usuarios/${uid}`;
    const lista = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    let perfilCarregado = false;
    this.desligar.push(
      onSnapshot(doc(this.db, base), (s) => {
        perfilCarregado = true;
        this.set({ perfil: s.exists() ? s.data() : { onboarding: 'marca' }, pronto: true });
      }),
      onSnapshot(doc(this.db, `${base}/marca/principal`), (s) => this.set({ marca: s.exists() ? s.data() : null })),
      onSnapshot(collection(this.db, `${base}/conexoes`), (s) => {
        const c = { instagram: null, facebook: null };
        s.docs.forEach((d) => (c[d.id] = d.data()));
        this.set({ conexoes: c });
      }),
      onSnapshot(query(collection(this.db, `${base}/fotos`), orderBy('criadoEm', 'desc'), limit(300)), (s) => this.set({ fotos: lista(s) })),
      onSnapshot(query(collection(this.db, `${base}/posts`), orderBy('agendadoPara', 'asc'), limit(400)), (s) => this.set({ posts: lista(s) })),
      onSnapshot(collection(this.db, `${base}/agentes`), (s) => {
        const a = {};
        s.docs.forEach((d) => (a[d.id] = d.data()));
        this.set({ agentes: a });
      }),
      onSnapshot(query(collection(this.db, `${base}/atividade`), orderBy('criadoEm', 'desc'), limit(80)), (s) => this.set({ atividade: lista(s) })),
      onSnapshot(doc(this.db, `${base}/tendencias/atual`), (s) => this.set({ tendencias: s.exists() ? s.data() : null })),
      onSnapshot(doc(this.db, `${base}/insights/atual`), (s) => this.set({ insights: s.exists() ? s.data() : null }))
    );
    // se o documento do perfil demorar (rede lenta), libera a tela mesmo assim
    setTimeout(() => !perfilCarregado && this.set({ pronto: true }), 6000);
  }

  // Pedido para as Cloud Functions (disparam em onDocumentCreated)
  async pedir(tipo, dados = {}) {
    await addDoc(collection(this.db, this.caminho('execucoes')), { tipo, ...dados, criadoEm: agora() });
  }

  async registrar(agente, texto, tipo = 'info', extra = {}) {
    await addDoc(collection(this.db, this.caminho('atividade')), { agente, texto, tipo, criadoEm: agora(), ...extra });
  }

  // ---------- conta ----------
  async cadastrar({ nome, email, senha }) {
    const { user } = await createUserWithEmailAndPassword(this.auth, email.trim(), senha);
    await updateProfile(user, { displayName: nome.trim() });
    await setDoc(doc(this.db, `usuarios/${user.uid}`), { nome: nome.trim(), email: user.email, onboarding: 'marca', criadoEm: agora() });
    sendEmailVerification(user).catch(() => {});
    this.set({ usuario: { uid: user.uid, email: user.email, nome: nome.trim(), emailVerificado: false } });
  }

  async entrar({ email, senha, lembrar = true }) {
    await setPersistence(this.auth, lembrar ? browserLocalPersistence : browserSessionPersistence);
    await signInWithEmailAndPassword(this.auth, email.trim(), senha);
  }

  async entrarComGoogle() {
    const { user } = await signInWithPopup(this.auth, new GoogleAuthProvider());
    const perfil = await getDoc(doc(this.db, `usuarios/${user.uid}`));
    if (!perfil.exists()) {
      await setDoc(doc(this.db, `usuarios/${user.uid}`), { nome: user.displayName || '', email: user.email, onboarding: 'marca', criadoEm: agora() });
    }
  }

  async sair() {
    await signOut(this.auth);
  }

  async enviarRecuperacao(email) {
    const url = `${window.location.origin}${window.location.pathname}#/entrar`;
    try {
      await sendPasswordResetEmail(this.auth, email.trim(), { url });
    } catch (e) {
      // não revelamos se o e-mail tem conta ou não
      if (e.code !== 'auth/user-not-found') throw e;
    }
    return { enviado: true };
  }

  verificarCodigoRecuperacao(codigo) {
    return verifyPasswordResetCode(this.auth, codigo);
  }

  redefinirSenha(codigo, novaSenha) {
    return confirmPasswordReset(this.auth, codigo, novaSenha);
  }

  async trocarSenha(atual, nova) {
    const u = this.auth.currentUser;
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, atual));
    await updatePassword(u, nova);
  }

  // ---------- marca ----------
  async salvarMarca(parcial, etapa) {
    const dados = { ...parcial };
    if (typeof dados.logo === 'string' && dados.logo.startsWith('data:')) {
      const blob = await (await fetch(dados.logo)).blob();
      const r = ref(this.storage, this.caminho('marca', 'logo.png'));
      await uploadBytes(r, blob, { contentType: 'image/png' });
      dados.logo = await getDownloadURL(r);
    }
    await setDoc(doc(this.db, this.caminho('marca', 'principal')), { ...dados, atualizadoEm: agora() }, { merge: true });
    if (etapa) await setDoc(doc(this.db, this.caminho()), { onboarding: etapa }, { merge: true });
  }

  async concluirOnboarding() {
    await setDoc(doc(this.db, this.caminho()), { onboarding: 'pronto', concluidoEm: agora() }, { merge: true });
    await this.pedir('equipe');
  }

  // ---------- Meta (Instagram + Facebook) ----------
  async conectarMeta() {
    const gerar = httpsCallable(this.functions, 'metaUrlAutorizacao');
    const { data } = await gerar({ origem: window.location.origin });
    const janela = window.open(data.url, 'pulso-meta', 'width=620,height=760');
    if (!janela) throw Object.assign(new Error('O navegador bloqueou a janela. Libere pop-ups para este site.'), { code: 'auth/popup-blocked' });
    return new Promise((ok, falha) => {
      const fim = setTimeout(() => {
        sair();
        falha(new Error('A autorização demorou demais. Tente de novo.'));
      }, 5 * 60 * 1000);
      const aoMensagem = (e) => {
        if (e.data?.tipo !== 'pulso-meta') return;
        sair();
        e.data.ok ? ok(this.estado.conexoes) : falha(new Error(e.data.erro || 'A Meta não autorizou a conexão.'));
      };
      const vigia = setInterval(() => {
        if (janela.closed) {
          sair();
          this.estado.conexoes.instagram || this.estado.conexoes.facebook ? ok(this.estado.conexoes) : falha(new Error('A janela foi fechada antes de terminar.'));
        }
      }, 800);
      const sair = () => {
        clearTimeout(fim);
        clearInterval(vigia);
        window.removeEventListener('message', aoMensagem);
      };
      window.addEventListener('message', aoMensagem);
    });
  }

  async desconectar(rede) {
    await httpsCallable(this.functions, 'desconectarMeta')({ rede });
  }

  // ---------- fotos ----------
  async enviarFotos(arquivos, { silencioso = false } = {}) {
    const novas = [];
    for (const arquivo of arquivos) {
      if (!arquivo.type.startsWith('image/')) continue;
      const { blob, largura, altura } = await reduzirArquivo(arquivo);
      const id = novoId();
      const local = URL.createObjectURL(blob);
      const analise = analisarImagem(await carregarImagem(local));
      URL.revokeObjectURL(local);
      const caminho = this.caminho('fotos', `${id}.jpg`);
      const r = ref(this.storage, caminho);
      await uploadBytes(r, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(r);
      const foto = { id, nome: arquivo.name, url, caminho, largura, altura, analise, usos: 0, criadoEm: agora(), silencioso };
      await setDoc(doc(this.db, this.caminho('fotos', id)), foto);
      novas.push(foto);
    }
    return novas;
  }

  async apagarFoto(id) {
    const f = this.estado.fotos.find((x) => x.id === id);
    if (f?.caminho) await deleteObject(ref(this.storage, f.caminho)).catch(() => {});
    await deleteDoc(doc(this.db, this.caminho('fotos', id)));
  }

  // ---------- agentes ----------
  async rodarAgentes(somente) {
    const ocupado = Object.values(this.estado.agentes).some((a) => a.status === 'trabalhando');
    if (ocupado) {
      toast('Os agentes já estão trabalhando. Acompanhe no Estúdio.', { agente: 'radar' });
      return;
    }
    await this.pedir('equipe', somente ? { somente } : {});
    toast('Pedido enviado. Acompanhe a equipe no Estúdio.', { agente: 'radar', acao: { rotulo: 'Ver', para: '/estudio' } });
  }

  async criarDaFoto(fotoId, { formatos = ['feed'], intencao = 'produto', detalhe = '' } = {}) {
    await this.pedir('foto', { fotoId, formatos, intencao, detalhe });
    return { pendente: true };
  }

  // ---------- mesa ----------
  atualizarPost(id, patch) {
    return updateDoc(doc(this.db, this.caminho('posts', id)), { ...patch, atualizadoEm: agora() });
  }

  async aprovar(id, { arte } = {}) {
    const post = this.estado.posts.find((p) => p.id === id);
    if (!post) return;
    if (!arte) throw new Error('Não foi possível gerar a arte final. Recarregue a página e tente de novo.');
    const caminho = this.caminho('posts', id, `arte-${Date.now()}.jpg`);
    const r = ref(this.storage, caminho);
    await uploadBytes(r, arte, { contentType: 'image/jpeg' });
    const arteUrl = await getDownloadURL(r);
    let agendadoPara = post.agendadoPara;
    if (new Date(agendadoPara).getTime() < Date.now() + 60 * 1000) agendadoPara = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    await this.atualizarPost(id, { status: 'agendado', arteUrl, arteCaminho: caminho, agendadoPara, aprovadoEm: agora() });
    await this.registrar('disparo', 'Aprovado. Vou publicar no horário marcado.', 'feito', { postId: id });
  }

  async descartar(id) {
    await this.atualizarPost(id, { status: 'descartado' });
  }

  async pedirAjuste(id, pedido) {
    await this.atualizarPost(id, { status: 'ajustando', pedidoAjuste: pedido });
    await this.pedir('ajuste', { postId: id, pedido });
  }

  async publicarAgora(id) {
    await httpsCallable(this.functions, 'publicarAgora')({ postId: id });
  }
}
