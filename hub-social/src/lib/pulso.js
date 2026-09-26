// Nota de saúde do perfil (0 a 100), usada no Painel.
// Constância e engajamento pesam mais porque são o que o algoritmo mais recompensa.
import { inicioDaSemana } from './tempo.js';

export function calcularPulso({ insights, posts, marca }) {
  const meta = marca?.ritmo?.feed || 4;
  const semana = inicioDaSemana(new Date()).getTime();
  const fimSemana = semana + 7 * 864e5;
  const daSemana = posts.filter((p) => p.formato === 'feed' && ['agendado', 'publicado', 'publicando'].includes(p.status) && new Date(p.agendadoPara).getTime() >= semana && new Date(p.agendadoPara).getTime() < fimSemana);
  const publicadosSemana = posts.filter((p) => p.formato === 'feed' && p.status === 'publicado' && new Date(p.publicadoEm || p.agendadoPara).getTime() >= semana).length;
  const constancia = Math.min(1, daSemana.length / meta);
  const eng = insights?.kpis?.engajamento?.valor ?? 0.03;
  const engajamento = Math.max(0, Math.min(1, (eng - 0.015) / 0.05));
  const crescimento = Math.max(0, Math.min(1, 0.5 + (insights?.kpis?.alcance?.delta ?? 0) * 2));
  const pendentes = posts.filter((p) => p.status === 'aguardando').length;
  const mesa = Math.max(0, 1 - pendentes * 0.12);
  const nota = Math.round(100 * (0.35 * constancia + 0.3 * engajamento + 0.2 * crescimento + 0.15 * mesa));
  const nivel = nota >= 85 ? 'Em chamas' : nota >= 65 ? 'Em alta' : nota >= 40 ? 'No ritmo' : 'Aquecendo';

  // sequência: semanas seguidas batendo a meta de feed (conta a partir das publicações)
  let sequencia = 0;
  for (let s = 1; s <= 12; s++) {
    const ini = semana - s * 7 * 864e5;
    const n = posts.filter((p) => p.formato === 'feed' && p.status === 'publicado' && new Date(p.publicadoEm).getTime() >= ini && new Date(p.publicadoEm).getTime() < ini + 7 * 864e5).length;
    if (n >= meta) sequencia++;
    else break;
  }
  if (publicadosSemana >= meta) sequencia++;

  return { nota, nivel, meta, agendadosSemana: daSemana.length, publicadosSemana, sequencia, partes: { constancia, engajamento, crescimento, mesa } };
}

export function diagnostico(p, insights) {
  const d = insights?.kpis?.alcance?.delta ?? 0;
  if (p.partes.mesa < 0.7) return 'Tem post pronto parado na Mesa. Aprovar hoje segura o ritmo da semana.';
  if (p.partes.constancia < 0.5) return 'A semana está com poucos posts agendados. Constância é o que mais pesa no alcance.';
  if (d > 0.05) return `O alcance subiu ${Math.round(d * 100)}% em relação à semana anterior. Continue nesse ritmo.`;
  if (d < -0.05) return `O alcance caiu ${Math.round(-d * 100)}% na semana. A Lupa deixou sugestões logo abaixo.`;
  return 'Alcance estável. Um carrossel útil esta semana pode dar o próximo empurrão.';
}
