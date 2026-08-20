import * as XLSX from 'xlsx-js-style';
import { convertSapRow, type ExcelCellInput, type SapDatabaseValue } from './sapCellConversion';
import { detectSapReport, mapSapHeaders, type SapReportDefinition } from './sapReportDefinitions';

export type SapImportIssue = {
  row: number;
  column?: string;
  message: string;
};

export type SapImportPreview = {
  definition: SapReportDefinition;
  sheetName: string;
  headerRow: number;
  rows: Record<string, SapDatabaseValue>[];
  issues: SapImportIssue[];
};

const MAX_HEADER_SCAN_ROWS = 50;

const getCell = (sheet: XLSX.WorkSheet, row: number, column: number): ExcelCellInput => {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })] as XLSX.CellObject | undefined;
  if (!cell) return { value: null };
  return {
    value: cell.v,
    formatted: cell.w ?? XLSX.utils.format_cell(cell),
    isDate: cell.t === 'd' || (typeof cell.z === 'string' && XLSX.SSF.is_date(cell.z)),
  };
};

const rowCells = (sheet: XLSX.WorkSheet, row: number, startColumn: number, endColumn: number) =>
  Array.from({ length: endColumn - startColumn + 1 }, (_, offset) => getCell(sheet, row, startColumn + offset));

const isEmptyRow = (cells: ExcelCellInput[]) => cells.every((cell) => cell.value == null || String(cell.value).trim() === '');

const findHeader = (workbook: XLSX.WorkBook, fileName: string) => {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) continue;
    const range = XLSX.utils.decode_range(sheet['!ref']);
    const lastHeaderRow = Math.min(range.e.r, range.s.r + MAX_HEADER_SCAN_ROWS - 1);
    for (let row = range.s.r; row <= lastHeaderRow; row += 1) {
      const cells = rowCells(sheet, row, range.s.c, range.e.c);
      const definition = detectSapReport(fileName, cells.map((cell) => cell.formatted ?? cell.value));
      if (definition) return { sheet, sheetName, range, row, cells, definition };
    }
  }
  return null;
};

export const parseSapWorkbook = (content: ArrayBuffer, fileName: string): SapImportPreview => {
  const workbook = XLSX.read(content, { type: 'array', cellDates: false, cellNF: true, cellText: true });
  const header = findHeader(workbook, fileName);
  if (!header) throw new Error('Не удалось определить тип SAP-отчёта по имени файла и заголовкам.');

  const mapping = mapSapHeaders(
    header.definition,
    header.cells.map((cell) => cell.formatted ?? cell.value),
  );
  const rows: Record<string, SapDatabaseValue>[] = [];
  const issues: SapImportIssue[] = [];

  for (let rowIndex = header.row + 1; rowIndex <= header.range.e.r; rowIndex += 1) {
    const cells = rowCells(header.sheet, rowIndex, header.range.s.c, header.range.e.c);
    if (isEmptyRow(cells)) continue;
    const converted = convertSapRow(cells, mapping);
    const missing = header.definition.columns.filter((column) =>
      column.required && (converted[column.key] == null || converted[column.key] === ''));
    if (missing.length) {
      missing.forEach((column) => issues.push({
        row: rowIndex + 1,
        column: column.header,
        message: `Не заполнено обязательное поле «${column.header}»`,
      }));
      continue;
    }
    rows.push(converted);
  }

  if (!rows.length) throw new Error('В распознанном отчёте нет корректных строк для импорта.');
  return {
    definition: header.definition,
    sheetName: header.sheetName,
    headerRow: header.row + 1,
    rows,
    issues,
  };
};
