// Bancos de conteúdo do MODO DEMONSTRAÇÃO.
// No modo real, quem produz isso são os agentes (Claude + dados do Instagram/Facebook).
// Aqui é só material de exemplo para a experiência funcionar sem nenhuma chave.

const NICHOS = {
  alimentacao: {
    palavras: ['café', 'cafeteria', 'padaria', 'restaurante', 'doce', 'confeitaria', 'bolo', 'hamburg', 'pizza', 'bar', 'açaí', 'marmita', 'comida', 'gastronomia', 'bistr', 'sorvete', 'lanche'],
    lugar: 'a casa',
    coisas: ['a fornada da manhã', 'o café coado na hora', 'o prato do dia', 'a receita da casa', 'o doce que sai primeiro'],
    hashtags: ['#comidadeverdade', '#feitoamao', '#cafedamanha', '#gastronomialocal', '#receitadecasa'],
    tendencias: [
      { tema: 'Bastidores do preparo em vídeo curto', porque: 'Vídeos mostrando mãos, massa e forno estão puxando compartilhamento no nicho.', formato: 'reels', sinal: 'subindo' },
      { tema: 'Cardápio da semana em carrossel', porque: 'Posts que ajudam a decidir o que pedir costumam ser salvos para consulta.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Enquete de sabor nos stories', porque: 'Enquetes simples geram resposta rápida e aumentam a entrega dos próximos stories.', formato: 'story', sinal: 'estável' },
      { tema: 'Quem faz: apresentar a equipe', porque: 'Rostos da equipe aproximam e aparecem entre os formatos mais comentados de negócio local.', formato: 'foto', sinal: 'subindo' },
      { tema: 'Harmonização e combinações', porque: 'Conteúdo do tipo "combina com" rende salvamentos e comentários de opinião.', formato: 'carrossel', sinal: 'estável' }
    ],
    dicas: [
      { titulo: 'Como guardar pão sem endurecer', itens: ['Pano de algodão, nada de plástico', 'Longe da geladeira', 'Fatiou? Congela em porções', 'Forno quente por 3 minutos revive'] },
      { titulo: 'Café coado mais gostoso em casa', itens: ['Água antes de ferver', 'Moagem média', 'Escalde o filtro de papel', 'Despeje devagar, em círculos'] }
    ],
    perguntas: ['Doce ou salgado de manhã?', 'Qual sabor volta para o cardápio?', 'Café puro ou com leite?'],
    pedidosFoto: ['balcão com os produtos do dia, luz natural', 'mãos preparando algo, de perto', 'a fachada ou a porta de entrada', 'um prato ou produto em cima da mesa, visto de cima']
  },
  moda: {
    palavras: ['moda', 'roupa', 'boutique', 'loja', 'calçado', 'sapato', 'acessório', 'joia', 'bijou', 'brechó', 'vestido', 'bolsa', 'ótica'],
    lugar: 'a loja',
    coisas: ['a peça nova da vitrine', 'o look da semana', 'a coleção que chegou', 'o básico que combina com tudo'],
    hashtags: ['#lookdodia', '#modalocal', '#estilopessoal', '#compredopequeno', '#novidadesnaloja'],
    tendencias: [
      { tema: 'Uma peça, três jeitos de usar', porque: 'Carrosséis de combinação costumam ser salvos e reenviados entre amigas.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Provador ao vivo nos stories', porque: 'Mostrar caimento real em corpos reais gera pergunta de tamanho e venda por direct.', formato: 'story', sinal: 'subindo' },
      { tema: 'Chegou hoje: abrir a caixa', porque: 'Vídeos de novidade chegando criam expectativa e trazem gente para a loja.', formato: 'reels', sinal: 'subindo' },
      { tema: 'Cores da estação', porque: 'Conteúdo de tendência de cor atrai quem ainda não segue o perfil.', formato: 'foto', sinal: 'estável' },
      { tema: 'Cuidados com a peça', porque: 'Dica prática de lavagem e conservação rende salvamento.', formato: 'carrossel', sinal: 'estável' }
    ],
    dicas: [
      { titulo: 'Como fazer a roupa durar mais', itens: ['Lave do avesso', 'Água fria sempre que der', 'Nada de secadora no delicado', 'Guarde malha dobrada, não no cabide'] },
      { titulo: 'Montando um armário que combina', itens: ['Comece por 3 cores base', 'Uma peça de destaque por look', 'Invista em calça e sapato', 'Acessório muda tudo'] }
    ],
    perguntas: ['Com salto ou com tênis?', 'Qual cor você usaria primeiro?', 'Estampa ou liso?'],
    pedidosFoto: ['uma peça no cabide com fundo liso', 'alguém vestindo o look, corpo inteiro', 'detalhe do tecido ou acabamento, bem de perto', 'a vitrine da loja']
  },
  beleza: {
    palavras: ['salão', 'cabelo', 'estética', 'unha', 'barbearia', 'barbeiro', 'maquiagem', 'sobrancelha', 'spa', 'depilação', 'cílios', 'beleza', 'manicure'],
    lugar: 'o salão',
    coisas: ['o corte da semana', 'a cor que saiu hoje', 'o antes e depois', 'o cuidado que faz diferença'],
    hashtags: ['#autocuidado', '#belezareal', '#cabelosaudavel', '#salaodebeleza', '#antesedepois'],
    tendencias: [
      { tema: 'Antes e depois com a mesma luz', porque: 'Transformações honestas, sem filtro, são das mais compartilhadas no nicho.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Processo acelerado em vídeo', porque: 'Vídeos curtos do procedimento prendem atenção até o final.', formato: 'reels', sinal: 'subindo' },
      { tema: 'Mito ou verdade', porque: 'Formato de pergunta e resposta gera comentário e salvamento.', formato: 'carrossel', sinal: 'estável' },
      { tema: 'Horários livres da semana nos stories', porque: 'Agenda aberta com link direto converte em reserva.', formato: 'story', sinal: 'estável' },
      { tema: 'Rotina de cuidado em casa', porque: 'Dicas práticas de manutenção aumentam a confiança antes da primeira visita.', formato: 'foto', sinal: 'subindo' }
    ],
    dicas: [
      { titulo: 'Cabelo bonito até o próximo retorno', itens: ['Água morna, nunca quente', 'Hidratação uma vez por semana', 'Protetor antes do secador', 'Fronha de cetim ajuda'] },
      { titulo: 'Unha que dura mais', itens: ['Luva na louça', 'Óleo de cutícula à noite', 'Lixa em uma direção só', 'Base fortalecedora por baixo'] }
    ],
    perguntas: ['Curto ou longo para o verão?', 'Qual desses tons você usaria?', 'Mudar tudo ou só um detalhe?'],
    pedidosFoto: ['o resultado de um atendimento, com luz de janela', 'a profissional trabalhando', 'o espaço do salão arrumado', 'produtos usados, lado a lado']
  },
  saude: {
    palavras: ['clínica', 'odonto', 'dentista', 'fisio', 'nutri', 'psicolog', 'médic', 'saúde', 'terapia', 'fono', 'consultório', 'veterin'],
    lugar: 'a clínica',
    coisas: ['o atendimento de hoje', 'a dúvida mais comum da semana', 'o cuidado que evita dor de cabeça', 'o check-up que muita gente esquece'],
    hashtags: ['#saudeemdia', '#prevencao', '#cuidadocomvoce', '#qualidadedevida', '#saudelocal'],
    tendencias: [
      { tema: 'Dúvidas reais respondidas', porque: 'Responder perguntas que os pacientes fazem gera confiança e salvamento.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Um dia na clínica', porque: 'Bastidores humanizam e reduzem o medo da primeira consulta.', formato: 'reels', sinal: 'subindo' },
      { tema: 'Sinais de alerta', porque: 'Listas de sinais que pedem atenção são muito compartilhadas.', formato: 'carrossel', sinal: 'estável' },
      { tema: 'Caixinha de perguntas', porque: 'Perguntas nos stories viram pauta e aumentam a entrega do perfil.', formato: 'story', sinal: 'estável' },
      { tema: 'Apresentar a equipe', porque: 'Conhecer quem atende é decisivo na escolha do profissional.', formato: 'foto', sinal: 'subindo' }
    ],
    dicas: [
      { titulo: 'Sinais para não deixar para depois', itens: ['Dor que volta sempre', 'Cansaço fora do normal', 'Mudança de apetite', 'Sono que não descansa'] },
      { titulo: 'Como aproveitar melhor a consulta', itens: ['Anote suas dúvidas antes', 'Leve exames antigos', 'Liste os remédios que usa', 'Pergunte até entender'] }
    ],
    perguntas: ['Qual dúvida você quer que a gente responda?', 'Você faz check-up todo ano?', 'Manhã ou tarde para consultar?'],
    pedidosFoto: ['a recepção arrumada e iluminada', 'a equipe sorrindo, sem pose', 'um equipamento ou detalhe do consultório', 'a fachada com o nome visível']
  },
  fitness: {
    palavras: ['academia', 'crossfit', 'pilates', 'personal', 'yoga', 'dança', 'treino', 'funcional', 'luta', 'natação', 'box', 'corrida'],
    lugar: 'o estúdio',
    coisas: ['o treino de hoje', 'a turma das 7h', 'o exercício da semana', 'a evolução de quem começou'],
    hashtags: ['#treinoemdia', '#vidasaudavel', '#movimento', '#foco', '#treinofuncional'],
    tendencias: [
      { tema: 'Exercício explicado em 3 passos', porque: 'Execução correta explicada simples é salva e reenviada.', formato: 'reels', sinal: 'forte' },
      { tema: 'Desafio da semana', porque: 'Desafios geram participação e marcações de amigos.', formato: 'story', sinal: 'subindo' },
      { tema: 'Erros comuns', porque: 'Conteúdo de correção de postura gera comentário e salvamento.', formato: 'carrossel', sinal: 'estável' },
      { tema: 'Aluno da vez', porque: 'Histórias de alunos reais inspiram quem ainda não começou.', formato: 'foto', sinal: 'subindo' },
      { tema: 'Treino para fazer em casa', porque: 'Quem viaja ou falta procura alternativas rápidas.', formato: 'carrossel', sinal: 'estável' }
    ],
    dicas: [
      { titulo: 'Voltar a treinar sem se machucar', itens: ['Comece com metade da carga', 'Aqueça de verdade', 'Durma bem na véspera', 'Respeite a dor diferente'] },
      { titulo: 'Treino curto que funciona', itens: ['20 minutos bastam', 'Circuito de 4 exercícios', 'Descanso curto', 'Constância vence intensidade'] }
    ],
    perguntas: ['Treino de manhã ou à noite?', 'Qual exercício você mais odeia?', 'Topa o desafio desta semana?'],
    pedidosFoto: ['a turma treinando, com movimento', 'um aluno em ação, de perto', 'o espaço vazio antes de abrir', 'equipamentos arrumados']
  },
  servicos: {
    palavras: ['consultor', 'contab', 'advoca', 'imobili', 'marketing', 'agência', 'escola', 'curso', 'arquitet', 'engenh', 'serviço', 'assessoria', 'seguro', 'viagem', 'turismo', 'fotograf'],
    lugar: 'o escritório',
    coisas: ['o projeto entregue esta semana', 'a dúvida que mais chega', 'o erro que dá para evitar', 'o passo a passo que a gente usa'],
    hashtags: ['#empreendedorismo', '#pequenosnegocios', '#dicaprofissional', '#bastidores', '#trabalhobemfeito'],
    tendencias: [
      { tema: 'Erros que custam caro', porque: 'Listas de erros evitáveis são salvas e reenviadas para sócios e colegas.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Bastidores de um projeto', porque: 'Mostrar o processo prova competência sem precisar se vender.', formato: 'reels', sinal: 'subindo' },
      { tema: 'Pergunta da semana', porque: 'Responder dúvidas reais posiciona como referência.', formato: 'foto', sinal: 'estável' },
      { tema: 'Checklist prático', porque: 'Material de consulta rápida é o formato mais salvo em perfis de serviço.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Quem está por trás', porque: 'Rosto e história do time aumentam a confiança para fechar.', formato: 'story', sinal: 'estável' }
    ],
    dicas: [
      { titulo: 'Antes de contratar, pergunte', itens: ['O que está incluso', 'Qual o prazo real', 'Quem vai me atender', 'Como é o pós-entrega'] },
      { titulo: 'Organize a semana em 15 minutos', itens: ['Liste as 3 prioridades', 'Bloqueie horário para elas', 'Agrupe reuniões', 'Revise na sexta'] }
    ],
    perguntas: ['Qual dúvida trava seu negócio hoje?', 'Você prefere reunião ou mensagem?', 'O que a gente explica no próximo post?'],
    pedidosFoto: ['a mesa de trabalho com um projeto real', 'a equipe em reunião, sem pose', 'um detalhe de uma entrega', 'o espaço de atendimento']
  },
  pet: {
    palavras: ['pet', 'cachorro', 'gato', 'banho e tosa', 'tosa', 'ração', 'adestr', 'petshop', 'animal'],
    lugar: 'o pet shop',
    coisas: ['o banho de hoje', 'o cliente de quatro patas da semana', 'o cuidado que ele agradece', 'a novidade da prateleira'],
    hashtags: ['#vidadepet', '#amopets', '#petshop', '#banhoetosa', '#cachorrofeliz'],
    tendencias: [
      { tema: 'Antes e depois do banho', porque: 'Transformações de pet são das mais compartilhadas do nicho.', formato: 'reels', sinal: 'forte' },
      { tema: 'Cliente da semana', porque: 'Tutores compartilham quando o pet aparece no perfil.', formato: 'foto', sinal: 'subindo' },
      { tema: 'Cuidados no calor', porque: 'Dicas sazonais são salvas e reenviadas entre tutores.', formato: 'carrossel', sinal: 'estável' },
      { tema: 'Enquete: qual petisco?', porque: 'Enquetes rápidas movimentam os stories.', formato: 'story', sinal: 'estável' },
      { tema: 'Mitos da alimentação', porque: 'Formato mito ou verdade gera debate nos comentários.', formato: 'carrossel', sinal: 'subindo' }
    ],
    dicas: [
      { titulo: 'Seu pet no calor', itens: ['Passeio cedo ou à noite', 'Água fresca sempre', 'Nada de asfalto quente', 'Sombra no quintal'] },
      { titulo: 'Banho em casa sem estresse', itens: ['Água morna', 'Shampoo próprio para pet', 'Seque bem as orelhas', 'Petisco no final'] }
    ],
    perguntas: ['Seu pet ama ou odeia banho?', 'Gato ou cachorro?', 'Qual o nome mais criativo que você já viu?'],
    pedidosFoto: ['um pet depois do banho, bem de perto', 'a equipe com um cliente peludo', 'a prateleira de produtos', 'a entrada da loja']
  },
  geral: {
    palavras: [],
    lugar: 'a empresa',
    coisas: ['o que a gente fez hoje', 'a novidade da semana', 'o detalhe que faz diferença', 'o nosso jeito de trabalhar'],
    hashtags: ['#negociolocal', '#bastidores', '#feitocomcuidado', '#compredopequeno', '#novidade'],
    tendencias: [
      { tema: 'Bastidores do dia a dia', porque: 'Mostrar o processo real aproxima e gera conversa.', formato: 'reels', sinal: 'subindo' },
      { tema: 'Perguntas frequentes em carrossel', porque: 'Responder dúvidas comuns é salvo para consulta.', formato: 'carrossel', sinal: 'forte' },
      { tema: 'Enquete nos stories', porque: 'Interação rápida aumenta a entrega dos próximos stories.', formato: 'story', sinal: 'estável' },
      { tema: 'Apresentar quem faz', porque: 'Rostos da equipe criam confiança.', formato: 'foto', sinal: 'subindo' },
      { tema: 'Dica prática do seu ramo', porque: 'Conteúdo útil atrai quem ainda não conhece o perfil.', formato: 'carrossel', sinal: 'estável' }
    ],
    dicas: [
      { titulo: 'O que perguntar antes de comprar', itens: ['O que está incluso', 'Qual o prazo', 'Como funciona a troca', 'Quem atende depois'] },
      { titulo: 'Três coisas que a gente faz diferente', itens: ['Atendimento de gente para gente', 'Prazo combinado é prazo cumprido', 'Cuidado em cada detalhe'] }
    ],
    perguntas: ['O que você quer ver por aqui?', 'Como você conheceu a gente?', 'Qual novidade você quer primeiro?'],
    pedidosFoto: ['o seu produto ou serviço em uso', 'a equipe trabalhando', 'a fachada ou o espaço', 'um detalhe bonito do que vocês fazem']
  }
};

export function nichoDe(texto = '') {
  const t = texto.toLowerCase();
  for (const [id, n] of Object.entries(NICHOS)) {
    if (n.palavras.some((p) => t.includes(p))) return { id, ...n };
  }
  return { id: 'geral', ...NICHOS.geral };
}
