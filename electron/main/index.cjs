const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const XLSX = require('xlsx-js-style');

const isVirtualDesktop = process.platform === 'win32' && (
  /^vdi[-_]/i.test(process.env.COMPUTERNAME || '')
  || /^(rdp|ica)/i.test(process.env.SESSIONNAME || '')
  || process.env.ANALIZ_RUM_DISABLE_GPU === '1'
);
if (isVirtualDesktop) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('disable-skia-graphite');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
}

let database;
let databasePath;
const readLocalConfig = () => {
  const configuredPath = process.env.ANALIZ_RUM_CONFIG_FILE;
  const candidates = [configuredPath, path.join(process.cwd(), 'analiz-rum.config.json'), path.join(path.dirname(process.execPath), 'analiz-rum.config.json')].filter(Boolean);
  const configPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!configPath) return {};
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (error) { throw new Error(`Не удалось прочитать локальную конфигурацию ${configPath}: ${error.message}`); }
};
const getSourceFolder = () => process.env.ANALIZ_RUM_SOURCE_FOLDER || readLocalConfig().sourceFolder || '';
const getDatabaseFolder = () => process.env.ANALIZ_RUM_DATABASE_FOLDER || readLocalConfig().databaseFolder || app.getPath('userData');

const reports = [
  { type: 'directory', table: 'directory_positions', names: ['справочник позиций', 'справочник', 'карточки позиций', 'directory'], columns: { 'GUID': ['guid', 'text'], 'Категория': ['category', 'text'], 'PLU': ['plu', 'text'], 'Код': ['plu', 'text'], 'Код позиции': ['plu', 'text'], 'Наименование PLU': ['name', 'text'], 'Наименование': ['name', 'text'], 'Наименование позиции': ['name', 'text'], 'Поставщик': ['supplier', 'text'], 'SAP-код': ['supplier_sap_code', 'text'], 'SAP код': ['supplier_sap_code', 'text'], 'Номер договора': ['contract_number', 'text'], 'Ном корзины': ['basket_number', 'text'], 'Номер корзины': ['basket_number', 'text'], 'Штук на паллете': ['pieces_per_pallet', 'integer'], 'Отображать в анализе': ['show_in_analysis', 'integer'], 'Формат обечайки': ['sleeve_format', 'text'], 'Клиент': ['sleeve_client', 'text'], 'Тираж': ['sleeve_print_run', 'integer'], 'Удалено в Analysis Room': ['deleted_override', 'text'] }, required: ['plu', 'name'] },
  { type: 'bom', table: 'bom_rows', names: ['разузловка', 'bom'], columns: { 'Уровень разузловки': ['level', 'integer'], 'Позиция': ['position', 'text'], 'Вид материала': ['material_type', 'text'], '№ компонента': ['component_number', 'text'], 'Краткий текст материала': ['material_text', 'text'], 'Фиктивный узел': ['phantom_node', 'text'], 'Альтернативная позиция': ['alternative_position', 'text'], 'Ранговый список': ['ranked_list', 'integer'], 'ГруппаАльтПоз': ['alternative_group', 'text'], 'Основное PLU': ['main_plu', 'text'], 'Краткий текст материала_1': ['material_text_1', 'text'], 'Узел': ['node', 'text'], 'Кол-во компон. (БЕИ)': ['component_qty', 'number'], '__Количество как в Excel': ['component_qty_display', 'text'], 'БЕИ': ['base_unit', 'text'] }, required: ['level'] },
  { type: 'supplies', table: 'supply_rows', names: ['поставки', 'поставка'], columns: { 'Номер недели/долг': ['week_or_debt', 'text'], 'Остаток поставки': ['supply_remainder', 'number'], 'Поставщик': ['supplier_code', 'text'], 'Наименование поставщика': ['supplier_name', 'text'], 'Дата заказа': ['order_created_at', 'date'], 'Плановая дата поставки': ['planned_delivery_at', 'date'], 'Дата поставлено': ['delivered_at', 'date'], '№ заказа': ['order_number', 'text'], '№ товара': ['item_code', 'text'], 'Наименование товара': ['item_name', 'text'], 'Количество заказано': ['ordered_qty', 'number'], 'Количество поставлено': ['delivered_qty', 'number'], 'ВидЗаказаНаПоставку': ['order_type', 'text'], 'Удалено': ['deleted', 'text'], 'Возврат': ['return_flag', 'text'], 'Наименование статуса заказа': ['order_status', 'text'], 'Единица измерения': ['unit', 'text'] }, required: ['order_number', 'item_code'] },
  { type: 'workshop_stock', table: 'workshop_stock', names: ['остатки_цех', 'остатки цех'], columns: { 'Номер материала': ['material_number', 'text'], 'Завод': ['plant', 'text'], 'Партия': ['batch', 'text'], 'Склад': ['warehouse', 'text'], 'ЕдИзмерения': ['unit', 'text'], 'СвобИспользЗпс': ['free_stock', 'number'], 'НаКонтрКачества': ['quality_stock', 'number'], 'Блокированный': ['blocked_stock', 'number'], 'Вид материала': ['material_type', 'text'], 'Д/Изготовления': ['manufactured_at', 'date'], 'СрокХранен/МсГ': ['shelf_life', 'date'], 'Последнее ПМ': ['last_movement_at', 'date'] }, required: ['material_number'] },
];
const warehouseColumns = { 'Партия ОграничИспольз': ['restricted_batch', 'text'], 'Тип склада': ['warehouse_type', 'text'], 'Складское место': ['storage_bin', 'text'], 'Единица обработки': ['handling_unit', 'text'], 'Продукт': ['product', 'text'], 'Группа консолидации': ['consolidation_group', 'text'], 'Краткое описание продукта': ['product_description', 'text'], 'Количество': ['quantity', 'number'], 'Базисная ЕИ': ['base_unit', 'text'], 'Дата ПМ': ['movement_date', 'date'], 'Срок хранения/МсГ': ['shelf_life', 'date'], 'Партия': ['batch', 'text'], 'Вид запаса': ['stock_type', 'text'], 'Время ПМ': ['movement_time', 'text'], 'ЕО верхнего уровня': ['top_handling_unit', 'text'], 'Документ': ['document', 'text'], 'Вышестоящая ЕО': ['parent_handling_unit', 'text'], 'Ресурс': ['resource', 'text'] };
reports.push(
  { type: 'warehouse_stock', table: 'warehouse_stock', names: ['остатки_склад', 'остатки склад'], columns: warehouseColumns, required: ['product'] },
  { type: 'blocked_stock', table: 'blocked_stock', names: ['запас_в_блоке', 'запас в блоке'], columns: warehouseColumns, required: ['product'] },
);

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, '');
const categoryRules = [
  [/обечайк/i, 'Обечайки'],
  [/этикетк/i, 'Этикетки'],
  [/(лоток|лотки)/i, 'Лотки'],
  [/(пленка|плёнка)/i, 'Плёнки'],
  [/(гофра|гофро|короб)/i, 'Гофра и короба'],
  [/упаковк/i, 'Упаковка'],
  [/(форма|коррекс|корекс|крышка|стакан|сэндвич|контейнер)/i, 'Индивидуальная упаковка'],
];
const normalizeCategory = (category) => ({ 'Пленка': 'Плёнки', 'Плёнка': 'Плёнки', 'Гофра': 'Гофра и короба', 'Короба': 'Гофра и короба', 'Лоток': 'Лотки' }[String(category ?? '').trim()] || String(category ?? '').trim());
const detectCategory = (name) => categoryRules.find(([pattern]) => pattern.test(String(name ?? '')))?.[1] || 'Прочее';
const defaultSleeveFormats = [
  '100 × 385', '100 × 465,5', '105 × 392,5', '115 × 411', '224 × 290,3',
  '224 × 315,5', '275 × 75', '290 × 75', '75 × 346', '80 × 443,5',
  '324 × 55', 'Лоток трапеция', '358 × 70', '425 × 80', '406 × 80',
  '345 × 70', '441,5 × 80', '364 × 65', '328 × 75', '426 × 100',
];
const normalizeSleeveFormat = (value) => String(value ?? '').trim().replace(/\./g, ',').replace(/\s*(?:x|х|×|\*)\s*/i, ' × ').replace(/\s*мм\.?$/i, '').trim();
const detectSleeveFormat = (name) => {
  const source = String(name ?? '');
  if (/лоток\s+трапеци/i.test(source)) return 'Лоток трапеция';
  const matches = [...source.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:x|х|×|\*)\s*(\d+(?:[.,]\d+)?)/gi)];
  const detected = matches.at(-1);
  if (!detected) return '';
  const normalized = normalizeSleeveFormat(`${detected[1]} × ${detected[2]}`);
  const direct = defaultSleeveFormats.find((format) => normalizeSleeveFormat(format) === normalized);
  if (direct) return direct;
  const reversed = normalizeSleeveFormat(`${detected[2]} × ${detected[1]}`);
  return defaultSleeveFormats.find((format) => normalizeSleeveFormat(format) === reversed) || normalized;
};
const detectSleeveClient = (name) => /(^|[^a-zа-я0-9])sel([^a-zа-я0-9]|$)/i.test(String(name ?? ''))
  ? 'Перекрёсток'
  : /(^|[^a-zа-я0-9])5[kк]([^a-zа-я0-9]|$)/i.test(String(name ?? '')) ? 'Пятёрочка' : '';
const prepareDirectoryRecord = (record) => {
  const supplier = String(record.supplier ?? '').trim();
  const category = normalizeCategory(record.category) || detectCategory(record.name);
  const isSleeve = category === 'Обечайки' || /обечайк/i.test(String(record.name ?? ''));
  const explicitShowInAnalysis = typeof record.show_in_analysis === 'boolean'
    ? Number(record.show_in_analysis)
    : numberValue(record.show_in_analysis);
  return {
    ...record,
    guid: String(record.guid ?? '').trim() || [record.plu, supplier || 'supplier', record.contract_number, record.basket_number].map(normalize).join('::'),
    category,
    supplier,
    supplier_sap_code: String(record.supplier_sap_code ?? '').trim(),
    contract_number: String(record.contract_number ?? '').trim(),
    basket_number: String(record.basket_number ?? '').trim(),
    pieces_per_pallet: Math.max(0, Math.trunc(numberValue(record.pieces_per_pallet) ?? 0)),
    show_in_analysis: ['Этикетки', 'Обечайки'].includes(category)
      ? 0
      : record.show_in_analysis == null
        ? Number(Boolean(supplier))
        : Number(Boolean(explicitShowInAnalysis)),
    sleeve_format: isSleeve ? (normalizeSleeveFormat(record.sleeve_format) || detectSleeveFormat(record.name)) : null,
    sleeve_client: isSleeve ? (String(record.sleeve_client ?? '').trim() || detectSleeveClient(record.name)) : null,
    sleeve_print_run: isSleeve ? Math.max(0, Math.trunc(numberValue(record.sleeve_print_run) ?? 0)) || null : null,
    deleted_override: /^(1|да|yes|true|x)$/i.test(String(record.deleted_override ?? '').trim()) ? 'Да' : null,
  };
};
const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const source = String(value ?? '').trim().replace(/[\s\u00a0]/g, '');
  if (!source) return null;
  const separator = Math.max(source.lastIndexOf(','), source.lastIndexOf('.'));
  const normalized = separator < 0 ? source : `${source.slice(0, separator).replace(/[.,]/g, '')}.${source.slice(separator + 1)}`;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};
// AR-STOCK-NUMBERS-V1: numeric Excel cells are never parsed through display text.
const stockQuantityValue = (value, location) => {
  if (value == null || String(value).trim() === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/[\s\u00a0\u202f]/g, '');
  if (/^[+-]?\d{1,3}[.,]\d{3}$/.test(text)) throw new Error(`Неоднозначное количество «${value}» хранится текстом (${location}). Нужна числовая ячейка Excel; масштаб не изменён.`);
  if (/^[+-]?\d{1,3}(?:[.]\d{3}){2,}$/.test(text) || /^[+-]?\d{1,3}(?:[,]\d{3}){2,}$/.test(text)) return Number(text.replace(/[.,]/g, ''));
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(text) && !/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(text) && !/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) throw new Error(`Некорректное количество «${value}» (${location}).`);
  return numberValue(text);
};
const bomQuantityValue = (value, unit) => {
  const source = String(value ?? '').trim().replace(/[\s\u00a0]/g, '');
  if (!source) return null;
  const isPieces = String(unit ?? '').trim().toLocaleUpperCase('ru') === 'ШТ';
  const normalized = source.includes(',')
    ? source.replace(/\./g, '').replace(',', '.')
    : isPieces && /^\d{1,3}(\.\d{3})+$/.test(source)
      ? source.replace(/\./g, '')
      : source;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};
const dateValue = (value) => {
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  const match = String(value ?? '').trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : String(value ?? '').trim() || null;
};
const convert = (value, type) => {
  if (type === 'number') return numberValue(value);
  if (type === 'integer') { const result = numberValue(value); return result == null ? null : Math.trunc(result); }
  return type === 'date' ? dateValue(value) : String(value ?? '').trim() || null;
};
const persist = () => {
  // sql.js export reopens its connection and resets connection-local PRAGMAs.
  try {
    fs.writeFileSync(databasePath, Buffer.from(database.export()));
  } finally {
    database.run('PRAGMA foreign_keys = ON');
  }
};
const rows = (sql, params = []) => {
  const statement = database.prepare(sql); statement.bind(params); const result = [];
  while (statement.step()) result.push(statement.getAsObject()); statement.free(); return result;
};

const importedRowTables = [
  'blocked_stock',
  'bom_rows',
  'directory_positions',
  'supply_rows',
  'warehouse_stock',
  'workshop_stock',
];

// A current refresh is a replacement, not a history append. The archive on
// disk remains the source of historical dates, while permanent business
// tables (overrides, forecasts, orders, etc.) are deliberately untouched.
const clearReportSnapshots = () => {
  for (const table of importedRowTables) {
    database.run(`DELETE FROM ${table} WHERE NOT EXISTS (SELECT 1 FROM data_imports WHERE data_imports.id = ${table}.import_id)`);
  }
  database.run('DELETE FROM data_imports WHERE report_date IS NOT NULL');
};

const initializeDatabase = async () => {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  const databaseFolder = getDatabaseFolder();
  fs.mkdirSync(databaseFolder, { recursive: true });
  databasePath = path.join(databaseFolder, 'analiz_rum.db');
  database = fs.existsSync(databasePath) ? new SQL.Database(fs.readFileSync(databasePath)) : new SQL.Database();
  for (const file of ['items_directory.sql', 'workshop_stock.sql', 'sap_reports.sql', 'analytics.sql']) {
    database.run(fs.readFileSync(path.join(__dirname, '../../database/schema', file), 'utf8'));
  }
  database.run('CREATE TABLE IF NOT EXISTS manual_daily_forecasts (material_number TEXT PRIMARY KEY, daily_forecast REAL NOT NULL CHECK(daily_forecast >= 0))');
  if (!rows('PRAGMA table_info(bom_rows)').some((column) => column.name === 'component_qty_display')) {
    database.run('ALTER TABLE bom_rows ADD COLUMN component_qty_display TEXT');
  }
  if (!rows('PRAGMA table_info(directory_positions)').some((column) => column.name === 'deleted_override')) {
    database.run('ALTER TABLE directory_positions ADD COLUMN deleted_override TEXT');
  }
  database.run(`CREATE TABLE IF NOT EXISTS directory_position_overrides (
    guid TEXT PRIMARY KEY, category TEXT NOT NULL, plu TEXT NOT NULL, name TEXT NOT NULL,
    supplier TEXT NOT NULL, supplier_sap_code TEXT NOT NULL, contract_number TEXT NOT NULL,
    basket_number TEXT NOT NULL, pieces_per_pallet INTEGER NOT NULL DEFAULT 0,
    show_in_analysis INTEGER NOT NULL DEFAULT 0, sleeve_format TEXT, sleeve_client TEXT,
    sleeve_print_run INTEGER, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  database.run(`CREATE TABLE IF NOT EXISTS directory_deleted_overrides (
    guid TEXT PRIMARY KEY,
    deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  database.run(`CREATE TABLE IF NOT EXISTS report_row_overrides (
    report_type TEXT NOT NULL,
    row_key TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('update','delete')),
    patch_json TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(report_type,row_key)
  )`);
  persist();
};

const recognize = (fileName) => reports.find((report) => report.names.some((name) => fileName.toLocaleLowerCase('ru').includes(name)));
const bomColumnLayout = [
  ['level', 'integer'],
  ['position', 'text'],
  ['material_type', 'text'],
  ['component_number', 'text'],
  ['material_text', 'text'],
  ['phantom_node', 'text'],
  ['alternative_position', 'text'],
  ['ranked_list', 'integer'],
  ['alternative_group', 'text'],
  ['main_plu', 'text'],
  ['material_text_1', 'text'],
  ['node', 'text'],
  ['component_qty_display', 'text'],
  ['base_unit', 'text'],
];
const excelDisplayValue = (sheet, rowIndex, columnIndex) => {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
  const cell = sheet[address];
  if (!cell || cell.v == null) return null;
  return typeof cell.v === 'number' ? String(cell.v).replace('.', ',') : String(cell.v);
};
const importWorkbook = (filePath, report, reportDate) => {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  let parsed;
  for (const sheetName of workbook.SheetNames) {
    if (report.type === 'directory' && /неликвид/i.test(sheetName)) continue;
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
    const rawMatrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    for (let index = 0; index < Math.min(matrix.length, 50); index += 1) {
      const headerMap = new Map(Object.entries(report.columns).map(([header, definition]) => [normalize(header), definition]));
      const mapped = report.type === 'bom'
        ? (normalize(matrix[index][0]) === normalize('Уровень разузловки') ? bomColumnLayout : [])
        : matrix[index].map((header) => headerMap.get(normalize(header)) ?? null);
      if (!report.required.every((key) => mapped.some((definition) => definition?.[0] === key))) continue;
      parsed = matrix.slice(index + 1).map((row, rowIndex) => ({ row, rawRow: rawMatrix[index + 1 + rowIndex] ?? [], sheetRowIndex: index + 1 + rowIndex })).filter(({ row }) => row.some((cell) => cell != null && String(cell).trim())).map(({ row, rawRow, sheetRowIndex }) => {
        const record = {}; mapped.forEach((definition, columnIndex) => { if (definition) { const stockNumeric = ['warehouse_stock', 'workshop_stock', 'blocked_stock'].includes(report.type) && definition[1] === 'number'; record[definition[0]] = stockNumeric ? stockQuantityValue(rawRow[columnIndex], `${path.basename(filePath)}, строка ${sheetRowIndex + 1}, ${definition[0]}`) : convert(row[columnIndex], definition[1]); } }); if (report.type === 'bom') { record.component_qty_display = excelDisplayValue(sheet, sheetRowIndex, 12); record.component_qty = typeof rawRow[12] === 'number' ? rawRow[12] : bomQuantityValue(rawRow[12], rawRow[13]); } return record;
      }).filter((record) => report.required.every((key) => record[key] != null && record[key] !== '')).map((record) => report.type === 'directory' ? prepareDirectoryRecord(record) : record).filter((record) => report.type !== 'directory' || !record.deleted_override);
      if (report.type === 'directory') parsed = [...new Map(parsed.map((record) => [record.guid, record])).values()];
      break;
    }
    if (parsed) break;
  }
  if (!parsed || (!parsed.length && report.type !== 'directory')) throw new Error(`В файле ${path.basename(filePath)} не найдены корректные строки ${report.type}`);
  database.run("DELETE FROM data_imports WHERE report_type = ? AND report_date = ?", [report.type, reportDate]);
  database.run("INSERT INTO data_imports(report_type,source_type,source_name,source_modified_at,report_date,row_count,status) VALUES(?,?,?,?,?,?,'completed')", [report.type, 'excel', path.basename(filePath), fs.statSync(filePath).mtime.toISOString(), reportDate, parsed.length]);
  const importId = database.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  const keys = Object.values(report.columns).map((definition) => definition[0]).filter((key, index, all) => all.indexOf(key) === index);
  const sql = `INSERT INTO ${report.table}(import_id,${keys.join(',')}) VALUES(?${keys.map(() => ',?').join('')})`;
  const statement = database.prepare(sql);
  parsed.forEach((record) => statement.run([importId, ...keys.map((key) => record[key] ?? null)])); statement.free();
  return { type: report.type, file: path.basename(filePath), rows: parsed.length };
};

const directoryExcelFields = [
  ['guid', 'GUID'], ['category', 'Категория'], ['plu', 'PLU'], ['name', 'Наименование PLU'],
  ['supplier', 'Поставщик'], ['supplier_sap_code', 'SAP-код'], ['contract_number', 'Номер договора'],
  ['basket_number', 'Номер корзины'], ['pieces_per_pallet', 'Штук на паллете'],
  ['show_in_analysis', 'Отображать в анализе'], ['sleeve_format', 'Формат обечайки'], ['sleeve_client', 'Клиент'],
  ['sleeve_print_run', 'Тираж'], ['deleted_override', 'Удалено в Analysis Room'],
];

const normalizeDirectoryPosition = (position) => {
  const prepared = prepareDirectoryRecord({
    guid: position.id,
    category: position.category,
    plu: position.plu,
    name: position.name,
    supplier: position.supplier,
    supplier_sap_code: position.supplierSapCode,
    contract_number: position.contractNumber,
    basket_number: position.basketNumber,
    pieces_per_pallet: position.piecesPerPallet,
    show_in_analysis: position.showInAnalysis,
    sleeve_format: position.sleeveFormat,
    sleeve_client: position.sleeveClient,
    sleeve_print_run: position.sleevePrintRun,
  });
  return {
    ...prepared,
    id: prepared.guid,
    supplierSapCode: prepared.supplier_sap_code,
    contractNumber: prepared.contract_number,
    basketNumber: prepared.basket_number,
    piecesPerPallet: prepared.pieces_per_pallet,
    showInAnalysis: Boolean(prepared.show_in_analysis),
    sleeveFormat: prepared.sleeve_format || '',
    sleeveClient: prepared.sleeve_client || '',
    sleevePrintRun: prepared.sleeve_print_run || 0,
  };
};

const latestSourceFile = (reportType) => {
  const folder = getSourceFolder();
  if (!folder || !fs.existsSync(folder)) throw new Error('Сетевая папка Excel недоступна. Проверьте analiz-rum.config.json.');
  const candidate = fs.readdirSync(folder)
    .filter((name) => /\.xlsx?$/i.test(name) && recognize(name)?.type === reportType)
    .map((name) => ({ path: path.join(folder, name), modified: fs.statSync(path.join(folder, name)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified)[0];
  if (!candidate) throw new Error('В сетевой папке не найден Excel-файл «Справочник позиций».');
  return candidate.path;
};

const setSheetCell = (sheet, row, column, value, template) => {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  const cell = sheet[address] || {};
  if (template?.s && !cell.s) cell.s = template.s;
  if (value == null || value === '') {
    cell.t = 's'; cell.v = '';
  } else if (typeof value === 'number') {
    cell.t = 'n'; cell.v = value;
  } else {
    cell.t = 's'; cell.v = String(value);
  }
  delete cell.w;
  sheet[address] = cell;
};

const updateDirectoryWorkbook = (positions = [], deletedIds = []) => {
  if (!positions.length && !deletedIds.length) return null;
  const sourcePath = latestSourceFile('directory');
  const workbook = XLSX.readFile(sourcePath, { cellStyles: true, cellDates: false });
  const report = reports.find((item) => item.type === 'directory');
  let target;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
    for (let headerRow = 0; headerRow < Math.min(matrix.length, 50); headerRow += 1) {
      const aliasMap = new Map(Object.entries(report.columns).map(([header, definition]) => [normalize(header), definition[0]]));
      const mapped = matrix[headerRow].map((header) => aliasMap.get(normalize(header)) || null);
      if (!report.required.every((key) => mapped.includes(key))) continue;
      target = { sheet, headerRow, mapped };
      break;
    }
    if (target) break;
  }
  if (!target) throw new Error('В Excel-справочнике не найдены колонки PLU и наименование.');

  const { sheet, headerRow, mapped } = target;
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  const columnByField = new Map();
  mapped.forEach((field, index) => { if (field && !columnByField.has(field)) columnByField.set(field, index); });
  directoryExcelFields.forEach(([field, header]) => {
    if (columnByField.has(field)) return;
    range.e.c += 1;
    columnByField.set(field, range.e.c);
    mapped[range.e.c] = field;
    const template = sheet[XLSX.utils.encode_cell({ r: headerRow, c: Math.max(range.s.c, range.e.c - 1) })];
    setSheetCell(sheet, headerRow, range.e.c, header, template);
  });

  const rowByGuid = new Map();
  const rawValue = (row, field) => {
    const column = columnByField.get(field);
    return column == null ? null : sheet[XLSX.utils.encode_cell({ r: row, c: column })]?.v ?? null;
  };
  for (let row = headerRow + 1; row <= range.e.r; row += 1) {
    const record = {};
    directoryExcelFields.forEach(([field]) => { record[field] = rawValue(row, field); });
    if (!String(record.plu ?? '').trim() && !String(record.name ?? '').trim()) continue;
    const prepared = prepareDirectoryRecord(record);
    rowByGuid.set(prepared.guid, row);
  }

  const writePosition = (position) => {
    const data = normalizeDirectoryPosition(position);
    let row = rowByGuid.get(data.id);
    if (row == null) { row = range.e.r + 1; range.e.r = row; rowByGuid.set(data.id, row); }
    directoryExcelFields.forEach(([field]) => {
      const column = columnByField.get(field);
      const template = row > headerRow + 1 ? sheet[XLSX.utils.encode_cell({ r: row - 1, c: column })] : null;
      setSheetCell(sheet, row, column, field === 'deleted_override' ? '' : data[field], template);
    });
  };
  positions.forEach(writePosition);
  deletedIds.forEach((guid) => {
    const row = rowByGuid.get(guid);
    if (row != null) setSheetCell(sheet, row, columnByField.get('deleted_override'), 'Да');
  });
  sheet['!ref'] = XLSX.utils.encode_range(range);

  const backupFolder = path.join(databasePath ? path.dirname(databasePath) : getDatabaseFolder(), 'directory-backups');
  fs.mkdirSync(backupFolder, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupFolder, `${path.basename(sourcePath)}.${stamp}.backup`);
  const tempPath = `${sourcePath}.analiz-rum-${process.pid}${path.extname(sourcePath)}`;
  try {
    fs.copyFileSync(sourcePath, backupPath);
    XLSX.writeFile(workbook, tempPath);
    fs.copyFileSync(tempPath, sourcePath);
  } catch (error) {
    throw new Error(`Не удалось сохранить Excel-справочник. Закройте файл в Excel и повторите: ${error.message}`);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
  return sourcePath;
};

const upsertDirectoryOverrides = (positions) => {
  const statement = database.prepare(`INSERT INTO directory_position_overrides(guid,category,plu,name,supplier,supplier_sap_code,contract_number,basket_number,pieces_per_pallet,show_in_analysis,sleeve_format,sleeve_client,sleeve_print_run) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(guid) DO UPDATE SET category=excluded.category,plu=excluded.plu,name=excluded.name,supplier=excluded.supplier,supplier_sap_code=excluded.supplier_sap_code,contract_number=excluded.contract_number,basket_number=excluded.basket_number,pieces_per_pallet=excluded.pieces_per_pallet,show_in_analysis=excluded.show_in_analysis,sleeve_format=excluded.sleeve_format,sleeve_client=excluded.sleeve_client,sleeve_print_run=excluded.sleeve_print_run,updated_at=CURRENT_TIMESTAMP`);
  const normalized = positions.map(normalizeDirectoryPosition);
  normalized.forEach((position) => {
    statement.run([position.id, position.category, position.plu, position.name, position.supplier, position.supplier_sap_code, position.contract_number, position.basket_number, position.pieces_per_pallet, position.show_in_analysis, position.sleeve_format || null, position.sleeve_client || null, position.sleeve_print_run || null]);
    database.run('DELETE FROM directory_deleted_overrides WHERE guid=?', [position.id]);
  });
  statement.free();
  return normalized.map((position) => ({
    id: position.id, category: position.category, plu: position.plu, name: position.name, supplier: position.supplier,
    supplierSapCode: position.supplier_sap_code, contractNumber: position.contract_number, basketNumber: position.basket_number,
    piecesPerPallet: position.pieces_per_pallet, showInAnalysis: Boolean(position.show_in_analysis),
    sleeveFormat: position.sleeve_format || '', sleeveClient: position.sleeve_client || '', sleevePrintRun: position.sleeve_print_run || 0,
  }));
};

const snapshot = (date) => {
  const selectedDate = date || rows("SELECT MAX(report_date) AS date FROM data_imports WHERE status = ? AND report_type <> 'directory'", ['completed'])[0]?.date || null;
  const imports = selectedDate ? rows('SELECT report_type,source_name,row_count,imported_at FROM data_imports WHERE report_date = ? ORDER BY report_type', [selectedDate]) : [];
  const stockTotals = selectedDate ? rows(`WITH w AS (SELECT CASE WHEN trim(product) NOT GLOB '*[^0-9]*' AND trim(product) <> '' THEN COALESCE(NULLIF(ltrim(trim(product),'0'),''),'0') ELSE trim(product) END material_key,SUM(quantity) warehouse FROM warehouse_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='warehouse_stock' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY material_key), p AS (SELECT CASE WHEN trim(material_number) NOT GLOB '*[^0-9]*' AND trim(material_number) <> '' THEN COALESCE(NULLIF(ltrim(trim(material_number),'0'),''),'0') ELSE trim(material_number) END material_key,SUM(free_stock) production FROM workshop_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='workshop_stock' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY material_key), b AS (SELECT CASE WHEN trim(product) NOT GLOB '*[^0-9]*' AND trim(product) <> '' THEN COALESCE(NULLIF(ltrim(trim(product),'0'),''),'0') ELSE trim(product) END material_key,SUM(quantity) blocked FROM blocked_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='blocked_stock' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY material_key), keys AS (SELECT material_key FROM w UNION SELECT material_key FROM p UNION SELECT material_key FROM b) SELECT keys.material_key materialNumber,COALESCE(w.warehouse,0) warehouse,COALESCE(p.production,0) production,COALESCE(b.blocked,0) blocked FROM keys LEFT JOIN w USING(material_key) LEFT JOIN p USING(material_key) LEFT JOIN b USING(material_key)`, [selectedDate, selectedDate, selectedDate]) : [];
  const supplyTotals = selectedDate ? rows(`SELECT item_code materialNumber,SUM(COALESCE(supply_remainder,0)) supplyRemainder FROM supply_rows WHERE import_id=(SELECT id FROM data_imports WHERE report_type='supplies' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY item_code`, [selectedDate]) : [];
  const rawDirectoryRows = rows(`SELECT d.guid id,COALESCE(o.category,d.category) category,COALESCE(o.plu,d.plu) plu,COALESCE(o.name,d.name) name,COALESCE(o.supplier,d.supplier) supplier,COALESCE(o.supplier_sap_code,d.supplier_sap_code) supplierSapCode,COALESCE(o.contract_number,d.contract_number) contractNumber,COALESCE(o.basket_number,d.basket_number) basketNumber,COALESCE(o.pieces_per_pallet,d.pieces_per_pallet) piecesPerPallet,COALESCE(o.show_in_analysis,d.show_in_analysis) showInAnalysis,COALESCE(NULLIF(o.sleeve_format,''),NULLIF(d.sleeve_format,'')) sleeveFormat,COALESCE(NULLIF(o.sleeve_client,''),NULLIF(d.sleeve_client,'')) sleeveClient,COALESCE(o.sleeve_print_run,d.sleeve_print_run) sleevePrintRun FROM directory_positions d LEFT JOIN directory_position_overrides o ON o.guid=d.guid WHERE d.import_id=(SELECT id FROM data_imports WHERE report_type='directory' ORDER BY id DESC LIMIT 1) AND NOT EXISTS(SELECT 1 FROM directory_deleted_overrides removed WHERE removed.guid=d.guid) UNION ALL SELECT o.guid id,o.category,o.plu,o.name,o.supplier,o.supplier_sap_code supplierSapCode,o.contract_number contractNumber,o.basket_number basketNumber,o.pieces_per_pallet piecesPerPallet,o.show_in_analysis showInAnalysis,NULLIF(o.sleeve_format,'') sleeveFormat,NULLIF(o.sleeve_client,'') sleeveClient,o.sleeve_print_run sleevePrintRun FROM directory_position_overrides o WHERE NOT EXISTS(SELECT 1 FROM directory_positions d WHERE d.guid=o.guid AND d.import_id=(SELECT id FROM data_imports WHERE report_type='directory' ORDER BY id DESC LIMIT 1)) AND NOT EXISTS(SELECT 1 FROM directory_deleted_overrides removed WHERE removed.guid=o.guid)`).map(normalizeDirectoryPosition);
  const sleeveMetadataByPlu = new Map();
  const sleevePrintRunBySupplierFormat = new Map();
  rawDirectoryRows.forEach((position) => {
    if (position.category !== 'Обечайки' && !/обечайк/i.test(position.name)) return;
    const pluKey = normalize(position.plu);
    const current = sleeveMetadataByPlu.get(pluKey) || {};
    sleeveMetadataByPlu.set(pluKey, {
      format: current.format || position.sleeveFormat || '',
      client: current.client || position.sleeveClient || '',
    });
    if (position.sleeveFormat && position.sleevePrintRun) {
      sleevePrintRunBySupplierFormat.set(`${normalize(position.supplier)}::${normalizeSleeveFormat(position.sleeveFormat)}`, position.sleevePrintRun);
    }
  });
  const directoryRows = rawDirectoryRows.map((position) => {
    if (position.category !== 'Обечайки' && !/обечайк/i.test(position.name)) return position;
    const shared = sleeveMetadataByPlu.get(normalize(position.plu)) || {};
    const sleeveFormat = position.sleeveFormat || shared.format || detectSleeveFormat(position.name);
    const sleeveClient = position.sleeveClient || shared.client || detectSleeveClient(position.name);
    const sharedPrintRun = sleeveFormat
      ? sleevePrintRunBySupplierFormat.get(`${normalize(position.supplier)}::${normalizeSleeveFormat(sleeveFormat)}`)
      : 0;
    return { ...position, sleeveFormat, sleeveClient, sleevePrintRun: position.sleevePrintRun || sharedPrintRun || 0 };
  });
  const supplyRows = selectedDate ? rows(`SELECT CAST(id AS TEXT) id,week_or_debt weekOrDebt,supply_remainder supplyRemainder,supplier_code supplierCode,supplier_name supplierName,order_created_at orderCreatedAt,planned_delivery_at plannedDeliveryAt,delivered_at deliveredAt,order_number orderNumber,item_code itemCode,item_name itemName,ordered_qty orderedQty,delivered_qty deliveredQty,order_type orderType,deleted,return_flag returnFlag,order_status orderStatus,unit FROM supply_rows WHERE import_id=(SELECT id FROM data_imports WHERE report_type='supplies' AND report_date=? ORDER BY id DESC LIMIT 1)`, [selectedDate]) : [];
  const bomRows = readBom(selectedDate);
  const forecastTotals = require('./bom-analysis.cjs').forecasts(bomRows, rows('SELECT material_number materialNumber, daily_forecast dailyForecast FROM manual_daily_forecasts'));
  return { selectedDate, dates: rows("SELECT DISTINCT report_date date FROM data_imports WHERE status='completed' AND report_type <> 'directory' AND report_date IS NOT NULL ORDER BY report_date DESC").map((item) => item.date), imports, stockTotals, supplyTotals, directoryRows, supplyRows, bomRows: [], forecastTotals };
};

const readBom = (selectedDate) => selectedDate ? rows(`SELECT CAST(id AS TEXT) id,level,position,material_type materialType,component_number componentNumber,material_text materialText,phantom_node phantomNode,alternative_position alternativePosition,ranked_list rankedList,alternative_group alternativeGroup,main_plu mainPlu,material_text_1 materialText1,node,COALESCE(component_qty_display,CAST(component_qty AS TEXT)) componentQty,component_qty componentQtyValue,base_unit baseUnit FROM bom_rows WHERE import_id=(SELECT id FROM data_imports WHERE report_type='bom' AND report_date=? ORDER BY id DESC LIMIT 1) ORDER BY bom_rows.id`, [selectedDate]) : [];
ipcMain.handle('bom:search', (_, date, query) => require('./bom-analysis.cjs').search(readBom(date), query));
ipcMain.handle('bom:save-forecast', (_, code, value, date) => {
  const material = require('./bom-analysis.cjs').key(code);
  if (!material || material.length > 100) throw Error('Укажите код позиции');
  if (!snapshot(date).directoryRows.some(row => require('./bom-analysis.cjs').key(row.plu) === material)) throw Error('Позиция не найдена в справочнике');
  if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw Error('Прогноз должен быть неотрицательным числом');
  const before = database.export();
  try {
    if (value === null) database.run('DELETE FROM manual_daily_forecasts WHERE material_number=?', [material]);
    else database.run('INSERT OR REPLACE INTO manual_daily_forecasts VALUES (?,?)', [material, value]);
    require('./archive.cjs').saveDatabase(databasePath, database.export());
  } catch (error) {
    database.run('DELETE FROM manual_daily_forecasts WHERE material_number=?', [material]);
    const SQL = database.constructor; const old = new SQL(before);
    const stmt = old.prepare('SELECT daily_forecast FROM manual_daily_forecasts WHERE material_number=?'); stmt.bind([material]);
    if (stmt.step()) database.run('INSERT INTO manual_daily_forecasts VALUES (?,?)', [material, stmt.get()[0]]);
    stmt.free(); old.close(); throw error;
  } finally { database.run('PRAGMA foreign_keys = ON'); }
  return snapshot(date);
});
ipcMain.handle('data:get-state', () => ({ ...snapshot(), databasePath }));
ipcMain.handle('data:get-snapshot', (_, date) => loadReportDate(date));
ipcMain.handle('directory:save-positions', (_, positions) => {
  const list = Array.isArray(positions) ? positions : [];
  if (!list.length) return [];
  database.run('BEGIN');
  try {
    const saved = upsertDirectoryOverrides(list);
    database.run('COMMIT');
    persist();
    return saved;
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
});
ipcMain.handle('settings:get-workspace', () => {
  const saved = rows("SELECT value_json valueJson FROM app_settings WHERE setting_key='workspace' LIMIT 1")[0]?.valueJson;
  if (!saved) return {};
  try { return JSON.parse(saved); } catch { return {}; }
});
ipcMain.handle('settings:save-workspace', (_, settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Некорректные настройки рабочего пространства.');
  database.run("INSERT INTO app_settings(setting_key,value_json) VALUES('workspace',?) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP", [JSON.stringify(settings)]);
  persist();
  return true;
});
ipcMain.handle('directory:save-position', async (_, position) => {
  database.run('BEGIN');
  try {
    const [saved] = upsertDirectoryOverrides([position]);
    database.run('COMMIT');
    persist();
    return saved;
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
});
ipcMain.handle('directory:delete-positions', (_, ids) => {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map((value) => String(value ?? '').trim()).filter(Boolean))];
  if (!list.length) return [];
  database.run('BEGIN');
  try {
    const statement = database.prepare('INSERT INTO directory_deleted_overrides(guid) VALUES(?) ON CONFLICT(guid) DO UPDATE SET deleted_at=CURRENT_TIMESTAMP');
    list.forEach((id) => statement.run([id]));
    statement.free();
    database.run('COMMIT');
    persist();
    return list;
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
});
// AR-ARCHIVE-V2: current directory plus selected-day reports; no Excel writes.
const { createDateLoader, selectReports, selectDirectory, saveDatabase } = require('./archive.cjs');
const loadReportDate = createDateLoader({
  today: localDate, getSourceFolder,
  snapshot: (date) => ({ ...snapshot(date), databasePath }),
  importFolder: (reportDate, folder, historical, readReports) => {
    const directory = selectDirectory(getSourceFolder(), recognize);
    const selected = readReports ? selectReports(folder, recognize, historical).filter((item) => item.report.type !== 'directory') : [];
    const before = database.export();
    database.run('PRAGMA foreign_keys = ON');
    let committed = false;
    database.run('BEGIN');
    try {
      const replacingCurrentSnapshot = readReports && !historical;
      if (replacingCurrentSnapshot) clearReportSnapshots();
      importWorkbook(directory.path, directory.report, localDate());
      const imported = selected.map((item) => importWorkbook(item.path, item.report, reportDate));
      database.run('COMMIT'); committed = true;
      if (replacingCurrentSnapshot) database.run('VACUUM');
      try { saveDatabase(databasePath, database.export()); }
      finally { database.run('PRAGMA foreign_keys = ON'); }
      return { ...snapshot(reportDate), databasePath, imported };
    } catch (error) {
      if (!committed) database.run('ROLLBACK');
      else {
        const Database = database.constructor;
        database.close(); database = new Database(before);
        database.run('PRAGMA foreign_keys = ON');
      }
      throw error;
    }
  },
});
ipcMain.handle('data:update', (_, date) => loadReportDate(date, true));

const iconPath = path.resolve(__dirname, '../../assets/delekto-kitchen-icon.png');

const createSplashWindow = () => {
  const splash = new BrowserWindow({
    width: 620,
    height: 340,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#ff4023',
    icon: iconPath,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  splash.loadFile(path.resolve(__dirname, '../splash.html'));
  splash.once('ready-to-show', () => splash.show());
  return splash;
};

const createWindow = (splash) => {
  const window = new BrowserWindow({ width: 1500, height: 960, show: false, backgroundColor: '#ffffff', icon: iconPath, webPreferences: { preload: path.join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false } });
  const devUrl = process.argv.find((argument) => argument.startsWith('--dev-url='))?.slice('--dev-url='.length);
  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.resolve(__dirname, '../../dist/index.html'));
  window.once('ready-to-show', () => {
    window.show();
    if (splash && !splash.isDestroyed()) splash.close();
  });
  return window;
};

app.setName('DELEKTO Analysis Room');
app.whenReady().then(async () => {
  const splashStartedAt = Date.now();
  const splash = createSplashWindow();
  try {
    await initializeDatabase();
    const remainingSplashTime = Math.max(0, 10000 - (Date.now() - splashStartedAt));
    if (remainingSplashTime) await new Promise((resolve) => setTimeout(resolve, remainingSplashTime));
    createWindow(splash);
  } catch (error) {
    if (!splash.isDestroyed()) splash.close();
    throw error;
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
