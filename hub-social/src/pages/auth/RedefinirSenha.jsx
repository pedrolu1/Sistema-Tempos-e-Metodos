import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Loader2, KeyRound } from 'lucide-react';
import AuthLayout from './AuthLayout.jsx';
import { CampoSenha } from '../../components/Campos.jsx';
import { useBackend } from '../../lib/store.jsx';
import { mensagemDeErro, forcaSenha } from '../../lib/erros.js';
import { toast } from '../../lib/toast.js';

export default function RedefinirSenha() {
  const backend = useBackend();
  const ir = useNavigate();
  const [params] = useSearchParams();
  const codigo = params.get('oobCode') || '';
  const [email, setEmail] = useState(null);
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    backend
      .verificarCodigoRecuperacao(codigo)
      .then(setEmail)
      .catch((e) => setErro(mensagemDeErro(e)));
  }, [backend, codigo]);

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setErro('');
    try {
      await backend.redefinirSenha(codigo, senha);
      toast('Senha nova salva. Agora é só entrar.', { tipo: 'ok' });
      ir('/entrar');
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Criar senha nova</h1>
      {email && (
        <p className="sub">
          Para a conta <strong>{email}</strong>.
        </p>
      )}
      {erro && !email ? (
        <div className="auth-campos">
          <p className="erro-caixa" role="alert">
            {erro}
          </p>
          <Link to="/esqueci-senha" className="btn btn-papel btn-grande btn-bloco">
            Pedir um link novo
          </Link>
        </div>
      ) : (
        <form className="auth-campos" onSubmit={enviar} noValidate>
          <CampoSenha rotulo="Senha nova" valor={senha} mudar={setSenha} medidor autoComplete="new-password" placeholder="Mínimo 8 caracteres" autoFocus />
          {erro && (
            <p className="erro-caixa" role="alert">
              {erro}
            </p>
          )}
          <button className="btn btn-papel btn-grande btn-bloco" disabled={enviando || !email || forcaSenha(senha) < 2}>
            {enviando ? <Loader2 className="gira" /> : <KeyRound />}
            Salvar senha nova
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
