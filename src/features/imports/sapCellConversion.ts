import type { SapCellType, SapColumnDefinition } from './sapReportDefinitions';

export type ExcelCellInput = { value: unknown; formatted?: string; isDate?: boolean };
export type SapDatabaseValue = string | number | null;

const pad = (value: number) => String(value).padStart(2, '0');
const isoDate = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

export const excelSerialToDate = (serial: number) => {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const wholeDays = Math.floor(serial);
  return new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400000);
};

export const parseSapNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const source = String(value ?? '').trim().replace(/[\s\u00a0]/g, '');
  if (!source) return null;
  const comma = source.lastIndexOf(',');
  const dot = source.lastIndexOf('.');
  const decimalIndex = Math.max(comma, dot);
  const normalized = decimalIndex < 0
    ? source
    : `${source.slice(0, decimalIndex).replace(/[.,]/g, '')}.${source.slice(decimalIndex + 1)}`;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseSapDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return isoDate(value);
  if (typeof value === 'number') {
    const date = excelSerialToDate(value);
    return date ? isoDate(date) : null;
  }
  const source = String(value ?? '').trim();
  if (!source) return null;
  const ru = source.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ru) return `${ru[3]}-${pad(Number(ru[2]))}-${pad(Number(ru[1]))}`;
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
};

export const parseSapTime = (value: unknown) => {
  if (typeof value === 'number' && value >= 0 && value < 1) {
    const seconds = Math.round(value * 86400) % 86400;
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  }
  const source = String(value ?? '').trim();
  const match = source.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  return match ? `${pad(Number(match[1]))}:${match[2]}:${match[3] ?? '00'}` : source || null;
};

export const inferSapCellType = (cell: ExcelCellInput): SapCellType => {
  if (cell.value == null || cell.value === '') return 'auto';
  if (cell.isDate || cell.value instanceof Date) return 'date';
  if (typeof cell.value === 'number') return 'number';
  if (parseSapDate(cell.value)) return 'date';
  if (parseSapNumber(cell.value) !== null && !/^0\d+/.test(String(cell.value).trim())) return 'number';
  return 'text';
};

export const convertSapCell = (cell: ExcelCellInput, column: SapColumnDefinition): SapDatabaseValue => {
  const type = column.type === 'auto' ? inferSapCellType(cell) : column.type;
  if (cell.value == null || cell.value === '') return null;
  if (type === 'text') return String(cell.formatted ?? cell.value).trim();
  if (type === 'number') return parseSapNumber(cell.value);
  if (type === 'integer') {
    const number = parseSapNumber(cell.value);
    return number === null ? null : Math.trunc(number);
  }
  if (type === 'date') return parseSapDate(cell.value);
  if (type === 'time') return parseSapTime(cell.value);
  return String(cell.formatted ?? cell.value).trim();
};

export const convertSapRow = (cells: ExcelCellInput[], mapping: Map<number, SapColumnDefinition>) => {
  const row: Record<string, SapDatabaseValue> = {};
  mapping.forEach((column, index) => { row[column.key] = convertSapCell(cells[index] ?? { value: null }, column); });
  return row;
};
