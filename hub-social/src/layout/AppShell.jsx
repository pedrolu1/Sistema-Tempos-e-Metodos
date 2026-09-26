import { NavLink, Outlet, useLocation, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Stamp, Sparkles, CalendarDays, Images, Settings } from 'lucide-react';
import { Logo } from '../components/Marca.jsx';
import AgenteAvatar from '../components/AgenteAvatar.jsx';
import { useStore } from '../lib/store.jsx';
import { AGENTES, STATUS_AGENTE } from '../lib/agents.js';

const NAV = [
  { para: '/', rotulo: 'Painel', Icone: LayoutDashboard, fim: true },
  { para: '/mesa', rotulo: 'Mesa', Icone: Stamp, contador: true },
  { para: '/estudio', rotulo: 'Estúdio', Icone: Sparkles, vivo: true },
  { para: '/agenda', rotulo: 'Agenda', Icone: CalendarDays },
  { para: '/acervo', rotulo: 'Acervo', Icone: Images }
];

function Itens({ pendentes, trabalhando, compacto }) {
  return NAV.map(({ para, rotulo, Icone, fim, contador, vivo }) => (
    <NavLink key={para} to={para} end={fim} className="nav-item">
      <span className="nav-icone">
        <Icone />
        {compacto && contador && pendentes > 0 && (
          <motion.span key={pendentes} className="nav-contador num" initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }}>
            {pendentes}
          </motion.span>
        )}
        {vivo && trabalhando > 0 && <span className="nav-vivo" aria-label={`${trabalhando} agentes trabalhando`} />}
      </span>
      <span className={compacto ? 'nav-rotulo-compacto' : 'nav-rotulo'}>{rotulo}</span>
      {!compacto && contador && pendentes > 0 && <span className="nav-pilula num">{pendentes}</span>}
    </NavLink>
  ));
}

export default function AppShell() {
  const { posts, agentes, usuario, marca, modo } = useStore();
  const local = useLocation();
  const pendentes = posts.filter((p) => p.status === 'aguardando').length;
  const trabalhando = Object.values(agentes).filter((a) => a.status === 'trabalhando').length;
  const inicial = (marca?.nome || usuario?.nome || '?')[0].toUpperCase();

  return (
    <div className="app">
      <aside className="lateral">
        <Link to="/" className="lateral-logo" aria-label="Pulso, ir para o Painel">
          <Logo tamanho={28} />
        </Link>
        <nav className="lateral-nav" aria-label="Principal">
          <Itens pendentes={pendentes} trabalhando={trabalhando} />
        </nav>
        <div className="lateral-equipe">
          <p className="lateral-titulo">Equipe agora</p>
          <ul>
            {AGENTES.map((a) => {
              const s = agentes[a.id]?.status || 'ocioso';
              return (
                <li key={a.id}>
                  <Link to="/estudio" className="equipe-item">
                    <AgenteAvatar id={a.id} status={s} tamanho={28} />
                    <span>
                      <strong>{a.nome}</strong>
                      <small data-status={s}>{STATUS_AGENTE[s]}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="lateral-rodape">
          <NavLink to="/ajustes" className="nav-item">
            <span className="nav-icone">
              <Settings />
            </span>
            <span className="nav-rotulo">Ajustes</span>
          </NavLink>
          <div className="conta-chip">
            <span className="conta-inicial" style={{ background: marca?.cores?.primaria }}>
              {marca?.logo ? <img src={marca.logo} alt="" /> : inicial}
            </span>
            <span>
              <strong>{marca?.nome || usuario?.nome}</strong>
              <small>{modo === 'demo' ? 'Modo demonstração' : usuario?.email}</small>
            </span>
          </div>
        </div>
      </aside>

      <header className="topo-movel">
        <Link to="/" aria-label="Pulso, ir para o Painel">
          <Logo tamanho={24} />
        </Link>
        <div className="topo-movel-dir">
          {modo === 'demo' && <span className="selo">Demonstração</span>}
          <Link to="/ajustes" className="btn btn-fantasma btn-icone" aria-label="Ajustes">
            <Settings />
          </Link>
        </div>
      </header>

      <main className="conteudo" id="conteudo">
        <AnimatePresence mode="wait">
          <motion.div key={local.pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="abas-movel" aria-label="Principal">
        <Itens pendentes={pendentes} trabalhando={trabalhando} compacto />
      </nav>
    </div>
  );
}
