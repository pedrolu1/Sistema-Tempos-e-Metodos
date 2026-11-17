// Checklist de entrega com fotos: 4 por lado do forno (abóbada inteira e as
// 3 manilhas instaladas e revestidas), 8 no total. O líder tira e envia; o
// planejador aprova (o número entra na relação da medição) ou devolve.
// As fotos ficam guardadas no aparelho sem internet e sobem sozinhas depois.
import { el } from '../../../src/utils/dom.js';
import { abrirFolha, statusChip } from './base.js';
import { ic } from '../lib/icones.js';
import { SLOTS_FOTO, LADOS, rotulo } from '../data/obra.js';
import { calcular, checklists, proximoNumeroChecklist } from '../lib/calculo.js';
import { assinar, assinarFotos, salvarFoto, enviarChecklist, devolverChecklist, aprovarChecklist } from '../lib/banco.js';
import { comprimirFoto } from '../lib/fotos.js';
import { completa } from '../lib/datas.js';
import { autorDe } from '../lib/acesso.js';
import { vibrar, tocar, faiscas, comemorar } from '../lib/efeitos.js';
import { toast } from '../../../src/lib/toast.js';

export const NOME_STATUS = { pendente: 'Sem fotos', rascunho: 'Em andamento', enviado: 'Enviado para aprovação', devolvido: 'Devolvido para ajuste', aprovado: 'Aprovado' };

/** modo: 'campo' (tira e envia), 'gestao' (aprova/devolve) ou 'leitura' (gestor). */
export function abrirChecklistFotos(fid, { perfil, modo = 'campo' }) {
  const folha = abrirFolha({ titulo: `Checklist · ${fid.replace('-', ' · ')}`, corpo: [], aoFechar: () => { pararEstado(); pararFotos(); } });
  let calc = null;
  let fotos = {};
  const carregando = new Set();
  const pararEstado = assinar((estado) => {
    calc = calcular(estado);
    desenhar();
  });
  const pararFotos = assinarFotos(fid, (f) => {
    fotos = f;
    desenhar();
  });

  function desenhar() {
    if (!calc) return;
    const ck = checklists(calc)[fid] || { status: 'pendente', fotos: {}, nFotos: 0 };
    const fc = calc.fornos[fid];
    const travado = modo !== 'campo' || ck.status === 'aprovado' || ck.status === 'enviado';
    const n = SLOTS_FOTO.filter((s) => fotos[s.id] || ck.fotos?.[s.id]).length;
    const pendentesEnvio = Object.values(fotos).filter((f) => f.pendente).length;

    const slot = (s) => {
      const f = fotos[s.id];
      const temSemImagem = !f && ck.fotos?.[s.id];
      const enviando = carregando.has(s.id);
      const entrada = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'foto-entrada', onchange: (ev) => tirar(s, ev.target.files[0]) });
      const conteudo = enviando
        ? el('span', { class: 'foto-vazia' }, [el('span', { class: 'spinner' }), 'Preparando…'])
        : f
          ? el('img', { src: f.imagem, alt: `${s.nome}, ${s.desc}`, loading: 'lazy' })
          : el('span', { class: 'foto-vazia' }, [el('span', { html: travado ? ic.camera(26) : ic.camera(28) }), temSemImagem ? 'Carregando…' : travado ? 'Sem foto' : 'Tirar foto']);
      return el('div', { class: `foto-slot${f ? ' tem' : ''}` }, [
        el('button', {
          type: 'button', class: 'foto-botao', 'aria-label': `${s.nome}: ${f ? 'ver foto' : 'tirar foto'}`,
          onclick: () => (f ? ampliar(s, f, travado) : !travado && entrada.click())
        }, conteudo),
        el('div', { class: 'foto-rotulo' }, [el('strong', {}, s.nome), f?.pendente ? el('span', { class: 'foto-pendente', title: 'Guardada no aparelho, sobe quando tiver internet' }, [el('span', { html: ic.semNuvem(13) }), 'no aparelho']) : f ? el('span', { class: 'foto-ok', html: ic.check(13) }) : null]),
        travado ? null : entrada
      ]);
    };

    const acoes = [];
    if (modo === 'campo' && !travado) {
      acoes.push(el('button', {
        type: 'button', class: 'btn btn-brasa', disabled: n < SLOTS_FOTO.length,
        onclick: (ev) => {
          enviarChecklist(fid, autorDe(perfil));
          tocar('forno');
          vibrar([20, 40, 30]);
          faiscas(ev.currentTarget, { quantidade: 46 });
          folha.fechar();
          comemorar({ titulo: 'Checklist enviado!', texto: `${rotulo(fid)} com as 8 fotos. O planejador aprova no painel.`, icone: ic.prancheta(48), som: 'ok' });
        }
      }, n < SLOTS_FOTO.length ? `Faltam ${SLOTS_FOTO.length - n} fotos` : 'Enviar checklist'));
    }
    if (modo === 'gestao' && ck.status === 'enviado') {
      acoes.push(el('button', {
        type: 'button', class: 'btn btn-ghost', onclick: () => {
          const motivo = prompt('O que precisa ajustar? (vai para o líder)');
          if (motivo == null) return;
          devolverChecklist(fid, perfil.nome, motivo.trim());
          toast('Checklist devolvido para o campo.', 'info');
        }
      }, 'Devolver'));
      acoes.push(el('button', {
        type: 'button', class: 'btn btn-brasa', style: { flex: 1 },
        onclick: async (ev) => {
          const botao = ev.currentTarget;
          botao.disabled = true;
          try {
            const numero = await aprovarChecklist(fid, perfil.nome, proximoNumeroChecklist(calc) - 1);
            tocar('forno');
            faiscas(botao, { quantidade: 50 });
            toast(`Checklist nº ${numero} aprovado.`, 'ok');
          } catch {
            botao.disabled = false;
            toast('Para aprovar precisa de internet (o número não pode repetir). Tente de novo.', 'error', 6000);
          }
        }
      }, 'Aprovar checklist'));
    }

    folha.montar({
      subtitulo: fc.concluidoEm ? `Forno concluído em ${completa(fc.concluidoEm)}` : 'Forno ainda sem a massa 1200 nas 6 primárias',
      corpo: [
        el('div', { class: 'entre' }, [
          statusChip(ck.status, ck.numero ? `Nº ${ck.numero} · ${NOME_STATUS[ck.status]}` : NOME_STATUS[ck.status]),
          el('span', { class: 'fraco', style: { fontSize: '13.5px' } }, `${n} de ${SLOTS_FOTO.length} fotos`)
        ]),
        ck.origem === 'planilha' ? el('p', { class: 'fraco', style: { fontSize: '13.5px' } }, 'Aprovado antes do app, conforme a planilha de medição.') : null,
        ck.status === 'devolvido' && ck.motivoDevolucao ? el('div', { class: 'bloqueado-nota aviso' }, [el('span', { html: ic.alert(15) }), `Devolvido por ${ck.devolvidoPor || 'planejador'}: ${ck.motivoDevolucao}`]) : null,
        pendentesEnvio ? el('div', { class: 'bloqueado-nota' }, [el('span', { html: ic.semNuvem(15) }), `${pendentesEnvio} foto${pendentesEnvio > 1 ? 's' : ''} guardada${pendentesEnvio > 1 ? 's' : ''} no aparelho. Sobe${pendentesEnvio > 1 ? 'm' : ''} sozinha${pendentesEnvio > 1 ? 's' : ''} quando tiver internet.`]) : null,
        ...LADOS.map((lado) => el('section', { class: 'fotos-lado' }, [
          el('div', { class: 'titulo-secao', style: { fontSize: '18px' } }, [lado.nome, el('small', {}, `${SLOTS_FOTO.filter((s) => s.lado === lado.id && (fotos[s.id] || ck.fotos?.[s.id])).length} de 4`)]),
          el('div', { class: 'fotos-grade' }, SLOTS_FOTO.filter((s) => s.lado === lado.id).map(slot))
        ])),
        modo === 'campo' && !travado ? el('p', { class: 'fraco', style: { fontSize: '12.5px' } }, 'Abóbada: a foto da abóbada inteira daquele lado. P01 a P06: cada manilha instalada e revestida. A data, a hora e o local saem gravados na foto.') : null,
        travado && modo === 'campo' && ck.status === 'enviado' ? el('div', { class: 'bloqueado-nota' }, [el('span', { html: ic.lock(14) }), 'Enviado. Para trocar uma foto, peça ao planejador para devolver.']) : null
      ],
      pe: acoes.length ? acoes : null
    });
  }

  async function tirar(s, arquivo) {
    if (!arquivo) return;
    carregando.add(s.id);
    desenhar();
    try {
      const agora = new Date();
      const legenda = `${rotulo(fid)} · ${s.lado}${s.nome.startsWith('P') ? ` · ${s.nome}` : ' · abóbada'} · ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const f = await comprimirFoto(arquivo, { legenda });
      await salvarFoto({ fornoId: fid, slot: s.id, imagem: f.dataUrl, largura: f.largura, altura: f.altura, autor: autorDe(perfil) });
      vibrar(12);
      tocar('ok');
    } catch {
      toast('Não consegui usar essa foto. Tente tirar de novo.', 'error');
    } finally {
      carregando.delete(s.id);
      desenhar();
    }
  }

  function ampliar(s, f, travado) {
    const grande = abrirFolha({
      titulo: `${s.nome} · ${s.lado === 'LM' ? 'lado máquina' : 'lado coque'}`,
      subtitulo: `${s.desc}${f.autor?.nome ? ` · por ${f.autor.nome}` : ''}`,
      corpo: [el('img', { class: 'foto-grande', src: f.imagem, alt: s.desc })],
      pe: travado ? null : [el('button', { type: 'button', class: 'btn btn-ghost', style: { flex: 1 }, onclick: () => { grande.fechar(); trocar(s); } }, [el('span', { html: ic.camera(18) }), 'Tirar de novo'])]
    });
  }

  function trocar(s) {
    const entrada = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'foto-entrada', onchange: (ev) => tirar(s, ev.target.files[0]) });
    document.body.appendChild(entrada);
    entrada.click();
    setTimeout(() => entrada.remove(), 60000);
  }
  return folha;
}
