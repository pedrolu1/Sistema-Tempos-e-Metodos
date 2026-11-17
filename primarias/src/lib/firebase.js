// Mesmo projeto Firebase do Tempos & Métodos: mesmas contas (login por
// matrícula) e o mesmo banco. As coleções do Primárias começam com "prim_".
// O cache local é ilimitado porque o líder pode juntar fotos sem internet:
// tudo fica guardado no aparelho e sobe sozinho quando a rede volta.
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Sem as chaves do Firebase (desenvolvimento local), o app roda no modo
// demonstração, com os dados guardados só no navegador.
export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app;
let auth;
let db;
if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (appCheckKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true });
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED })
  });
}

export { app, auth, db };
