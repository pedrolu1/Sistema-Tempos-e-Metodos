---
name: rotina-primarias
description: Rotina diária do contrato das primárias (REFRAMAX, coqueria Ternium). Lê o grupo das primárias no WhatsApp Web, interpreta o avanço dos líderes, mostra para o planejador conferir e preenche o RDO, a Curva S de revestimento e a Gestão Visual nas planilhas Excel dele. Use quando pedirem "rode a rotina das primárias", "faz o RDO de hoje", "atualiza a curva e o mapa" ou quando a tarefa agendada disparar.
---

# Rotina diária das primárias

Os arquivos desta pasta: `config.json` (caminhos e parâmetros), `preencher-primarias.ps1`
(preenche as planilhas pelo Excel), `dia.exemplo.json` (formato do dia).

Fale com o planejador de forma curta e objetiva, em português, sem travessão.

## 1. Preparar

1. Leia `config.json`. Se ele não existir, copie `config.exemplo.json` para `config.json`
   e peça ao planejador os caminhos das três planilhas e o nome do grupo.
2. Data alvo: hoje, a não ser que o planejador diga outra.

## 2. Ler o grupo (só leitura)

1. No Chrome, abra https://web.whatsapp.com (a sessão já fica logada) e o grupo
   `grupoWhatsApp` do config.
2. Role até a primeira mensagem da data alvo e leia todas as mensagens daquele dia:
   texto, legenda de foto e documento. Áudio sem transcrição: anote que existe e de quem é.
3. **Nunca** envie mensagem, reaja, apague, encaminhe ou mexa nas configurações do grupo.
4. Salve as mensagens lidas (hora, autor, texto) em
   `pastaDias\mensagens-AAAA-MM-DD.txt`.

## 3. Interpretar

Monte `pastaDias\dia-AAAA-MM-DD.json` no formato de `dia.exemplo.json`.

**Etapas** (campo `etapa`), na ordem do serviço:

| etapa | palavras que costumam aparecer |
|---|---|
| `montagem_andaime` | montagem de andaime, andaime montado, montamos andaime, andaime liberado |
| `desmontagem_andaime` | desmontagem, andaime desmontado, desmontamos |
| `demolicao` | demolição, demolido, demolimos, retirada/quebra das manilhas |
| `assentamento` | assentamento, assentada, concretagem, concretado, instalação, manilha instalada |
| `injetbar` | Injetbar, IBAR, sílica, primeira camada do revestimento |
| `massa1200` | massa 1200, Silplate, revestimento final/concluído |

"Revestimento" sozinho, sem dizer se é Injetbar ou massa 1200, vai para `duvidas`.

**Locais** (campo `locais`), sempre da bateria do config:
- forno inteiro `B6-F07`; um lado `B6-F07-LM`; uma primária `B6-F07-LM-P01`.
- P01, P02 e P03 são sempre do lado máquina (LM); P04, P05 e P06 do lado coque (LC).
- Aceite variações: "bloco 6", "BL6", "forno 7", "FR 7", "F07", "lado máquina", "lado coque",
  "LM/LC", "ambos os lados", "P1 a P3", "F5 ao F8" (vira F05, F06, F07, F08).
- Andaime é por lado: forno sem lado = os dois lados.
- Sem bloco, sem forno ou sem etapa claros: não chute. Vai para `duvidas` com a mensagem original.

**Outros campos:**
- `observacoesRdo`: um parágrafo em maiúsculas que começa com "A REFRAMAX INFORMA QUE",
  com o 5S (limpeza, organização, segregação de material), paralisações, falta de material,
  interferências e o que mais for relevante para o cliente. Sem nomes de pessoas.
- `efetivo`: só se alguém informar o efetivo do dia; use os nomes de função do RDO
  (Líder de Manutenção, Operador de Manutenção Refratária, Montador de Andaimes,
  Operador de Caminhão Munck e as funções da mão de obra indireta). Sem informação, deixe fora:
  o script repete o do dia anterior e avisa.
- `clima`: `chuvoso` se falarem de chuva no turno; senão `estavel`.
- `desvio`: só se houve baixa produção com motivo dito no grupo:
  `{ "empresa": "Reframax" | "Ternium" | "Não aplicável", "motivo": "...", "obs": "..." }`.
  Motivos já usados: Falta de material, Preparação e abastecimento, 5S obrigatório,
  Alteração de estratégia, Equipe atendimento ao Alto Forno, Absenteísmo, Baixa produtividade,
  Manobra para medição, Falha na logística, Calor extremo, Acidente de trabalho,
  Treinamentos operacionais, Tempo chuvoso, Interferência de andaimes, Restrição de acesso (FTE).
- `fonte` em cada avanço: hora, autor e trecho da mensagem que justifica o lançamento.

## 4. Conferência (obrigatória)

Mostre ao planejador, curto:
- uma linha por etapa com os locais (ex.: "Demolição: B6 F09 LM/LC, B6 F10 LM");
- o texto das observações do RDO;
- efetivo e clima;
- as dúvidas, uma por linha, com a mensagem original.

Espere ele responder "ok" ou corrigir. **Não rode o script sem a confirmação.**

## 5. Preencher as planilhas

As planilhas precisam estar fechadas no Excel. Rode no PowerShell:

```
powershell -NoProfile -ExecutionPolicy Bypass -File "<esta pasta>\preencher-primarias.ps1" -Dia "<pastaDias>\dia-AAAA-MM-DD.json" -Config "<esta pasta>\config.json"
```

Na primeira vez (ou depois de mudar o script), rode antes com `-Simular`: ele trabalha em
cópias dentro de `pastaSaida\AAAA-MM-DD\simulacao` e não toca nas originais. Mostre o PDF do
RDO gerado e só então rode de verdade.

O script faz cópia de segurança em `pastaBackup` antes de mexer, e pode ser rodado de novo
para o mesmo dia (atualiza a mesma aba do RDO e as mesmas datas).

## 6. Responder

Leia `pastaSaida\AAAA-MM-DD\resumo.json` e responda em poucas linhas:
- RDO nº e o caminho do PDF;
- fornos que fecharam no dia;
- semana: realizado × previsto; BM: realizado × meta (`metaFornosBm`);
- os avisos do script.

## Se der erro

Leia a mensagem, corrija `preencher-primarias.ps1` (mantenha o arquivo em UTF-8 com BOM),
rode com `-Simular` e só depois de verdade. Nunca apague as cópias de `pastaBackup`.
