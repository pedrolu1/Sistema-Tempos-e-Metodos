# Gera primarias/src/data/seed.js a partir das planilhas de controle atuais.
# Uso (na raiz do repositório):
#   python3 primarias/scripts/gerar-seed.py "Gestão Visual - Compilado.xlsx" "Curva S - Semanal.xlsm" primarias/src/data/seed.js
# Lê: aba "Banco de Dados" e "Banco de Dados (Resumo)" da Gestão Visual; aba "BD - REV" da Curva S.
import sys, json, warnings, datetime as dt, pandas as pd
warnings.filterwarnings('ignore')
gv, cs, out = sys.argv[1], sys.argv[2], sys.argv[3]
EPOCH = dt.date(2025, 9, 1)
def off(v):
    if pd.isna(v): return -1
    d = pd.Timestamp(v).date()
    return (d - EPOCH).days
df = pd.read_excel(gv, sheet_name='Banco de Dados', header=30, usecols='C:AE').dropna(subset=['Bat.:'])
bats = {}
last = EPOCH
for bat in ['A', 'B', 'C']:
    arr = []
    for b in range(1, 9):
        for f in range(1, 19):
            for p in range(1, 7):
                bloco = f"{bat}{b}"; forno = f"F{f:02d}"; prim = f"P{p:02d}"
                r = df[(df['Bloco:'] == bloco) & (df['Forno:'] == forno) & (df['Primária:'] == prim)]
                assert len(r) == 1, (bloco, forno, prim, len(r))
                r = r.iloc[0]
                lado = 'LM' if p <= 3 else 'LC'
                assert r['Lado:'] == lado, (bloco, forno, prim, r['Lado:'])
                tri = [off(r['Data de Término (Demo.):']), off(r['Data de Término (Inst.):']), off(r['Data de Término (Reves.):'])]
                for t in tri:
                    if t >= 0: last = max(last, EPOCH + dt.timedelta(days=t))
                arr.extend(tri)
    bats[bat] = arr
# curva S (3º contrato)
bd = pd.read_excel(cs, sheet_name='BD - REV')
curva = []
for _, r in bd.iterrows():
    curva.append({'semana': r['SEMANA'], 'inicio': pd.Timestamp(dt.datetime.strptime(r['DATA DE INÍCIO DA SEMANA'][:10], '%d/%m/%Y')).strftime('%Y-%m-%d'),
                  'fim': pd.Timestamp(dt.datetime.strptime(r['DATA DE TÉRMINO DA SEMANA'][:10], '%d/%m/%Y')).strftime('%Y-%m-%d'),
                  'diasUteis': int(r['QUANTIDADE DE DIAS ÚTEIS NA SEMANA']), 'bm': r['PERÍODO DO BM'], 'previsto': int(r['PREVISTO'] or 0)})
# desvios (resumo diário) a partir do início do 3º contrato na bateria B
rs = pd.read_excel(gv, sheet_name='Banco de Dados (Resumo)', header=2, usecols='B:P').dropna(subset=['Data:'])
rs = rs[rs['Data:'] >= pd.Timestamp('2026-06-16')]
desvios = []
for _, r in rs.iterrows():
    emp = r['Desvio - Empresa Responsável:']; mot = r['Motivo da Baixa Aderência (Revestimento)']
    if pd.isna(emp) and pd.isna(mot): continue
    desvios.append({'data': pd.Timestamp(r['Data:']).strftime('%Y-%m-%d'),
                    'empresa': (str(emp).strip() if not pd.isna(emp) else ''),
                    'motivo': (str(mot).strip() if not pd.isna(mot) else ''),
                    'obs': (str(r['Observações:']).strip() if not pd.isna(r['Observações:']) else '')})
js = []
js.append('// Gerado a partir das planilhas de controle (Gestão Visual compilada e Curva S do 3º contrato).')
js.append('// Não edite à mão: rode primarias/scripts/gerar-seed.py de novo com as planilhas novas.')
js.append(f"export const SEED_EPOCH = '{EPOCH.isoformat()}';")
js.append(f"export const SEED_ATE = '{last.isoformat()}';")
js.append('// Por bateria: blocos 1→8, fornos F01→F18, primárias P01→P06; para cada primária,')
js.append('// três números = dias desde SEED_EPOCH em que terminou demolição, instalação e revestimento (-1 = ainda não).')
js.append('export const SEED_BATERIAS = ' + json.dumps(bats, separators=(',', ':')) + ';')
js.append('// Previsto semanal da Curva S (fornos concluídos por semana).')
js.append('export const SEED_CURVA = ' + json.dumps(curva, ensure_ascii=False) + ';')
js.append('// Desvios diários registrados no resumo da gestão visual.')
js.append('export const SEED_DESVIOS = ' + json.dumps(desvios, ensure_ascii=False) + ';')
open(out, 'w').write('\n'.join(js) + '\n')
print('ultima data', last, 'curva', len(curva), 'desvios', len(desvios), 'bytes', len('\n'.join(js)))
print(desvios[:5])
