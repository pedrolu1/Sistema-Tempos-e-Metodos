import { AGENTE } from '../lib/agents.js';

// Avatar do agente: uma gota de tinta na cor dele. Quando está trabalhando,
// a gota "respira" e gira devagar; esperando você, pulsa um anel.
export default function AgenteAvatar({ id, status = 'ocioso', tamanho = 44, className = '' }) {
  const a = AGENTE[id];
  if (!a) return null;
  const { Icone } = a;
  return (
    <span
      className={`avatar-agente ${className}`}
      data-status={status}
      style={{ '--cor': a.cor, '--tam': `${tamanho}px` }}
      title={`${a.nome}, ${a.papel}`}
    >
      <svg viewBox="0 0 100 100" className="avatar-gota" aria-hidden="true">
        <path d="M50 6c17 0 32 9 38 25s3 36-9 48-33 17-49 9S5 62 7 44 33 6 50 6Z" />
      </svg>
      <Icone className="avatar-icone" aria-hidden="true" strokeWidth={2.2} />
    </span>
  );
}
