<#
Preenche as planilhas do contrato das primárias a partir do avanço de um dia
(dia.json), usando o próprio Excel do computador. Assim o gráfico da Curva S,
o logo do RDO, as macros e a formatação condicional do mapa continuam intactos.

O que faz, nesta ordem:
  1. Faz cópia de segurança das três planilhas.
  2. Gestão Visual: datas de demolição, instalação (assentamento/concretagem)
     e revestimento (Injetbar e massa 1200) de cada primária, andaime SIM/NÃO,
     linha do dia no "Banco de Dados (Resumo)" e "Atualizado em".
  3. Curva S: fornos concluídos por semana (forno = as 6 primárias com massa
     1200), do BM atual em diante; zero nas semanas sem revestimento; atualiza
     a tabela dinâmica e o gráfico.
  4. RDO: cria a aba do dia (cópia da última), atividades, efetivo, clima,
     materiais (anterior, aplicado) e observações.
  5. Exporta o RDO em PDF, o gráfico da Curva S em PNG e o mapa em PDF.
  6. Grava resumo.json com o que mudou e os avisos.

Uso (PowerShell do Windows):
  powershell -ExecutionPolicy Bypass -File preencher-primarias.ps1 -Dia C:\...\dia-2026-11-06.json -Config C:\...\config.json
  Acrescente -Simular para trabalhar em cópias (nada nas planilhas originais muda).

Este arquivo precisa ficar salvo em UTF-8 com BOM (o Windows PowerShell 5.1
lê os acentos errado sem isso).
#>
param(
  [Parameter(Mandatory = $true)][string]$Dia,
  [Parameter(Mandatory = $true)][string]$Config,
  [switch]$Simular
)

$ErrorActionPreference = 'Stop'
$avisos = New-Object System.Collections.ArrayList
function Aviso([string]$t) { [void]$avisos.Add($t); Write-Host "AVISO: $t" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# Constantes das planilhas (colunas 1 = A)
# ---------------------------------------------------------------------------
$ETAPAS = @('montagem_andaime', 'desmontagem_andaime', 'demolicao', 'assentamento', 'injetbar', 'massa1200')
$TITULO_ETAPA = @{
  montagem_andaime    = 'MONTAGEM DE ANDAIME'
  desmontagem_andaime = 'DESMONTAGEM DE ANDAIME'
  demolicao           = 'DEMOLIÇÃO DAS MANILHAS'
  assentamento        = 'ASSENTAMENTO / CONCRETAGEM DAS MANILHAS'
  injetbar            = 'REVESTIMENTO COM INJETBAR'
  massa1200           = 'REVESTIMENTO COM MASSA 1200'
}
# Banco de Dados (Gestão Visual)
$BD_PRIMEIRA = 32
$C_BLOCO = 5; $C_LADO = 6; $C_FORNO = 7; $C_PRIM = 8; $C_ANDAIME = 11
$C_INI_DEMO = 12; $C_FIM_DEMO = 13; $C_INI_INST = 15; $C_FIM_INST = 16; $C_INI_REV = 18; $C_FIM_REV = 19
$C_CONTRATO = 22; $C_MEDICAO = 23
# Materiais do RDO (linhas 47 a 51) e consumo por primária na etapa (aba RASCUNHO)
$MATERIAIS = @(
  @{ linha = 47; etapa = 'assentamento'; porPrimaria = 1 },    # manilha refratária (PÇ)
  @{ linha = 48; etapa = 'assentamento'; porPrimaria = 50 },   # concreto isolante Cast Fire I RC (KG)
  @{ linha = 49; etapa = 'assentamento'; porPrimaria = 25 },   # concreto denso Didurit F55-5-BR (KG)
  @{ linha = 50; etapa = 'injetbar'; porPrimaria = 30 },       # sílica líquida Injetbar CK (KG)
  @{ linha = 51; etapa = 'massa1200'; porPrimaria = 100 }      # massa Silplate 1200 WR (KG)
)
$xlUp = -4162; $xlCenter = -4108; $xlTop = -4160; $xlLeft = -4131; $xlNone = -4142; $xlContinuous = 1; $xlThin = 2

# ---------------------------------------------------------------------------
# Funções puras
# ---------------------------------------------------------------------------
function Ler-Json([string]$caminho) { Get-Content -LiteralPath $caminho -Raw -Encoding UTF8 | ConvertFrom-Json }

function Para-Data($v) {
  if ($null -eq $v -or $v -eq '') { return $null }
  if ($v -is [double]) { return [DateTime]::FromOADate($v) }
  if ($v -is [DateTime]) { return $v.Date }
  $s = [string]$v
  if ($s -match '^(\d{2})/(\d{2})/(\d{4})') { return (Get-Date -Year $matches[3] -Month $matches[2] -Day $matches[1]).Date }
  if ($s -match '^(\d{4})-(\d{2})-(\d{2})') { return (Get-Date -Year $matches[1] -Month $matches[2] -Day $matches[3]).Date }
  return $null
}

# Número da semana igual ao WEEKNUM(data; 2) do Excel (semana começa na segunda), como a coluna H da Curva S
function Rotulo-Semana([DateTime]$d) {
  $cal = [System.Globalization.CultureInfo]::InvariantCulture.Calendar
  return 'S-{0:D2}' -f $cal.GetWeekOfYear($d, [System.Globalization.CalendarWeekRule]::FirstDay, [DayOfWeek]::Monday)
}

# Boletim de medição: do dia 16 ao dia 15 do mês seguinte ("2026_11" = 16/10 a 15/11)
function Bm([DateTime]$d) {
  $m = $d
  if ($d.Day -ge 16) { $m = $d.AddMonths(1) }
  return '{0:yyyy}_{0:MM}' -f $m
}

# "B6-F07-LM-P01", "B6-F07-LM", "B6-F07-LM/LC", "B6-F07" -> lista de primárias "B6-F07-LM-P01"...
function Expandir-Local([string]$local) {
  $t = ($local.ToUpper() -replace '\s', '' -replace '_', '-')
  if ($t -notmatch '^([A-C][1-8])-?F(\d{1,2})(?:-?(LM/LC|LC/LM|LM|LC))?(?:-?P(\d{1,2}))?$') { return $null }
  $bloco = $matches[1]; $forno = 'F{0:D2}' -f [int]$matches[2]; $lado = $matches[3]; $p = $matches[4]
  if ([int]$matches[2] -lt 1 -or [int]$matches[2] -gt 18) { return $null }
  $prims = @()
  if ($p) {
    $n = [int]$p
    if ($n -lt 1 -or $n -gt 6) { return $null }
    $prims = @($n)
  } elseif ($lado -eq 'LM') { $prims = 1..3 }
  elseif ($lado -eq 'LC') { $prims = 4..6 }
  else { $prims = 1..6 }
  $saida = @()
  foreach ($n in $prims) {
    $ld = 'LC'; if ($n -le 3) { $ld = 'LM' }
    if ($lado -and $lado.Length -eq 2 -and $lado -ne $ld) { return $null }   # P05 no lado máquina, por exemplo
    $saida += ('{0}-{1}-{2}-P{3:D2}' -f $bloco, $forno, $ld, $n)
  }
  return $saida
}

# Linhas do RDO no formato da planilha: forno inteiro "B6 - F05 - LM/LC", lado inteiro
# "B6 - F05 - LM" e primárias soltas "B6 - F05 - LM - P01, P02". Andaime é por lado.
function Linhas-Rdo([string[]]$prims, [string]$etapa) {
  $porForno = [ordered]@{}
  foreach ($id in ($prims | Sort-Object -Unique)) {
    $partes = $id.Split('-')
    $f = '{0} - {1}' -f $partes[0], $partes[1]
    if (-not $porForno.Contains($f)) { $porForno[$f] = New-Object System.Collections.ArrayList }
    [void]$porForno[$f].Add($partes)
  }
  $linhas = @()
  foreach ($f in $porForno.Keys) {
    $ps = $porForno[$f]
    $lm = @($ps | Where-Object { $_[2] -eq 'LM' } | ForEach-Object { $_[3] } | Sort-Object)
    $lc = @($ps | Where-Object { $_[2] -eq 'LC' } | ForEach-Object { $_[3] } | Sort-Object)
    $andaime = $etapa -like '*andaime'
    if ($ps.Count -eq 6 -or ($andaime -and $lm.Count -and $lc.Count)) { $linhas += "$f - LM/LC"; continue }
    foreach ($par in @(@('LM', $lm), @('LC', $lc))) {
      $lado = $par[0]; $lista = $par[1]
      if (-not $lista.Count) { continue }
      if ($andaime -or $lista.Count -eq 3) { $linhas += "$f - $lado" }
      else { $linhas += ('{0} - {1} - {2}' -f $f, $lado, ($lista -join ', ')) }
    }
  }
  return $linhas
}

function Abrir([object]$xl, [string]$caminho) {
  $wb = $xl.Workbooks.Open($caminho, 0, $false)
  if ($wb.ReadOnly) {
    $wb.Close($false)
    throw "A planilha está aberta em outro lugar (somente leitura): $caminho. Feche-a no Excel e rode de novo."
  }
  return $wb
}

function Celula([object]$ws, [int]$l, [int]$c) { return $ws.Cells.Item($l, $c) }

# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------
$cfg = Ler-Json $Config
$diaJson = Ler-Json $Dia
$data = Para-Data $diaJson.data
if (-not $data) { throw "dia.json sem 'data' no formato AAAA-MM-DD." }
$bateria = [string]$cfg.bateria
if ($diaJson.bateria) { $bateria = [string]$diaJson.bateria }
$oaData = $data.ToOADate()

# avanço do dia: etapa -> primárias (expande cabeceiras e fornos)
$doDia = @{}
foreach ($e in $ETAPAS) { $doDia[$e] = New-Object System.Collections.ArrayList }
foreach ($a in @($diaJson.avancos)) {
  if ($ETAPAS -notcontains $a.etapa) { Aviso "Etapa desconhecida '$($a.etapa)' ignorada."; continue }
  foreach ($local in @($a.locais)) {
    $prims = Expandir-Local ([string]$local)
    if (-not $prims) { Aviso "Local que não entendi: '$local' ($($a.etapa)). Ficou de fora."; continue }
    foreach ($p in $prims) {
      if (-not $p.StartsWith($bateria)) { Aviso "$p não é da bateria $bateria. Ficou de fora."; continue }
      if (-not $doDia[$a.etapa].Contains($p)) { [void]$doDia[$a.etapa].Add($p) }
    }
  }
}

$saida = Join-Path $cfg.pastaSaida ('{0:yyyy-MM-dd}' -f $data)
New-Item -ItemType Directory -Force -Path $saida | Out-Null
$arquivos = @{ visual = [string]$cfg.planilhas.gestaoVisual; curva = [string]$cfg.planilhas.curvaS; rdo = [string]$cfg.planilhas.rdo }
foreach ($k in @($arquivos.Keys)) { if (-not (Test-Path -LiteralPath $arquivos[$k])) { throw "Não achei a planilha ($k): $($arquivos[$k])" } }

# cópia de segurança (ou, no modo simulação, as cópias em que vamos trabalhar)
$pastaCopias = Join-Path $cfg.pastaBackup ('{0:yyyy-MM-dd_HHmm}' -f (Get-Date))
if ($Simular) { $pastaCopias = Join-Path $saida 'simulacao' }
New-Item -ItemType Directory -Force -Path $pastaCopias | Out-Null
foreach ($k in @($arquivos.Keys)) {
  $destino = Join-Path $pastaCopias (Split-Path $arquivos[$k] -Leaf)
  Copy-Item -LiteralPath $arquivos[$k] -Destination $destino -Force
  if ($Simular) { $arquivos[$k] = $destino }
}
Write-Host ("Cópias em {0}" -f $pastaCopias)

$resumo = [ordered]@{ data = ('{0:yyyy-MM-dd}' -f $data); simulacao = [bool]$Simular; etapas = [ordered]@{}; fornosConcluidosNoDia = @(); rdo = $null; arquivos = [ordered]@{}; avisos = $avisos }
foreach ($e in $ETAPAS) { $resumo.etapas[$e] = $doDia[$e].Count }

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$xl.AskToUpdateLinks = $false
try {
  # =========================================================================
  # 2. Gestão Visual
  # =========================================================================
  $wbV = Abrir $xl $arquivos.visual
  $bd = $wbV.Worksheets.Item('Banco de Dados')
  $ultima = $bd.Cells.Item($bd.Rows.Count, $C_BLOCO).End($xlUp).Row
  $vals = $bd.Range($bd.Cells.Item($BD_PRIMEIRA, $C_BLOCO), $bd.Cells.Item($ultima, $C_FIM_REV)).Value2   # E..S
  $off = $C_BLOCO - 1
  $linhaDe = @{}
  for ($i = 1; $i -le ($ultima - $BD_PRIMEIRA + 1); $i++) {
    $id = '{0}-{1}-{2}-{3}' -f $vals[$i, ($C_BLOCO - $off)], $vals[$i, ($C_FORNO - $off)], $vals[$i, ($C_LADO - $off)], $vals[$i, ($C_PRIM - $off)]
    $linhaDe[$id] = $i
  }
  # grava na planilha e na cópia em memória (usada para contar os fornos da curva)
  function Gravar-Data([int]$i, [int]$col, [bool]$soSeVazio) {
    $atual = $vals[$i, ($col - $off)]
    if ($soSeVazio -and $null -ne $atual -and $atual -ne '') { return }
    (Celula $bd ($BD_PRIMEIRA + $i - 1) $col).Value2 = $oaData
    $vals[$i, ($col - $off)] = $oaData
  }
  foreach ($e in $ETAPAS) {
    foreach ($p in $doDia[$e]) {
      if (-not $linhaDe.ContainsKey($p)) { Aviso "$p não existe no Banco de Dados."; continue }
      $i = $linhaDe[$p]
      $l = $BD_PRIMEIRA + $i - 1
      switch ($e) {
        'montagem_andaime' { (Celula $bd $l $C_ANDAIME).Value2 = 'SIM' }
        'desmontagem_andaime' { (Celula $bd $l $C_ANDAIME).Value2 = 'NÃO' }
        'demolicao' { Gravar-Data $i $C_INI_DEMO $true; Gravar-Data $i $C_FIM_DEMO $false }
        'assentamento' {
          if (-not $vals[$i, ($C_FIM_DEMO - $off)]) { Aviso "$p com assentamento sem demolição registrada." }
          Gravar-Data $i $C_INI_INST $true; Gravar-Data $i $C_FIM_INST $false
        }
        'injetbar' {
          if (-not $vals[$i, ($C_FIM_INST - $off)]) { Aviso "$p com Injetbar sem assentamento registrado." }
          Gravar-Data $i $C_INI_REV $true
        }
        'massa1200' {
          if (-not $vals[$i, ($C_INI_REV - $off)]) { Aviso "$p com massa 1200 sem Injetbar registrado; considerei o início do revestimento no mesmo dia." }
          Gravar-Data $i $C_INI_REV $true; Gravar-Data $i $C_FIM_REV $false
          (Celula $bd $l $C_MEDICAO).Value2 = (Bm $data)
          if ($cfg.contrato -and -not (Celula $bd $l $C_CONTRATO).Value2) { (Celula $bd $l $C_CONTRATO).Value2 = [string]$cfg.contrato }
        }
      }
    }
  }

  # fornos da bateria: concluído quando as 6 primárias têm o fim do revestimento; vale a data da última
  $conclusao = @{}
  $porForno = @{}
  foreach ($id in $linhaDe.Keys) {
    if (-not $id.StartsWith($bateria)) { continue }
    $f = $id.Substring(0, $id.LastIndexOf('-', $id.LastIndexOf('-') - 1))
    if (-not $porForno.ContainsKey($f)) { $porForno[$f] = @() }
    $porForno[$f] += $vals[$linhaDe[$id], ($C_FIM_REV - $off)]
  }
  foreach ($f in $porForno.Keys) {
    $datas = @($porForno[$f] | Where-Object { $_ -is [double] })
    if ($datas.Count -eq 6) { $conclusao[$f] = [DateTime]::FromOADate(($datas | Measure-Object -Maximum).Maximum).Date }
  }
  $resumo.fornosConcluidosNoDia = @($conclusao.Keys | Where-Object { $conclusao[$_] -eq $data } | Sort-Object)

  # linha do dia no resumo diário (cria se ainda não existir, copiando as fórmulas da primeira linha)
  $res = $wbV.Worksheets.Item('Banco de Dados (Resumo)')
  $linhaRes = $null; $ultimaRes = 3
  for ($l = 4; $l -le 289; $l++) {
    $v = (Celula $res $l 3).Value2
    if ($null -eq $v -or $v -eq '') { continue }
    $ultimaRes = $l
    if ([double]$v -eq $oaData) { $linhaRes = $l }
  }
  if (-not $linhaRes) {
    $linhaRes = $ultimaRes + 1
    if ($linhaRes -gt 289) { Aviso 'Resumo diário cheio (linha 289): a linha do dia não foi criada.'; $linhaRes = $null }
    else {
      $res.Range('D4:F4').Copy($res.Range("D$linhaRes")) | Out-Null
      $res.Range('H4').Copy($res.Range("H$linhaRes")) | Out-Null
      $res.Range('J4:M4').Copy($res.Range("J$linhaRes")) | Out-Null
      (Celula $res $linhaRes 3).Value2 = $oaData
      (Celula $res $linhaRes 3).NumberFormat = (Celula $res 4 3).NumberFormat
      (Celula $res $linhaRes 2).Value2 = (Bm $data)
    }
  }
  if ($linhaRes -and $diaJson.desvio) {
    if ($diaJson.desvio.empresa) { (Celula $res $linhaRes 14).Value2 = [string]$diaJson.desvio.empresa }
    if ($diaJson.desvio.motivo) { (Celula $res $linhaRes 15).Value2 = [string]$diaJson.desvio.motivo }
    if ($diaJson.desvio.obs) { (Celula $res $linhaRes 16).Value2 = [string]$diaJson.desvio.obs }
  }

  # "Atualizado em" do mapa da bateria
  $visual = $wbV.Worksheets.Item("Visual - Bat. $bateria")
  $achou = $visual.UsedRange.Find('ATUALIZADO EM:')
  if ($achou) {
    (Celula $visual ($achou.Row + 1) $achou.Column).Value2 = $oaData
    (Celula $visual ($achou.Row + 1) ($achou.Column + 2)).Value2 = (Get-Date).TimeOfDay.TotalDays
  } else { Aviso "Não achei 'ATUALIZADO EM:' na aba Visual - Bat. $bateria." }
  $xl.Calculate()
  $wbV.Save()
  $pdfMapa = Join-Path $saida ("Mapa-Bateria-{0}-{1:yyyy-MM-dd}.pdf" -f $bateria, $data)
  $visual.ExportAsFixedFormat(0, $pdfMapa)
  $resumo.arquivos.mapa = $pdfMapa
  $wbV.Close($false)

  # =========================================================================
  # 3. Curva S (só revestimento, em fornos)
  # =========================================================================
  $wbC = Abrir $xl $arquivos.curva
  $rev = $wbC.Worksheets.Item('BD - REV')
  $ultC = $rev.Cells.Item($rev.Rows.Count, 1).End($xlUp).Row
  $semanas = @()
  for ($l = 2; $l -le $ultC; $l++) {
    $ini = Para-Data (Celula $rev $l 5).Text
    $fim = Para-Data (Celula $rev $l 6).Text
    $bmIni = Para-Data (Celula $rev $l 3).Value2
    $bmFim = Para-Data (Celula $rev $l 4).Value2
    if ($ini -and $fim) {
      $semanas += [pscustomobject]@{ linha = $l; bm = [string](Celula $rev $l 1).Text; rotulo = [string](Celula $rev $l 8).Text; ini = $ini; fim = $fim; bmIni = $bmIni; bmFim = $bmFim; qtd = 0 }
    }
  }
  # Cada forno conta na linha da semana em que fechou, pelo número da semana (coluna H,
  # WEEKNUM tipo 2), como a planilha e a medição já fazem: um forno que fecha no dia 16
  # ainda entra na semana que começou antes do corte do BM.
  foreach ($f in $conclusao.Keys) {
    $d = $conclusao[$f]
    $rot = Rotulo-Semana $d
    $alvo = $semanas | Where-Object { $_.rotulo -eq $rot } | Select-Object -First 1
    if (-not $alvo) {
      $mesmoBm = @($semanas | Where-Object { $_.bmIni -and $d -ge $_.bmIni -and $d -le $_.bmFim })
      $alvo = $mesmoBm | Where-Object { $_.ini -le $d } | Select-Object -Last 1
      if (-not $alvo) { $alvo = $mesmoBm | Select-Object -First 1 }
    }
    if ($alvo) { $alvo.qtd++ } else { Aviso "Forno $f fechou em $('{0:dd/MM/yyyy}' -f $d), fora das semanas da Curva S." }
  }
  # Só recalcula do BM do dia em diante: BM já medido não é reescrito. Semana sem
  # revestimento fica com zero; semana que ainda não começou fica vazia.
  $semanaAtual = $semanas | Where-Object { $_.rotulo -eq (Rotulo-Semana $data) } | Select-Object -First 1
  $bmAtual = Bm $data
  if ($semanaAtual) { $bmAtual = $semanaAtual.bm }
  foreach ($s in $semanas) {
    if ($s.bm -lt $bmAtual) { continue }
    $cel = Celula $rev $s.linha 21   # U = REALIZADO
    if ($s.ini -le $data) { $cel.Value2 = $s.qtd } else { $cel.ClearContents() | Out-Null }
  }
  $atu = $wbC.Worksheets.Item('Atualização')
  (Celula $atu 2 2).Value2 = ('ATUALIZADO EM: {0:dd/MM/yyyy - HH:mm}' -f (Get-Date))
  $wbC.RefreshAll()
  $xl.CalculateUntilAsyncQueriesDone()
  $wbC.RefreshAll()
  $xl.CalculateUntilAsyncQueriesDone()
  $wbC.Save()
  if ($semanaAtual) { $resumo.semana = [ordered]@{ semana = $semanaAtual.rotulo; previsto = (Celula $rev $semanaAtual.linha 9).Value2; realizado = $semanaAtual.qtd } }
  $resumo.bm = [ordered]@{ periodo = $bmAtual; meta = $cfg.metaFornosBm; realizado = (($semanas | Where-Object { $_.bm -eq $bmAtual } | Measure-Object -Property qtd -Sum).Sum) }
  try {
    $graf = $wbC.Worksheets.Item('Curva S - Rev').ChartObjects(1).Chart
    $png = Join-Path $saida ("Curva-S-{0:yyyy-MM-dd}.png" -f $data)
    [void]$graf.Export($png)
    $resumo.arquivos.curva = $png
  } catch { Aviso "Não consegui exportar o gráfico da Curva S: $($_.Exception.Message)" }
  $wbC.Close($false)

  # =========================================================================
  # 4. RDO
  # =========================================================================
  $wbR = Abrir $xl $arquivos.rdo
  $numeradas = @()
  foreach ($ws in $wbR.Worksheets) { if ($ws.Name -match '^\d+$') { $numeradas += $ws } }
  if (-not $numeradas.Count) { throw 'Nenhuma aba numerada de RDO encontrada.' }
  $doDiaRdo = $numeradas | Where-Object { (Para-Data (Celula $_ 2 3).Value2) -eq $data } | Select-Object -First 1
  $ultimaAba = $numeradas | Sort-Object { [int]$_.Name } | Select-Object -Last 1
  if ($doDiaRdo) {
    $aba = $doDiaRdo
    $numero = [int]$aba.Name
    $anterior = $numeradas | Where-Object { [int]$_.Name -eq ($numero - 1) } | Select-Object -First 1
    Write-Host "RDO do dia já existia (aba $($aba.Name)): atualizando."
  } else {
    $numero = [int]$ultimaAba.Name + 1
    if ($diaJson.numeroRdo) { $numero = [int]$diaJson.numeroRdo }
    $anterior = $ultimaAba
    $ultimaAba.Copy([System.Reflection.Missing]::Value, $ultimaAba)
    $aba = $wbR.Worksheets.Item($ultimaAba.Index + 1)
    $aba.Name = '{0:D3}' -f $numero
  }
  $nomeAba = $aba.Name
  (Celula $aba 1 3).NumberFormat = '@'
  (Celula $aba 1 3).Value2 = [string]$numero
  (Celula $aba 2 3).Value2 = $oaData

  # atividades: duas faixas de três blocos (A:C, D:F, G:I); cada etapa do dia ocupa um bloco
  $area = $aba.Range('A7:I44')
  $area.UnMerge()
  $area.ClearContents() | Out-Null
  # some com as linhas internas dos blocos do dia anterior; a moldura do quadro fica
  $area.Borders.Item(11).LineStyle = $xlNone   # verticais internas
  $area.Borders.Item(12).LineStyle = $xlNone   # horizontais internas
  $blocos = @(@(7, 1, 3), @(7, 4, 6), @(7, 7, 9), @(24, 1, 3), @(24, 4, 6), @(24, 7, 9))
  $k = 0
  $atividades = [ordered]@{}
  foreach ($e in $ETAPAS) {
    if (-not $doDia[$e].Count) { continue }
    $linhas = @(Linhas-Rdo ([string[]]$doDia[$e]) $e)
    $atividades[$e] = $linhas
    if ($k -ge $blocos.Count) { Aviso "Sem espaço no RDO para $e."; continue }
    $b = $blocos[$k]; $k++
    $max = 15
    $cab = $aba.Range($aba.Cells.Item($b[0], $b[1]), $aba.Cells.Item($b[0], $b[2]))
    $cab.Merge()
    $cab.Value2 = $TITULO_ETAPA[$e]
    $cab.Font.Bold = $true
    $cab.HorizontalAlignment = $xlCenter
    $cab.WrapText = $true
    $cab.Borders.Item(9).LineStyle = $xlContinuous   # linha embaixo do título
    if ($linhas.Count -gt $max) {
      # muitas linhas: junta duas por linha para caber no bloco
      $juntas = @()
      for ($j = 0; $j -lt $linhas.Count; $j += 2) { $juntas += (($linhas[$j..([Math]::Min($j + 1, $linhas.Count - 1))]) -join '; ') }
      $linhas = $juntas
      if ($linhas.Count -gt $max) { Aviso "$e tem mais locais do que cabem no bloco do RDO; os últimos ficaram de fora." }
    }
    for ($j = 0; $j -lt [Math]::Min($linhas.Count, $max); $j++) {
      $r = $aba.Range($aba.Cells.Item($b[0] + 1 + $j, $b[1]), $aba.Cells.Item($b[0] + 1 + $j, $b[2]))
      $r.Merge()
      $r.Value2 = $linhas[$j]
      $r.HorizontalAlignment = $xlCenter
      $r.ShrinkToFit = $true
    }
  }
  if (-not $atividades.Count) { (Celula $aba 8 1).Value2 = 'Sem avanço físico registrado no dia.' }

  # observações
  $aba.Range('B41').Value2 = 'Obs.:'
  $obs = $aba.Range('C41:I43')
  $obs.Merge()
  $obs.WrapText = $true
  $obs.VerticalAlignment = $xlTop
  $obs.HorizontalAlignment = $xlLeft
  if ($diaJson.observacoesRdo) { $obs.Value2 = [string]$diaJson.observacoesRdo }

  # efetivo realizado (diurno): pela função escrita na coluna J; sem efetivo no dia.json, fica o do dia anterior
  if ($diaJson.efetivo) {
    $nomes = @{}
    foreach ($p in $diaJson.efetivo.PSObject.Properties) { $nomes[$p.Name.ToUpper().Trim()] = $p.Value }
    foreach ($l in @(9..17 + 22..34 + 40..44)) {
      $funcao = [string](Celula $aba $l 10).Value2
      if ($funcao -and $nomes.ContainsKey($funcao.ToUpper().Trim())) { (Celula $aba $l 12).Value2 = [double]$nomes[$funcao.ToUpper().Trim()] }
    }
  } else { Aviso 'Efetivo não informado: repeti o realizado do RDO anterior. Confira.' }

  # clima (diurno)
  $chuva = ([string]$diaJson.clima) -eq 'chuvoso'
  (Celula $aba 48 6).Value2 = $(if ($chuva) { '' } else { 'X' })
  (Celula $aba 49 6).Value2 = $(if ($chuva) { 'X' } else { '' })

  # materiais: anterior = acumulado do RDO anterior; aplicado = primárias da etapa × consumo
  foreach ($m in $MATERIAIS) {
    $ant = 0
    if ($anterior -and $anterior.Name -ne $aba.Name) { $ant = [double](Celula $anterior $m.linha 14).Value2 }
    (Celula $aba $m.linha 12).Value2 = $ant
    (Celula $aba $m.linha 13).Value2 = $doDia[$m.etapa].Count * $m.porPrimaria
  }
  $xl.Calculate()
  $wbR.Save()
  $pdfRdo = Join-Path $saida ("RDO-{0}-{1:yyyy-MM-dd}.pdf" -f $nomeAba, $data)
  $aba.ExportAsFixedFormat(0, $pdfRdo)
  $resumo.rdo = [ordered]@{ numero = $numero; aba = $nomeAba; atividades = $atividades }
  $resumo.arquivos.rdo = $pdfRdo
  $wbR.Close($false)
}
finally {
  $xl.Quit()
  [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

$caminhoResumo = Join-Path $saida 'resumo.json'
$resumo | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $caminhoResumo -Encoding UTF8
Write-Host "Pronto. Resumo em $caminhoResumo" -ForegroundColor Green
