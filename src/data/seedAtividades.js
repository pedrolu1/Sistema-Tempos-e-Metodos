/**
 * Catálogo padrão de etapas produtivas, organizado por contrato — usado pelo
 * botão "Importar catálogo padrão" em Admin → Cadastros. Importar é seguro
 * de rodar mais de uma vez: itens que já existem (mesmo código) são ignorados.
 *
 * classificacao: 'VA' (Valor Agregado) marca as etapas que efetivamente
 * transformam a peça/estrutura (instalação, recomposição, acabamento); tudo
 * o mais (montagem/desmontagem de andaime, demolição/remoção de acesso,
 * limpeza, inspeção/medição) é 'DN' — necessário para viabilizar o trabalho,
 * mas não agrega valor por si só. É só um ponto de partida: revise e ajuste
 * item a item em Cadastros conforme o critério da sua operação.
 */
export const SEED_ATIVIDADES = [
  // ---- Reparo de Dutos Coletores (MONOLÍTICO) ----
  { codigo: 'M1', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Montagem dos andaimes para reparo de duto coletor' },
  { codigo: 'M2', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Instalação de chapa de piso' },
  { codigo: 'M3', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Abertura metálica de duto coletor' },
  { codigo: 'M4', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Posicionamento da chapa sobre o duto coletor vizinho' },
  { codigo: 'M5', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Desmontagem refratária e inserção de caixa fria' },
  { codigo: 'M6', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Limpeza sobre os andaimes' },
  { codigo: 'M7', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Preparação para a instalação do monolítico (mecânica)' },
  { codigo: 'M8', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Preparação para a instalação do monolítico (refratário)' },
  { codigo: 'M9', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Instalação do monolítico (mecânica)', classificacao: 'VA' },
  { codigo: 'M10', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Instalação do monolítico (refratário)', classificacao: 'VA' },
  { codigo: 'M11', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Ajuste e alinhamento do monolítico', classificacao: 'VA' },
  { codigo: 'M12', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Acabamento refratário do monolítico', classificacao: 'VA' },
  { codigo: 'M13', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Fechamento metálico do duto coletor', classificacao: 'VA' },
  { codigo: 'M14', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Remoção da chapa de piso' },
  { codigo: 'M15', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Rebaixamento dos andaimes' },
  { codigo: 'M16', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Instalação de chapa de piso' },
  { codigo: 'M17', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Abertura de janelas metálicas (2) para limpeza interna' },
  { codigo: 'M18', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Abertura de janelas refratárias (2) para limpeza interna' },
  { codigo: 'M19', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Limpeza interna do duto coletor' },
  { codigo: 'M20', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Endoscopia' },
  { codigo: 'M21', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Medido' },
  { codigo: 'M22', contrato: 'Reparo de Dutos Coletores', local: 'MONOLÍTICO', nome: 'Desmontagem dos andaimes' },

  // ---- Reparo de Cabeceiras do Forno (CABECEIRAS) ----
  { codigo: 'CLC1', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Soldagem do dispositivo e travamento da porta falsa no forno' },
  { codigo: 'CLC2', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Remoção do buckstay horizontal superior do forno' },
  { codigo: 'CLC3', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Remoção do protector plate superior do forno' },
  { codigo: 'CLC4', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Demolição refratária do lintel do forno (topo) + isolamento da abóbada inferior' },
  { codigo: 'CLC5', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Montagem de andaimes em frente ao forno para contenção e instalação de linha de vida' },
  { codigo: 'CLC6', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Demolição refratária da parede jamb side do forno lado direito + isolamento da parede remanescente' },
  { codigo: 'CLC7', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Demolição refratária da parede jamb side do forno lado esquerdo + isolamento da parede remanescente' },
  { codigo: 'CLC8', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Remoção do protector plate intermediário do forno (middle) lado direito' },
  { codigo: 'CLC9', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Remoção do protector plate intermediário do forno (middle) lado esquerdo' },
  { codigo: 'CLC10', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Demolição da soleira para reparo do protector plate inferior' },
  { codigo: 'CLC11', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Remoção do protector plate inferior do forno' },
  { codigo: 'CLC12', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação do protector plate inferior do forno', classificacao: 'VA' },
  { codigo: 'CLC13', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Recomposição refratária do protector plate inferior (assent. tijolos + concretagem)', classificacao: 'VA' },
  { codigo: 'CLC14', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação do protector plate intermediário do forno (middle) lado direito', classificacao: 'VA' },
  { codigo: 'CLC15', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação do protector plate intermediário do forno (middle) lado esquerdo', classificacao: 'VA' },
  { codigo: 'CLC16', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação do protector plate superior do forno', classificacao: 'VA' },
  { codigo: 'CLC17', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Recomposição da parede jamb side lado direito e instalação da peça especial', classificacao: 'VA' },
  { codigo: 'CLC18', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Recomposição da parede jamb side lado esquerdo e instalação da peça especial', classificacao: 'VA' },
  { codigo: 'CLC19', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Montagem do arco do lintel monolítico', classificacao: 'VA' },
  { codigo: 'CLC20', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação do buckstay horizontal superior do forno e troca das molas do buckstay vertical', classificacao: 'VA' },
  { codigo: 'CLC21', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação de forma metálica no forno para concretagem da abóbada inferior' },
  { codigo: 'CLC22', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Rejuntamento da abóbada inferior', classificacao: 'VA' },
  { codigo: 'CLC23', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação de guarda corpo e tela de proteção nos andaimes' },
  { codigo: 'CLC24', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Assentamento dos tijolos isolantes na abóbada do forno', classificacao: 'VA' },
  { codigo: 'CLC25', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação da chapa de divisão e concretagem das extremidades da abóbada do forno (topo)', classificacao: 'VA' },
  { codigo: 'CLC26', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Assentamento dos tijolos impermeabilizantes (densos - 70 pac) do forno', classificacao: 'VA' },
  { codigo: 'CLC27', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Aplicação de massa isolante (silplate 1200) na cabeceira do forno (calafetagem)', classificacao: 'VA' },
  { codigo: 'CLC28', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Instalação do guarda corpo ao final da passarela (somente LC)' },
  { codigo: 'CLC29', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Retirada da coifa de despoeiramento do forno (somente LM)' },
  { codigo: 'CLC30', contrato: 'Reparo de Cabeceiras do Forno', local: 'CABECEIRAS', nome: 'Montagem da coifa de despoeiramento do forno (somente LM)' },

  // ---- Instalação de Primárias (TOPO DOS FORNOS) ----
  { codigo: 'PR1', contrato: 'Instalação de Primárias', local: 'TOPO DOS FORNOS', nome: 'Montagem de andaimes para manutenção de primárias' },
  { codigo: 'PR2', contrato: 'Instalação de Primárias', local: 'TOPO DOS FORNOS', nome: 'Demolição refratária' },
  { codigo: 'PR3', contrato: 'Instalação de Primárias', local: 'TOPO DOS FORNOS', nome: 'Instalação das primárias novas', classificacao: 'VA' },
  { codigo: 'PR4', contrato: 'Instalação de Primárias', local: 'TOPO DOS FORNOS', nome: 'Revestimento da abóbada do forno', classificacao: 'VA' }
].map((item) => ({ ...item, tipo: 'produtiva', classificacao: item.classificacao === 'VA' ? 'VA' : 'DN' }));
