import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'motion/react';
import { Check, X, Wand2, Stamp, Loader2, Info, Clock, Keyboard, ImagePlus, Play } from 'lucide-react';
import { useBackend, useStore } from '../lib/store.jsx';
import PostCanvas, { exportarPost } from '../render/PostCanvas.jsx';
import AgenteAvatar from '../components/AgenteAvatar.jsx';
import { IconeInstagram, IconeFacebook } from '../components/Marca.jsx';
import { AGENTES } from '../lib/agents.js';
import { quando, faltaQuanto } from '../lib/tempo.js';
import { toast } from '../lib/toast.js';
import { mensagemDeErro } from '../lib/erros.js';

const AJUSTES = ['Texto mais curto', 'Mais descontraído', 'Mais formal', 'Outra foto', 'Outro layout'];

function paraInputLocal(iso) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const VARIANTES = {
  sair: (dir) => ({
    x: dir === 'direita' ? 700 : dir === 'esquerda' ? -700 : 0,
    y: dir === 'baixo' ? 260 : 0,
    opacity: 0,
    rotate: dir === 'direita' ? 18 : dir === 'esquerda' ? -18 : 0,
    transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] }
  })
};

function Carta({ post, marca, fotos, topo, profundidade, onAprovar, onDescartar, carimbo }) {
  const x = useMotionValue(0);
  const rot = useTransform(x, [-320, 320], [-14, 14]);
  const sim = useTransform(x, [30, 150], [0, 1]);
  const nao = useTransform(x, [-150, -30], [1, 0]);

  return (
    <motion.div
      className="carta"
      data-formato={post.formato}
      style={topo ? { x, rotate: rot, zIndex: 10 } : { zIndex: 10 - profundidade }}
      initial={{ scale: 0.9, y: 30, opacity: 0 }}
      animate={topo ? { scale: 1, y: 0, opacity: 1 } : { scale: 1 - profundidade * 0.05, y: profundidade * 18, opacity: 1, rotate: profundidade % 2 ? 3 : -3 }}
      variants={VARIANTES}
      exit="sair"
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      drag={topo && !carimbo ? 'x' : false}
      dragSnapToOrigin
      dragElastic={0.85}
      onDragEnd={(_, info) => {
        if (info.offset.x > 140 || info.velocity.x > 700) onAprovar();
        else if (info.offset.x < -140 || info.velocity.x < -700) onDescartar();
      }}
      aria-hidden={!topo}
    >
      <PostCanvas post={post} marca={marca} fotos={fotos} escala={post.formato === 'story' ? 0.36 : 0.44} />
      {topo && (
        <>
          <motion.span className="carta-dica carta-sim" style={{ opacity: sim }}>
            <Check /> Aprovar
          </motion.span>
          <motion.span className="carta-dica carta-nao" style={{ opacity: nao }}>
            <X /> Descartar
          </motion.span>
        </>
      )}
      <AnimatePresence>
        {carimbo && (
          <motion.span className="carimbo" initial={{ scale: 2.6, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: -14 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
            <Check strokeWidth={3} /> Aprovado
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Explosao() {
  const tintas = AGENTES.map((a) => a.hex);
  const pontos = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => {
        const ang = (i / 36) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 120 + Math.random() * 160;
        return { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, cor: tintas[i % tintas.length], tam: 8 + Math.random() * 12, atraso: Math.random() * 0.1 };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  return (
    <div className="explosao" aria-hidden="true">
      {pontos.map((p, i) => (
        <motion.i
          key={i}
          style={{ background: p.cor, width: p.tam, height: p.tam }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: p.atraso, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

export default function Mesa() {
  const backend = useBackend();
  const { posts, marca, fotos, conexoes, modo, agentes } = useStore();
  const fila = useMemo(() => posts.filter((p) => p.status === 'aguardando').sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara)), [posts]);
  const ajustando = posts.filter((p) => p.status === 'ajustando');
  const [saida, setSaida] = useState('direita');
  const [carimbo, setCarimbo] = useState(null);
  const [aprovadosHoje, setAprovadosHoje] = useState(0);
  const [celebrar, setCelebrar] = useState(false);
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [pedido, setPedido] = useState('');
  const ocupado = useRef(false);
  const atual = fila[0];
  const [rascunho, setRascunho] = useState(null);

  useEffect(() => {
    setRascunho(atual ? { legenda: atual.legenda || '', cta: atual.cta || '', hashtags: (atual.hashtags || []).join(' '), titulo: atual.design?.titulo || '', agendadoPara: paraInputLocal(atual.agendadoPara), redes: atual.redes } : null);
    setAjusteAberto(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.id, atual?.design?.titulo, atual?.legenda]);

  async function salvarRascunho() {
    if (!atual || !rascunho) return;
    const patch = {};
    if (rascunho.legenda !== (atual.legenda || '')) patch.legenda = rascunho.legenda;
    if (rascunho.cta !== (atual.cta || '')) patch.cta = rascunho.cta;
    const tags = rascunho.hashtags.split(/\s+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`));
    if (tags.join(' ') !== (atual.hashtags || []).join(' ')) patch.hashtags = tags;
    if (rascunho.titulo !== atual.design?.titulo) patch.design = { ...atual.design, titulo: rascunho.titulo };
    const novaData = new Date(rascunho.agendadoPara).toISOString();
    if (Math.abs(new Date(novaData) - new Date(atual.agendadoPara)) > 59000) patch.agendadoPara = novaData;
    if (rascunho.redes.join() !== atual.redes.join()) patch.redes = rascunho.redes;
    if (Object.keys(patch).length) await backend.atualizarPost(atual.id, patch);
  }

  async function aprovar() {
    if (!atual || ocupado.current) return;
    if (modo === 'real' && !conexoes.instagram && !conexoes.facebook) {
      toast('Conecte o Instagram ou o Facebook antes de aprovar.', { tipo: 'erro', acao: { rotulo: 'Conectar', para: '/ajustes' } });
      return;
    }
    ocupado.current = true;
    const alvo = atual;
    try {
      await salvarRascunho();
      setCarimbo(alvo.id);
      const arte = backend.precisaDaArte ? await exportarPost({ ...alvo, design: { ...alvo.design, titulo: rascunho?.titulo ?? alvo.design?.titulo } }, marca, fotos) : null;
      await new Promise((ok) => setTimeout(ok, 550));
      setSaida('direita');
      await backend.aprovar(alvo.id, { arte });
      setAprovadosHoje((n) => n + 1);
      if (fila.length === 1) setCelebrar(true);
    } catch (e) {
      toast(mensagemDeErro(e), { tipo: 'erro' });
    } finally {
      setCarimbo(null);
      ocupado.current = false;
    }
  }

  async function descartar() {
    if (!atual || ocupado.current) return;
    const alvo = atual;
    setSaida('esquerda');
    await backend.descartar(alvo.id);
    toast('Post descartado', { acao: { rotulo: 'Desfazer', onClick: () => backend.atualizarPost(alvo.id, { status: 'aguardando' }) } });
  }

  async function ajustar(texto) {
    if (!atual || !texto.trim()) return;
    setSaida('baixo');
    setAjusteAberto(false);
    setPedido('');
    await backend.pedirAjuste(atual.id, texto.trim());
  }

  useEffect(() => {
    function tecla(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey) return;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        aprovar();
      }
      if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        descartar();
      }
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const produzindo = ['radar', 'compasso', 'traco', 'verbo'].some((a) => agentes[a]?.status === 'trabalhando');

  return (
    <div className="pagina mesa">
      <header className="pagina-topo">
        <div>
          <h1>Mesa de aprovação</h1>
          <p className="sub">
            {fila.length
              ? `${fila.length} ${fila.length === 1 ? 'post pronto' : 'posts prontos'}. Arraste para a direita para aprovar, para a esquerda para descartar.`
              : 'Nada esperando por você agora.'}
          </p>
        </div>
        {aprovadosHoje > 0 && (
          <motion.span key={aprovadosHoje} className="selo selo-grande" initial={{ scale: 0.7 }} animate={{ scale: 1 }}>
            <Stamp /> {aprovadosHoje} {aprovadosHoje === 1 ? 'aprovado' : 'aprovados'} nesta sessão
          </motion.span>
        )}
      </header>

      {ajustando.length > 0 && (
        <p className="faixa-ajuste">
          <Loader2 className="gira" /> {ajustando.length === 1 ? 'Um post está' : `${ajustando.length} posts estão`} voltando para ajuste. Ele reaparece aqui quando ficar pronto.
        </p>
      )}

      {!atual ? (
        <section className="mesa-vazia">
          {celebrar && <Explosao />}
          <motion.div className="mesa-vazia-selo" initial={{ rotate: -30, scale: 0.6, opacity: 0 }} animate={{ rotate: -10, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            <Stamp />
          </motion.div>
          <h2 className="display">{celebrar ? 'Mesa limpa' : produzindo ? 'A equipe está produzindo' : 'Mesa vazia'}</h2>
          <p className="sub">
            {celebrar
              ? 'Tudo aprovado. O Disparo publica cada post no horário marcado.'
              : produzindo
                ? 'Os posts aparecem aqui assim que Traço e Verbo terminarem.'
                : 'Crie um post a partir de uma foto ou peça para a equipe montar a próxima semana.'}
          </p>
          <div className="linha-botoes">
            <Link to="/acervo" className="btn btn-papel btn-grande">
              <ImagePlus /> Criar post com uma foto
            </Link>
            {!produzindo && (
              <button className="btn btn-fantasma btn-grande" onClick={() => backend.rodarAgentes()}>
                <Play /> Rodar a equipe
              </button>
            )}
          </div>
        </section>
      ) : (
        <div className="mesa-corpo">
          <section className="mesa-pilha" aria-label="Post atual">
            <div className="pilha" data-formato={atual.formato}>
              <AnimatePresence custom={saida} initial={false}>
                {fila
                  .slice(0, 3)
                  .reverse()
                  .map((p) => {
                    const prof = fila.indexOf(p);
                    return (
                      <Carta
                        key={p.id}
                        post={prof === 0 && rascunho ? { ...p, design: { ...p.design, titulo: rascunho.titulo } } : p}
                        marca={marca}
                        fotos={fotos}
                        topo={prof === 0}
                        profundidade={prof}
                        onAprovar={aprovar}
                        onDescartar={descartar}
                        carimbo={carimbo === p.id}
                      />
                    );
                  })}
              </AnimatePresence>
            </div>
            <div className="mesa-acoes">
              <button className="acao acao-nao" onClick={descartar} aria-label="Descartar post">
                <X />
                <span>Descartar</span>
              </button>
              <button className="acao acao-ajuste" onClick={() => setAjusteAberto((v) => !v)} aria-expanded={ajusteAberto} aria-label="Pedir ajuste">
                <Wand2 />
                <span>Ajustar</span>
              </button>
              <button className="acao acao-sim" onClick={aprovar} aria-label="Aprovar post">
                <Check />
                <span>Aprovar</span>
              </button>
            </div>
            <AnimatePresence>
              {ajusteAberto && (
                <motion.div className="ajuste" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}>
                  <p>O que mudar?</p>
                  <div className="chips">
                    {AJUSTES.map((a) => (
                      <button key={a} className="chip" onClick={() => ajustar(a)}>
                        {a}
                      </button>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      ajustar(pedido);
                    }}
                  >
                    <input className="caixa" value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Ou escreva: fala do bolo de cenoura" />
                    <button className="btn btn-papel" disabled={!pedido.trim()}>
                      Pedir
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="atalhos fraco">
              <Keyboard size={16} /> Teclado: seta direita aprova, seta esquerda descarta.
            </p>
          </section>

          {rascunho && (
            <section className="mesa-detalhes painel-bloco" aria-label="Detalhes do post">
              <div className="por-que">
                <AgenteAvatar id="compasso" tamanho={34} />
                <div>
                  <strong>Por que este post</strong>
                  <p>
                    {atual.pauta?.tema ? `${atual.pauta.tema.replace(/^./, (c) => c.toUpperCase())}. ` : ''}
                    Objetivo: {atual.pauta?.objetivo || 'alcance'}.
                  </p>
                </div>
              </div>

              <div className="campo">
                <span>
                  <Clock size={15} /> Publicação {quando(atual.agendadoPara)}
                  <small className="fraco"> ({faltaQuanto(atual.agendadoPara)})</small>
                </span>
                <input type="datetime-local" className="caixa" value={rascunho.agendadoPara} onChange={(e) => setRascunho({ ...rascunho, agendadoPara: e.target.value })} onBlur={salvarRascunho} />
                {atual.motivoHorario && <small className="ajuda">Escolhido pelo Compasso: {atual.motivoHorario}.</small>}
              </div>

              <div className="campo">
                <span>Onde publicar</span>
                <div className="chips">
                  {[
                    ['instagram', 'Instagram', IconeInstagram],
                    ['facebook', 'Facebook', IconeFacebook]
                  ].map(([id, nome, Icone]) => {
                    const on = rascunho.redes.includes(id);
                    return (
                      <button
                        key={id}
                        className="chip"
                        aria-pressed={on}
                        onClick={() => {
                          const redes = on ? rascunho.redes.filter((r) => r !== id) : [...rascunho.redes, id];
                          if (!redes.length) return;
                          setRascunho({ ...rascunho, redes });
                          backend.atualizarPost(atual.id, { redes });
                        }}
                      >
                        <Icone /> {nome}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="campo">
                <span>Texto da arte</span>
                <input className="caixa" value={rascunho.titulo} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} onBlur={salvarRascunho} maxLength={90} />
              </label>

              {atual.formato === 'story' ? (
                <p className="nota">
                  <Info size={16} /> Story não tem legenda no Instagram nem no Facebook. Tudo que importa está na arte.
                </p>
              ) : (
                <>
                  <label className="campo">
                    <span>
                      Legenda <small className="fraco num">{rascunho.legenda.length}/2200</small>
                    </span>
                    <textarea className="caixa" rows={7} value={rascunho.legenda} onChange={(e) => setRascunho({ ...rascunho, legenda: e.target.value })} onBlur={salvarRascunho} maxLength={2200} />
                  </label>
                  <label className="campo">
                    <span>Chamada para ação</span>
                    <input className="caixa" value={rascunho.cta} onChange={(e) => setRascunho({ ...rascunho, cta: e.target.value })} onBlur={salvarRascunho} />
                  </label>
                  <label className="campo">
                    <span>Hashtags</span>
                    <input className="caixa" value={rascunho.hashtags} onChange={(e) => setRascunho({ ...rascunho, hashtags: e.target.value })} onBlur={salvarRascunho} />
                  </label>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
