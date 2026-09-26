import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Mail, User, Loader2 } from 'lucide-react';
import AuthLayout from './AuthLayout.jsx';
import { Campo, CampoSenha } from '../../components/Campos.jsx';
import { IconeGoogle } from '../../components/Marca.jsx';
import { useBackend, useStore } from '../../lib/store.jsx';
import { mensagemDeErro, forcaSenha } from '../../lib/erros.js';

export default function CriarConta() {
  const backend = useBackend();
  const { modo } = useStore();
  const ir = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const pode = nome.trim().length >= 2 && emailOk && forcaSenha(senha) >= 2;

  async function enviar(e) {
    e.preventDefault();
    if (!pode) return;
    setErro('');
    setEnviando(true);
    try {
      await backend.cadastrar({ nome, email, senha });
      ir('/comecar');
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
      ir('/comecar');
    } catch (err) {
      setErro(mensagemDeErro(err));
    }
  }

  return (
    <AuthLayout>
      <h1>Criar conta</h1>
      <p className="sub">Em cinco minutos seus agentes começam a trabalhar.</p>
      <form className="auth-campos" onSubmit={enviar} noValidate>
        {modo === 'real' && (
          <>
            <button type="button" className="btn btn-fantasma btn-grande btn-bloco" onClick={google}>
              <IconeGoogle /> Continuar com Google
            </button>
            <div className="ou">
              <span>ou com e-mail</span>
            </div>
          </>
        )}
        <Campo rotulo="Seu nome" icone={User} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" placeholder="Como quer ser chamado" required />
        <Campo
          rotulo="E-mail"
          icone={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="voce@empresa.com"
          erro={email && !emailOk ? 'Confira o e-mail, parece faltar alguma parte.' : ''}
          required
        />
        <CampoSenha valor={senha} mudar={setSenha} medidor autoComplete="new-password" placeholder="Mínimo 8 caracteres" required />
        {erro && (
          <p className="erro-caixa" role="alert">
            {erro}{' '}
            {/já existe/i.test(erro) && (
              <Link to="/entrar" className="link">
                Entrar
              </Link>
            )}
          </p>
        )}
        <button className="btn btn-papel btn-grande btn-bloco" disabled={enviando || !pode}>
          {enviando && <Loader2 className="gira" />}
          {enviando ? 'Criando sua conta' : 'Criar conta'}
        </button>
      </form>
      <p className="auth-troca">
        Já tem conta?{' '}
        <Link to="/entrar" className="link">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
