# REFRAMAX — Tempos & Métodos

Sistema de lançamento, gestão e análise de dados de Tempos e Métodos industriais.
Um único app web (PWA) que funciona como **aplicativo mobile instalável** para
quem lança apontamentos em campo — online ou offline, com sincronização
automática — e como **painel administrador** para quem planeja os projetos
(com as atividades, VA/DN/DNN, tempo padrão e equipe de cada uma), aprova
acessos, acompanha o dashboard e exporta relatórios.

## Stack

- **Frontend:** JavaScript puro (sem framework), Vite, CSS custom design system.
- **Backend:** Firebase (Authentication + Firestore), com persistência offline
  nativa do Firestore — é o próprio SDK que enfileira os lançamentos feitos sem
  internet e sobe tudo sozinho assim que a conexão volta.
- **PWA:** manifest + service worker (`vite-plugin-pwa`) — instalável no celular
  e no desktop, com o app shell em cache para abrir mesmo offline.
- **Exportação:** Excel (`xlsx`), PDF (`jsPDF`) e Word (`docx`) gerados no
  navegador, sem servidor.

## 1. Criar o projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e
   crie um novo projeto (pode desativar o Google Analytics, não é necessário).
2. No menu lateral, vá em **Build → Authentication → Sign-in method** e ative o
   provedor **E-mail/senha**.
3. Vá em **Build → Firestore Database → Criar banco de dados**. Escolha o modo
   **produção** (as regras de segurança do projeto já vêm prontas em
   `firestore.rules`) e a região mais próxima de você.
4. Ainda no console, vá em **Configurações do projeto → Geral → Seus apps** e
   clique em **Adicionar app → Web** (ícone `</>`). Dê um nome (ex.: "REFRAMAX
   Web") e copie o objeto `firebaseConfig` gerado.

## 2. Configurar o projeto localmente

```bash
npm install
cp .env.example .env
```

Abra `.env` e preencha com os valores do `firebaseConfig` copiado no passo
anterior:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Depois:

```bash
npm run dev
```

## 3. Publicar as regras de segurança do Firestore

As regras (`firestore.rules`) e os índices (`firestore.indexes.json`) do
projeto ficam versionados no repositório. Publique-os com a
[Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # selecione o projeto criado no passo 1
firebase deploy --only firestore:rules,firestore:indexes
```

Sem esse passo, o Firestore roda no modo padrão e o app não terá permissão
para ler/gravar nada.

## 4. Criar o primeiro administrador

Por segurança, **ninguém pode se autoaprovar** — nem tornar a própria conta
administradora — diretamente pelo app (é assim que o controle de acesso do
admin funciona de verdade). Isso significa que o primeiro administrador
precisa ser liberado manualmente, uma única vez:

1. Rode o app (`npm run dev` ou já publicado) e crie sua conta normalmente pela
   tela **Criar acesso**.
2. No console do Firebase, vá em **Firestore Database → dados** e abra a
   coleção `usuarios`. Você verá o documento criado com o seu `uid`.
3. Edite esse documento e mude os campos:
   - `status`: `"pendente"` → `"aprovado"`
   - `role`: `"lider"` → `"admin"`
4. Volte ao app — a tela atualiza sozinha (é tudo em tempo real) e você já
   entra como administrador. A partir daqui, qualquer novo acesso pode ser
   aprovado direto pela tela **Usuários** do painel admin.

## 5. Publicar (deploy)

O projeto já vem com configuração pronta para os principais provedores —
escolha um. Em qualquer um deles, o app usa roteamento por hash (`#/...`),
então não é necessário configurar rewrites de SPA, e o build já usa caminhos
relativos (`base: './'`), então funciona tanto na raiz de um domínio quanto
num subcaminho (GitHub Pages de projeto).

### GitHub Pages (já configurado — só falta ligar)

O repositório já inclui `.github/workflows/deploy.yml`: a cada push em `main`
(ou na branch `claude/industrial-time-methods-system-2sgf0q`), o GitHub Actions
builda o projeto e publica o resultado no GitHub Pages automaticamente. Faltam
dois passos únicos, que só o dono do repositório consegue fazer (não há API
para isso):

1. **Ativar o Pages:** em `Settings → Pages`, em "Build and deployment →
   Source", selecione **GitHub Actions**. Sem isso o workflow roda mas o
   último passo (publicar) falha.
2. **Adicionar as credenciais do Firebase como secrets:** em
   `Settings → Secrets and variables → Actions → New repository secret`,
   crie um secret para cada uma destas chaves (os mesmos valores do seu
   `.env`, veja o passo 1 e 2 deste README):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

Depois de configurar os dois itens acima, vá em `Actions → Deploy REFRAMAX →
Run workflow` para disparar manualmente (ou dê qualquer novo push). O link
final aparece em `Settings → Pages` e no resumo da execução do workflow.
Sem os secrets, o site sobe do mesmo jeito, só que mostrando a tela de
"Configuração pendente" até você preenchê-los.

### Vercel

Importe o repositório em [vercel.com/new](https://vercel.com/new). O
`vercel.json` já define build e output. Adicione as variáveis `VITE_FIREBASE_*`
em *Project Settings → Environment Variables* com os mesmos valores do `.env`.

### Netlify (para o hub do planejamento)

O projeto já existe na Netlify: **reframax-tempos-e-metodos**
(https://reframax-tempos-e-metodos.netlify.app). Falta ligá-lo ao GitHub, uma vez só:

1. Em app.netlify.com, abra o projeto → *Project configuration → Build & deploy →
   Continuous deployment → Link repository* → GitHub → `Sistema-Tempos-e-Metodos`.
2. Em *Branch to deploy*, escolha `claude/industrial-time-methods-system-2sgf0q`.
   Build e pasta já vêm do `netlify.toml`.
3. Em *Project configuration → Environment variables*, crie as mesmas 6 chaves
   `VITE_FIREBASE_*` do `.env` (e `VITE_APPCHECK_SITE_KEY`, se usar App Check).
4. Em *Deploys*, clique em *Trigger deploy*. Depois disso, cada push publica sozinho
   nos dois endereços (GitHub Pages e Netlify).

`public/_headers` libera o app para ser exibido dentro do hub
(`frame-ancestors`) e bloqueia qualquer outro site. Se o hub mudar de endereço,
atualize essa linha.

**No hub**, use um destes dois jeitos (o hub está em outra conta Netlify, então
não dá para colocar o app num subcaminho do endereço do hub):

- Botão/cartão com link (recomendado, principalmente no celular: instala, funciona
  offline e ocupa a tela toda):
  `<a href="https://reframax-tempos-e-metodos.netlify.app/" target="_blank" rel="noopener">REFRAMAX Tempos & Métodos</a>`
- Embutido na página do hub (bom para o painel no computador):
  `<iframe src="https://reframax-tempos-e-metodos.netlify.app/" style="width:100%;height:100vh;border:0" allow="clipboard-write; fullscreen"></iframe>`
  Dentro do hub, o login fica separado do app aberto direto, e não aparece a opção de instalar.

Se o login falhar no endereço novo: no Firebase, *Authentication → Settings →
Authorized domains*, adicione `reframax-tempos-e-metodos.netlify.app`; se usar App
Check, inclua o mesmo domínio na chave do reCAPTCHA.

### Firebase Hosting

`firebase deploy --only hosting` (depois de `npm run build`).

## Estrutura do projeto

```
src/
  lib/            # Firebase, coleções (projetos, lançamentos, estudos…), sincronização,
                  # assistentes por regras, saúde/auto-recuperação, auditoria, backup,
                  # exportação (Excel, PDF, Word, PowerPoint) e planilha de planejamento
  components/     # UI reutilizável (botões, modais, assistente passo a passo, gráficos)
  pages/
    AuthScreens.js   # login, cadastro, tela de aprovação pendente
    mobile/          # app de campo: lançar, estudos, consultar
    admin/           # painel: dashboard, assistente, projetos (com o editor de
                     # atividades), estudos, lançamentos, setores, usuários, sistema
    estudos/         # assistentes de cronoanálise, amostragem, MTM, takt/lead, histórico
  styles/         # design system (tokens, componentes, layout)
  utils/          # cálculos puros: formatação, planejamento, indicadores, estudos
firestore.rules             # regras de segurança (validação de campos, papéis, contratos)
firestore.indexes.json      # índices compostos necessários
```

## Como o app decide qual "versão" mostrar

Não existem dois apps separados: é o **papel do usuário aprovado** que decide
a experiência exibida após o login —

- `role: "admin"` → painel completo, inclusive aprovação de usuários.
- `role: "planejador"` → painel (planejamento, estudos, indicadores), sem a
  aprovação de usuários.
- `role: "lider"` → app de campo (apontador). Em **Usuários** o admin pode limitar
  os contratos que cada apontador enxerga.

## Segurança e manutenção

- **Regras do Firestore**: sempre que `firestore.rules` mudar, copie o arquivo
  inteiro em Firestore Database → Regras → Publicar.
- **Auditoria**: alterações e exclusões ficam registradas (página Sistema) e não
  podem ser editadas nem apagadas.
- **Saúde do app**: falhas e recuperações automáticas aparecem resumidas na
  página Sistema e no Assistente.
- **Backup**: página Sistema → "Fazer backup agora" (arquivo .json). O Assistente
  lembra quando passa de 7 dias.
- **App Check (opcional)**: no console do Firebase, App Check → registrar o app
  web com reCAPTCHA v3; copie a *site key* e crie o secret
  `VITE_APPCHECK_SITE_KEY` no GitHub (Settings → Secrets → Actions). Depois do
  próximo deploy, ative a "aplicação obrigatória" do Firestore no App Check.

## Como funciona o offline-first

O Firestore é inicializado com cache local persistente
(`persistentLocalCache`). Isso quer dizer que:

- Lançar um apontamento sem internet grava instantaneamente no aparelho.
- Assim que a rede volta, o próprio SDK sincroniza sozinho — sem fila manual.
- O botão de sincronizar (no centro da barra inferior do app mobile) dá uma
  confirmação visual explícita e mostra quantos lançamentos ainda estão
  pendentes.
- Na aba **Consultar** do celular, quem lançou pode editar ou excluir os
  próprios lançamentos a qualquer momento (o badge mostra "No celular" ou
  "Enviado"). O gestor edita qualquer um pela tela **Lançamentos** do painel.
  Toda alteração e exclusão fica registrada na auditoria.
- **Terminar depois**: ao lançar, a chave "Terminar depois" guarda o
  apontamento como "Em andamento" (só no celular de quem lançou, funciona sem
  internet e não entra nos indicadores). Ao tocar em **Finalizar**, o término
  vem com o horário atual e ele vira um lançamento normal.
