import { useId, useState } from 'react';
import { Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { forcaSenha, ROTULO_FORCA } from '../lib/erros.js';

export function Campo({ rotulo, ajuda, icone: Icone, erro, children, ...props }) {
  const id = useId();
  return (
    <label className="campo" htmlFor={id}>
      <span>{rotulo}</span>
      <div className="entrada">
        {Icone && <Icone aria-hidden="true" />}
        {children || <input id={id} {...props} />}
      </div>
      {ajuda && <small className="ajuda">{ajuda}</small>}
      {erro && (
        <small className="erro-campo">
          <AlertCircle size={15} /> {erro}
        </small>
      )}
    </label>
  );
}

export function CampoSenha({ rotulo = 'Senha', valor, mudar, medidor = false, autoComplete = 'current-password', ...props }) {
  const id = useId();
  const [ver, setVer] = useState(false);
  const forca = forcaSenha(valor);
  return (
    <label className="campo" htmlFor={id}>
      <span>{rotulo}</span>
      <div className="entrada">
        <Lock aria-hidden="true" />
        <input id={id} type={ver ? 'text' : 'password'} value={valor} onChange={(e) => mudar(e.target.value)} autoComplete={autoComplete} {...props} />
        <button type="button" className="olho" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'}>
          {ver ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {medidor && valor && (
        <div className="forca" data-forca={forca} aria-live="polite">
          <span className="forca-barras" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <small>
            {ROTULO_FORCA[forca]}
            {forca < 2 && '. Use 8 caracteres ou mais, com letras e números.'}
          </small>
        </div>
      )}
    </label>
  );
}
