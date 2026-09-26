import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, ShieldCheck, Upload, Minus, Plus, Sparkles, X } from 'lucide-react';
import { Logo, IconeInstagram, IconeFacebook } from '../../components/Marca.jsx';
import { Campo } from '../../components/Campos.jsx';
import AgenteAvatar from '../../components/AgenteAvatar.jsx';
import PostCanvas from '../../render/PostCanvas.jsx';
import { PARES } from '../../render/fontes.js';
import { useBackend, useStore } from '../../lib/store.jsx';
import { AGENTES } from '../../lib/agents.js';
import { carregarImagem, paletaDe, contraste, luminancia } from '../../lib/imagem.js';
import { toast } from '../../lib/toast.js';
import { mensagemDeErro } from '../../lib/erros.js';

const ETAPAS = [
  { id: 'marca', titulo: 'Seu negócio' },
  { id: 'identidade', titulo: 'Cara da marca' },
  { id: 'voz', titulo: 'Jeito de falar' },
  { id: 'redes', titulo: 'Redes sociais' },
  { id: 'fotos', titulo: 'Suas fotos' }
];

const NICHOS_SUGERIDOS = ['Cafeteria', 'Restaurante', 'Moda feminina', 'Salão de beleza', 'Clínica', 'Academia', 'Pet shop', 'Consultoria'];
const VALORES = ['Feito à mão', 'Atendimento próximo', 'Qualidade acima de tudo', 'Preço justo', 'Sustentabilidade', 'Tradição', 'Inovação', 'Bom humor'];
const CTAS = [
  { id: 'whatsapp', rotulo: 'Chamar no WhatsApp' },
  { id: 'direct', rotulo: 'Mandar direct' },
  { id: 'visita', rotulo: 'Visitar a loja' },
  { id: 'site', rotulo: 'Acessar o site' },
  { id: 'comentario', rotulo: 'Comentar no post' }
];

const MARCA_PADRAO = {
  nome: '',
  usuario: '',
  nicho: '',
  cidade: '',
  descricao: '',
  publico: '',
  logo: null,
  cores: { primaria: '#26355d', secundaria: '#e8e1f4', destaque: '#ff8a3d', clara: '#f8f6f2', escura: '#1d1b29' },
  fontes: 'editorial',
  voz: { tom: 65, emojis: 'pouco', valores: [], evitar: '' },
  cta: { tipo: 'whatsapp', whatsapp: '', site: '' },
  ritmo: { feed: 4, stories: 5 }
};

async function logoParaDataURL(arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(url);
    const escala = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/png');
    const cores = paletaDe(img, { k: 5, ignorarClaros: true });
    return { dataUrl, cores };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Monta a paleta completa a partir das cores do logo.
function paletaDoLogo(cores, atual) {
  if (!cores.length) return atual;
  const saturacao = (h) => {
    const [r, g, b] = h.match(/\w\w/g).map((x) => parseInt(x, 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };
  const escuras = [...cores].sort((a, b) => luminancia(a) - luminancia(b));
  const primaria = cores.find((c) => luminancia(c) < 0.35) || escuras[0];
  const destaque = [...cores].filter((c) => c !== primaria).sort((a, b) => saturacao(b) - saturacao(a))[0] || atual.destaque;
  return { ...atual, primaria, destaque: contraste(destaque, primaria) > 1.6 ? destaque : atual.destaque };
}

function Previa({ marca, fotos }) {
  const foto = fotos[0];
  const post = useMemo(
    () => ({
      formato: 'feed',
      design: foto
        ? { template: 'recorte', titulo: marca.nome ? `${marca.nome}, do nosso jeito` : 'Sua foto, sua marca', apoio: '', paleta: 'marca', zonaTexto: foto.analise?.zonaTexto, focal: foto.analise?.focal, seed: 11, fotoId: foto.id }
        : { template: 'aviso', titulo: marca.nome ? `${marca.nome} agora tem uma agência` : 'Seu próximo post começa aqui', apoio: 'feito por você', paleta: 'marca', seed: 5 }
    }),
    [marca.nome, foto]
  );
  return (
    <div className="previa">
      <div className="previa-celular">
        <div className="previa-cabeca">
          <span className="previa-avatar" style={{ background: marca.cores.primaria }}>
            {marca.logo ? <img src={marca.logo} alt="" /> : (marca.nome || 'P')[0]}
          </span>
          <strong>{marca.usuario || (marca.nome || 'suamarca').toLowerCase().replace(/\s+/g, '')}</strong>
        </div>
        <PostCanvas post={post} marca={marca} fotos={fotos} escala={0.34} rotulo="Prévia de um post com a sua marca" />
        <div className="previa-rodape">
          <span />
          <span />
          <span />
        </div>
      </div>
      <p className="fraco">Prévia ao vivo. Muda conforme você preenche.</p>
    </div>
  );
}

function Contratacao({ aoTerminar }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n < AGENTES.length) {
      const t = setTimeout(() => setN(n + 1), 520);
      return () => clearTimeout(t);
    }
    const t = setTimeout(aoTerminar, 1100);
    return () => clearTimeout(t);
  }, [n, aoTerminar]);
  return (
    <motion.div className="contratacao" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h2 className="display">Montando sua equipe</h2>
      <div className="contratacao-lista">
        {AGENTES.map((a, i) => (
          <motion.div key={a.id} className="contratacao-item" initial={{ opacity: 0, y: 30, scale: 0.8 }} animate={i < n ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ type: 'spring', stiffness: 380, damping: 20 }}>
            <AgenteAvatar id={a.id} status={i < n ? 'trabalhando' : 'ocioso'} tamanho={64} />
            <strong>{a.nome}</strong>
            <span>{a.papel}</span>
          </motion.div>
        ))}
      </div>
      <p className="sub">{n < AGENTES.length ? 'Apresentando cada agente à sua marca' : 'Pronto. O Radar já começou a pesquisar.'}</p>
    </motion.div>
  );
}

export default function Onboarding() {
  const backend = useBackend();
  const { marca: salva, perfil, conexoes, fotos, modo } = useStore();
  const ir = useNavigate();
  const [marca, setMarca] = useState(() => ({ ...MARCA_PADRAO, ...(salva || {}), cores: { ...MARCA_PADRAO.cores, ...(salva?.cores || {}) }, voz: { ...MARCA_PADRAO.voz, ...(salva?.voz || {}) }, cta: { ...MARCA_PADRAO.cta, ...(salva?.cta || {}) }, ritmo: { ...MARCA_PADRAO.ritmo, ...(salva?.ritmo || {}) } }));
  const inicial = Math.max(0, ETAPAS.findIndex((e) => e.id === perfil?.onboarding));
  const [passo, setPasso] = useState(inicial);
  const [direcao, setDirecao] = useState(1);
  const [conectando, setConectando] = useState(false);
  const [enviandoFotos, setEnviandoFotos] = useState(false);
  const [montando, setMontando] = useState(false);
  const inputFotos = useRef(null);

  const muda = (patch) => setMarca((m) => ({ ...m, ...patch }));
  const mudaEm = (chave, patch) => setMarca((m) => ({ ...m, [chave]: { ...m[chave], ...patch } }));

  const podeAvancar = [marca.nome.trim().length >= 2 && marca.nicho.trim().length >= 2, true, true, true, true][passo];

  async function avancar() {
    const proxima = ETAPAS[passo + 1]?.id;
    await backend.salvarMarca(marca, proxima || 'fotos');
    if (passo < ETAPAS.length - 1) {
      setDirecao(1);
      setPasso(passo + 1);
    } else {
      setMontando(true);
    }
  }

  function voltar() {
    setDirecao(-1);
    setPasso(Math.max(0, passo - 1));
  }

  async function conectar() {
    setConectando(true);
    try {
      await backend.conectarMeta();
      toast('Instagram e Facebook conectados', { tipo: 'ok', agente: 'disparo' });
    } catch (e) {
      toast(mensagemDeErro(e), { tipo: 'erro' });
    } finally {
      setConectando(false);
    }
  }

  async function subirFotos(arquivos) {
    if (!arquivos?.length) return;
    setEnviandoFotos(true);
    try {
      await backend.enviarFotos(Array.from(arquivos), { silencioso: true });
    } finally {
      setEnviandoFotos(false);
    }
  }

  async function fotosDeExemplo() {
    setEnviandoFotos(true);
    try {
      const arquivos = await Promise.all(
        ['coffee.png', 'chelsea.png'].map(async (n) => {
          const r = await fetch(`./exemplos/${n}`);
          const b = await r.blob();
          return new File([b], n, { type: 'image/png' });
        })
      );
      await backend.enviarFotos(arquivos, { silencioso: true });
    } finally {
      setEnviandoFotos(false);
    }
  }

  async function subirLogo(arquivo) {
    if (!arquivo) return;
    const { dataUrl, cores } = await logoParaDataURL(arquivo);
    setMarca((m) => ({ ...m, logo: dataUrl, cores: paletaDoLogo(cores, m.cores) }));
    toast('Tirei as cores do seu logo. Ajuste se quiser.', { agente: 'traco' });
  }

  if (montando) {
    return (
      <Contratacao
        aoTerminar={async () => {
          await backend.concluirOnboarding();
          ir('/');
        }}
      />
    );
  }

  const etapa = ETAPAS[passo];

  return (
    <div className="onboarding">
      <header className="onb-topo">
        <Logo tamanho={26} />
        <ol className="onb-passos" aria-label="Etapas">
          {ETAPAS.map((e, i) => (
            <li key={e.id} data-estado={i < passo ? 'feito' : i === passo ? 'atual' : 'depois'} aria-current={i === passo ? 'step' : undefined}>
              <span className="onb-bolinha">{i < passo ? <Check size={14} /> : i + 1}</span>
              <span className="onb-nome">{e.titulo}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className="onb-corpo">
        <section className="onb-form">
          <AnimatePresence mode="wait" custom={direcao}>
            <motion.div
              key={etapa.id}
              custom={direcao}
              initial={{ opacity: 0, x: 40 * direcao }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 * direcao }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="onb-etapa"
            >
              {etapa.id === 'marca' && (
                <>
                  <h1>Conte sobre o seu negócio</h1>
                  <p className="sub">É daqui que os agentes tiram o assunto, o público e o jeito de cada post.</p>
                  <div className="grade-2">
                    <Campo rotulo="Nome da marca" value={marca.nome} onChange={(e) => muda({ nome: e.target.value })} placeholder="Ex.: Café Aurora" autoFocus />
                    <Campo rotulo="@ no Instagram" value={marca.usuario} onChange={(e) => muda({ usuario: e.target.value.replace(/^@/, '').trim() })} placeholder="cafeaurora" />
                  </div>
                  <Campo rotulo="Ramo de atuação" value={marca.nicho} onChange={(e) => muda({ nicho: e.target.value })} placeholder="Ex.: cafeteria artesanal" ajuda="Quanto mais específico, melhor a pesquisa do Radar." />
                  <div className="chips">
                    {NICHOS_SUGERIDOS.map((n) => (
                      <button key={n} type="button" className="chip" aria-pressed={marca.nicho === n} onClick={() => muda({ nicho: n })}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="grade-2">
                    <Campo rotulo="Cidade" value={marca.cidade} onChange={(e) => muda({ cidade: e.target.value })} placeholder="Ex.: Belo Horizonte" ajuda="Para achar assuntos da sua região." />
                    <Campo rotulo="Para quem vocês vendem" value={marca.publico} onChange={(e) => muda({ publico: e.target.value })} placeholder="Ex.: quem trabalha no centro" />
                  </div>
                  <Campo rotulo="O que vocês fazem, em uma frase">
                    <textarea className="caixa" rows={2} value={marca.descricao} onChange={(e) => muda({ descricao: e.target.value })} placeholder="Ex.: café coado na hora e pão de fermentação natural, feitos por quem ama o que faz." />
                  </Campo>
                </>
              )}

              {etapa.id === 'identidade' && (
                <>
                  <h1>Deixe as artes com a cara da marca</h1>
                  <p className="sub">Mande o logo e o Traço tira as cores dele. Depois é só escolher o estilo das letras.</p>
                  <label className="logo-upload">
                    <input type="file" accept="image/*" onChange={(e) => subirLogo(e.target.files?.[0])} hidden />
                    {marca.logo ? <img src={marca.logo} alt="Logo enviado" /> : <Upload />}
                    <span>
                      <strong>{marca.logo ? 'Trocar logo' : 'Enviar logo'}</strong>
                      <small>PNG com fundo transparente fica melhor</small>
                    </span>
                    {marca.logo && (
                      <button type="button" className="btn btn-fantasma btn-icone" onClick={(e) => { e.preventDefault(); muda({ logo: null }); }} aria-label="Remover logo">
                        <X />
                      </button>
                    )}
                  </label>
                  <div className="cores">
                    {[
                      ['primaria', 'Principal'],
                      ['destaque', 'Destaque'],
                      ['clara', 'Fundo claro'],
                      ['escura', 'Texto escuro']
                    ].map(([k, r]) => (
                      <label key={k} className="cor">
                        <input type="color" value={marca.cores[k]} onChange={(e) => mudaEm('cores', { [k]: e.target.value })} />
                        <span className="cor-amostra" style={{ background: marca.cores[k] }} />
                        <span>
                          <strong>{r}</strong>
                          <small>{marca.cores[k]}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <h3>Estilo das letras</h3>
                  <div className="pares" role="radiogroup" aria-label="Estilo das letras">
                    {Object.entries(PARES).map(([id, p]) => (
                      <button key={id} type="button" role="radio" aria-checked={marca.fontes === id} className="par" onClick={() => muda({ fontes: id })}>
                        <span className="par-amostra" style={{ fontFamily: `"${p.titulo.familia}"`, fontWeight: p.titulo.peso, fontStretch: p.titulo.largo ? '125%' : undefined }}>
                          Aa
                        </span>
                        <span>
                          <strong>{p.nome}</strong>
                          <small>{p.pra}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {etapa.id === 'voz' && (
                <>
                  <h1>Como a marca conversa</h1>
                  <p className="sub">O Verbo escreve as legendas nesse tom. Nada de texto engessado.</p>
                  <div className="campo">
                    <span>Tom de voz</span>
                    <div className="regua">
                      <small>Formal</small>
                      <input type="range" min="0" max="100" value={marca.voz.tom} onChange={(e) => mudaEm('voz', { tom: +e.target.value })} aria-label="Tom de voz, de formal a descontraído" />
                      <small>Descontraído</small>
                    </div>
                    <p className="exemplo-tom">
                      {marca.voz.tom < 35
                        ? '"Apresentamos a nova coleção, pensada para o seu dia a dia."'
                        : marca.voz.tom < 70
                          ? '"Chegou coisa nova por aqui e a gente já está apaixonado."'
                          : '"Gente, olha isso. A gente não aguentou esperar pra mostrar."'}
                    </p>
                  </div>
                  <div className="campo">
                    <span>Emojis</span>
                    <div className="chips">
                      {[
                        ['nunca', 'Nunca'],
                        ['pouco', 'Com moderação'],
                        ['livre', 'À vontade']
                      ].map(([v, r]) => (
                        <button key={v} type="button" className="chip" aria-pressed={marca.voz.emojis === v} onClick={() => mudaEm('voz', { emojis: v })}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="campo">
                    <span>O que a marca defende</span>
                    <div className="chips">
                      {VALORES.map((v) => {
                        const on = marca.voz.valores.includes(v);
                        return (
                          <button key={v} type="button" className="chip" aria-pressed={on} onClick={() => mudaEm('voz', { valores: on ? marca.voz.valores.filter((x) => x !== v) : [...marca.voz.valores, v] })}>
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Campo rotulo="Palavras que a marca nunca usa" value={marca.voz.evitar} onChange={(e) => mudaEm('voz', { evitar: e.target.value })} placeholder="Ex.: barato, promoção imperdível" />
                  <div className="campo">
                    <span>Chamada para ação preferida</span>
                    <div className="chips">
                      {CTAS.map((c) => (
                        <button key={c.id} type="button" className="chip" aria-pressed={marca.cta.tipo === c.id} onClick={() => mudaEm('cta', { tipo: c.id })}>
                          {c.rotulo}
                        </button>
                      ))}
                    </div>
                  </div>
                  {marca.cta.tipo === 'whatsapp' && <Campo rotulo="WhatsApp" type="tel" value={marca.cta.whatsapp} onChange={(e) => mudaEm('cta', { whatsapp: e.target.value })} placeholder="(31) 99999-0000" />}
                  {marca.cta.tipo === 'site' && <Campo rotulo="Site" type="url" value={marca.cta.site} onChange={(e) => mudaEm('cta', { site: e.target.value })} placeholder="https://" />}
                </>
              )}

              {etapa.id === 'redes' && (
                <>
                  <h1>Conecte o Instagram e o Facebook</h1>
                  <p className="sub">
                    A conexão é pela Meta, dona das duas redes. Você autoriza na janela oficial e o Pulso nunca vê nem guarda a sua senha. Dá para desconectar quando quiser.
                  </p>
                  <div className="redes">
                    {[
                      ['instagram', 'Instagram', IconeInstagram, 'Precisa ser conta profissional (comercial ou criador).'],
                      ['facebook', 'Facebook', IconeFacebook, 'A página da empresa, ligada ao Instagram.']
                    ].map(([id, nome, Icone, dica]) => {
                      const c = conexoes[id];
                      return (
                        <div key={id} className="rede" data-conectado={!!c}>
                          <span className={`rede-icone rede-${id}`}>
                            <Icone />
                          </span>
                          <span className="rede-info">
                            <strong>{nome}</strong>
                            <small>{c ? `${id === 'instagram' ? '@' + c.usuario : c.nome}, conectado` : dica}</small>
                          </span>
                          {c ? (
                            <span className="selo" style={{ color: 'var(--ok)' }}>
                              <Check /> Conectado
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {!conexoes.instagram && (
                    <button className="btn btn-papel btn-grande" onClick={conectar} disabled={conectando}>
                      {conectando ? <Loader2 className="gira" /> : <ShieldCheck />}
                      {conectando ? 'Esperando a autorização da Meta' : 'Conectar com a Meta'}
                    </button>
                  )}
                  {modo === 'demo' && !conexoes.instagram && <p className="fraco">No modo demonstração a conexão é simulada.</p>}
                  <div className="ritmo">
                    <h3>Ritmo de postagem</h3>
                    <p className="fraco">O Compasso distribui isso nos melhores dias da semana.</p>
                    {[
                      ['feed', 'Posts no feed por semana', 1, 7],
                      ['stories', 'Stories por semana', 0, 14]
                    ].map(([k, r, min, max]) => (
                      <div key={k} className="contador">
                        <span>{r}</span>
                        <button type="button" className="btn btn-fantasma btn-icone" onClick={() => mudaEm('ritmo', { [k]: Math.max(min, marca.ritmo[k] - 1) })} aria-label={`Menos ${r}`}>
                          <Minus />
                        </button>
                        <strong className="num" aria-live="polite">
                          {marca.ritmo[k]}
                        </strong>
                        <button type="button" className="btn btn-fantasma btn-icone" onClick={() => mudaEm('ritmo', { [k]: Math.min(max, marca.ritmo[k] + 1) })} aria-label={`Mais ${r}`}>
                          <Plus />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {etapa.id === 'fotos' && (
                <>
                  <h1>Mande fotos reais do seu dia a dia</h1>
                  <p className="sub">Produto, equipe, espaço, bastidores. Foto de celular serve. O Traço monta os posts em cima delas, sem imagem inventada.</p>
                  <div
                    className="soltar"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      subirFotos(e.dataTransfer.files);
                    }}
                    onClick={() => inputFotos.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputFotos.current?.click()}
                  >
                    <input ref={inputFotos} type="file" accept="image/*" multiple hidden onChange={(e) => subirFotos(e.target.files)} />
                    {enviandoFotos ? <Loader2 className="gira" /> : <ImagePlus />}
                    <strong>{enviandoFotos ? 'Analisando as fotos' : 'Arraste as fotos aqui ou toque para escolher'}</strong>
                    <small>Pode mandar várias de uma vez</small>
                  </div>
                  {fotos.length > 0 && (
                    <div className="mini-fotos">
                      {fotos.slice(0, 12).map((f) => (
                        <motion.img key={f.id} src={f.url} alt="" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} />
                      ))}
                    </div>
                  )}
                  {modo === 'demo' && fotos.length === 0 && (
                    <button type="button" className="btn btn-fantasma" onClick={fotosDeExemplo} disabled={enviandoFotos}>
                      <Sparkles /> Usar duas fotos de exemplo
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="onb-acoes">
            {passo > 0 && (
              <button className="btn btn-fantasma btn-grande" onClick={voltar}>
                <ArrowLeft /> Voltar
              </button>
            )}
            <button className="btn btn-papel btn-grande" onClick={avancar} disabled={!podeAvancar}>
              {passo === ETAPAS.length - 1 ? (fotos.length ? 'Montar minha agência' : 'Pular e montar a agência') : 'Continuar'}
              <ArrowRight />
            </button>
          </div>
        </section>

        <aside className="onb-lado">
          <Previa marca={marca} fotos={fotos} />
        </aside>
      </div>
    </div>
  );
}
