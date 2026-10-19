import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// App Check (opcional): com a chave do reCAPTCHA v3 configurada, o Firebase
// só aceita chamadas vindas deste app publicado — scripts e cópias do site
// não conseguem usar o banco mesmo tendo as credenciais públicas.
const appCheckKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
export const appCheckAtivo = Boolean(firebaseConfigured && appCheckKey);

let app, auth, db;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);
  if (appCheckAtivo) {
    initializeAppCheck(app, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true });
  }

  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  // Cache local persistente: é isso que permite lançar offline e sincronizar
  // automaticamente assim que a conexão voltar, sem nenhuma fila manual.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} else {
  // eslint-disable-next-line no-console
  console.warn(
    '[REFRAMAX] Firebase não configurado. Copie .env.example para .env e preencha as credenciais do seu projeto.'
  );
}

export { app, auth, db };
