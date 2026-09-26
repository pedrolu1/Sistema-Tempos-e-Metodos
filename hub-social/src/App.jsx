import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { StoreProvider, useStore, TelaCarregando } from './lib/store.jsx';
import Toasts from './components/Toasts.jsx';
import AppShell from './layout/AppShell.jsx';
import Entrar from './pages/auth/Entrar.jsx';
import CriarConta from './pages/auth/CriarConta.jsx';
import EsqueciSenha from './pages/auth/EsqueciSenha.jsx';
import RedefinirSenha from './pages/auth/RedefinirSenha.jsx';

const Onboarding = lazy(() => import('./pages/onboarding/Onboarding.jsx'));
const Painel = lazy(() => import('./pages/Painel.jsx'));
const Mesa = lazy(() => import('./pages/Mesa.jsx'));
const Estudio = lazy(() => import('./pages/Estudio.jsx'));
const Agenda = lazy(() => import('./pages/Agenda.jsx'));
const Acervo = lazy(() => import('./pages/Acervo.jsx'));
const Ajustes = lazy(() => import('./pages/Ajustes.jsx'));

// O e-mail de redefinição do Firebase chega como ?mode=resetPassword&oobCode=...
// Com roteamento por hash, levamos esses parâmetros para a rota certa.
(function redirecionarAcaoDeEmail() {
  const q = new URLSearchParams(window.location.search);
  if (q.get('mode') === 'resetPassword' && q.get('oobCode')) {
    const destino = `${window.location.pathname}#/redefinir-senha?oobCode=${encodeURIComponent(q.get('oobCode'))}`;
    window.history.replaceState(null, '', destino);
  }
})();

function Raiz() {
  const { pronto } = useStore();
  if (!pronto) return <TelaCarregando />;
  return (
    <>
      <Suspense fallback={<TelaCarregando />}>
        <Outlet />
      </Suspense>
      <Toasts />
    </>
  );
}

function SoVisitante() {
  const { usuario, perfil } = useStore();
  if (usuario) return <Navigate to={perfil?.onboarding === 'pronto' ? '/' : '/comecar'} replace />;
  return <Outlet />;
}

function Protegida({ onboarding = false }) {
  const { usuario, perfil } = useStore();
  if (!usuario) return <Navigate to="/entrar" replace />;
  const pronto = perfil?.onboarding === 'pronto';
  if (!onboarding && !pronto) return <Navigate to="/comecar" replace />;
  if (onboarding && pronto) return <Navigate to="/" replace />;
  return <Outlet />;
}

const router = createHashRouter([
  {
    element: <Raiz />,
    children: [
      {
        element: <SoVisitante />,
        children: [
          { path: '/entrar', element: <Entrar /> },
          { path: '/criar-conta', element: <CriarConta /> },
          { path: '/esqueci-senha', element: <EsqueciSenha /> }
        ]
      },
      { path: '/redefinir-senha', element: <RedefinirSenha /> },
      {
        element: <Protegida onboarding />,
        children: [{ path: '/comecar', element: <Onboarding /> }]
      },
      {
        element: <Protegida />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <Painel /> },
              { path: '/mesa', element: <Mesa /> },
              { path: '/estudio', element: <Estudio /> },
              { path: '/agenda', element: <Agenda /> },
              { path: '/acervo', element: <Acervo /> },
              { path: '/ajustes', element: <Ajustes /> }
            ]
          }
        ]
      },
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
]);

export default function App() {
  return (
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  );
}
