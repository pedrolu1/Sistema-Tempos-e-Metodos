import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ImagePlus, Loader2, Wand2, Trash2, X, Sparkles } from 'lucide-react';
import { useBackend, useStore } from '../lib/store.jsx';
import AgenteAvatar from '../components/AgenteAvatar.jsx';
import { descreverAnalise } from '../lib/imagem.js';
import { quando } from '../lib/tempo.js';
import { toast } from '../lib/toast.js';
import { mensagemDeErro } from '../lib/erros.js';

const INTENCOES = [
  { id: 'produto', rotulo: 'Mostrar produto ou serviço' },
  { id: 'novidade', rotulo: 'Anunciar novidade' },
  { id: 'bastidores', rotulo: 'Bastidores' },
  { id: 'tendencia', rotulo: 'Entrar numa tendência' }
];

const ZONA = { topo: 'no topo', base: 'embaixo', esquerda: 'à esquerda', direita: 'à direita' };

function CriarPost({ foto, fechar }) {
  const backend = useBackend();
  const ir = useNavigate();
  const [formatos, setFormatos] = useState(['feed']);
  const [intencao, setIntencao] = useState('produto');
  const [detalhe, setDetalhe] = useState('');
  const [criando, setCriando] = useState(false);

  async function criar() {
    setCriando(true);
    try {
      const r = await backend.criarDaFoto(foto.id, { formatos, intencao, detalhe: detalhe.trim() });
      fechar();
      toast(r?.pendente ? 'A equipe começou. O post aparece na Mesa em instantes.' : 'Pronto. O post está na Mesa esperando o seu ok.', { agente: 'traco', acao: { rotulo: 'Ver', para: '/mesa' } });
      ir('/mesa');
    } catch (e) {
      toast(mensagemDeErro(e), { tipo: 'erro' });
      setCriando(false);
    }
  }

  const alternar = (f) => setFormatos((l) => (l.includes(f) ? (l.length > 1 ? l.filter((x) => x !== f) : l) : [...l, f]));

  return (
    <motion.div className="modal-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !criando && fechar()}>
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-criar"
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="btn btn-fantasma btn-icone modal-fechar" onClick={fechar} aria-label="Fechar" disabled={criando}>
          <X />
        </button>
        <div className="criar-corpo">
          <img src={foto.url} alt="Foto escolhida" className="criar-foto" />
          <div className="criar-form">
            <h2 id="t-criar">Criar post com esta foto</h2>
            <p className="fraco">{descreverAnalise(foto.analise)}</p>
            <div className="campo">
              <span>Formato</span>
              <div className="chips">
                {[
                  ['feed', 'Feed'],
                  ['story', 'Story']
                ].map(([f, r]) => (
                  <button key={f} className="chip" aria-pressed={formatos.includes(f)} onClick={() => alternar(f)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="campo">
              <span>O que você quer com ela</span>
              <div className="chips">
                {INTENCOES.map((i) => (
                  <button key={i.id} className="chip" aria-pressed={intencao === i.id} onClick={() => setIntencao(i.id)}>
                    {i.rotulo}
                  </button>
                ))}
              </div>
            </div>
            <label className="campo">
              <span>O que aparece na foto (opcional)</span>
              <input className="caixa" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Ex.: o bolo de cenoura com calda da casa" />
              <small className="ajuda">Ajuda o Verbo a escrever uma legenda certeira.</small>
            </label>
            <div className="criar-equipe">
              {['compasso', 'traco', 'verbo'].map((a) => (
                <AgenteAvatar key={a} id={a} status={criando ? 'trabalhando' : 'ocioso'} tamanho={34} />
              ))}
              <span className="fraco">{criando ? 'Compasso, Traço e Verbo trabalhando' : 'Horário, arte e legenda saem juntos'}</span>
            </div>
            <button className="btn btn-papel btn-grande btn-bloco" onClick={criar} disabled={criando}>
              {criando ? <Loader2 className="gira" /> : <Wand2 />}
              {criando ? 'Criando' : formatos.length > 1 ? 'Criar post e story' : `Criar ${formatos[0] === 'story' ? 'story' : 'post'}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Acervo() {
  const backend = useBackend();
  const { fotos, posts, modo } = useStore();
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [escolhida, setEscolhida] = useState(null);
  const input = useRef(null);
  const pedidos = posts.filter((p) => p.status === 'precisa_foto');

  async function enviar(arquivos) {
    const lista = Array.from(arquivos || []).filter((f) => f.type.startsWith('image/'));
    if (!lista.length) return;
    setEnviando(true);
    try {
      await backend.enviarFotos(lista);
      toast(`${lista.length} ${lista.length === 1 ? 'foto enviada' : 'fotos enviadas'}`, { tipo: 'ok', agente: 'traco' });
    } catch (e) {
      toast(mensagemDeErro(e), { tipo: 'erro' });
    } finally {
      setEnviando(false);
    }
  }

  async function exemplos() {
    const arquivos = await Promise.all(
      ['coffee.png', 'chelsea.png'].map(async (n) => new File([await (await fetch(`./exemplos/${n}`)).blob()], n, { type: 'image/png' }))
    );
    enviar(arquivos);
  }

  return (
    <div
      className="pagina acervo"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        enviar(e.dataTransfer.files);
      }}
    >
      <header className="pagina-topo">
        <div>
          <h1>Acervo</h1>
          <p className="sub">Fotos reais da sua empresa. Escolha uma e a equipe transforma em post, com arte, legenda e horário.</p>
        </div>
        <button className="btn btn-papel btn-grande" onClick={() => input.current?.click()} disabled={enviando}>
          {enviando ? <Loader2 className="gira" /> : <ImagePlus />}
          {enviando ? 'Analisando' : 'Enviar fotos'}
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => enviar(e.target.files)} />
      </header>

      {pedidos.length > 0 && (
        <section className="pedidos painel-bloco" aria-labelledby="t-ped">
          <div className="bloco-cabeca">
            <AgenteAvatar id="traco" status="aguardando" tamanho={34} />
            <div>
              <h2 id="t-ped">O Traço está pedindo fotos</h2>
              <p className="fraco">Envie qualquer foto e ele encaixa no post certo.</p>
            </div>
          </div>
          <ul>
            {pedidos.slice(0, 5).map((p) => (
              <li key={p.id}>
                <strong>{p.pauta.pedidoFoto.replace(/^./, (c) => c.toUpperCase())}</strong>
                <small className="fraco">
                  para o {p.formato === 'story' ? 'story' : 'post'} de {quando(p.agendadoPara)}
                </small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fotos.length === 0 ? (
        <section className="acervo-vazio" onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}>
          <ImagePlus />
          <h2>Arraste suas fotos para cá</h2>
          <p className="sub">Produto, equipe, espaço, bastidores. Fotos de celular com luz natural funcionam muito bem.</p>
          {modo === 'demo' && (
            <button
              className="btn btn-fantasma"
              onClick={(e) => {
                e.stopPropagation();
                exemplos();
              }}
            >
              <Sparkles /> Usar fotos de exemplo
            </button>
          )}
        </section>
      ) : (
        <section className="fotos" aria-label="Fotos">
          <AnimatePresence initial={false}>
            {fotos.map((f, i) => (
              <motion.figure key={f.id} className="foto" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
                <button className="foto-botao" onClick={() => setEscolhida(f)} aria-label="Criar post com esta foto">
                  <img src={f.url} alt={f.descricao || f.nome || 'Foto do acervo'} loading="lazy" />
                  <span className="foto-acao">
                    <Wand2 /> Criar post
                  </span>
                </button>
                <figcaption>
                  <span className="foto-paleta" aria-hidden="true">
                    {(f.analise?.paleta || []).slice(0, 4).map((c) => (
                      <i key={c} style={{ background: c }} />
                    ))}
                  </span>
                  <small>
                    {f.descricao ? f.descricao : `Texto cabe ${ZONA[f.analise?.zonaTexto] || 'embaixo'}`}
                    {f.usos ? `, usada ${f.usos}x` : ''}
                  </small>
                  <button
                    className="btn btn-fantasma btn-icone foto-apagar"
                    onClick={() => backend.apagarFoto(f.id)}
                    aria-label="Apagar foto"
                  >
                    <Trash2 />
                  </button>
                </figcaption>
              </motion.figure>
            ))}
          </AnimatePresence>
        </section>
      )}

      <AnimatePresence>{arrastando && <motion.div className="soltar-tela" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Solte as fotos para enviar</motion.div>}</AnimatePresence>
      <AnimatePresence>{escolhida && <CriarPost foto={escolhida} fechar={() => setEscolhida(null)} />}</AnimatePresence>
    </div>
  );
}
