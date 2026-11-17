// Usuários (só administrador): libera quem pediu acesso, define o papel de
// cada um (líder, planejador, administrador ou gestor), gera senha provisória
// e bloqueia. A conta é a mesma do Tempos & Métodos (matrícula + senha).
import { el } from '../../../../src/utils/dom.js';
import { initials } from '../../../../src/utils/format.js';
import { abrirFolha, statusChip } from '../../components/base.js';
import { ic } from '../../lib/icones.js';
import { PAPEIS } from '../../data/obra.js';
import { atualizarUsuario, removerAcesso, redefinirSenha, modoDemo } from '../../lib/acesso.js';
import { toast } from '../../../../src/lib/toast.js';

const ERROS_SENHA = {
  'sem-permissao': 'Sem permissão para trocar a senha desta pessoa (administrador ou planejador do Tempos & Métodos só pelo T&M).',
  'nao-configurado': 'A troca de senha ainda não está ligada no servidor (falta a chave do Firebase na Netlify).',
  principal: 'A senha do administrador principal não pode ser trocada por aqui.',
  'propria-conta': 'Para a sua senha, use "Trocar minha senha".',
  rede: 'Sem conexão. Tente de novo com internet.'
};

export function paginaUsuarios({ usuarios, perfil }) {
  const ordenar = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
  const pedidos = usuarios.filter((u) => u.status === 'pendente').sort(ordenar);
  const ativos = usuarios.filter((u) => u.status === 'aprovado').sort((a, b) => (Object.keys(PAPEIS).indexOf(a.papel) - Object.keys(PAPEIS).indexOf(b.papel)) || ordenar(a, b));
  const bloqueados = usuarios.filter((u) => u.status === 'negado').sort(ordenar);
  const escolhas = {};

  const seletorPapel = (u, aoMudar) => el('select', { class: 'select input-compact', style: { height: '36px', minWidth: '150px' }, 'aria-label': `Papel de ${u.nome}`, onchange: (ev) => aoMudar(ev.target.value) },
    Object.entries(PAPEIS).map(([id, p]) => el('option', { value: id, selected: (u.papel || 'lider') === id }, p.nome)));

  const pessoa = (u) => el('div', { class: 'usuario-pessoa' }, [
    el('span', { class: 'avatar' }, initials(u.nome || '?')),
    el('div', {}, [el('strong', {}, u.nome || 'Sem nome'), el('small', {}, `Matrícula ${u.matricula || '?'}${u.uid === perfil.uid ? ' · você' : ''}`)])
  ]);

  const mudar = async (u, mudancas, msg) => {
    try {
      await atualizarUsuario(u.uid, mudancas);
      toast(msg, 'ok');
    } catch {
      toast('Não consegui salvar. Confira a internet.', 'error');
    }
  };

  const senha = async (u) => {
    if (modoDemo) return toast('Na demonstração não há senha.', 'info');
    if (!confirm(`Gerar uma senha provisória para ${u.nome}? A senha atual dele deixa de valer (aqui e no Tempos & Métodos).`)) return;
    try {
      const nova = await redefinirSenha(u.uid);
      abrirFolha({
        titulo: 'Senha provisória',
        subtitulo: `${u.nome} · matrícula ${u.matricula}`,
        corpo: [
          el('div', { class: 'senha-provisoria' }, nova),
          el('p', { class: 'fraco', style: { fontSize: '13.5px' } }, 'Passe para a pessoa. Na próxima entrada ela cria a senha dela. Esta senha não aparece de novo.')
        ],
        pe: [el('button', { class: 'btn btn-primary', type: 'button', style: { flex: 1 }, onclick: () => navigator.clipboard?.writeText(nova).then(() => toast('Senha copiada.', 'ok')) }, 'Copiar senha')]
      });
    } catch (err) {
      toast(ERROS_SENHA[err?.code] || 'Não consegui gerar a senha. Tente de novo.', 'error', 7000);
    }
  };

  return [
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Pedidos de acesso'), el('p', {}, 'Quem entrou com a matrícula e pediu para usar o Primárias. Escolha o papel e libere.')]), el('span', { class: 'num', style: { fontSize: '24px' } }, String(pedidos.length))]),
      pedidos.length
        ? el('div', { class: 'pilha', style: { gap: '8px' } }, pedidos.map((u) => {
            escolhas[u.uid] = u.papel || 'lider';
            return el('div', { class: 'usuario-linha' }, [
              pessoa(u),
              seletorPapel(u, (v) => { escolhas[u.uid] = v; }),
              el('div', { class: 'toolbar' }, [
                el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => mudar(u, { status: 'negado' }, `${u.nome} não terá acesso.`) }, 'Negar'),
                el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => mudar(u, { status: 'aprovado', papel: escolhas[u.uid] }, `${u.nome} liberado como ${PAPEIS[escolhas[u.uid]].nome.toLowerCase()}.`) }, [el('span', { html: ic.check(15), style: { display: 'inline-flex' } }), 'Liberar'])
              ])
            ]);
          }))
        : el('div', { class: 'vazio-convite' }, [el('strong', {}, 'Nenhum pedido'), 'Quem criar a conta ou pedir acesso pelo app aparece aqui.'])
    ]),
    el('section', { class: 'cartao' }, [
      el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Com acesso'), el('p', {}, 'Troque o papel na lista; vale na hora.')]), el('span', { class: 'num', style: { fontSize: '24px' } }, String(ativos.length))]),
      el('div', { class: 'papeis-legenda' }, Object.values(PAPEIS).map((p) => el('span', {}, [el('b', {}, p.nome), ` ${p.desc.toLowerCase()}`]))),
      el('div', { class: 'pilha', style: { gap: '8px' } }, ativos.map((u) => {
        const eu = u.uid === perfil.uid;
        return el('div', { class: 'usuario-linha' }, [
          pessoa(u),
          eu ? statusChip('aprovado', PAPEIS[u.papel]?.nome || u.papel) : seletorPapel(u, (v) => mudar(u, { papel: v }, `${u.nome} agora é ${PAPEIS[v].nome.toLowerCase()}.`)),
          eu
            ? el('span', { class: 'fraco', style: { fontSize: '12.5px' } }, 'seu acesso')
            : el('div', { class: 'toolbar' }, [
                el('button', { class: 'btn btn-ghost btn-sm', type: 'button', title: 'Gerar senha provisória', onclick: () => senha(u) }, [el('span', { html: ic.key(15), style: { display: 'inline-flex' } }), 'Senha']),
                el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => confirm(`Bloquear o acesso de ${u.nome} ao Primárias?`) && mudar(u, { status: 'negado' }, `${u.nome} bloqueado.`) }, 'Bloquear')
              ])
        ]);
      }))
    ]),
    bloqueados.length
      ? el('section', { class: 'cartao' }, [
          el('div', { class: 'cartao-topo' }, [el('div', {}, [el('h3', {}, 'Bloqueados'), el('p', {}, 'Não entram no Primárias. Liberar de novo ou apagar o cadastro (a pessoa pode pedir acesso outra vez).')])]),
          el('div', { class: 'pilha', style: { gap: '8px' } }, bloqueados.map((u) => el('div', { class: 'usuario-linha' }, [
            pessoa(u),
            statusChip('devolvido', 'Bloqueado'),
            el('div', { class: 'toolbar' }, [
              el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => confirm(`Apagar o cadastro de ${u.nome} no Primárias?`) && removerAcesso(u.uid).then(() => toast('Cadastro apagado.', 'ok'), () => toast('Não consegui apagar.', 'error')) }, 'Apagar'),
              el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => mudar(u, { status: 'aprovado' }, `${u.nome} liberado de novo.`) }, 'Liberar')
            ])
          ])))
        ])
      : null
  ];
}
