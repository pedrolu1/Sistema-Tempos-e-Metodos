import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stamp } from 'lucide-react';
import { Logo } from '../../components/Marca.jsx';
import AgenteAvatar from '../../components/AgenteAvatar.jsx';
import { useStore } from '../../lib/store.jsx';

// A volta completa de um post, do tema em alta até a publicação.
const ETAPAS = [
  { quem: 'radar', texto: 'Radar achou um tema em alta no seu nicho' },
  { quem: 'compasso', texto: 'Compasso marcou quinta às 19h, pico do seu público' },
  { quem: 'traco', texto: 'Traço montou a arte com a sua foto' },
  { quem: 'verbo', texto: 'Verbo escreveu a legenda e a chamada' },
  { quem: 'voce', texto: 'Você bateu o olho e aprovou' },
  { quem: 'disparo', texto: 'Disparo publicou no Instagram e no Facebook' }
];

function Mural() {
  const [passo, setPasso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPasso((p) => (p + 1) % ETAPAS.length), 2100);
    return () => clearInterval(t);
  }, []);
  const n = ETAPAS.length;
  const pos = (i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(a) * 150, y: Math.sin(a) * 150 };
  };
  const atual = pos(passo);
  return (
    <div className="mural" aria-hidden="true">
      <div className="mural-roda">
        <svg className="mural-trilha" viewBox="-180 -180 360 360">
          <circle r="150" />
        </svg>
        {ETAPAS.map((e, i) => {
          const p = pos(i);
          return (
            <div key={e.quem} className="mural-no" style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
              {e.quem === 'voce' ? (
                <span className={`mural-voce ${passo === i ? 'ativo' : ''}`}>
                  <Stamp />
                </span>
              ) : (
                <AgenteAvatar id={e.quem} status={passo === i ? 'trabalhando' : 'ocioso'} tamanho={56} />
              )}
            </div>
          );
        })}
        <motion.div className="mural-post" animate={{ x: atual.x * 0.3, y: atual.y * 0.3, rotate: passo * 3 - 6 }} transition={{ type: 'spring', stiffness: 90, damping: 16 }}>
          <span className="mural-post-foto" />
          <span className="mural-post-linha" />
          <span className="mural-post-linha curta" />
          <AnimatePresence>
            {passo >= 4 && (
              <motion.span className="mural-carimbo" initial={{ scale: 2.4, opacity: 0, rotate: -24 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                ok
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={passo} className="mural-legenda" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          {ETAPAS[passo].texto}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export default function AuthLayout({ children }) {
  const { modo } = useStore();
  return (
    <div className="auth">
      <main className="auth-form">
        <div className="auth-topo">
          <Logo tamanho={30} animado />
        </div>
        <div className="auth-conteudo">{children}</div>
        {modo === 'demo' && (
          <p className="auth-demo">
            Modo demonstração: sua conta e seus dados ficam só neste navegador. Nada é publicado de verdade.
          </p>
        )}
      </main>
      <aside className="auth-arte">
        <div className="auth-arte-texto">
          <h2 className="display">Uma agência inteira trabalhando no seu Instagram e Facebook.</h2>
          <p>Seis agentes pesquisam, planejam, criam e publicam. Nada vai ao ar sem o seu ok.</p>
        </div>
        <Mural />
      </aside>
    </div>
  );
}
