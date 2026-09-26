// Métricas de EXEMPLO para o modo demonstração. Nada aqui vem de uma conta real.
import { aleatorio, hashTexto } from './redacao.js';

function matrizHorarios(r) {
  const gauss = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  const m = [];
  for (let d = 0; d < 7; d++) {
    const fimDeSemana = d === 0 || d === 6;
    const linha = [];
    for (let h = 0; h < 24; h++) {
      let v =
        0.35 * gauss(h, fimDeSemana ? 10 : 8, 1.4) +
        0.62 * gauss(h, fimDeSemana ? 13.5 : 12.5, 1.3) +
        1.0 * gauss(h, fimDeSemana ? 20.5 : 19.8, 1.9) +
        0.05;
      v *= fimDeSemana ? 0.85 : d === 4 || d === 3 ? 1.08 : 1;
      v *= 0.9 + r() * 0.2;
      linha.push(v);
    }
    m.push(linha);
  }
  const max = Math.max(...m.flat());
  return m.map((l) => l.map((v) => +(v / max).toFixed(3)));
}

export function gerarInsights(semente) {
  const r = aleatorio(hashTexto(semente));
  const hoje = new Date();
  const serie = [];
  let seguidores = 1800 + Math.floor(r() * 1400);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    const fds = d.getDay() === 0 || d.getDay() === 6;
    const tendencia = 1 + (29 - i) * 0.012;
    const alcance = Math.round((520 + r() * 380) * tendencia * (fds ? 0.8 : 1));
    const interacoes = Math.round(alcance * (0.045 + r() * 0.03));
    seguidores += Math.round(r() * 9 - 1.5);
    serie.push({ data: d.toISOString().slice(0, 10), alcance, interacoes, seguidores });
  }
  const soma = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
  const ult7 = serie.slice(-7);
  const ant7 = serie.slice(-14, -7);
  const alcance7 = soma(ult7, 'alcance');
  const alcanceAnt = soma(ant7, 'alcance');
  const eng = soma(ult7, 'interacoes') / alcance7;
  const engAnt = soma(ant7, 'interacoes') / alcanceAnt;
  const visitas = Math.round(alcance7 * (0.06 + r() * 0.02));
  const cliques = Math.round(visitas * (0.12 + r() * 0.06));

  const kpis = {
    seguidores: { valor: seguidores, delta: seguidores - serie[serie.length - 8].seguidores, serie: serie.map((s) => s.seguidores) },
    alcance: { valor: alcance7, delta: (alcance7 - alcanceAnt) / alcanceAnt, serie: serie.map((s) => s.alcance) },
    engajamento: { valor: eng, delta: eng - engAnt, serie: serie.map((s) => s.interacoes / s.alcance) },
    visitas: { valor: visitas, delta: 0.04 + r() * 0.1, serie: serie.map((s) => Math.round(s.alcance * 0.07)) },
    cliques: { valor: cliques, delta: -0.02 + r() * 0.12, serie: serie.map((s) => Math.round(s.alcance * 0.009)) }
  };

  return {
    demo: true,
    atualizadoEm: new Date().toISOString(),
    serie,
    kpis,
    porRede: {
      instagram: { parcela: 0.68 + r() * 0.12 },
      facebook: { parcela: 0 }
    },
    horarios: matrizHorarios(r),
    formatos: [
      { formato: 'Carrossel', taxa: 0.061 + r() * 0.01 },
      { formato: 'Reels', taxa: 0.055 + r() * 0.012 },
      { formato: 'Foto', taxa: 0.034 + r() * 0.008 },
      { formato: 'Story', taxa: 0.027 + r() * 0.008 }
    ],
    publicados: []
  };
}

// Sugestões da Lupa (modo demo): regras simples em cima dos números de exemplo.
export function sugestoesDemo(insights, posts = []) {
  const s = [];
  const f = [...insights.formatos].sort((a, b) => b.taxa - a.taxa);
  s.push({
    id: 'formato',
    titulo: `${f[0].formato} engaja mais que ${f[2].formato.toLowerCase()} no seu perfil`,
    detalhe: `A taxa de engajamento do ${f[0].formato.toLowerCase()} está em ${(f[0].taxa * 100).toFixed(1).replace('.', ',')}%, contra ${(f[2].taxa * 100).toFixed(1).replace('.', ',')}% da ${f[2].formato.toLowerCase()}. Vale trocar um post de foto por semana por ${f[0].formato.toLowerCase()}.`,
    impacto: 'alto',
    acao: { tipo: 'rodar', agente: 'compasso', rotulo: 'Ajustar o calendário' }
  });
  const pico = insights.horarios.map((l) => l.indexOf(Math.max(...l)));
  const horaPico = Math.round(pico.reduce((a, b) => a + b, 0) / 7);
  s.push({
    id: 'horario',
    titulo: `Seu público se concentra perto das ${horaPico}h`,
    detalhe: `O Compasso já agenda os posts de feed nessa janela. Stories funcionam melhor espalhados ao longo do dia para manter você no topo da barra.`,
    impacto: 'médio',
    acao: { tipo: 'ir', para: '/agenda', rotulo: 'Ver agenda' }
  });
  const pendentes = posts.filter((p) => p.status === 'aguardando').length;
  if (pendentes > 0) {
    s.unshift({
      id: 'mesa',
      titulo: `${pendentes} ${pendentes === 1 ? 'post espera' : 'posts esperam'} o seu ok`,
      detalhe: 'Constância pesa no alcance. Aprovar com antecedência garante que nada saia fora do horário ideal.',
      impacto: 'alto',
      acao: { tipo: 'ir', para: '/mesa', rotulo: 'Abrir a Mesa' }
    });
  }
  const faltaFoto = posts.filter((p) => p.status === 'precisa_foto').length;
  if (faltaFoto > 0) {
    s.push({
      id: 'fotos',
      titulo: 'Fotos reais seguram mais a atenção',
      detalhe: `O Traço tem ${faltaFoto} ${faltaFoto === 1 ? 'post esperando' : 'posts esperando'} foto. Fotos feitas no celular, com luz de janela, costumam render mais do que imagem de banco.`,
      impacto: 'médio',
      acao: { tipo: 'ir', para: '/acervo', rotulo: 'Enviar fotos' }
    });
  }
  s.push({
    id: 'resposta',
    titulo: 'Responda os comentários na primeira hora',
    detalhe: 'Conversa logo depois da publicação é um dos sinais que mais ajudam o post a circular. Separe 10 minutos depois de cada horário agendado.',
    impacto: 'médio',
    acao: null
  });
  return s;
}
