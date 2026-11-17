import './styles/main.css';
import { el, mount } from '../../src/utils/dom.js';
import { CREDITO } from '../../src/components/ui.js';
import { toast } from '../../src/lib/toast.js';
import {
  observarAcesso, entrar, cadastrar, solicitarAcesso, sair, criarSenhaPropria, mensagemDeErro, matriculaValida,
  modoDemo, PERFIS_DEMO, entrarDemo
} from './lib/acesso.js';
import { PAPEIS, FORNOS, contratoAtivo } from './data/obra.js';
import { calcular } from './lib/calculo.js';
import { estadoAtual, restaurarDemo } from './lib/banco.js';
import { simulando, alternarSimulacao } from './lib/simulacao.js';
import { abrirFolha, cel } from './components/base.js';
import { ic } from './lib/icones.js';

const app = document.getElementById('app');
let desmontar = null;
let visao = null; // planejador/admin podem abrir o app do líder e voltar
let telaLogin = 'entrar';
let ultimo = null;

function trocarTela(fn) {
  desmontar?.();
  desmontar = null;
  fn();
}

observarAcesso((a) => {
  ultimo = a;
  mostrar(a);
});

function mostrar(a) {
  if (a.estado === 'carregando') return trocarTela(() => mount(app, [el('div', { class: 'boot-splash' }, [el('div', { class: 'boot-mark' }, el('div', { class: 'marca marca-lg' }, 'Primárias')), el('div', { class: 'marca-tag' }, 'Carregando…')])]));
  if (a.estado === 'sem-login') return trocarTela(() => (modoDemo ? entradaDemo() : login()));
  if (a.estado === 'sem-acesso') return trocarTela(() => pedirAcesso(a.sugestao || {}));
  if (a.estado === 'pendente') return trocarTela(() => aviso('Acesso em análise', `Olá, ${a.perfil.nome}. Seu pedido chegou ao administrador. Assim que ele liberar, esta tela abre o app sozinha.`));
  if (a.estado === 'negado') return trocarTela(() => aviso('Acesso não liberado', 'O administrador não liberou seu acesso ao Primárias. Fale com o planejamento.'));
  if (a.estado === 'trocar-senha') return trocarTela(() => novaSenha(a.perfil));
  if (a.estado === 'ok') return abrirApp(a.perfil);
}

function abrirApp(perfil) {
  const campo = visao ? visao === 'campo' : Boolean(PAPEIS[perfil.papel]?.campo);
  const carregar = campo ? import('./pages/campo/CampoApp.js').then((m) => m.montarCampo) : import('./pages/painel/PainelApp.js').then((m) => m.montarPainel);
  carregar.then((montar) => {
    trocarTela(() => {
      desmontar = montar(app, {
        perfil,
        menuDemo: modoDemo ? menuDemo : null,
        trocarVisao: PAPEIS[perfil.papel]?.gestao ? (v) => { visao = v; location.hash = ''; abrirApp(perfil); } : null
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Telas de acesso
// ---------------------------------------------------------------------------
function cabecalho(texto) {
  return el('div', { class: 'acesso-topo' }, [
    el('div', { class: 'marca-reframax' }, 'REFRAMAX'),
    el('div', { class: 'marca marca-lg' }, 'Primárias'),
    texto ? el('p', {}, texto) : null
  ]);
}

function login() {
  const erro = el('div', { class: 'acesso-erro', style: { display: 'none' } });
  const mostrarErro = (t) => {
    erro.textContent = t;
    erro.style.display = t ? 'block' : 'none';
  };
  const cadastro = telaLogin === 'cadastro';
  const nome = el('input', { class: 'input', id: 'ac-nome', autocomplete: 'name', placeholder: 'Nome e sobrenome' });
  const matricula = el('input', { class: 'input', id: 'ac-mat', inputmode: 'numeric', autocomplete: 'username', maxlength: 6, placeholder: '6 números' });
  const senha = el('input', { class: 'input', id: 'ac-senha', type: 'password', autocomplete: cadastro ? 'new-password' : 'current-password', placeholder: cadastro ? 'Pelo menos 6 caracteres' : 'Sua senha' });
  const botao = el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'submit' }, cadastro ? 'Criar conta e pedir acesso' : 'Entrar');
  const enviar = async (ev) => {
    ev.preventDefault();
    mostrarErro('');
    if (!matriculaValida(matricula.value)) return mostrarErro('A matrícula tem 6 números.');
    if (cadastro && nome.value.trim().length < 3) return mostrarErro('Escreva seu nome completo.');
    botao.disabled = true;
    try {
      if (cadastro) await cadastrar({ nome: nome.value, matricula: matricula.value, senha: senha.value });
      else await entrar(matricula.value, senha.value);
    } catch (err) {
      mostrarErro(mensagemDeErro(err));
      botao.disabled = false;
    }
  };
  mount(app, [
    el('div', { class: 'acesso' }, [
      el('div', { class: 'acesso-caixa' }, [
        cabecalho(cadastro ? 'Primeiro acesso: crie sua conta. O administrador libera e define o seu papel.' : 'Lançamento e acompanhamento da substituição das válvulas primárias. Entre com a mesma matrícula e senha do Tempos & Métodos.'),
        el('form', { class: 'acesso-form', onsubmit: enviar }, [
          cadastro ? el('div', { class: 'field' }, [el('label', { class: 'field-label', for: 'ac-nome' }, 'Nome'), nome]) : null,
          el('div', { class: 'field' }, [el('label', { class: 'field-label', for: 'ac-mat' }, 'Matrícula'), matricula]),
          el('div', { class: 'field' }, [el('label', { class: 'field-label', for: 'ac-senha' }, 'Senha'), senha]),
          erro,
          botao
        ]),
        el('div', { class: 'acesso-troca' }, cadastro
          ? ['Já tem conta? ', el('button', { type: 'button', onclick: () => { telaLogin = 'entrar'; login(); } }, 'Entrar')]
          : ['Primeiro acesso? ', el('button', { type: 'button', onclick: () => { telaLogin = 'cadastro'; login(); } }, 'Criar conta')]),
        el('div', { class: 'credito' }, CREDITO)
      ])
    ])
  ]);
  (cadastro ? nome : matricula).focus();
}

function pedirAcesso(sugestao) {
  const nome = el('input', { class: 'input', value: sugestao.nome || '', placeholder: 'Nome e sobrenome' });
  const botao = el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: async () => {
    if (nome.value.trim().length < 3) return toast('Escreva seu nome completo.', 'error');
    botao.disabled = true;
    try {
      await solicitarAcesso({ nome: nome.value, matricula: sugestao.matricula });
    } catch {
      botao.disabled = false;
      toast('Não foi possível enviar o pedido. Confira a internet.', 'error');
    }
  } }, 'Pedir acesso ao Primárias');
  mount(app, [el('div', { class: 'acesso' }, [el('div', { class: 'acesso-caixa' }, [
    cabecalho(),
    el('div', { class: 'acesso-cartao' }, [
      el('h3', {}, 'Falta liberar o Primárias'),
      el('p', {}, `Sua conta (matrícula ${sugestao.matricula || ''}) já existe, mas ainda não tem acesso a este app. Peça abaixo: o administrador libera e define o seu papel.`),
      el('div', { class: 'field', style: { width: '100%' } }, [el('label', { class: 'field-label' }, 'Seu nome'), nome]),
      botao,
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => sair() }, 'Sair')
    ])
  ])])]);
}

function aviso(titulo, texto) {
  mount(app, [el('div', { class: 'acesso' }, [el('div', { class: 'acesso-caixa' }, [
    cabecalho(),
    el('div', { class: 'acesso-cartao' }, [el('h3', {}, titulo), el('p', {}, texto), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => sair() }, 'Sair')])
  ])])]);
}

function novaSenha(perfil) {
  const s1 = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'Pelo menos 6 caracteres' });
  const s2 = el('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'Repita a senha' });
  const botao = el('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: async () => {
    if (s1.value.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'error');
    if (s1.value !== s2.value) return toast('As duas senhas não são iguais.', 'error');
    botao.disabled = true;
    try {
      await criarSenhaPropria(s1.value);
      toast('Senha criada.', 'ok');
    } catch (err) {
      botao.disabled = false;
      toast(mensagemDeErro(err), 'error');
    }
  } }, 'Salvar minha senha');
  mount(app, [el('div', { class: 'acesso' }, [el('div', { class: 'acesso-caixa' }, [
    cabecalho(),
    el('div', { class: 'acesso-cartao' }, [
      el('h3', {}, 'Crie a sua senha'),
      el('p', {}, `${perfil.nome}, sua senha foi redefinida pelo administrador. Crie uma senha só sua para continuar.`),
      el('div', { class: 'field', style: { width: '100%' } }, [el('label', { class: 'field-label' }, 'Senha nova'), s1]),
      el('div', { class: 'field', style: { width: '100%' } }, [el('label', { class: 'field-label' }, 'Repita'), s2]),
      botao
    ])
  ])])]);
}

/** Sem Firebase (desenvolvimento e testes): escolhe o perfil. */
function entradaDemo() {
  const calc = calcular(estadoAtual());
  const bat = contratoAtivo().bateria;
  const fornos = FORNOS.filter((f) => f.bateria === bat);
  mount(app, [el('div', { class: 'entrada' }, [el('div', { class: 'entrada-caixa' }, [
    el('div', { class: 'entrada-topo' }, [
      el('div', { class: 'marca-reframax' }, 'REFRAMAX'),
      el('div', { class: 'marca marca-lg' }, 'Primárias'),
      el('div', { class: 'entrada-bateria', 'aria-hidden': 'true' }, fornos.map((f, i) => {
        const c = cel(calc.fornos[f.id].concluidoEm ? 4 : calc.fornos[f.id].minimo);
        c.style.animation = `fade-in 380ms ${i * 8}ms both var(--ease-out)`;
        return c;
      })),
      el('p', {}, 'Modo de teste, sem banco online: os dados ficam neste navegador. Escolha como entrar.')
    ]),
    el('div', { class: 'perfis' }, PERFIS_DEMO.map((p) => el('button', { type: 'button', class: 'perfil-op', onclick: () => { visao = null; entrarDemo(p.uid); } }, [
      el('em', {}, PAPEIS[p.papel].nome),
      el('strong', {}, p.nome),
      el('span', {}, PAPEIS[p.papel].desc)
    ]))),
    el('div', { class: 'credito' }, CREDITO)
  ])])]);
}

function menuDemo() {
  const desenhar = () => [el('div', { class: 'menu-list' }, [
    el('button', { class: 'menu-item', type: 'button', onclick: () => { folha.fechar(); visao = null; sair(); } }, [el('span', { html: ic.users(20) }), el('div', {}, [el('strong', {}, 'Trocar de perfil'), el('small', {}, 'Volta para a escolha de perfil.')])]),
    el('button', { class: 'menu-item', type: 'button', onclick: () => { alternarSimulacao(!simulando()); folha.montar({ corpo: desenhar() }); } }, [el('span', { html: ic.bolt(20) }), el('div', {}, [el('strong', {}, simulando() ? 'Parar a equipe virtual' : 'Simular a equipe em campo'), el('small', {}, 'Líderes virtuais lançam etapas a cada poucos segundos.')])]),
    el('button', { class: 'menu-item danger', type: 'button', onclick: () => { if (!confirm('Apagar o que foi lançado neste navegador?')) return; restaurarDemo(); folha.fechar(); } }, [el('span', { html: ic.sync(20) }), el('div', {}, [el('strong', {}, 'Restaurar os dados'), el('small', {}, 'Volta ao estado das planilhas.')])])
  ])];
  const folha = abrirFolha({ titulo: 'Modo de teste', subtitulo: 'Sem banco online', corpo: desenhar() });
}

window.addEventListener('prim:sair', () => {
  visao = null;
  sair();
});
// quem está no app do líder e é planejador volta ao painel por aqui
window.addEventListener('prim:visao', (e) => {
  visao = e.detail;
  if (ultimo?.estado === 'ok') abrirApp(ultimo.perfil);
});
