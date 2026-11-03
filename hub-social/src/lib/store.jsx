import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';

const env = import.meta.env;

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

// Sem Firebase configurado, o app roda inteiro no navegador com dados de exemplo.
export const MODO = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId ? 'real' : 'demo';

export const ESTADO_INICIAL = {
  pronto: false,
  modo: MODO,
  usuario: null,
  perfil: null,
  marca: null,
  conexoes: { instagram: null, facebook: null },
  fotos: [],
  posts: [],
  agentes: {},
  atividade: [],
  tendencias: null,
  insights: null
};

// Base comum dos dois backends (demo e Firebase): um estado imutável + assinantes.
export class Backend {
  constructor() {
    this.estado = { ...ESTADO_INICIAL };
    this.ouvintes = new Set();
  }

  getState = () => this.estado;

  subscribe = (fn) => {
    this.ouvintes.add(fn);
    return () => this.ouvintes.delete(fn);
  };

  set(patch) {
    const novo = typeof patch === 'function' ? patch(this.estado) : patch;
    this.estado = { ...this.estado, ...novo };
    this.ouvintes.forEach((f) => f());
  }
}

const Ctx = createContext(null);

async function criarBackend() {
  if (MODO === 'real') {
    const { FirebaseBackend } = await import('./firebase/backend.js');
    return new FirebaseBackend(FIREBASE_CONFIG);
  }
  const { DemoBackend } = await import('./demo/backend.js');
  return new DemoBackend();
}

let unico = null;
let promessa = null;

export function StoreProvider({ children }) {
  const [backend, setBackend] = useState(unico);
  useEffect(() => {
    let vivo = true;
    promessa ||= criarBackend().then((b) => {
      unico = b;
      b.iniciar();
      return b;
    });
    promessa.then((b) => vivo && setBackend(b));
    return () => {
      vivo = false;
    };
  }, []);
  if (!backend) return <TelaCarregando />;
  return <Ctx.Provider value={backend}>{children}</Ctx.Provider>;
}

export function useBackend() {
  return useContext(Ctx);
}

export function useStore() {
  const b = useContext(Ctx);
  return useSyncExternalStore(b.subscribe, b.getState);
}

export function TelaCarregando() {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <svg viewBox="0 0 48 34" width="96" height="68" className="simbolo carregando-gotas" aria-hidden="true">
        <circle cx="13" cy="20" r="10" fill="var(--radar)" />
        <circle cx="24" cy="12" r="10" fill="var(--traco)" />
        <circle cx="35" cy="21" r="10" fill="var(--verbo)" />
      </svg>
      <span className="sr-only">Carregando</span>
    </div>
  );
}
