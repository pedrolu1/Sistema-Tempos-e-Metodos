import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Mail, Loader2, Sparkles } from 'lucide-react';
import AuthLayout from './AuthLayout.jsx';
import { Campo, CampoSenha } from '../../components/Campos.jsx';
import { IconeGoogle } from '../../components/Marca.jsx';
import { useBackend, useStore } from '../../lib/store.jsx';
import { mensagemDeErro } from '../../lib/erros.js';

export default function Entrar() {
  const backend = useBackend();
  const { modo } = useStore();
  const ir = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await backend.entrar({ email, senha, lembrar });
      ir('/');
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  async function google() {
    setErro('');
    try {
      await backend.entrarComGoogle();
      ir('/');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <AuthLayout>
      <h1>Entrar</h1>
      <p className="sub">Sua equipe de agentes continua de onde parou.</p>
      <form className="auth-campos" onSubmit={enviar} noValidate>
        {modo === 'real' && (
          <>
            <button type="button" className="btn btn-fantasma btn-grande btn-bloco" onClick={google}>
              <IconeGoogle /> Entrar com Google
            </button>
            <div className="ou">
              <span>ou com e-mail</span>
            </div>
          </>
        )}
        <Campo rotulo="E-mail" icone={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@empresa.com" required />
        <CampoSenha valor={senha} mudar={setSenha} required placeholder="Sua senha" />
        <div className="auth-linha">
          <label className="caixa-marcar">
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
            <span>Manter conectado</span>
          </label>
          <Link to="/esqueci-senha" className="link">
            Esqueci a senha
          </Link>
        </div>
        {erro && (
          <p className="erro-caixa" role="alert">
            {erro}
          </p>
        )}
        <button className="btn btn-papel btn-grande btn-bloco" disabled={enviando || !email || !senha}>
          {enviando ? <Loader2 className="gira" /> : null}
          {enviando ? 'Entrando' : 'Entrar'}
        </button>
      </form>
      {modo === 'demo' && (
        <button
          type="button"
          className="btn btn-fantasma btn-grande btn-bloco auth-exemplo"
          disabled={enviando}
          onClick={async () => {
            setEnviando(true);
            try {
              await backend.entrarComExemplo();
              ir('/');
            } catch (err) {
              setErro(mensagemDeErro(err));
            } finally {
              setEnviando(false);
            }
          }}
        >
          <Sparkles /> Ver com dados de exemplo
        </button>
      )}
      <p className="auth-troca">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" className="link">
          Criar conta grátis
        </Link>
      </p>
    </AuthLayout>
  );
}
