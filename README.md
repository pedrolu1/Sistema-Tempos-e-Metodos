# REFRAMAX — Tempos & Métodos

Sistema de lançamento, gestão e análise de dados de Tempos e Métodos industriais.
Um único app web (PWA) que funciona como **aplicativo mobile instalável** para
quem lança apontamentos em campo — online ou offline, com sincronização
automática — e como **painel administrador** para quem gerencia cadastros,
aprova acessos, acompanha o dashboard e exporta relatórios.

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

### Netlify

Importe o repositório — `netlify.toml` já define o build. Adicione as mesmas
variáveis de ambiente em *Site settings → Environment variables*.

### Firebase Hosting

`firebase deploy --only hosting` (depois de `npm run build`).

## Estrutura do projeto

```
src/
  lib/            # Firebase, autenticação, coleções (colaboradores, atividades,
                   # lançamentos), sincronização, exportação
  components/      # UI reutilizável (botões, modais, seletor de colaboradores,
                   # gráficos do dashboard)
  pages/
    AuthScreens.js       # login, cadastro, tela de aprovação pendente
    mobile/               # app mobile: lançar + consultar/sincronizar
    admin/                # painel admin: dashboard, lançamentos, cadastros, usuários
  styles/          # design system (tokens, componentes, layout)
  utils/           # helpers de DOM, formatação, ícones
firestore.rules             # regras de segurança
firestore.indexes.json      # índices compostos necessários
```

## Como o app decide qual "versão" mostrar

Não existem dois apps separados: é o **papel do usuário aprovado** que decide
a experiência exibida após o login —

- `role: "admin"` → painel administrador (dashboard, cadastros, usuários, todos
  os lançamentos, exportação).
- `role: "lider"` → app de lançamento (a "versão mobile"), pensado para uso no
  celular mas funciona em qualquer tela.

## Como funciona o offline-first

O Firestore é inicializado com cache local persistente
(`persistentLocalCache`). Isso quer dizer que:

- Lançar um apontamento sem internet grava instantaneamente no aparelho.
- Assim que a rede volta, o próprio SDK sincroniza sozinho — sem fila manual.
- O botão de sincronizar (no centro da barra inferior do app mobile) dá uma
  confirmação visual explícita e mostra quantos lançamentos ainda estão
  pendentes.
- Um lançamento só pode ser editado/excluído pelo app mobile **antes** de ser
  confirmado pelo servidor (badge "Pendente"); depois de sincronizado
  ("Sincronizado"), só o administrador pode alterá-lo — pela tela
  **Lançamentos** do painel desktop.
