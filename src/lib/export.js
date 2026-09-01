import { formatDateBR, formatMinutes, formatEfetivo, classificacaoDoLancamento, CLASSIFICACAO_INFO } from '../utils/format.js';

// As bibliotecas de exportação (xlsx/jsPDF/docx) só são carregadas quando o
// usuário realmente exporta algo — mantém o bundle inicial leve para o app
// mobile, que é o caminho crítico de carregamento offline-first.

const COLUMNS = [
  { key: 'data', label: 'Data', map: (r) => formatDateBR(r.data) },
  { key: 'horario', label: 'Horário', map: (r) => `${r.horaInicio}–${r.horaTermino}` },
  { key: 'duracao', label: 'Duração', map: (r) => formatMinutes(r.duracaoMinutos) },
  { key: 'tipo', label: 'Tipo', map: (r) => (r.tipoRegistro === 'improdutividade' ? 'Improdutividade' : 'Atividade') },
  { key: 'classificacao', label: 'Classificação Lean', map: (r) => CLASSIFICACAO_INFO[classificacaoDoLancamento(r)].short },
  { key: 'atividadeNome', label: 'Descrição', map: (r) => r.atividadeNome || '' },
  { key: 'liderNome', label: 'Líder', map: (r) => r.liderNome || '' },
  { key: 'colaboradores', label: 'Colaboradores', map: (r) => (r.colaboradoresNomes || []).join(', ') },
  { key: 'efetivo', label: 'Efetivo utilizado', map: (r) => formatEfetivo(r.efetivo) },
  { key: 'criadoPorNome', label: 'Lançado por', map: (r) => r.criadoPorNome || '' },
  { key: 'status', label: 'Status', map: (r) => (r._sincronizado === false ? 'Pendente' : 'Sincronizado') }
];

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function exportExcel(rows, filename = `reframax-lancamentos-${stamp()}.xlsx`) {
  const XLSX = await import('xlsx');
  const data = rows.map((r) => Object.fromEntries(COLUMNS.map((c) => [c.label, c.map(r)])));
  const sheet = XLSX.utils.json_to_sheet(data);
  sheet['!cols'] = COLUMNS.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Lançamentos');
  XLSX.writeFile(wb, filename);
}

export async function exportPDF(rows, filename = `reframax-lancamentos-${stamp()}.pdf`, meta = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const docPdf = new jsPDF({ orientation: 'landscape', unit: 'pt' });
  docPdf.setFontSize(15);
  docPdf.setTextColor(20, 20, 24);
  docPdf.text('REFRAMAX — Relatório de Tempos e Métodos', 40, 42);
  docPdf.setFontSize(9.5);
  docPdf.setTextColor(110, 110, 118);
  const sub = meta.periodo ? `Período: ${meta.periodo} · Gerado em ${new Date().toLocaleString('pt-BR')}` : `Gerado em ${new Date().toLocaleString('pt-BR')}`;
  docPdf.text(sub, 40, 60);

  autoTable(docPdf, {
    startY: 76,
    head: [COLUMNS.map((c) => c.label)],
    body: rows.map((r) => COLUMNS.map((c) => c.map(r))),
    styles: { fontSize: 8.2, cellPadding: 5, textColor: [30, 30, 34] },
    headStyles: { fillColor: [43, 95, 234], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 248] },
    margin: { left: 40, right: 40 }
  });

  docPdf.save(filename);
}

export async function exportWord(rows, filename = `reframax-lancamentos-${stamp()}.docx`, meta = {}) {
  const [{ Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType }, { saveAs }] = await Promise.all([
    import('docx'),
    import('file-saver')
  ]);

  const headerRow = new TableRow({
    tableHeader: true,
    children: COLUMNS.map(
      (c) =>
        new TableCell({
          shading: { fill: '2B5FEA' },
          children: [new Paragraph({ children: [new TextRun({ text: c.label, bold: true, color: 'FFFFFF', size: 18 })] })]
        })
    )
  });

  const bodyRows = rows.map(
    (r, i) =>
      new TableRow({
        children: COLUMNS.map(
          (c) =>
            new TableCell({
              shading: i % 2 === 1 ? { fill: 'F4F4F6' } : undefined,
              children: [new Paragraph({ children: [new TextRun({ text: c.map(r) || '—', size: 17 })] })]
            })
        )
      })
  );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'REFRAMAX — Relatório de Tempos e Métodos', bold: true })] }),
          new Paragraph({
            spacing: { after: 220 },
            children: [
              new TextRun({
                text: meta.periodo ? `Período: ${meta.periodo} · Gerado em ${new Date().toLocaleString('pt-BR')}` : `Gerado em ${new Date().toLocaleString('pt-BR')}`,
                color: '6B6D78',
                size: 18
              })
            ]
          }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
          new Paragraph({
            spacing: { before: 260 },
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: `Total de registros: ${rows.length}`, italics: true, size: 16, color: '7B7C88' })]
          })
        ]
      }
    ]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
