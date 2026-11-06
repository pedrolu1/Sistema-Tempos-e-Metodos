# Rotina das primárias: WhatsApp → RDO, Curva S e Gestão Visual

O Claude, no seu computador, lê o grupo das primárias no WhatsApp Web, te mostra o
avanço do dia para conferir e preenche as três planilhas pelo próprio Excel. Sai do dia:
o RDO em PDF, o gráfico da Curva S em PNG e o mapa da bateria em PDF.

## Instalar (uma vez)

1. Copie esta pasta para o computador, por exemplo `C:\Primarias\rotina`.
2. Copie `config.exemplo.json` para `config.json` e troque os três caminhos das
   planilhas e o nome do grupo (ou mande os caminhos e o nome que eu preencho).
3. Deixe o WhatsApp Web logado no Chrome.
4. No app Claude do computador, use o modo com acesso ao computador e à pasta
   `C:\Primarias`, com o Chrome liberado.
5. Primeiro teste: peça "rode a rotina das primárias de hoje em modo simulação". Ele
   trabalha em cópias; confira o PDF do RDO antes de rodar de verdade.

## Todo dia

Crie uma tarefa agendada no app Claude, de segunda a sexta no fim do turno, com o texto:

> Rode a rotina das primárias de hoje seguindo C:\Primarias\rotina\SKILL.md

Ele lê o grupo, te mostra o resumo e só preenche depois do seu "ok".

## Regras que o script segue

- Curva S só de revestimento e só em fornos: o forno conta quando as 6 primárias têm a
  massa 1200, na semana em que a última foi feita. Semana sem revestimento fica com zero.
- Só recalcula do BM atual em diante (16 a 15); BM já medido não é reescrito.
- Gestão Visual: datas de demolição, instalação (assentamento/concretagem) e
  revestimento (início = Injetbar, fim = massa 1200) por primária; andaime SIM/NÃO.
- RDO: nova aba a partir da última, com atividades por etapa, efetivo, clima, materiais
  (anterior = acumulado do RDO anterior; aplicado = primárias × consumo) e observações.
- Antes de mexer, faz cópia de segurança das planilhas em `pastaBackup`.
