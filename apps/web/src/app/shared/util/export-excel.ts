/** Excel-friendly CSV (UTF-8 BOM) and SpreadsheetML (.xls) downloads. */

export interface ExcelColumn<T> {
  key: string;
  header: string;
  value?: (row: T) => string | number | null | undefined;
}

function cellValue<T>(row: T, col: ExcelColumn<T>): string {
  const raw = col.value
    ? col.value(row)
    : (row as Record<string, unknown>)[col.key];
  if (raw == null) {
    return '';
  }
  return String(raw);
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** UTF-8 BOM CSV — opens cleanly in Excel. */
export function downloadCsv<T>(
  rows: T[],
  columns: ExcelColumn<T>[],
  filename: string,
) {
  const header = columns.map((c) => escapeCsv(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(cellValue(row, c))).join(','))
    .join('\r\n');
  const csv = `\uFEFF${header}\r\n${body}`;
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
}

/**
 * SpreadsheetML workbook Excel opens as a native workbook (.xls).
 * Useful for multi-sheet ops reports without a heavy xlsx dependency.
 */
export function downloadExcelWorkbook(
  sheets: Array<{
    name: string;
    columns: ExcelColumn<Record<string, unknown>>[];
    rows: Record<string, unknown>[];
  }>,
  filename: string,
) {
  const sheetXml = sheets
    .map((sheet) => {
      const safeName = sheet.name.replace(/[\\/*?[\]:]/g, '_').slice(0, 31);
      const headerRow = `<Row>${sheet.columns
        .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.header)}</Data></Cell>`)
        .join('')}</Row>`;
      const dataRows = sheet.rows
        .map((row) => {
          const cells = sheet.columns
            .map((c) => {
              const v = cellValue(row, c);
              const isNum = v !== '' && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v);
              return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(v)}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');
      return `<Worksheet ss:Name="${escapeXml(safeName)}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${sheetXml}
</Workbook>`;

  const name = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  triggerDownload(
    new Blob([xml], { type: 'application/vnd.ms-excel' }),
    name,
  );
}
