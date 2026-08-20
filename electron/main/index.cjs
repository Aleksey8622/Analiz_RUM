const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const XLSX = require('xlsx-js-style');

let database;
let databasePath;
const WINDOWS_SOURCE_FOLDER = String.raw`\\x5.ru\root\Regions\MO-PAVL3\Data\PLANNING\FK01_Долгопрудный\Закупки\Румы\Алексей\Ежедневная проверка\SAP_Reports`;
const WINDOWS_DATABASE_FOLDER = String.raw`C:\Users\Aleksey.Rudnev\Desktop\Analiz_RUM`;
const getSourceFolder = () => process.env.ANALIZ_RUM_SOURCE_FOLDER || (process.platform === 'win32' ? WINDOWS_SOURCE_FOLDER : '');
const getDatabaseFolder = () => process.env.ANALIZ_RUM_DATABASE_FOLDER || (process.platform === 'win32' ? WINDOWS_DATABASE_FOLDER : app.getPath('userData'));

const reports = [
  { type: 'bom', table: 'bom_rows', names: ['разузловка', 'bom'], columns: { 'Уровень разузловки': ['level', 'integer'], 'Позиция': ['position', 'text'], 'Вид материала': ['material_type', 'text'], '№ компонента': ['component_number', 'text'], 'Краткий текст материала': ['material_text', 'text'], 'Фиктивный узел': ['phantom_node', 'text'], 'Альтернативная позиция': ['alternative_position', 'text'], 'Ранговый список': ['ranked_list', 'integer'], 'ГруппаАльтПоз': ['alternative_group', 'text'], 'Основное PLU': ['main_plu', 'text'], 'Краткий текст материала_1': ['material_text_1', 'text'], 'Узел': ['node', 'text'], 'Кол-во компон. (БЕИ)': ['component_qty', 'number'], 'БЕИ': ['base_unit', 'text'] }, required: ['component_number'] },
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
const numberValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const source = String(value ?? '').trim().replace(/[\s\u00a0]/g, '');
  if (!source) return null;
  const separator = Math.max(source.lastIndexOf(','), source.lastIndexOf('.'));
  const normalized = separator < 0 ? source : `${source.slice(0, separator).replace(/[.,]/g, '')}.${source.slice(separator + 1)}`;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
};
const dateValue = (value) => {
  if (typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  const match = String(value ?? '').trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : String(value ?? '').trim() || null;
};
const convert = (value, type) => type === 'number' ? numberValue(value) : type === 'integer' ? Math.trunc(numberValue(value) ?? 0) : type === 'date' ? dateValue(value) : String(value ?? '').trim() || null;
const persist = () => fs.writeFileSync(databasePath, Buffer.from(database.export()));
const rows = (sql, params = []) => {
  const statement = database.prepare(sql); statement.bind(params); const result = [];
  while (statement.step()) result.push(statement.getAsObject()); statement.free(); return result;
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
  persist();
};

const recognize = (fileName) => reports.find((report) => report.names.some((name) => fileName.toLocaleLowerCase('ru').includes(name)));
const importWorkbook = (filePath, report, reportDate) => {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  let parsed;
  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: null });
    for (let index = 0; index < Math.min(matrix.length, 50); index += 1) {
      const headerMap = new Map(Object.entries(report.columns).map(([header, definition]) => [normalize(header), definition]));
      const mapped = matrix[index].map((header) => headerMap.get(normalize(header)) ?? null);
      if (!report.required.every((key) => mapped.some((definition) => definition?.[0] === key))) continue;
      parsed = matrix.slice(index + 1).filter((row) => row.some((cell) => cell != null && String(cell).trim())).map((row) => {
        const record = {}; mapped.forEach((definition, columnIndex) => { if (definition) record[definition[0]] = convert(row[columnIndex], definition[1]); }); return record;
      }).filter((record) => report.required.every((key) => record[key] != null && record[key] !== ''));
      break;
    }
    if (parsed) break;
  }
  if (!parsed?.length) throw new Error(`В файле ${path.basename(filePath)} не найдены корректные строки ${report.type}`);
  database.run("DELETE FROM data_imports WHERE report_type = ? AND report_date = ?", [report.type, reportDate]);
  database.run("INSERT INTO data_imports(report_type,source_type,source_name,source_modified_at,report_date,row_count,status) VALUES(?,?,?,?,?,?,'completed')", [report.type, 'excel', path.basename(filePath), fs.statSync(filePath).mtime.toISOString(), reportDate, parsed.length]);
  const importId = database.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  const keys = Object.values(report.columns).map((definition) => definition[0]).filter((key, index, all) => all.indexOf(key) === index);
  const sql = `INSERT INTO ${report.table}(import_id,${keys.join(',')}) VALUES(?${keys.map(() => ',?').join('')})`;
  const statement = database.prepare(sql);
  parsed.forEach((record) => statement.run([importId, ...keys.map((key) => record[key] ?? null)])); statement.free();
  return { type: report.type, file: path.basename(filePath), rows: parsed.length };
};

const snapshot = (date) => {
  const selectedDate = date || rows('SELECT MAX(report_date) AS date FROM data_imports WHERE status = ?', ['completed'])[0]?.date || null;
  const imports = selectedDate ? rows('SELECT report_type,source_name,row_count,imported_at FROM data_imports WHERE report_date = ? ORDER BY report_type', [selectedDate]) : [];
  const stockTotals = selectedDate ? rows(`WITH w AS (SELECT product material_number,SUM(quantity) warehouse FROM warehouse_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='warehouse_stock' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY product), p AS (SELECT material_number,SUM(free_stock) production FROM workshop_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='workshop_stock' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY material_number), b AS (SELECT product material_number,SUM(quantity) blocked FROM blocked_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='blocked_stock' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY product), keys AS (SELECT material_number FROM w UNION SELECT material_number FROM p UNION SELECT material_number FROM b) SELECT keys.material_number materialNumber,COALESCE(w.warehouse,0) warehouse,COALESCE(p.production,0) production,COALESCE(b.blocked,0) blocked FROM keys LEFT JOIN w USING(material_number) LEFT JOIN p USING(material_number) LEFT JOIN b USING(material_number)`, [selectedDate, selectedDate, selectedDate]) : [];
  const supplyTotals = selectedDate ? rows(`SELECT item_code materialNumber,SUM(COALESCE(supply_remainder,0)) supplyRemainder FROM supply_rows WHERE import_id=(SELECT id FROM data_imports WHERE report_type='supplies' AND report_date=? ORDER BY id DESC LIMIT 1) GROUP BY item_code`, [selectedDate]) : [];
  return { selectedDate, dates: rows("SELECT DISTINCT report_date date FROM data_imports WHERE status='completed' AND report_date IS NOT NULL ORDER BY report_date DESC").map((item) => item.date), imports, stockTotals, supplyTotals };
};

ipcMain.handle('data:get-state', () => ({ ...snapshot(), databasePath }));
ipcMain.handle('data:get-snapshot', (_, date) => ({ ...snapshot(date), databasePath }));
ipcMain.handle('data:update', (_, requestedDate) => {
  const reportDate = requestedDate || localDate();
  const existing = rows("SELECT COUNT(*) count FROM data_imports WHERE report_date=? AND status='completed'", [reportDate])[0]?.count ?? 0;
  if (reportDate !== localDate() && existing > 0) return { ...snapshot(reportDate), databasePath, imported: [] };
  if (reportDate !== localDate()) throw new Error(`Снимок за ${reportDate} ещё не создан.`);
  const folder = getSourceFolder(); if (!folder) throw new Error('Сетевой путь к SAP-файлам доступен только в Windows-конфигурации приложения.');
  if (!fs.existsSync(folder)) throw new Error(`Сетевая папка недоступна: ${folder}`);
  const candidates = fs.readdirSync(folder).filter((name) => /\.xlsx?$/i.test(name)).map((name) => ({ name, path: path.join(folder, name), report: recognize(name), modified: fs.statSync(path.join(folder, name)).mtimeMs })).filter((item) => item.report);
  const latest = [...new Set(candidates.map((item) => item.report.type))].map((type) => candidates.filter((item) => item.report.type === type).sort((a, b) => b.modified - a.modified)[0]);
  if (!latest.length) throw new Error('В выбранной папке не найдены распознаваемые SAP-файлы.');
  database.run('BEGIN'); try { const imported = latest.map((item) => importWorkbook(item.path, item.report, reportDate)); database.run('COMMIT'); persist(); return { ...snapshot(reportDate), databasePath, imported }; } catch (error) { database.run('ROLLBACK'); throw error; }
});

const createWindow = () => {
  const window = new BrowserWindow({ width: 1500, height: 960, webPreferences: { preload: path.join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false } });
  const devUrl = process.argv.find((argument) => argument.startsWith('--dev-url='))?.slice('--dev-url='.length);
  if (devUrl) window.loadURL(devUrl);
  else window.loadFile(path.resolve(__dirname, '../../dist/index.html'));
};

app.whenReady().then(async () => { await initializeDatabase(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
