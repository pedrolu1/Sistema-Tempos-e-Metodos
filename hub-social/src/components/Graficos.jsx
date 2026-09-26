import { useId, useMemo, useRef, useState } from 'react';
import { DIAS } from '../lib/tempo.js';

// Gráficos do Painel. Tudo que é análise usa a tinta da Lupa (lilás).
// Série única: sem legenda, o título do cartão já diz o que é.

export function Sparkline({ valores = [], largura = 120, altura = 36, rotulo }) {
  const pts = useMemo(() => {
    if (valores.length < 2) return [];
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const amp = max - min || 1;
    return valores.map((v, i) => [(i / (valores.length - 1)) * (largura - 8) + 4, altura - 5 - ((v - min) / amp) * (altura - 10)]);
  }, [valores, largura, altura]);
  if (!pts.length) return null;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const ult = pts[pts.length - 1];
  return (
    <svg className="sparkline" viewBox={`0 0 ${largura} ${altura}`} width={largura} height={altura} role="img" aria-label={rotulo}>
      <path d={d} className="sparkline-linha" />
      <circle cx={ult[0]} cy={ult[1]} r="4" className="sparkline-ponto" />
    </svg>
  );
}

export function LinhaPulso({ serie = [], chave = 'alcance', rotulo = 'Alcance por dia', formatar = (v) => v }) {
  const W = 720;
  const H = 180;
  const m = { e: 8, d: 8, t: 16, b: 26 };
  const ref = useRef(null);
  const [foco, setFoco] = useState(null);
  const gid = useId();
  const valores = serie.map((s) => s[chave] ?? 0);
  if (serie.length < 2) return <p className="fraco">Ainda não há dias suficientes para o gráfico.</p>;
  const max = Math.max(...valores, 1) * 1.1;
  const x = (i) => m.e + (i / Math.max(1, serie.length - 1)) * (W - m.e - m.d);
  const y = (v) => m.t + (1 - v / max) * (H - m.t - m.b);
  const linha = valores.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const area = `${linha}L${x(valores.length - 1)} ${H - m.b}L${x(0)} ${H - m.b}Z`;
  const marcas = [0, Math.floor(serie.length / 2), serie.length - 1].filter((i) => serie[i]);

  function mover(e) {
    const box = ref.current.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - m.e) / (W - m.e - m.d)) * (serie.length - 1));
    setFoco(Math.max(0, Math.min(serie.length - 1, i)));
  }

  const fmtData = (s) => {
    const d = new Date(s + 'T12:00:00');
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="linha-pulso">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onPointerMove={mover}
        onPointerLeave={() => setFoco(null)}
        role="img"
        aria-label={`${rotulo}, últimos ${serie.length} dias`}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--lupa)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--lupa)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => (
          <line key={f} x1={m.e} x2={W - m.d} y1={y(max * f * 0.9)} y2={y(max * f * 0.9)} className="grade" />
        ))}
        <line x1={m.e} x2={W - m.d} y1={H - m.b} y2={H - m.b} className="eixo" />
        <path d={area} fill={`url(#${gid})`} />
        <path d={linha} className="linha-pulso-traco" vectorEffect="non-scaling-stroke" />
        {foco != null && <line x1={x(foco)} x2={x(foco)} y1={m.t} y2={H - m.b} className="mira" vectorEffect="non-scaling-stroke" />}
      </svg>
      {foco != null && (
        <>
          <span className="linha-pulso-ponto" style={{ left: `${(x(foco) / W) * 100}%`, top: `${(y(valores[foco]) / H) * 100}%` }} />
          <div className="dica-grafico" style={{ left: `${(x(foco) / W) * 100}%` }}>
            <strong className="num">{formatar(valores[foco])}</strong>
            <span>{fmtData(serie[foco].data)}</span>
          </div>
        </>
      )}
      <div className="linha-pulso-eixo" aria-hidden="true">
        {marcas.map((i) => (
          <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>
            {fmtData(serie[i].data)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{rotulo}</caption>
        <tbody>
          {serie.map((s) => (
            <tr key={s.data}>
              <th scope="row">{s.data}</th>
              <td>{formatar(s[chave])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// rampa sequencial de uma tinta só: do fundo até lilás claro
function tom(v) {
  const a = [46, 38, 104];
  const b = [185, 140, 255];
  const c = [236, 226, 255];
  const [p, q, t] = v < 0.7 ? [a, b, v / 0.7] : [b, c, (v - 0.7) / 0.3];
  return `rgb(${p.map((x, i) => Math.round(x + (q[i] - x) * t)).join(',')})`;
}

export function MapaHorarios({ matriz = [], de = 6, ate = 23 }) {
  const [foco, setFoco] = useState(null);
  const horas = Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  if (!matriz.length) return null;
  return (
    <div className="mapa-horarios" onPointerLeave={() => setFoco(null)}>
      <div className="mapa-grade" style={{ '--colunas': horas.length }} role="img" aria-label="Seguidores online por dia e hora">
        <span />
        {horas.map((h) => (
          <span key={h} className="mapa-hora" aria-hidden="true">
            {h % 3 === 0 ? `${h}h` : ''}
          </span>
        ))}
        {ordem.map((d) => (
          <div className="mapa-linha" key={d} style={{ display: 'contents' }}>
            <span className="mapa-dia">{DIAS[d]}</span>
            {horas.map((h) => {
              const v = matriz[d][h];
              return (
                <span
                  key={h}
                  className="mapa-celula"
                  style={{ background: tom(v) }}
                  onPointerEnter={() => setFoco({ d, h, v })}
                  data-foco={foco && foco.d === d && foco.h === h ? '' : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="mapa-legenda" aria-live="polite">
        {foco ? (
          <>
            <strong>
              {DIAS[foco.d]}, {foco.h}h
            </strong>{' '}
            com {Math.round(foco.v * 100)}% do pico de seguidores online
          </>
        ) : (
          <>Passe o dedo ou o mouse nos quadrados. Mais claro, mais gente online.</>
        )}
      </p>
      <table className="sr-only">
        <caption>Seguidores online, percentual do pico</caption>
        <thead>
          <tr>
            <th>Dia</th>
            {horas.map((h) => (
              <th key={h}>{h}h</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordem.map((d) => (
            <tr key={d}>
              <th scope="row">{DIAS[d]}</th>
              {horas.map((h) => (
                <td key={h}>{Math.round(matriz[d][h] * 100)}%</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Anel de meta semanal
export function Anel({ valor, meta, tamanho = 76, cor = 'var(--papel)' }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, meta ? valor / meta : 0);
  return (
    <svg className="anel" width={tamanho} height={tamanho} viewBox="0 0 76 76" role="img" aria-label={`${valor} de ${meta}`}>
      <circle cx="38" cy="38" r={r} className="anel-trilho" />
      <circle cx="38" cy="38" r={r} className="anel-valor" style={{ stroke: cor, strokeDasharray: c, strokeDashoffset: c * (1 - f) }} />
    </svg>
  );
}
