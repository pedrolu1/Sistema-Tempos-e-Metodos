import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Play, Loader2, ArrowUpRight, ArrowDownRight, Flame, ChevronRight, Stamp, CalendarClock } from 'lucide-react';
import { useBackend, useStore } from '../lib/store.jsx';
import { LinhaPulso, Sparkline, MapaHorarios, Anel } from '../components/Graficos.jsx';
import AgenteAvatar from '../components/AgenteAvatar.jsx';
import PostCanvas from '../render/PostCanvas.jsx';
import { calcularPulso, diagnostico } from '../lib/pulso.js';
import { compacto, pct, quando } from '../lib/tempo.js';
import { STATUS_POST } from '../lib/agents.js';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function Delta({ valor, tipo = 'pct' }) {
  if (valor == null || Number.isNaN(valor)) return null;
  const sobe = valor >= 0;
  const Icone = sobe ? ArrowUpRight : ArrowDownRight;
  const texto = tipo === 'pct' ? `${sobe ? '+' : ''}${Math.round(valor * 100)}%` : tipo === 'pp' ? `${sobe ? '+' : ''}${(valor * 100).toFixed(1).replace('.', ',')} p.p.` : `${sobe ? '+' : ''}${compacto(valor)}`;
  return (
    <span className="delta" data-sobe={sobe}>
      <Icone aria-hidden="true" />
      {texto}
      <span className="sr-only">{sobe ? 'de alta' : 'de queda'} na semana</span>
    </span>
  );
}

const KPIS = [
  { id: 'seguidores', rotulo: 'Seguidores', fmt: compacto, delta: 'abs' },
  { id: 'alcance', rotulo: 'Alcance, 7 dias', fmt: compacto, delta: 'pct' },
  { id: 'engajamento', rotulo: 'Engajamento', fmt: (v) => pct(v), delta: 'pp' },
  { id: 'visitas', rotulo: 'Visitas ao perfil', fmt: compacto, delta: 'pct' },
  { id: 'cliques', rotulo: 'Cliques no link', fmt: compacto, delta: 'pct' }
];

const SERIES = [
  { id: 'alcance', rotulo: 'Alcance', fmt: compacto },
  { id: 'interacoes', rotulo: 'Interações', fmt: compacto },
  { id: 'seguidores', rotulo: 'Seguidores', fmt: compacto }
];

export default function Painel() {
  const backend = useBackend();
  const { usuario, marca, insights, posts, agentes, fotos } = useStore();
  const ir = useNavigate();
  const [serie, setSerie] = useState('alcance');
  const rodando = Object.values(agentes).some((a) => a.status === 'trabalhando');
  const pulso = useMemo(() => calcularPulso({ insights, posts, marca }), [insights, posts, marca]);
  const pendentes = posts.filter((p) => p.status === 'aguardando');
  const proximos = posts
    .filter((p) => ['aguardando', 'agendado'].includes(p.status) && new Date(p.agendadoPara) > new Date())
    .sort((a, b) => new Date(a.agendadoPara) - new Date(b.agendadoPara))
    .slice(0, 4);
  const hojeAgendados = posts.filter((p) => p.status === 'agendado' && new Date(p.agendadoPara).toDateString() === new Date().toDateString()).length;
  const sugestoes = insights?.sugestoes || [];
  const serieAtual = SERIES.find((s) => s.id === serie);

  const resumo = [
    pendentes.length ? `${pendentes.length} ${pendentes.length === 1 ? 'post espera' : 'posts esperam'} o seu ok` : null,
    hojeAgendados ? `${hojeAgendados} ${hojeAgendados === 1 ? 'sai' : 'saem'} hoje` : null,
    rodando ? 'a equipe está trabalhando agora' : null
  ].filter(Boolean);

  function agir(acao) {
    if (!acao) return;
    if (acao.tipo === 'ir') ir(acao.para);
    if (acao.tipo === 'rodar') backend.rodarAgentes(acao.agente);
  }

  if (!insights) {
    return (
      <div className="pagina pg-painel">
        <header className="pagina-topo">
          <div>
            <h1>
              {saudacao()}, {usuario?.nome?.split(' ')[0]}
            </h1>
            <p className="sub">A Lupa ainda não leu os números da sua conta.</p>
          </div>
          <button className="btn btn-papel btn-grande" onClick={() => backend.rodarAgentes()} disabled={rodando}>
            {rodando ? <Loader2 className="gira" /> : <Play />}
            {rodando ? 'Equipe trabalhando' : 'Rodar a equipe agora'}
          </button>
        </header>
        <section className="painel-bloco vazio-painel">
          <AgenteAvatar id="lupa" status={rodando ? 'trabalhando' : 'aguardando'} tamanho={56} />
          <h2>Os indicadores aparecem aqui</h2>
          <p className="sub">Conecte o Instagram em Ajustes e rode a equipe. A Lupa lê alcance, seguidores, engajamento e os horários do seu público.</p>
          <Link to="/ajustes" className="btn btn-fantasma">
            Conectar o Instagram
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="pagina pg-painel">
      <header className="pagina-topo">
        <div>
          <h1>
            {saudacao()}, {usuario?.nome?.split(' ')[0]}
          </h1>
          <p className="sub">{resumo.length ? `${resumo.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : 'Tudo em dia. Os agentes avisam quando tiver novidade.'}</p>
        </div>
        <button className="btn btn-papel btn-grande" onClick={() => backend.rodarAgentes()} disabled={rodando}>
          {rodando ? <Loader2 className="gira" /> : <Play />}
          {rodando ? 'Equipe trabalhando' : 'Rodar a equipe agora'}
        </button>
      </header>

      {insights.demo && <p className="aviso-demo">Os números abaixo são de exemplo. Com o Instagram conectado de verdade, a Lupa lê os dados reais da sua conta.</p>}

      <section className="pulso painel-bloco" aria-labelledby="t-pulso">
        <div className="pulso-nota">
          <h2 id="t-pulso" className="rotulo-bloco">
            Pulso da marca
          </h2>
          <div className="pulso-numero">
            <motion.strong className="num" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              {pulso.nota}
            </motion.strong>
            <span className="pulso-nivel" data-nivel={pulso.nivel}>
              {pulso.nivel === 'Em chamas' && <Flame />}
              {pulso.nivel}
            </span>
          </div>
          <p className="pulso-diag">{diagnostico(pulso, insights)}</p>
          <ul className="pulso-partes">
            {[
              ['Constância', pulso.partes.constancia],
              ['Engajamento', pulso.partes.engajamento],
              ['Crescimento', pulso.partes.crescimento],
              ['Mesa em dia', pulso.partes.mesa]
            ].map(([r, v]) => (
              <li key={r}>
                <span>{r}</span>
                <span className="medidor" aria-hidden="true">
                  <i style={{ width: `${Math.round(v * 100)}%` }} />
                </span>
                <span className="num fraco">{Math.round(v * 100)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="pulso-grafico">
          <div className="chips" role="tablist" aria-label="Série do gráfico">
            {SERIES.map((s) => (
              <button key={s.id} role="tab" aria-selected={serie === s.id} className="chip" aria-pressed={serie === s.id} onClick={() => setSerie(s.id)}>
                {s.rotulo}
              </button>
            ))}
          </div>
          <LinhaPulso serie={insights.serie || []} chave={serie} rotulo={`${serieAtual.rotulo} por dia`} formatar={serieAtual.fmt} />
        </div>
      </section>

      <section className="kpis" aria-label="Indicadores da semana">
        {KPIS.map((k, i) => {
          const d = insights.kpis?.[k.id] || { valor: null, delta: null, serie: [] };
          return (
            <motion.article key={k.id} className="kpi" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <h3>{k.rotulo}</h3>
              <strong className="kpi-valor">{d?.valor == null ? <span className="fraco">sem dado</span> : k.fmt(d.valor)}</strong>
              <div className="kpi-pe">
                <Delta valor={d.delta} tipo={k.delta} />
                <Sparkline valores={(d.serie || []).slice(-14)} rotulo={`${k.rotulo}, últimos 14 dias`} />
              </div>
            </motion.article>
          );
        })}
      </section>

      <div className="painel-duplo">
        <section className="painel-bloco" aria-labelledby="t-sug">
          <div className="bloco-cabeca">
            <AgenteAvatar id="lupa" tamanho={32} />
            <div>
              <h2 id="t-sug">Sugestões para crescer</h2>
              <p className="fraco">A Lupa atualiza depois de cada publicação.</p>
            </div>
          </div>
          <ol className="sugestoes">
            {sugestoes.length === 0 && <li className="fraco">A Lupa está lendo seus números. As sugestões aparecem aqui em instantes.</li>}
            {sugestoes.map((s) => (
              <li key={s.id} className="sugestao">
                <span className="sugestao-impacto" data-impacto={s.impacto}>
                  Impacto {s.impacto}
                </span>
                <h3>{s.titulo}</h3>
                <p>{s.detalhe}</p>
                {s.acao && (
                  <button className="btn btn-fantasma" onClick={() => agir(s.acao)}>
                    {s.acao.rotulo} <ChevronRight />
                  </button>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="painel-bloco" aria-labelledby="t-hor">
          <div className="bloco-cabeca">
            <AgenteAvatar id="compasso" tamanho={32} />
            <div>
              <h2 id="t-hor">Quando seu público está online</h2>
              <p className="fraco">O Compasso agenda cada post nas janelas mais claras.</p>
            </div>
          </div>
          {insights.horarios ? <MapaHorarios matriz={insights.horarios} /> : <p className="fraco">A Meta ainda não liberou os horários do seu público. Enquanto isso, o Compasso usa os horários de maior movimento no Instagram em geral.</p>}
        </section>
      </div>

      <div className="painel-triplo">
        <section className="painel-bloco meta" aria-labelledby="t-meta">
          <h2 id="t-meta">Meta da semana</h2>
          <div className="meta-corpo">
            <div className="meta-anel">
              <Anel valor={pulso.agendadosSemana} meta={pulso.meta} />
              <span className="num">
                {pulso.agendadosSemana}/{pulso.meta}
              </span>
            </div>
            <p>
              {pulso.agendadosSemana >= pulso.meta ? 'Semana garantida. Tudo que passar disso é bônus.' : `Faltam ${pulso.meta - pulso.agendadosSemana} posts no feed para fechar a semana.`}
            </p>
          </div>
          <p className="sequencia">
            <Flame /> {pulso.sequencia ? `${pulso.sequencia} ${pulso.sequencia === 1 ? 'semana' : 'semanas'} seguidas batendo a meta` : 'Bata a meta desta semana para começar uma sequência'}
          </p>
        </section>

        <section className="painel-bloco" aria-labelledby="t-prox">
          <div className="bloco-cabeca bloco-cabeca-link">
            <h2 id="t-prox">Próximos posts</h2>
            <Link to="/agenda" className="link">
              Ver agenda
            </Link>
          </div>
          {proximos.length === 0 ? (
            <p className="fraco">Nada na fila ainda. Rode a equipe para o Compasso montar o calendário.</p>
          ) : (
            <ul className="proximos">
              {proximos.map((p) => (
                <li key={p.id}>
                  <Link to={p.status === 'aguardando' ? '/mesa' : '/agenda'} className="proximo">
                    <PostCanvas post={p} marca={marca} fotos={fotos} escala={0.08} />
                    <span>
                      <strong>{p.design?.titulo}</strong>
                      <small>
                        {p.formato === 'story' ? 'Story' : 'Feed'}, {quando(p.agendadoPara)}
                      </small>
                    </span>
                    <span className="selo" data-status={p.status}>
                      {p.status === 'aguardando' ? <Stamp /> : <CalendarClock />}
                      {STATUS_POST[p.status].rotulo}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="painel-bloco" aria-labelledby="t-form">
          <h2 id="t-form">Engajamento por formato</h2>
          <ul className="barras">
            {[...(insights.formatos || [])]
              .sort((a, b) => b.taxa - a.taxa)
              .map((f) => {
                const max = Math.max(...insights.formatos.map((x) => x.taxa), 0.0001);
                return (
                  <li key={f.formato}>
                    <span>{f.formato}</span>
                    <span className="barra" aria-hidden="true">
                      <motion.i initial={{ width: 0 }} animate={{ width: `${(f.taxa / max) * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <span className="num">{pct(f.taxa)}</span>
                  </li>
                );
              })}
          </ul>
          <p className="fraco">Taxa média de engajamento sobre o alcance, últimos 30 dias.</p>
        </section>
      </div>
    </div>
  );
}
