import { useEffect, useRef, useState } from 'react';
import { renderizar, renderizarBlob } from './renderizador.js';
import { carregarImagem } from '../lib/imagem.js';

const cache = new Map();

export function imagemCache(url) {
  if (!url) return Promise.resolve(null);
  if (!cache.has(url)) cache.set(url, carregarImagem(url).catch(() => null));
  return cache.get(url);
}

export async function recursosDoPost(post, marca, fotos) {
  const foto = fotos?.find((f) => f.id === (post.design?.fotoId || post.fotoId));
  const [imgFoto, imgLogo] = await Promise.all([imagemCache(foto?.url), imagemCache(marca?.logo)]);
  return { foto: imgFoto, logo: imgLogo };
}

export async function exportarPost(post, marca, fotos) {
  const { foto, logo } = await recursosDoPost(post, marca, fotos);
  return renderizarBlob({ spec: post.design, marca, foto, logo, formato: post.formato });
}

// Mostra a arte de um post. Redesenha quando o design, a foto ou a marca mudam.
export default function PostCanvas({ post, marca, fotos, escala = 0.5, className = '', rotulo }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);
  const foto = fotos?.find((f) => f.id === (post?.design?.fotoId || post?.fotoId));
  const chave = JSON.stringify([post?.design, post?.formato, foto?.url, marca?.cores, marca?.fontes, marca?.logo, marca?.nome, marca?.usuario]);

  useEffect(() => {
    let vivo = true;
    if (!post?.design || !ref.current) return;
    (async () => {
      const { foto: f, logo } = await recursosDoPost(post, marca, fotos);
      if (!vivo || !ref.current) return;
      await renderizar(ref.current, { spec: post.design, marca, foto: f, logo, formato: post.formato, escala });
      if (vivo) setPronto(true);
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, escala]);

  return (
    <canvas
      ref={ref}
      className={`post-canvas ${pronto ? 'pronto' : ''} ${className}`}
      data-formato={post?.formato}
      role="img"
      aria-label={rotulo || post?.design?.titulo || 'Arte do post'}
    />
  );
}
