import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, X, Send, Stamp, Trash2, ImagePlus } from 'lucide-react';
import { useBackend, useStore } from '../lib/store.jsx';
import PostCanvas from '../render/PostCanvas.jsx';
import { STATUS_POST } from '../lib/agents.js';
import { DIAS, MESES, somaDias, mesmoDia, hora, quando } from '../lib/tempo.js';
import { toast } from '../lib/toast.js';

const VISIVEIS = (p) => p.status !== 'descartado';

function Chip({ post, marca, fotos, abrir, arrastavel }) {
  return (
    <button
      className="ag-post"
      data-status={post.status}
      onClick={() => abrir(post)}
      draggable={arrastavel}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', post.id)}
      aria-label={`${post.formato === 'story' ? 'Story' : 'Post'} ${post.design?.titulo || post.pauta?.tema}, ${hora(post.agendadoPara)}, ${STATUS_POST[post.status].rotulo}`}
    >
      {post.design ? <PostCanvas post={post} marca={marca} fotos={fotos} escala={0.06} /> : <span className="ag-post-vazio" />}
      <span className="ag-post-info">
        <strong className="num">{hora(post.agendadoPara)}</strong>
        <small>{post.design?.titulo || post.pauta?.tema}</small>
      </span>
      <span className="ag-post-status" title={STATUS_POST[post.status].rotulo} />
    </button>
  );
}

function Gaveta({ post, fechar }) {
  const backend = useBackend();
  const { marca, fotos } = useStore();
  const ir = useNavigate();
  if (!post) return null;
  return (
    <motion.div className="gaveta-fundo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={fechar}>
      <motion.aside
        className="gaveta"
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes do post"
      >
        <button className="btn btn-fantasma btn-icone gaveta-fechar" onClick={fechar} aria-label="Fechar">
          <X />
        </button>
        <span className="selo" data-status={post.status}>
          {STATUS_POST[post.status].rotulo}
        </span>
        <h2>{post.design?.titulo || post.pauta?.tema}</h2>
        <p className="fraco">
          {post.formato === 'story' ? 'Story' : 'Feed'}, {quando(post.agendadoPara)}
        </p>
        {post.design && (
          <div className="gaveta-arte" data-formato={post.formato}>
            <PostCanvas post={post} marca={marca} fotos={fotos} escala={0.3} />
          </div>
        )}
        {post.status === 'precisa_foto' && (
          <p className="pedido-foto">
            O Traço precisa de uma foto para este post: {post.pauta?.pedidoFoto}.
          </p>
        )}
        {post.legenda && <p className="gaveta-legenda">{post.legenda}</p>}
        {post.motivoHorario && <p className="fraco">Horário escolhido pelo Compasso: {post.motivoHorario}.</p>}
        {post.resultado && (
          <p className="fraco">
            Resultado: {post.resultado.alcance} de alcance, {post.resultado.curtidas} curtidas, {post.resultado.salvamentos} salvamentos
            {post.resultado.demo ? ' (simulação)' : ''}.
          </p>
        )}
        {post.erro && <p className="erro-caixa">{post.erro}</p>}
        <div className="linha-botoes">
          {post.status === 'aguardando' && (
            <button className="btn btn-papel" onClick={() => ir('/mesa')}>
              <Stamp /> Aprovar na Mesa
            </button>
          )}
          {post.status === 'precisa_foto' && (
            <button className="btn btn-papel" onClick={() => ir('/acervo')}>
              <ImagePlus /> Enviar foto
            </button>
          )}
          {post.status === 'agendado' && (
            <button
              className="btn btn-papel"
              onClick={async () => {
                await backend.publicarAgora(post.id);
                toast('O Disparo vai publicar em instantes.', { agente: 'disparo' });
                fechar();
              }}
            >
              <Send /> Publicar agora
            </button>
          )}
          {!['publicado', 'publicando', 'descartado'].includes(post.status) && (
            <button
              className="btn btn-fantasma"
              onClick={async () => {
                await backend.descartar(post.id);
                fechar();
              }}
            >
              <Trash2 /> Descartar
            </button>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

export default function Agenda() {
  const backend = useBackend();
  const { posts, marca, fotos, insights } = useStore();
  const [modo, setModo] = useState('semana');
  const [ref, setRef] = useState(() => new Date());
  const [aberto, setAberto] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const visiveis = useMemo(() => posts.filter(VISIVEIS).sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara)), [posts]);
  const forca = insights?.horarios?.map((l) => l.reduce((a, b) => a + b, 0)) || [];
  const maxForca = Math.max(...forca, 1);
  const hoje = new Date();

  const dias = useMemo(() => {
    // semana = os 7 dias a partir da data de referência (começa em hoje)
    if (modo === 'semana') {
      const ini = new Date(ref);
      ini.setHours(0, 0, 0, 0);
      return Array.from({ length: 7 }, (_, i) => somaDias(ini, i));
    }
    // mês: grade de segunda a domingo
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const ini = somaDias(primeiro, -((primeiro.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => somaDias(ini, i));
  }, [modo, ref]);

  function mover(delta) {
    const d = new Date(ref);
    if (modo === 'semana') d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setRef(d);
  }

  async function soltar(dia, pid) {
    setAlvo(null);
    const p = posts.find((x) => x.id === pid);
    if (!p || ['publicado', 'publicando'].includes(p.status)) return;
    const antigo = new Date(p.agendadoPara);
    const novo = new Date(dia);
    novo.setHours(antigo.getHours(), antigo.getMinutes(), 0, 0);
    if (novo < new Date()) {
      toast('Esse horário já passou. Escolha um dia a partir de hoje.', { tipo: 'erro' });
      return;
    }
    await backend.atualizarPost(pid, { agendadoPara: novo.toISOString() });
    toast(`Remarcado para ${quando(novo)}`, { agente: 'compasso' });
  }

  const titulo =
    modo === 'semana'
      ? `${dias[0].getDate()} ${MESES[dias[0].getMonth()]} a ${dias[6].getDate()} ${MESES[dias[6].getMonth()]}`
      : `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][ref.getMonth()]} de ${ref.getFullYear()}`;

  return (
    <div className="pagina agenda">
      <header className="pagina-topo">
        <div>
          <h1>Agenda</h1>
          <p className="sub">Arraste um post para outro dia para remarcar. O horário continua o mesmo.</p>
        </div>
      </header>

      <div className="ag-barra">
        <div className="chips" role="tablist" aria-label="Visualização">
          {[
            ['semana', 'Semana'],
            ['mes', 'Mês']
          ].map(([v, r]) => (
            <button key={v} role="tab" aria-selected={modo === v} className="chip" aria-pressed={modo === v} onClick={() => setModo(v)}>
              {r}
            </button>
          ))}
        </div>
        <div className="ag-nav">
          <button className="btn btn-fantasma btn-icone" onClick={() => mover(-1)} aria-label="Anterior">
            <ChevronLeft />
          </button>
          <strong aria-live="polite">{titulo}</strong>
          <button className="btn btn-fantasma btn-icone" onClick={() => mover(1)} aria-label="Próximo">
            <ChevronRight />
          </button>
          <button className="btn btn-fantasma" onClick={() => setRef(new Date())}>
            Hoje
          </button>
        </div>
        <ul className="ag-legenda" aria-label="Legenda de status">
          {['aguardando', 'agendado', 'publicado', 'precisa_foto'].map((s) => (
            <li key={s} data-status={s}>
              <span className="ag-post-status" /> {STATUS_POST[s].rotulo}
            </li>
          ))}
        </ul>
      </div>

      <div className={`ag-grade ag-${modo}`}>
        {modo === 'mes' &&
          [1, 2, 3, 4, 5, 6, 0].map((d) => (
            <span key={d} className="ag-cab-mes">
              {DIAS[d]}
            </span>
          ))}
        {dias.map((dia) => {
          const doDia = visiveis.filter((p) => mesmoDia(p.agendadoPara, dia));
          const foraDoMes = modo === 'mes' && dia.getMonth() !== ref.getMonth();
          const f = forca[dia.getDay()] / maxForca;
          return (
            <section
              key={dia.toISOString()}
              className="ag-dia"
              data-hoje={mesmoDia(dia, hoje)}
              data-fora={foraDoMes}
              data-alvo={alvo === dia.toDateString()}
              onDragOver={(e) => {
                e.preventDefault();
                setAlvo(dia.toDateString());
              }}
              onDragLeave={() => setAlvo(null)}
              onDrop={(e) => {
                e.preventDefault();
                soltar(dia, e.dataTransfer.getData('text/plain'));
              }}
              aria-label={`${DIAS[dia.getDay()]} ${dia.getDate()}`}
            >
              <header className="ag-dia-cab">
                {modo === 'semana' && <span className="ag-dia-nome">{DIAS[dia.getDay()]}</span>}
                <strong className="num">{dia.getDate()}</strong>
                {modo === 'semana' && (
                  <span className="ag-forca" title={`Público online: ${Math.round(f * 100)}% do melhor dia`}>
                    <i style={{ width: `${Math.round(f * 100)}%` }} />
                  </span>
                )}
              </header>
              <div className="ag-dia-posts">
                {modo === 'semana'
                  ? doDia.map((p) => <Chip key={p.id} post={p} marca={marca} fotos={fotos} abrir={setAberto} arrastavel={!['publicado', 'publicando'].includes(p.status)} />)
                  : doDia.slice(0, 3).map((p) => (
                      <button key={p.id} className="ag-ponto" data-status={p.status} onClick={() => setAberto(p)} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}>
                        <span className="ag-post-status" />
                        <span className="num">{hora(p.agendadoPara)}</span>
                      </button>
                    ))}
                {modo === 'mes' && doDia.length > 3 && <small className="fraco">+{doDia.length - 3}</small>}
              </div>
            </section>
          );
        })}
      </div>

      <AnimatePresence>{aberto && <Gaveta post={posts.find((p) => p.id === aberto.id) || aberto} fechar={() => setAberto(null)} />}</AnimatePresence>
    </div>
  );
}
