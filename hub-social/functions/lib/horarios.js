// Janelas de publicação. A matriz 7x24 (domingo=0) vem do Instagram (seguidores
// online por hora). Enquanto a Lupa não leu a conta, usamos uma curva padrão
// (almoço e começo da noite), e o motivo do horário deixa isso claro.

export function matrizPadrao() {
  const g = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s));
  const m = [];
  for (let d = 0; d < 7; d++) {
    const fds = d === 0 || d === 6;
    const linha = [];
    for (let h = 0; h < 24; h++) linha.push(0.05 + 0.3 * g(h, fds ? 10 : 8, 1.4) + 0.6 * g(h, fds ? 13.5 : 12.5, 1.3) + g(h, fds ? 20.5 : 19.8, 1.9));
    m.push(linha);
  }
  const max = Math.max(...m.flat());
  return m.map((l) => l.map((v) => +(v / max).toFixed(3)));
}

// Converte uma data "de parede" no fuso do cliente para ISO (UTC).
export function paraISO(ano, mes, dia, hora, minuto, fuso) {
  const palpite = Date.UTC(ano, mes, dia, hora, minuto);
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(new Date(palpite))
    .reduce((a, p) => ((a[p.type] = +p.value), a), {});
  const visto = Date.UTC(partes.year, partes.month - 1, partes.day, partes.hour, partes.minute);
  return new Date(palpite - (visto - palpite)).toISOString();
}

export function diaLocal(data, fuso) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: fuso, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
    .formatToParts(data)
    .reduce((a, x) => ((a[x.type] = x.value), a), {});
  const semana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { ano: +p.year, mes: +p.month - 1, dia: +p.day, semana };
}

// Escolhe dias e horas para os próximos N dias, respeitando o ritmo e o que já existe.
export function montarJanelas({ matriz, ritmo = { feed: 4, stories: 5 }, ocupados = [], dias = 14, fuso = 'America/Sao_Paulo', padrao = false }) {
  const forcaDia = matriz.map((l) => l.reduce((a, b) => a + b, 0));
  const jaTem = new Set(ocupados.map((p) => `${diaLocal(new Date(p.agendadoPara), fuso).dia}-${p.formato}`));
  const janelas = [];
  const hoje = new Date();
  for (let s = 0; s < Math.ceil(dias / 7); s++) {
    const semana = Array.from({ length: 7 }, (_, i) => diaLocal(new Date(hoje.getTime() + (s * 7 + i + 1) * 864e5), fuso));
    const rank = [...semana].sort((a, b) => forcaDia[b.semana] - forcaDia[a.semana]);
    for (const [formato, qtd] of [
      ['feed', ritmo.feed],
      ['story', Math.min(7, ritmo.stories)]
    ]) {
      for (const d of rank.slice(0, qtd)) {
        if (jaTem.has(`${d.dia}-${formato}`)) continue;
        const linha = matriz[d.semana];
        let melhor = 7;
        for (let h = 7; h <= 22; h++) if (linha[h] > linha[melhor]) melhor = h;
        let hora = melhor;
        if (formato === 'story') {
          let segunda = melhor === 7 ? 8 : 7;
          for (let h = 7; h <= 22; h++) if (h !== melhor && linha[h] > linha[segunda]) segunda = h;
          hora = segunda;
        }
        // minuto quebrado: foge do pico de posts que saem em hora cheia
        const minuto = formato === 'feed' ? 5 + ((d.dia * 7) % 4) * 5 : 30 + ((d.dia * 3) % 3) * 5;
        janelas.push({
          formato,
          agendadoPara: paraISO(d.ano, d.mes, d.dia, hora, minuto, fuso),
          semana: d.semana,
          hora,
          motivoHorario: padrao
            ? 'horário de maior movimento no Instagram em geral (estimativa até a Lupa ler a sua conta)'
            : `${Math.round(linha[hora] * 100)}% do pico de seguidores online nesse horário`
        });
      }
    }
  }
  return janelas.sort((a, b) => a.agendadoPara.localeCompare(b.agendadoPara));
}
