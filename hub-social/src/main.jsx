import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree';
import '@fontsource-variable/anybody/wdth.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/auth.css';
import './styles/onboarding.css';
import './styles/telas.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
