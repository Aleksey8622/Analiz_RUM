const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const XLSX = require('xlsx-js-style');

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
  { type: 'directory', table: 'directory_positions', names: ['справочник позиций', 'справочник', 'карточки позиций', 'directory'], columns: { 'GUID': ['guid', 'text'], 'Категория': ['category', 'text'], 'PLU': ['plu', 'text'], 'Код': ['plu', 'text'], 'Код позиции': ['plu', 'text'], 'Наименование PLU': ['name', 'text'], 'Наименование': ['name', 'text'], 'Наименование позиции': ['name', 'text'], 'Поставщик': ['supplier', 'text'], 'SAP-код': ['supplier_sap_code', 'text'], 'SAP код': ['supplier_sap_code', 'text'], 'Номер договора': ['contract_number', 'text'], 'Ном корзины': ['basket_number', 'text'], 'Номер корзины': ['basket_number', 'text'], 'Штук на паллете': ['pieces_per_pallet', 'integer'], 'Отображать в анализе': ['show_in_analysis', 'integer'], 'Формат обечайки': ['sleeve_format', 'text'], 'Клиент': ['sleeve_client', 'text'], 'Тираж': ['sleeve_print_run', 'integer'] }, required: ['plu', 'name'] },
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
  [/(лоток|лотки)/i, 'Лотки'],
  [/(пленка|плёнка)/i, 'Плёнки'],
  [/(гофра|гофро|короб)/i, 'Гофра и короба'],
  [/обечайк/i, 'Обечайки'],
  [/этикетк/i, 'Этикетки'],
  [/упаковк/i, 'Упаковка'],
  [/(форма|коррекс|корекс|крышка|стакан|сэндвич|контейнер)/i, 'Индивидуальная упаковка'],
];
const normalizeCategory = (category) => ({ 'Пленка': 'Плёнки', 'Плёнка': 'Плёнки', 'Гофра': 'Гофра и короба', 'Короба': 'Гофра и короба', 'Лоток': 'Лотки' }[String(category ?? '').trim()] || String(category ?? '').trim());
const detectCategory = (name) => categoryRules.find(([pattern]) => pattern.test(String(name ?? '')))?.[1] || 'Прочее';
const prepareDirectoryRecord = (record) => {
  const supplier = String(record.supplier ?? '').trim();
  const category = normalizeCategory(record.category) || detectCategory(record.name);
  return {
    ...record,
    guid: String(record.guid ?? '').trim() || [record.plu, supplier || 'supplier', record.contract_number, record.basket_number].map(normalize).join('::'),
    category,
    supplier,
    supplier_sap_code: String(record.supplier_sap_code ?? '').trim(),
    contract_number: String(record.contract_number ?? '').trim(),
    basket_number: String(record.basket_number ?? '').trim(),
    pieces_per_pallet: Math.max(0, Math.trunc(numberValue(record.pieces_per_pallet) ?? 0)),
    show_in_analysis: record.show_in_analysis == null
      ? Number(Boolean(supplier) && !['Этикетки', 'Обечайки'].includes(category))
      : Number(Boolean(numberValue(record.show_in_analysis))),
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
  if (!rows('PRAGMA table_info(bom_rows)').some((column) => column.name === 'component_qty_display')) {
    database.run('ALTER TABLE bom_rows ADD COLUMN component_qty_display TEXT');
  }
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
        const record = {}; mapped.forEach((definition, columnIndex) => { if (definition) record[definition[0]] = convert(row[columnIndex], definition[1]); }); if (report.type === 'bom') { record.component_qty_display = excelDisplayValue(sheet, sheetRowIndex, 12); record.component_qty = typeof rawRow[12] === 'number' ? rawRow[12] : bomQuantityValue(rawRow[12], rawRow[13]); } return record;
      }).filter((record) => report.required.every((key) => record[key] != null && record[key] !== '')).map((record) => report.type === 'directory' ? prepareDirectoryRecord(record) : record);
      if (report.type === 'directory') parsed = [...new Map(parsed.map((record) => [record.guid, record])).values()];
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
  const directoryRows = selectedDate ? rows(`SELECT guid id,category,plu,name,supplier,supplier_sap_code supplierSapCode,contract_number contractNumber,basket_number basketNumber,pieces_per_pallet piecesPerPallet,show_in_analysis showInAnalysis,sleeve_format sleeveFormat,sleeve_client sleeveClient,sleeve_print_run sleevePrintRun FROM directory_positions WHERE import_id=(SELECT id FROM data_imports WHERE report_type='directory' AND report_date<=? ORDER BY report_date DESC,id DESC LIMIT 1)`, [selectedDate]) : [];
  const supplyRows = selectedDate ? rows(`SELECT CAST(id AS TEXT) id,week_or_debt weekOrDebt,supply_remainder supplyRemainder,supplier_code supplierCode,supplier_name supplierName,order_created_at orderCreatedAt,planned_delivery_at plannedDeliveryAt,delivered_at deliveredAt,order_number orderNumber,item_code itemCode,item_name itemName,ordered_qty orderedQty,delivered_qty deliveredQty,order_type orderType,deleted,return_flag returnFlag,order_status orderStatus,unit FROM supply_rows WHERE import_id=(SELECT id FROM data_imports WHERE report_type='supplies' AND report_date=? ORDER BY id DESC LIMIT 1)`, [selectedDate]) : [];
  const workshopRows = selectedDate ? rows(`SELECT CAST(id AS TEXT) id,material_number materialNumber,plant,batch,warehouse,unit,free_stock freeStock,quality_stock qualityStock,blocked_stock blocked,material_type materialType,manufactured_at madeAt,shelf_life shelfLife,last_movement_at lastMovement FROM workshop_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='workshop_stock' AND report_date=? ORDER BY id DESC LIMIT 1)`, [selectedDate]) : [];
  const warehouseRows = selectedDate ? rows(`SELECT CAST(id AS TEXT) id,restricted_batch restrictedBatch,warehouse_type warehouseType,storage_bin storageBin,handling_unit handlingUnit,product,consolidation_group consolidationGroup,product_description productDescription,quantity,base_unit baseUnit,movement_date movementDate,shelf_life shelfLife,batch,stock_type stockType,movement_time movementTime,top_handling_unit topHandlingUnit,document,parent_handling_unit parentHandlingUnit,resource FROM warehouse_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='warehouse_stock' AND report_date=? ORDER BY id DESC LIMIT 1)`, [selectedDate]) : [];
  const blockedRows = selectedDate ? rows(`SELECT CAST(id AS TEXT) id,restricted_batch restrictedBatch,warehouse_type warehouseType,storage_bin storageBin,handling_unit handlingUnit,product,consolidation_group consolidationGroup,product_description productDescription,quantity,base_unit baseUnit,movement_date movementDate,shelf_life shelfLife,batch,stock_type stockType,movement_time movementTime,top_handling_unit topHandlingUnit,document,parent_handling_unit parentHandlingUnit,resource FROM blocked_stock WHERE import_id=(SELECT id FROM data_imports WHERE report_type='blocked_stock' AND report_date=? ORDER BY id DESC LIMIT 1)`, [selectedDate]) : [];
  const bomRows = selectedDate ? rows(`SELECT CAST(id AS TEXT) id,level,position,material_type materialType,component_number componentNumber,material_text materialText,phantom_node phantomNode,alternative_position alternativePosition,ranked_list rankedList,alternative_group alternativeGroup,main_plu mainPlu,material_text_1 materialText1,node,COALESCE(component_qty_display,CAST(component_qty AS TEXT)) componentQty,component_qty componentQtyValue,base_unit baseUnit FROM bom_rows WHERE import_id=(SELECT id FROM data_imports WHERE report_type='bom' AND report_date=? ORDER BY id DESC LIMIT 1) ORDER BY id`, [selectedDate]) : [];
  return { selectedDate, dates: rows("SELECT DISTINCT report_date date FROM data_imports WHERE status='completed' AND report_date IS NOT NULL ORDER BY report_date DESC").map((item) => item.date), imports, stockTotals, supplyTotals, directoryRows, supplyRows, workshopRows, warehouseRows, blockedRows, bomRows };
};

ipcMain.handle('data:get-state', () => ({ ...snapshot(), databasePath }));
ipcMain.handle('data:get-snapshot', (_, date) => ({ ...snapshot(date), databasePath }));
ipcMain.handle('data:update', (_, requestedDate) => {
  const reportDate = requestedDate || localDate();
  const folder = getSourceFolder(); if (!folder) throw new Error('Путь к папке Excel не настроен. Создайте локальный файл analiz-rum.config.json по примеру из проекта.');
  if (!fs.existsSync(folder)) throw new Error(`Сетевая папка недоступна: ${folder}`);
  const candidates = fs.readdirSync(folder).filter((name) => /\.xlsx?$/i.test(name)).map((name) => ({ name, path: path.join(folder, name), report: recognize(name), modified: fs.statSync(path.join(folder, name)).mtimeMs })).filter((item) => item.report);
  const latest = [...new Set(candidates.map((item) => item.report.type))].map((type) => candidates.filter((item) => item.report.type === type).sort((a, b) => b.modified - a.modified)[0]);
  if (!latest.length) throw new Error('В выбранной папке не найдены распознаваемые SAP-файлы.');
  database.run('BEGIN'); try { const imported = latest.map((item) => importWorkbook(item.path, item.report, reportDate)); database.run('COMMIT'); persist(); return { ...snapshot(reportDate), databasePath, imported }; } catch (error) { database.run('ROLLBACK'); throw error; }
});

const iconPath = path.resolve(__dirname, '../../assets/delekto-kitchen-icon.png');

const createSplashWindow = () => {
  const splash = new BrowserWindow({
    width: 420,
    height: 360,
    frame: false,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    center: true,
    show: false,
    backgroundColor: '#ffffff',
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
    const remainingSplashTime = Math.max(0, 1200 - (Date.now() - splashStartedAt));
    if (remainingSplashTime) await new Promise((resolve) => setTimeout(resolve, remainingSplashTime));
    createWindow(splash);
  } catch (error) {
    if (!splash.isDestroyed()) splash.close();
    throw error;
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
