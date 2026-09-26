import { useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { Mail, Loader2, MailCheck, ArrowLeft } from 'lucide-react';
import AuthLayout from './AuthLayout.jsx';
import { Campo } from '../../components/Campos.jsx';
import { useBackend } from '../../lib/store.jsx';
import { mensagemDeErro } from '../../lib/erros.js';

export default function EsqueciSenha() {
  const backend = useBackend();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      setResultado(await backend.enviarRecuperacao(email));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <AuthLayout>
        <motion.div className="auth-enviado" initial={{ scale: 0.6, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
          <MailCheck />
        </motion.div>
        <h1>Confira seu e-mail</h1>
        <p className="sub">
          Se existir uma conta com <strong>{email}</strong>, o link para criar uma senha nova chega em alguns minutos. Vale olhar a caixa de spam também.
        </p>
        {resultado.linkDemo && (
          <div className="auth-campos">
            <p className="fraco">No modo demonstração não enviamos e-mail. Use o link abaixo, que é o mesmo que chegaria na sua caixa.</p>
            <a className="btn btn-papel btn-grande btn-bloco" href={resultado.linkDemo}>
              Abrir o link de redefinição
            </a>
          </div>
        )}
        <p className="auth-troca">
          <Link to="/entrar" className="link">
            Voltar para entrar
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Link to="/entrar" className="voltar">
        <ArrowLeft size={18} /> Voltar
      </Link>
      <h1>Esqueceu a senha?</h1>
      <p className="sub">Acontece. Digite o e-mail da conta e mandamos um link para você criar uma nova.</p>
      <form className="auth-campos" onSubmit={enviar} noValidate>
        <Campo rotulo="E-mail" icone={Mail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@empresa.com" required autoFocus />
        {erro && (
          <p className="erro-caixa" role="alert">
            {erro}
          </p>
        )}
        <button className="btn btn-papel btn-grande btn-bloco" disabled={enviando || !email.includes('@')}>
          {enviando && <Loader2 className="gira" />}
          {enviando ? 'Enviando' : 'Enviar link'}
        </button>
      </form>
    </AuthLayout>
  );
}
