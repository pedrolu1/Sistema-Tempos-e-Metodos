import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
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

let app, auth, db;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig);

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
    '[CRONOS] Firebase não configurado. Copie .env.example para .env e preencha as credenciais do seu projeto.'
  );
}

export { app, auth, db };
