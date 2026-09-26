import { useState } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Loader2, Stamp, RotateCcw, TrendingUp, Minus } from 'lucide-react';
import { useBackend, useStore } from '../lib/store.jsx';
import { AGENTES, AGENTE, STATUS_AGENTE } from '../lib/agents.js';
import AgenteAvatar from '../components/AgenteAvatar.jsx';
import PostCanvas from '../render/PostCanvas.jsx';
import { haQuanto, quando } from '../lib/tempo.js';

// Fluxo de produção: quem entrega para quem.
const FLUXO = ['radar', 'compasso', 'traco', 'verbo', 'voce', 'disparo'];

function Estacao({ id, estado, pendentes }) {
  if (id === 'voce') {
    return (
      <Link to="/mesa" className="estacao estacao-voce" data-ativo={pendentes > 0}>
        <span className="estacao-carimbo">
          <Stamp />
          {pendentes > 0 && <b className="num">{pendentes}</b>}
        </span>
        <strong>Você</strong>
        <small>{pendentes ? 'Aprovando' : 'Quem dá o ok'}</small>
      </Link>
    );
  }
  const a = AGENTE[id];
  return (
    <div className="estacao" data-status={estado?.status || 'ocioso'} style={{ '--cor': a.cor }}>
      <AgenteAvatar id={id} status={estado?.status} tamanho={52} />
      <strong>{a.nome}</strong>
      <small>{STATUS_AGENTE[estado?.status || 'ocioso']}</small>
    </div>
  );
}

function Entregas({ id, estado }) {
  const { tendencias, posts, marca, fotos, insights } = estado;
  const futuros = posts.filter((p) => !['descartado', 'publicado', 'falhou'].includes(p.status)).sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara));
  if (id === 'radar') {
    if (!tendencias?.itens?.length) return <p className="fraco">Ainda sem pesquisa. Rode o Radar para ver o que está em alta no seu nicho.</p>;
    return (
      <ul className="entregas-lista">
        {tendencias.itens.slice(0, 4).map((t) => (
          <li key={t.tema}>
            <span className="sinal" data-sinal={t.sinal}>
              {t.sinal === 'subindo' ? <TrendingUp /> : <Minus />}
              {t.sinal}
            </span>
            <span>
              <strong>{t.tema}</strong>
              <small>{t.porque}</small>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === 'compasso') {
    if (!futuros.length) return <p className="fraco">Calendário vazio. O Compasso monta as próximas duas semanas quando a equipe rodar.</p>;
    return (
      <ul className="entregas-lista">
        {futuros.slice(0, 4).map((p) => (
          <li key={p.id}>
            <span className="selo">{p.formato === 'story' ? 'Story' : 'Feed'}</span>
            <span>
              <strong>{quando(p.agendadoPara)}</strong>
              <small>{p.motivoHorario}</small>
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (id === 'traco') {
    const comArte = posts.filter((p) => p.design).slice(-4).reverse();
    const faltaFoto = posts.filter((p) => p.status === 'precisa_foto');
    return (
      <>
        {faltaFoto.length > 0 && (
          <Link to="/acervo" className="pedido-foto">
            O Traço precisa de {faltaFoto.length} {faltaFoto.length === 1 ? 'foto' : 'fotos'}: {faltaFoto[0].pauta.pedidoFoto}.
          </Link>
        )}
        {comArte.length ? (
          <div className="entregas-artes">
            {comArte.map((p) => (
              <PostCanvas key={p.id} post={p} marca={marca} fotos={fotos} escala={0.12} />
            ))}
          </div>
        ) : (
          !faltaFoto.length && <p className="fraco">Nenhuma arte ainda.</p>
        )}
      </>
    );
  }
  if (id === 'verbo') {
    const ultima = [...posts].reverse().find((p) => p.legenda);
    if (!ultima) return <p className="fraco">Nenhuma legenda ainda.</p>;
    return (
      <blockquote className="entrega-legenda">
        {ultima.legenda.split('\n\n')[0]}
        <cite>{ultima.cta}</cite>
      </blockquote>
    );
  }
  if (id === 'disparo') {
    const agendados = futuros.filter((p) => p.status === 'agendado');
    const publicados = posts.filter((p) => p.status === 'publicado');
    return (
      <ul className="entregas-lista">
        <li>
          <span className="selo num">{agendados.length}</span>
          <span>
            <strong>Agendados</strong>
            <small>{agendados[0] ? `Próximo ${quando(agendados[0].agendadoPara)}` : 'Nenhum na fila'}</small>
          </span>
        </li>
        <li>
          <span className="selo num">{publicados.length}</span>
          <span>
            <strong>Publicados</strong>
            <small>{publicados.length ? `Último ${haQuanto(publicados[publicados.length - 1].publicadoEm)}` : 'Ainda nenhum'}</small>
          </span>
        </li>
      </ul>
    );
  }
  if (id === 'lupa') {
    const s = insights?.sugestoes?.[0];
    if (!s) return <p className="fraco">Sem leitura ainda.</p>;
    return (
      <Link to="/" className="entrega-sugestao">
        <strong>{s.titulo}</strong>
        <small>{s.detalhe}</small>
      </Link>
    );
  }
  return null;
}

export default function Estudio() {
  const backend = useBackend();
  const estado = useStore();
  const { agentes, atividade, posts } = estado;
  const [filtro, setFiltro] = useState('todos');
  const rodando = Object.values(agentes).some((a) => a.status === 'trabalhando');
  const pendentes = posts.filter((p) => p.status === 'aguardando').length;
  const lista = atividade.filter((a) => filtro === 'todos' || a.agente === filtro).slice(0, 40);
  const ativoIdx = FLUXO.findIndex((id) => agentes[id]?.status === 'trabalhando');

  return (
    <div className="pagina estudio">
      <header className="pagina-topo">
        <div>
          <h1>Estúdio</h1>
          <p className="sub">Sua equipe, ao vivo. Cada agente tem a sua cor, e ela aparece em tudo que ele faz.</p>
        </div>
        <button className="btn btn-papel btn-grande" onClick={() => backend.rodarAgentes()} disabled={rodando}>
          {rodando ? <Loader2 className="gira" /> : <Play />}
          {rodando ? 'Equipe trabalhando' : 'Rodar a equipe inteira'}
        </button>
      </header>

      <section className="fluxo painel-bloco" aria-label="Linha de produção" data-rodando={rodando}>
        <div className="fluxo-trilho" style={{ '--ativo': ativoIdx < 0 ? 0 : ativoIdx / (FLUXO.length - 1) }}>
          <span className="fluxo-linha" />
          {rodando && <span className="fluxo-pacote" />}
        </div>
        <div className="fluxo-estacoes">
          {FLUXO.map((id) => (
            <Estacao key={id} id={id} estado={agentes[id]} pendentes={pendentes} />
          ))}
        </div>
      </section>

      <div className="estudio-corpo">
        <section className="agentes-grade" aria-label="Agentes">
          {AGENTES.map((a) => {
            const e = agentes[a.id] || {};
            const trabalhando = e.status === 'trabalhando';
            return (
              <article key={a.id} className="agente-cartao" data-status={e.status} style={{ '--cor': a.cor }}>
                <header>
                  <AgenteAvatar id={a.id} status={e.status} tamanho={48} />
                  <div>
                    <h2>{a.nome}</h2>
                    <p className="fraco">{a.papel}</p>
                  </div>
                  <span className="selo status-agente" data-status={e.status}>
                    <span className="ponto" />
                    {STATUS_AGENTE[e.status || 'ocioso']}
                  </span>
                </header>
                <p className="agente-faz">{a.faz}</p>
                <div className="agente-agora" aria-live="polite">
                  <AnimatePresence mode="wait">
                    <motion.p key={e.tarefa || 'nada'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                      {e.tarefa || 'Esperando a próxima rodada.'}
                      {trabalhando && <span className="cursor" aria-hidden="true" />}
                    </motion.p>
                  </AnimatePresence>
                  {trabalhando && (
                    <span className="progresso" aria-hidden="true">
                      <motion.i animate={{ width: `${Math.max(8, (e.progresso || 0) * 100)}%` }} transition={{ duration: 0.6 }} />
                    </span>
                  )}
                </div>
                <div className="agente-entregas">
                  <Entregas id={a.id} estado={estado} />
                </div>
                {a.id !== 'disparo' && (
                  <button className="btn btn-fantasma" onClick={() => backend.rodarAgentes(a.id)} disabled={rodando}>
                    <RotateCcw /> {a.id === 'radar' ? 'Pesquisar de novo' : a.id === 'compasso' ? 'Refazer calendário' : a.id === 'lupa' ? 'Ler os números agora' : 'Produzir a semana'}
                  </button>
                )}
              </article>
            );
          })}
        </section>

        <aside className="atividade painel-bloco" aria-label="O que aconteceu">
          <h2>Diário da equipe</h2>
          <div className="chips chips-rolagem">
            <button className="chip" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>
              Todos
            </button>
            {AGENTES.map((a) => (
              <button key={a.id} className="chip" aria-pressed={filtro === a.id} onClick={() => setFiltro(a.id)}>
                <span className="ponto" style={{ color: a.cor }} />
                {a.nome}
              </button>
            ))}
          </div>
          <ol className="linha-tempo">
            <AnimatePresence initial={false}>
              {lista.map((item) => (
                <motion.li key={item.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} data-tipo={item.tipo} style={{ '--cor': AGENTE[item.agente]?.cor }}>
                  <span className="lt-ponto" aria-hidden="true" />
                  <p>
                    <strong>{AGENTE[item.agente]?.nome}</strong> {item.texto}
                  </p>
                  <time className="fraco" dateTime={item.criadoEm}>
                    {haQuanto(item.criadoEm)}
                  </time>
                </motion.li>
              ))}
            </AnimatePresence>
            {!lista.length && <li className="fraco">Nada por aqui ainda.</li>}
          </ol>
        </aside>
      </div>
    </div>
  );
}
