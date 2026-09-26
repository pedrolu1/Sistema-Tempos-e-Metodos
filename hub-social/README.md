# Pulso

Agência de marketing gerida por agentes de IA para Instagram e Facebook. O cliente cadastra a marca, conecta as redes, manda fotos reais do dia a dia e aprova os posts numa mesa de aprovação. Os agentes pesquisam, planejam, criam arte e legenda e publicam no melhor horário. Nada vai ao ar sem o ok de quem gerencia o hub.

## A equipe

| Agente | Cor | O que faz |
| --- | --- | --- |
| Radar | azul | Pesquisa na web (ferramenta de busca do Claude) e nos posts de maior engajamento das hashtags do nicho o que está em alta. |
| Compasso | amarelo | Escolhe as janelas de publicação pelos horários em que os seguidores estão online e decide a pauta de cada uma. |
| Traço | rosa | Olha as fotos do cliente (visão do Claude), escolhe layout, texto da arte e paleta. O app desenha a arte com as fontes e cores da marca. |
| Verbo | verde | Escreve legenda, chamada para ação e hashtags no tom da marca, com regras contra texto com cara de IA. |
| Disparo | laranja | Publica no Instagram e no Facebook só o que foi aprovado, no horário agendado. |
| Lupa | lilás | Lê os números da conta todo dia, monta o Painel e sugere o que mudar para crescer. |

## Telas

- **Entrar, criar conta, esqueci a senha e redefinir senha.** E-mail e senha, entrar com Google (modo real), medidor de força de senha, "manter conectado".
- **Onboarding em 5 etapas** com prévia ao vivo de um post: negócio, cara da marca (logo com extração automática de cores e 5 estilos de letra), jeito de falar, conexão com a Meta e ritmo de postagem, fotos.
- **Painel:** nota "Pulso da marca", gráfico de 30 dias, seguidores, alcance, engajamento, visitas e cliques com variação da semana, mapa de horários do público, sugestões da Lupa com botão de ação, meta semanal e sequência de semanas batendo a meta.
- **Mesa de aprovação:** pilha de posts. Arrastar para a direita aprova (carimbo), para a esquerda descarta, "Ajustar" pede outra versão ("texto mais curto", "outra foto" ou pedido livre). Legenda, chamada, hashtags, texto da arte, redes e horário editáveis. Atalhos de teclado.
- **Estúdio:** linha de produção ao vivo, cartão de cada agente com o que ele está fazendo agora e o que entregou, e o diário da equipe.
- **Agenda:** semana e mês, com arrastar para remarcar.
- **Acervo:** upload de fotos (análise de luz, cor e área livre para texto), "Criar post com esta foto" e os pedidos de foto do Traço.
- **Ajustes:** marca (com galeria de como cada layout fica com a sua marca), conexões e conta.

## Rodar agora (modo demonstração)

```bash
cd hub-social
npm install
npm run dev
```

Sem as variáveis do Firebase o app abre em modo demonstração: tudo roda no navegador, os agentes são simulados por regras e nada é publicado. Na tela de entrar, "Ver com dados de exemplo" abre uma conta pronta (Café Aurora). As duas fotos de exemplo em `public/exemplos` vêm do scikit-image e são CC0.

## Ligar o modo real

### 1. Firebase

1. Crie um projeto em console.firebase.google.com e mude para o plano **Blaze** (Cloud Functions que chamam APIs externas exigem esse plano).
2. Authentication: ative **E-mail/senha** e **Google**.
3. Crie o Firestore e o Storage.
4. Libere a leitura das imagens no navegador (o motor de artes desenha as fotos num canvas):
   ```bash
   gsutil cors set cors.json gs://SEU-BUCKET
   ```
5. Em Authentication, Modelos, Redefinição de senha, troque a URL de ação para o endereço do app (ex.: `https://SEU-PROJETO.web.app/`). O app entende o link e abre a tela "Criar senha nova".
6. Copie `.env.example` para `.env` e preencha com o `firebaseConfig` do app web.

### 2. App da Meta

1. Em developers.facebook.com crie um app do tipo **Empresa** com **Login do Facebook para Empresas**.
2. Em URIs de redirecionamento válidos, coloque `https://SEU-PROJETO.web.app/api/meta/retorno` (o `firebase.json` já reescreve esse caminho para a função `metaRetorno`).
3. Permissões usadas: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `read_insights`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `business_management`.
4. Enquanto o app estiver em desenvolvimento, só contas com função no app conseguem conectar. Para clientes de fora é preciso passar pela **Análise do App** da Meta com essas permissões.
5. O Instagram do cliente precisa ser **profissional** (comercial ou criador) e estar ligado a uma Página do Facebook.

### 3. Chaves e deploy

```bash
cd functions
npm install
cp .env.example .env            # META_APP_ID e META_REDIRECT_URI
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase functions:secrets:set META_APP_SECRET
firebase functions:secrets:set TOKEN_KEY    # openssl rand -base64 32
npm run verificar               # confere módulos e testa as chamadas ao Claude contra uma API falsa
cd ..
npm run build
firebase deploy
```

O modelo padrão dos agentes é `claude-opus-5` (troque com `CLAUDE_MODEL` no `functions/.env`). O fallback do lado do servidor está ligado: se o modelo recusar um pedido, a API refaz com o modelo reserva recomendado.

## Como funciona por dentro

- O app grava pedidos em `usuarios/{uid}/execucoes` e a função `processarExecucao` faz a equipe trabalhar (rodada completa, post a partir de foto ou ajuste).
- Foto nova no acervo dispara `aoCriarFoto`: o Traço descreve a foto e, se algum post estava esperando foto, usa na hora.
- Aprovar na Mesa desenha a arte final no navegador (JPEG 1080x1350 ou 1080x1920), sobe para o Storage e marca o post como agendado. A função `disparo` roda a cada 5 minutos e publica o que chegou a hora.
- `lupaDiaria` lê os números às 7h10 (horário de Brasília).
- Os tokens da Meta ficam cifrados (AES-256-GCM) em `segredos/{uid}`, coleção que as regras do Firestore bloqueiam para o app. As regras também impedem o app de marcar um post como publicado.

### Por que conexão pela Meta e não login e senha das redes

Guardar a senha do Instagram e do Facebook do cliente fere os termos das duas redes, faz a conta cair em verificação de segurança e vira um risco enorme se o banco vazar. A conexão oficial dá só as permissões necessárias e pode ser revogada pelo cliente a qualquer momento.

### Por que motor de artes próprio e não Canva

Pelo que a documentação do Canva indica hoje, o preenchimento automático de modelos pela API depende de modelos de marca do plano Enterprise, montados à mão. O motor em `src/render/renderizador.js` desenha as peças direto no navegador com as fotos reais do cliente, fontes e cores da marca e acabamento de peça feita à mão (grão de impressão, fita adesiva, sublinhado de marcador, bilhete manuscrito, leve rotação), sem nenhuma imagem gerada por IA.

## O que ainda não faz

- Carrossel e reels (hoje: post de feed com uma imagem e story de imagem).
- Stories com figurinha de link ou enquete (a API da Meta não publica figurinhas).
- Escolher entre várias Páginas do Facebook na conexão (usa a primeira que tem Instagram ligado).
- A integração com a Meta e com o Claude não foi testada contra as APIs reais neste repositório, porque não havia credenciais. As chamadas ao Claude são conferidas pelo teste offline; nomes de métricas da Meta mudam entre versões da Graph API, e cada métrica é lida de forma tolerante (se faltar, o Painel mostra "sem dado").

## Estrutura

```
hub-social/
  src/
    pages/           telas (auth, onboarding, Painel, Mesa, Estúdio, Agenda, Acervo, Ajustes)
    render/          motor de artes (canvas) e pares de fontes
    lib/demo/        backend do modo demonstração
    lib/firebase/    backend do modo real
    lib/imagem.js    análise de foto no navegador (foco, área livre para texto, paleta)
  functions/
    agentes/         radar, compasso, traco, verbo, disparo, lupa, orquestra
    lib/             Claude, Graph API, criptografia, horários
  firestore.rules, storage.rules, firestore.indexes.json, cors.json, firebase.json
```
