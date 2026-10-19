import { el, mount } from '../../utils/dom.js';
import { badge, button, cardWithHeader, emptyState } from '../../components/ui.js';
import { statTile } from '../../components/charts.js';
import { icon } from '../../utils/icons.js';
import { fazerBackup } from '../../lib/backup.js';
import { repararApp, VERSAO } from '../../lib/saude.js';
import { encontrarInconsistencias } from '../../lib/reparo.js';
import { appCheckAtivo } from '../../lib/firebase.js';
import { toast } from '../../lib/toast.js';
import { modal } from '../../components/ui.js';

const SETE_DIAS = 7 * 86400000;
const quando = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const ACOES_RECUPERACAO = {
  'recarregou-versao-nova': 'Recarregou após atualização do app',
  'dados-reparados': 'Dados recalculados automaticamente',
  'reparo-manual': 'Reparo do app acionado pelo usuário'
};

/** Agrupa as falhas iguais (mesma assinatura) para o resumo. */
function agrupar(eventos) {
  const m = new Map();
  eventos.forEach((e) => {
    const k = e.assinatura || e.mensagem;
    if (!m.has(k)) m.set(k, { ...e, vezes: 0, pessoas: new Set(), recuperadas: 0, ultima: 0 });
    const g = m.get(k);
    g.vezes++;
    g.pessoas.add(e.nome || e.uid);
    if (e.recuperado) g.recuperadas++;
    g.ultima = Math.max(g.ultima, e.emLocal || 0);
  });
  return [...m.values()].sort((a, b) => b.ultima - a.ultima);
}

export function renderSistemaPage(ctxInicial) {
  let ctx = ctxInicial;
  let busca = '';
  const node = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' } });
  const isAdmin = ctx.profile.role === 'admin';

  function paint() {
    const recentes = (ctx.saude || []).filter((e) => (e.emLocal || 0) >= Date.now() - SETE_DIAS);
    const erros = recentes.filter((e) => e.tipo === 'erro');
    const recuperacoes = recentes.filter((e) => e.tipo === 'recuperacao');
    const naoRecuperados = erros.filter((e) => !e.recuperado);
    const pendentesReparo = encontrarInconsistencias(ctx.lancamentos || []).length;
    const grupos = agrupar(recentes);

    const saudeCard = cardWithHeader({
      title: 'Saúde do app — últimos 7 dias',
      subtitle: 'Falhas encontradas e o que o app fez sozinho para se recuperar',
      children: [
        el('div', { class: 'grid grid-kpis', style: { marginBottom: '16px' } }, [
          statTile({ label: 'Falhas registradas', value: String(erros.length), iconHtml: icon.alert(16), tone: naoRecuperados.length ? 'danger' : 'ok' }),
          statTile({ label: 'Recuperações automáticas', value: String(recuperacoes.length + erros.length - naoRecuperados.length), iconHtml: icon.sync(16), tone: 'ok' }),
          statTile({ label: 'Lançamentos a reparar', value: String(pendentesReparo), iconHtml: icon.bolt(16), tone: pendentesReparo ? 'warn' : 'ok' }),
          statTile({ label: 'Versão do app', value: el('span', { style: { fontSize: '19px' } }, VERSAO), iconHtml: icon.grid(16) })
        ]),
        grupos.length
          ? el('div', { class: 'table-wrap' }, [
              el('table', { class: 'data-table' }, [
                el('thead', {}, el('tr', {}, ['Ocorrência', 'Onde', 'Vezes', 'Quem', 'Última', 'Situação'].map((h) => el('th', {}, h)))),
                el('tbody', {}, grupos.slice(0, 30).map((g) => el('tr', {}, [
                  el('td', { style: { maxWidth: '380px' } }, g.tipo === 'recuperacao' ? (ACOES_RECUPERACAO[g.origem] || g.origem) : g.mensagem),
                  el('td', { class: 'mono muted' }, g.tipo === 'recuperacao' ? g.mensagem.slice(0, 60) : g.origem),
                  el('td', { class: 'mono' }, String(g.vezes)),
                  el('td', {}, [...g.pessoas].filter(Boolean).slice(0, 3).join(', ') || '—'),
                  el('td', { class: 'mono' }, quando(g.ultima)),
                  el('td', {}, g.tipo === 'recuperacao' || g.recuperadas === g.vezes ? badge('recuperado', 'ok', true) : badge('verificar', 'warn', true))
                ])))
              ])
            ])
          : emptyState({ icon: icon.check(34), title: 'Nenhuma falha nos últimos 7 dias', message: 'O app está rodando sem problemas.' }),
        el('div', { class: 'toolbar', style: { marginTop: '14px' } }, [
          button({ label: 'Reparar o app neste computador', size: 'sm', variant: 'ghost', icon: icon.sync(14), onClick: repararApp })
        ])
      ]
    });

    const ultimo = ctx.ultimoBackup?.ultimoEmLocal;
    const dias = ultimo ? Math.floor((Date.now() - ultimo) / 86400000) : null;
    const backupCard = cardWithHeader({
      title: 'Backup',
      subtitle: 'Cópia completa dos dados num arquivo guardado no seu computador',
      actions: [button({ label: 'Fazer backup agora', size: 'sm', variant: 'primary', icon: icon.download(15), onClick: async (ev) => {
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          const n = await fazerBackup({ incluirUsuarios: isAdmin, profile: ctx.profile });
          toast(`Backup baixado: ${n} registros. Guarde o arquivo em local seguro (ex.: pasta da rede ou OneDrive).`, 'ok', 6000);
        } catch {
          toast('Não foi possível fazer o backup. Verifique a conexão.', 'error');
        } finally {
          btn.disabled = false;
        }
      } })],
      children: [
        el('div', { class: `inline-alert ${dias === null || dias > 7 ? 'warn' : 'info'}` }, [
          el('span', { html: dias === null || dias > 7 ? icon.alert(15) : icon.check(15), style: { display: 'inline-flex' } }),
          el('div', {}, ultimo
            ? `Último backup: ${quando(ultimo)} por ${ctx.ultimoBackup.por} (${ctx.ultimoBackup.registros} registros)${dias > 7 ? ` — há ${dias} dias. Recomendado: 1 vez por semana.` : '.'}`
            : 'Nenhum backup feito ainda. Recomendado: 1 vez por semana.')
        ])
      ]
    });

    const filtrados = (ctx.auditoria || []).filter((a) => !busca || `${a.nome} ${a.acao} ${a.entidade} ${a.resumo}`.toLowerCase().includes(busca));
    const buscaInput = el('input', { class: 'input', type: 'search', placeholder: 'Buscar por pessoa, ação ou item…', value: busca, style: { height: '34px', width: '260px' },
      oninput: (e) => { busca = e.target.value.toLowerCase(); pintarAuditoria(); } });
    const auditBody = el('div');
    function pintarAuditoria() {
      const lista = (ctx.auditoria || []).filter((a) => !busca || `${a.nome} ${a.acao} ${a.entidade} ${a.resumo}`.toLowerCase().includes(busca));
      mount(auditBody, [lista.length
        ? el('div', { class: 'table-wrap' }, [
            el('table', { class: 'data-table' }, [
              el('thead', {}, el('tr', {}, ['Quando', 'Quem', 'Ação', 'Item', 'Detalhe'].map((h) => el('th', {}, h)))),
              el('tbody', {}, lista.slice(0, 150).map((a) => el('tr', {}, [
                el('td', { class: 'mono' }, quando(a.emLocal)),
                el('td', { class: 'strong' }, a.nome || '—'),
                el('td', {}, badge(a.acao, a.acao === 'excluiu' ? 'danger' : a.acao === 'alterou' ? 'info' : 'neutral')),
                el('td', {}, a.entidade),
                el('td', { style: { maxWidth: '420px', color: 'var(--text-2)' } }, a.resumo || '—')
              ])))
            ])
          ])
        : emptyState({ icon: icon.list(32), title: 'Nada registrado', message: 'Alterações e exclusões aparecem aqui.' })]);
    }
    pintarAuditoria();
    const auditCard = cardWithHeader({
      title: 'Auditoria',
      subtitle: `Quem alterou ou excluiu o quê (${filtrados.length} registros recentes) — os registros não podem ser editados nem apagados`,
      actions: [buscaInput],
      children: [auditBody]
    });

    const seg = [
      ['Acesso por aprovação', 'Cada pessoa só entra depois de aprovada por um administrador.'],
      ['Permissão por papel', 'Apontador lança; planejador planeja e analisa; só o administrador aprova usuários.'],
      ['Permissão por contrato', 'Em Usuários, limite os contratos que cada apontador enxerga.'],
      ['Validação no servidor', 'As regras do Firestore recusam registros com datas, horários ou durações inválidos.'],
      ['Saída por inatividade', 'O painel encerra a sessão após 30 minutos sem uso.'],
      ['App Check', appCheckAtivo ? 'Ativo: só o app oficial consegue acessar o banco.' : 'Desligado (opcional — exige configuração no console do Firebase).'],
      ['Auditoria e backup', 'Toda alteração/exclusão fica registrada; backup completo com um clique.']
    ];
    const segCard = cardWithHeader({
      title: 'Proteções ativas',
      subtitle: 'Resumo do que protege os dados',
      children: [el('div', { class: 'kv-grid' }, seg.map(([k, v]) => el('div', { class: 'kv' }, [el('span', {}, k), el('strong', { style: { fontWeight: '500', fontSize: '13px', lineHeight: '1.45' } }, v)])))]
    });

    const demoCard = cardDemo();

    // mantém o foco na busca da auditoria ao repintar
    const focoNaBusca = document.activeElement?.type === 'search' && node.contains(document.activeElement);
    mount(node, [demoCard, saudeCard, el('div', { class: 'grid grid-2' }, [backupCard, segCard]), auditCard]);
    if (focoNaBusca) buscaInput.focus();
  }

  /** Carregar/remover o cenário de demonstração (para conhecer o app com dados). */
  function cardDemo() {
    const nProj = (ctx.projetos || []).filter((p) => p.demo).length;
    const nLanc = (ctx.lancamentos || []).filter((l) => l.demo).length;
    const carregado = nProj > 0;
    const executar = (titulo, texto, rotulo, acao) => {
      const close = () => backdrop.remove();
      const ok = button({ label: rotulo, variant: carregado ? 'danger' : 'primary', onClick: async () => {
        ok.disabled = true;
        ok.textContent = 'Aguarde…';
        try {
          await acao();
        } catch {
          toast('Não foi possível concluir. Verifique a internet e as regras do Firestore.', 'error', 6000);
        }
        close();
      } });
      const backdrop = modal({ title: titulo, body: [el('p', { style: { fontSize: '13.5px', color: 'var(--text-1)', lineHeight: '1.55' } }, texto)], footer: [button({ label: 'Cancelar', variant: 'ghost', onClick: close }), ok], onClose: close });
      document.body.appendChild(backdrop);
    };
    return cardWithHeader({
      title: 'Dados de demonstração',
      subtitle: 'Um cenário de exemplo completo para conhecer o app funcionando',
      actions: [carregado
        ? button({ label: 'Remover dados de demonstração', size: 'sm', variant: 'danger', icon: icon.trash(14), onClick: () => executar('Remover a demonstração?', 'Apaga somente os registros marcados como demonstração (projetos, lançamentos, estudos, contratos, cliente e atividades "DEMO"). Os seus dados reais não são tocados.', 'Remover', async () => {
            const n = await (await import('../../lib/demo.js')).removerDemo();
            toast(`${n} registros de demonstração removidos.`, 'ok');
          }) })
        : button({ label: 'Carregar dados de demonstração', size: 'sm', variant: 'primary', icon: icon.bolt(14), onClick: () => executar('Carregar a demonstração?', 'Cria o cliente Ternium Brasil, 4 contratos (Coqueria, Alto-Forno, Aciaria, Regenerador), 4 projetos com ficha e etapas, cerca de 200 lançamentos dos últimos 30 dias e 3 estudos de tempos. Tudo fica marcado como demonstração e sai com um clique.', 'Carregar', async () => {
            const r = await (await import('../../lib/demo.js')).carregarDemo(ctx.profile);
            toast(`Demonstração carregada: ${r.projetos} projetos, ${r.lancamentos} lançamentos e ${r.estudos} estudos. Veja o Dashboard!`, 'ok', 7000);
          }) })],
      children: [el('div', { class: `inline-alert ${carregado ? 'warn' : 'info'}` }, [
        el('span', { html: carregado ? icon.alert(15) : icon.lightbulb(15), style: { display: 'inline-flex' } }),
        el('div', {}, carregado
          ? `Demonstração ativa: ${nProj} projetos e ${nLanc} lançamentos de exemplo aparecem nos indicadores. Remova antes de começar a usar com dados reais.`
          : 'Carregue para ver Dashboard, Assistente, Projetos e Estudos preenchidos. Para ver o app do celular, use "Ver app de campo" no menu lateral.')
      ])]
    });
  }

  paint();
  return {
    node,
    update(novo) {
      ctx = novo;
      paint();
    }
  };
}
