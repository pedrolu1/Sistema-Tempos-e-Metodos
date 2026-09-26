import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Loader2, LogOut, ShieldCheck, Unplug } from 'lucide-react';
import { useBackend, useStore } from '../lib/store.jsx';
import { Campo, CampoSenha } from '../components/Campos.jsx';
import { IconeInstagram, IconeFacebook } from '../components/Marca.jsx';
import { PARES } from '../render/fontes.js';
import { TEMPLATES } from '../render/renderizador.js';
import PostCanvas from '../render/PostCanvas.jsx';
import { toast } from '../lib/toast.js';
import { mensagemDeErro, forcaSenha } from '../lib/erros.js';
import { haQuanto } from '../lib/tempo.js';

const ABAS = [
  ['marca', 'Marca'],
  ['redes', 'Redes'],
  ['conta', 'Conta']
];

const EXEMPLOS = {
  manchete: { titulo: 'A fornada das sete saiu', apoio: 'Chega cedo que acaba' },
  moldura: { titulo: 'Feito à mão, todo dia', apoio: 'desde as 6h por aqui' },
  recorte: { titulo: 'Chegou a receita nova', apoio: 'Só esta semana', selo: 'Novo' },
  etiqueta: { titulo: 'Antes de abrir' },
  lista: { titulo: 'Como guardar pão sem endurecer', itens: ['Pano de algodão', 'Longe da geladeira', 'Fatiou? Congela'], apoio: 'salva para depois' },
  aviso: { titulo: 'Doce ou salgado de manhã?', apoio: 'responde aí' },
  citacao: { titulo: 'Aqui entra o depoimento real de um cliente, com a autorização dele', apoio: 'Nome do cliente' }
};

// Todos os layouts do Traço aplicados à marca, para o cliente ver o resultado antes.
function GaleriaLayouts({ marca, fotos }) {
  const foto = fotos[0];
  return (
    <div className="galeria-layouts">
      {Object.keys(TEMPLATES).map((t, i) => (
        <figure key={t}>
          <PostCanvas
            post={{
              formato: 'feed',
              design: { template: t, ...EXEMPLOS[t], paleta: ['marca', 'clara', 'destaque'][i % 3], zonaTexto: foto?.analise?.zonaTexto || 'base', focal: foto?.analise?.focal, seed: 40 + i, fotoId: ['aviso', 'citacao'].includes(t) ? null : foto?.id }
            }}
            marca={marca}
            fotos={fotos}
            escala={0.3}
          />
          <figcaption>{TEMPLATES[t]}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function AbaMarca() {
  const backend = useBackend();
  const { marca, fotos } = useStore();
  const [m, setM] = useState(marca);
  const [salvando, setSalvando] = useState(false);
  const mudaEm = (k, patch) => setM((x) => ({ ...x, [k]: { ...x[k], ...patch } }));

  async function salvar() {
    setSalvando(true);
    await backend.salvarMarca(m);
    setSalvando(false);
    toast('Marca atualizada. As próximas artes já saem assim.', { tipo: 'ok', agente: 'traco' });
  }

  return (
    <div className="ajustes-form">
      <div className="grade-2">
        <Campo rotulo="Nome da marca" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} />
        <Campo rotulo="@ no Instagram" value={m.usuario || ''} onChange={(e) => setM({ ...m, usuario: e.target.value.replace(/^@/, '') })} />
      </div>
      <div className="grade-2">
        <Campo rotulo="Ramo de atuação" value={m.nicho} onChange={(e) => setM({ ...m, nicho: e.target.value })} />
        <Campo rotulo="Cidade" value={m.cidade || ''} onChange={(e) => setM({ ...m, cidade: e.target.value })} />
      </div>
      <Campo rotulo="O que vocês fazem, em uma frase">
        <textarea className="caixa" rows={2} value={m.descricao || ''} onChange={(e) => setM({ ...m, descricao: e.target.value })} />
      </Campo>
      <div className="cores">
        {[
          ['primaria', 'Principal'],
          ['destaque', 'Destaque'],
          ['clara', 'Fundo claro'],
          ['escura', 'Texto escuro']
        ].map(([k, r]) => (
          <label key={k} className="cor">
            <input type="color" value={m.cores[k]} onChange={(e) => mudaEm('cores', { [k]: e.target.value })} />
            <span className="cor-amostra" style={{ background: m.cores[k] }} />
            <span>
              <strong>{r}</strong>
              <small>{m.cores[k]}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="campo">
        <span>Estilo das letras</span>
        <div className="chips">
          {Object.entries(PARES).map(([id, p]) => (
            <button key={id} className="chip" aria-pressed={m.fontes === id} onClick={() => setM({ ...m, fontes: id })} style={{ fontFamily: `"${p.titulo.familia}"` }}>
              {p.nome}
            </button>
          ))}
        </div>
      </div>
      <div className="campo">
        <span>Tom de voz</span>
        <div className="regua">
          <small>Formal</small>
          <input type="range" min="0" max="100" value={m.voz.tom} onChange={(e) => mudaEm('voz', { tom: +e.target.value })} aria-label="Tom de voz" />
          <small>Descontraído</small>
        </div>
      </div>
      <div className="grade-2">
        <Campo rotulo="Posts no feed por semana" type="number" min="1" max="7" value={m.ritmo.feed} onChange={(e) => mudaEm('ritmo', { feed: Math.max(1, Math.min(7, +e.target.value)) })} />
        <Campo rotulo="Stories por semana" type="number" min="0" max="14" value={m.ritmo.stories} onChange={(e) => mudaEm('ritmo', { stories: Math.max(0, Math.min(14, +e.target.value)) })} />
      </div>
      <Campo rotulo="Palavras que a marca nunca usa" value={m.voz.evitar || ''} onChange={(e) => mudaEm('voz', { evitar: e.target.value })} />
      <button className="btn btn-papel btn-grande" onClick={salvar} disabled={salvando}>
        {salvando ? <Loader2 className="gira" /> : <Check />} Salvar marca
      </button>
      <h3>Como o Traço usa a sua marca</h3>
      <p className="fraco">Exemplos com {fotos.length ? 'a sua primeira foto do acervo' : 'texto, envie fotos no Acervo para ver com imagem'}. Os textos aqui são só ilustração.</p>
      <GaleriaLayouts marca={m} fotos={fotos} />
    </div>
  );
}

function AbaRedes() {
  const backend = useBackend();
  const { conexoes, modo } = useStore();
  const [conectando, setConectando] = useState(false);
  async function conectar() {
    setConectando(true);
    try {
      await backend.conectarMeta();
      toast('Conectado', { tipo: 'ok', agente: 'disparo' });
    } catch (e) {
      toast(mensagemDeErro(e), { tipo: 'erro' });
    } finally {
      setConectando(false);
    }
  }
  return (
    <div className="ajustes-form">
      <p className="sub">A conexão é feita pela Meta com as permissões mínimas para ler métricas e publicar. O Pulso nunca vê a sua senha.</p>
      <div className="redes">
        {[
          ['instagram', 'Instagram', IconeInstagram],
          ['facebook', 'Facebook', IconeFacebook]
        ].map(([id, nome, Icone]) => {
          const c = conexoes[id];
          return (
            <div key={id} className="rede" data-conectado={!!c}>
              <span className={`rede-icone rede-${id}`}>
                <Icone />
              </span>
              <span className="rede-info">
                <strong>{nome}</strong>
                <small>{c ? `${id === 'instagram' ? '@' + c.usuario : c.nome}, conectado ${haQuanto(c.conectadoEm)}${c.demo ? ' (simulação)' : ''}` : 'Não conectado'}</small>
              </span>
              {c && (
                <button className="btn btn-fantasma" onClick={() => backend.desconectar(id)}>
                  <Unplug /> Desconectar
                </button>
              )}
            </div>
          );
        })}
      </div>
      {(!conexoes.instagram || !conexoes.facebook) && (
        <button className="btn btn-papel btn-grande" onClick={conectar} disabled={conectando}>
          {conectando ? <Loader2 className="gira" /> : <ShieldCheck />} Conectar com a Meta
        </button>
      )}
      {modo === 'demo' && <p className="fraco">No modo demonstração a conexão é simulada e nada é publicado.</p>}
    </div>
  );
}

function AbaConta() {
  const backend = useBackend();
  const { usuario, modo } = useStore();
  const ir = useNavigate();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function trocar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await backend.trocarSenha(atual, nova);
      setAtual('');
      setNova('');
      toast('Senha trocada', { tipo: 'ok' });
    } catch (err) {
      toast(mensagemDeErro(err), { tipo: 'erro' });
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="ajustes-form">
      <p>
        <strong>{usuario.nome}</strong>
        <br />
        <span className="fraco">{usuario.email}</span>
      </p>
      <form className="ajustes-form" onSubmit={trocar}>
        <h3>Trocar senha</h3>
        <CampoSenha rotulo="Senha atual" valor={atual} mudar={setAtual} />
        <CampoSenha rotulo="Senha nova" valor={nova} mudar={setNova} medidor autoComplete="new-password" />
        <button className="btn btn-fantasma" disabled={salvando || !atual || forcaSenha(nova) < 2}>
          {salvando && <Loader2 className="gira" />} Salvar senha nova
        </button>
      </form>
      <button
        className="btn btn-fantasma btn-grande"
        onClick={async () => {
          await backend.sair();
          ir('/entrar');
        }}
      >
        <LogOut /> Sair da conta
      </button>
      {modo === 'demo' && <p className="fraco">Modo demonstração: os dados ficam guardados só neste navegador.</p>}
    </div>
  );
}

export default function Ajustes() {
  const [aba, setAba] = useState('marca');
  return (
    <div className="pagina ajustes">
      <header className="pagina-topo">
        <div>
          <h1>Ajustes</h1>
          <p className="sub">Marca, conexões e conta.</p>
        </div>
      </header>
      <div className="chips" role="tablist" aria-label="Seções">
        {ABAS.map(([id, r]) => (
          <button key={id} role="tab" aria-selected={aba === id} className="chip" aria-pressed={aba === id} onClick={() => setAba(id)}>
            {r}
          </button>
        ))}
      </div>
      <section className="painel-bloco" role="tabpanel">
        {aba === 'marca' && <AbaMarca />}
        {aba === 'redes' && <AbaRedes />}
        {aba === 'conta' && <AbaConta />}
      </section>
    </div>
  );
}
