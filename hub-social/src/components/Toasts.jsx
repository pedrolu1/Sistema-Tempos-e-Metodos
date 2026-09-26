import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useToasts, fecharToast } from '../lib/toast.js';
import AgenteAvatar from './AgenteAvatar.jsx';

const ICONES = { ok: CheckCircle2, erro: AlertTriangle, info: Info };

export default function Toasts() {
  const lista = useToasts();
  const ir = useNavigate();
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence initial={false}>
        {lista.map((t) => {
          const Icone = ICONES[t.tipo] || Info;
          return (
            <motion.div
              key={t.id}
              className={`toast toast-${t.tipo}`}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            >
              {t.agente ? <AgenteAvatar id={t.agente} tamanho={30} /> : <Icone className="toast-icone" />}
              <span className="toast-texto">{t.texto}</span>
              {t.acao && (
                <button
                  className="toast-acao"
                  onClick={() => {
                    if (t.acao.para) ir(t.acao.para);
                    t.acao.onClick?.();
                    fecharToast(t.id);
                  }}
                >
                  {t.acao.rotulo}
                </button>
              )}
              <button className="toast-fechar" onClick={() => fecharToast(t.id)} aria-label="Fechar aviso">
                <X />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
