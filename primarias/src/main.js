import './styles/main.css';
import { el, mount } from '../../src/utils/dom.js';
import { CREDITO } from '../../src/components/ui.js';
import { perfilAtual, entrarComo, sair, PERFIS_DEMO, ehCampo } from './lib/sessao.js';
import { PAPEIS, FORNOS, contratoAtivo } from './data/obra.js';
import { calcular } from './lib/calculo.js';
import { estadoAtual, restaurarDemo } from './lib/store.js';
import { simulando, alternarSimulacao } from './lib/simulacao.js';
import { abrirFolha } from './components/base.js';
import { cel } from './components/base.js';
import { ic } from './lib/icones.js';
import { toast } from '../../src/lib/toast.js';

const app = document.getElementById('app');
let desmontar = null;
let visao = null; // gestor pode olhar o app de campo e voltar

function iniciar() {
  desmontar?.();
  desmontar = null;
  const perfil = perfilAtual();
  if (!perfil) return entrada();
  const campo = visao ? visao === 'campo' : ehCampo(perfil);
  const carregar = campo ? import('./pages/campo/CampoApp.js').then((m) => m.montarCampo) : import('./pages/painel/PainelApp.js').then((m) => m.montarPainel);
  carregar.then((montar) => {
    desmontar = montar(app, { perfil, menuDemo, trocarVisao: ehCampo(perfil) ? null : (v) => { visao = v; location.hash = ''; iniciar(); } });
  });
}

/** Tela de entrada da demonstração: a bateria B acende e a pessoa escolhe o papel. */
function entrada() {
  const calc = calcular(estadoAtual());
  const bat = contratoAtivo().bateria;
  const fornos = FORNOS.filter((f) => f.bateria === bat);
  const faixa = el('div', { class: 'entrada-bateria', 'aria-hidden': 'true' }, fornos.map((f, i) => {
    const c = cel(calc.fornos[f.id].concluidoEm ? 5 : calc.fornos[f.id].minimo);
    c.style.animation = `fade-in 380ms ${i * 9}ms both var(--ease-out)`;
    return c;
  }));
  const concluidos = fornos.filter((f) => calc.fornos[f.id].concluidoEm).length;
  mount(app, [
    el('div', { class: 'entrada' }, [
      el('div', { class: 'entrada-caixa' }, [
        el('div', { class: 'entrada-topo' }, [
          el('div', { class: 'marca marca-lg' }, 'Primárias'),
          el('div', { class: 'marca-tag' }, `REFRAMAX · Substituição das válvulas primárias · Bateria ${bat}`),
          faixa,
          el('p', {}, `${concluidos} dos ${fornos.length} fornos da bateria ${bat} concluídos. Cada lançamento acende o mapa na hora, para o campo e para o painel.`)
        ]),
        el('div', { class: 'pilha' }, [
          el('div', { class: 'titulo-secao' }, 'Entrar como'),
          el('div', { class: 'perfis' }, PERFIS_DEMO.map((p) => el('button', { type: 'button', class: 'perfil-op', onclick: () => { entrarComo(p.uid); visao = null; iniciar(); } }, [
            el('em', {}, PAPEIS[p.papel].campo ? 'App de campo' : PAPEIS[p.papel].somenteLeitura ? 'Painel, só leitura' : 'Painel'),
            el('strong', {}, p.nome),
            el('span', {}, p.desc)
          ])))
        ]),
        el('p', { class: 'aviso-demo' }, 'Demonstração da etapa 1 (telas). Os dados partem das planilhas de controle e ficam só neste navegador; abra o campo numa aba e o painel em outra para ver o tempo real. Na etapa 2 entra o login por matrícula do Tempos & Métodos e o banco de dados online.'),
        el('div', { class: 'credito' }, CREDITO)
      ])
    ])
  ]);
}

/** Menu da pílula "Demonstração": trocar de papel, simular equipe, restaurar. */
function menuDemo() {
  const desenhar = () => [
    el('div', { class: 'menu-list' }, [
      el('button', { class: 'menu-item', type: 'button', onclick: () => { folha.fechar(); sair(); visao = null; iniciar(); } }, [
        el('span', { html: ic.users(20) }),
        el('div', {}, [el('strong', {}, 'Trocar de papel'), el('small', {}, `Agora: ${perfilAtual()?.nome}. Volte à tela de entrada e escolha outro.`)])
      ]),
      el('button', { class: 'menu-item', type: 'button', onclick: () => { alternarSimulacao(!simulando()); folha.montar({ corpo: desenhar() }); toast(simulando() ? 'Equipe virtual lançando a cada poucos segundos nesta aba.' : 'Simulação desligada.', 'info'); } }, [
        el('span', { html: ic.bolt(20) }),
        el('div', {}, [el('strong', {}, simulando() ? 'Parar a equipe virtual' : 'Simular a equipe em campo'), el('small', {}, 'Líderes virtuais lançam etapas de verdade na bateria, para ver o painel mudar sozinho.')])
      ]),
      el('button', { class: 'menu-item danger', type: 'button', onclick: () => {
        if (!confirm('Apagar tudo o que foi lançado na demonstração e voltar ao estado das planilhas?')) return;
        restaurarDemo();
        folha.fechar();
        toast('Dados da demonstração restaurados.', 'ok');
      } }, [
        el('span', { html: ic.sync(20) }),
        el('div', {}, [el('strong', {}, 'Restaurar os dados'), el('small', {}, 'Volta ao estado das planilhas de controle.')])
      ])
    ])
  ];
  const folha = abrirFolha({ titulo: 'Demonstração', subtitulo: 'Etapa 1: telas, com dados das planilhas', corpo: desenhar() });
}

window.addEventListener('prim:sair', () => {
  sair();
  visao = null;
  iniciar();
});

iniciar();
