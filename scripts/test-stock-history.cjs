const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const XLSX = require('xlsx-js-style');

const main = path.resolve(__dirname, '../electron/main/index.cjs');
const source = fs.readFileSync(main, 'utf8').split('const iconPath =')[0];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ar-stock-history-'));
const input = path.join(temp, 'SAP_Reports');
fs.mkdirSync(input);
let testToday = '2026-08-28';
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [testToday + 'T12:00:00'])); }
}
const localRequire = createRequire(main);
async function boot() {
  const handlers = new Map();
  const context = vm.createContext({
    require: Object.assign((name) => name === 'electron' ? {
      app: {
        getPath: () => path.join(temp, 'db'),
        disableHardwareAcceleration: () => {},
        commandLine: { appendSwitch: () => {} },
      },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    } : localRequire(name), { resolve: localRequire.resolve }),
    process: { ...process, env: {
      ...process.env,
      ANALIZ_RUM_SOURCE_FOLDER: input,
      ANALIZ_RUM_DATABASE_FOLDER: path.join(temp, 'db'),
    } },
    __dirname: path.dirname(main), Buffer, console, Date: TestDate,
  });
  vm.runInContext(source + '\nthis.api = { initializeDatabase, reports, rows, run: (sql, params = []) => database.run(sql, params) };', context);
  await context.api.initializeDatabase();
  return { ...context.api, handlers };
}
function fixture(report, qty, folder = input, values = {}) {
  let fields = Object.entries(report.columns).filter((entry, index, all) =>
    all.findIndex((candidate) => candidate[1][0] === entry[1][0]) === index);
  if (report.type === 'bom') {
    fields = fields.filter((entry) => entry[1][0] !== 'component_qty');
    fields = fields.map(([header, definition]) => [definition[0] === 'component_qty_display' ? 'Кол-во компон. (БЕИ)' : header, definition]);
  }
  const data = fields.map(([, [key, type]]) => {
    if (Object.hasOwn(values, key)) return values[key];
    if (key === 'deleted_override') return '';
    if (['product', 'material_number', 'component_number', 'plu', 'item_code'].includes(key)) return '123';
    if (key === 'category') return 'Лотки';
    if (key === 'level') return 0;
    if (type === 'number' || key === 'component_qty_display') return qty;
    if (type === 'integer') return 1;
    if (type === 'date') return '28.08.2026';
    return 'test';
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([fields.map(([header]) => header), data]), 'Data');
  XLSX.writeFile(book, path.join(folder, report.names[0] + '.xlsx'));
}
(async () => {
  let app = await boot();
  const update = (date) => app.handlers.get('data:update')(null, date);
  const snapshot = (date) => app.handlers.get('data:get-snapshot')(null, date);
  app.reports.forEach((report) => fixture(report, 10));
  update('2026-08-28');
  const material = app.handlers.get('data:get-state')().directoryRows[0].plu;
  const saved = app.handlers.get('bom:save-forecast')(null, material, 123.45, '2026-08-28');
  assert.equal(saved.forecastTotals.find(row => row.manual).dailyForecast, 123.45);
  app = await boot();
  assert.equal(app.handlers.get('data:get-state')().forecastTotals.find(row => row.manual).dailyForecast, 123.45);
  assert.throws(() => app.handlers.get('bom:save-forecast')(null, material, -1, '2026-08-28'));
  app.reports.forEach((report) => fixture(report, 20));
  assert.equal(app.handlers.get('data:get-state')().stockTotals[0].warehouse, 10, 'Opening does not import changed Excel');
  testToday = '2026-08-31';
  update('2026-08-31');
  assert.deepEqual(Array.from(app.handlers.get('data:get-state')().dates), ['2026-08-31'], 'A new current refresh removes the previous current date');
  app.reports.forEach((report) => fixture(report, 30));
  update('2026-08-31');
  assert.equal(snapshot('2026-08-31').stockTotals[0].warehouse, 30);
  for (const report of app.reports) {
    assert.equal(app.rows('SELECT COUNT(*) n FROM data_imports WHERE report_type=?', [report.type])[0].n, 1);
    assert.equal(app.rows(`SELECT COUNT(*) n FROM ${report.table}`)[0].n, 1, 'No orphan or duplicate rows: ' + report.type);
  }
  for (const key of ['workshopRows', 'warehouseRows', 'blockedRows']) assert.ok(!(key in snapshot('2026-08-31')));
  assert.equal(snapshot('2026-08-31').forecastTotals.find(row => row.manual).dailyForecast, 123.45, 'Manual survives report refresh');
  app.handlers.get('bom:save-forecast')(null, material, null, '2026-08-31');
  assert.ok(!snapshot('2026-08-31').forecastTotals.some(row => row.manual));
  assert.equal(snapshot('2026-08-31').stockTotals[0].production, 30);
  assert.equal(snapshot('2026-08-31').stockTotals[0].blocked, 30);
  app.reports.forEach((report) => fixture(report, 40));
  const invalid = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(invalid, XLSX.utils.aoa_to_sheet([['invalid']]), 'Data');
  XLSX.writeFile(invalid, path.join(input, 'разузловка.xlsx'));
  assert.throws(() => update('2026-08-31'));
  assert.equal(snapshot('2026-08-31').stockTotals[0].warehouse, 30, 'Failed batch rolls back');
  app = await boot();
  assert.deepEqual(Array.from(app.handlers.get('data:get-state')().dates), ['2026-08-31'], 'Only the latest current snapshot survives restart');
  assert.equal(snapshot('2026-08-31').stockTotals[0].warehouse, 30);
  app.reports.forEach((report) => fixture(report, 40));
  testToday = '2026-09-01';
  update('2026-09-01');
  assert.equal(snapshot('2026-09-01').stockTotals[0].warehouse, 40);
  assert.deepEqual(Array.from(app.handlers.get('data:get-state')().dates), ['2026-09-01']);
  const { archiveFolder } = require('../electron/main/archive.cjs');
  assert.equal(archiveFolder(input, '2027-01-04'), path.join(temp, '2027', 'январь', '04.01.27'));
  assert.throws(() => archiveFolder(input, '2026-02-30'));
  assert.throws(() => snapshot('2027-01-04'), /будущую/);
  const archive = archiveFolder(input, '2026-08-27');
  fs.mkdirSync(archive, { recursive: true });
  const archiveReports = app.reports.filter((report) => report.type !== 'directory');
  archiveReports.forEach((report) => fixture(report, 50, archive));
  const originals = fs.readdirSync(archive).map((name) => [name, fs.readFileSync(path.join(archive, name))]);
  assert.equal(snapshot('2026-08-27').stockTotals[0].warehouse, 50, 'Missing snapshot loads exact archive day');
  assert.equal(app.rows('SELECT COUNT(*) n FROM data_imports WHERE report_date=?', ['2026-08-27'])[0].n, 5);
  originals.forEach(([name, bytes]) => assert.deepEqual(fs.readFileSync(path.join(archive, name)), bytes, 'Archive file not modified'));
  archiveReports.forEach((report) => fixture(report, 60, archive));
  assert.equal(snapshot('2026-08-27').stockTotals[0].warehouse, 50, 'Saved snapshot wins until explicit refresh');
  update('2026-08-27');
  assert.equal(snapshot('2026-08-27').stockTotals[0].warehouse, 60, 'Explicit refresh replaces only archived day');
  assert.equal(snapshot('2026-09-01').stockTotals[0].warehouse, 40);
  fs.renameSync(path.join(archive, 'поставки.xlsx'), path.join(archive, 'поставки.hidden'));
  assert.throws(() => update('2026-08-27'), /Нужен ровно один/);
  assert.equal(snapshot('2026-08-27').stockTotals[0].warehouse, 60, 'Missing file cannot destroy snapshot');
  fs.renameSync(path.join(archive, 'поставки.hidden'), path.join(archive, 'поставки.xlsx'));
  fs.copyFileSync(path.join(archive, 'поставки.xlsx'), path.join(archive, 'поставки copy.xlsx'));
  assert.throws(() => update('2026-08-27'), /Нужен ровно один/);
  fs.unlinkSync(path.join(archive, 'поставки copy.xlsx'));
  XLSX.writeFile(invalid, path.join(archive, 'разузловка.xlsx'));
  assert.throws(() => update('2026-08-27'));
  assert.equal(snapshot('2026-08-27').stockTotals[0].warehouse, 60);
  assert.throws(() => snapshot('2026-08-26'), /недоступна/);
  app = await boot();
  assert.equal(snapshot('2026-08-27').stockTotals[0].warehouse, 60, 'Archived snapshot survives restart without rereading invalid source');
  const directoryReport = app.reports.find((report) => report.type === 'directory');
  fixture(directoryReport, 1, input, { guid: 'active-123', plu: '123', name: 'Current name', sleeve_client: 'Current client' });
  const currentFile = path.join(input, directoryReport.names[0] + '.xlsx');
  const currentBytes = fs.readFileSync(currentFile);
  const oldView = snapshot('2026-08-27');
  assert.equal(oldView.directoryRows[0].name, 'Current name', 'Historical date uses current workbook, not dated directory');
  assert.equal(oldView.stockTotals[0].warehouse, 60, 'Current directory does not replace historical stocks');
  assert.deepEqual(fs.readFileSync(currentFile), currentBytes, 'Directory is read-only when selecting date');
  fixture(directoryReport, 1, input, { guid: 'active-456', plu: '456', name: 'New active item' });
  const currentView = snapshot('2026-08-27');
  assert.deepEqual(Array.from(currentView.directoryRows, (row) => row.plu), ['456'], 'Removed item is not resurrected from old directory');
  assert.ok(!currentView.stockTotals.some((row) => row.materialNumber === '456'), 'New item has no invented historical stock');
  assert.equal(currentView.stockTotals[0].warehouse, 60, 'Historical raw reports are retained');
  const workbook = XLSX.readFile(currentFile);
  const activeSheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(activeSheet, { header: 1 });
  const twoSheets = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet(matrix), 'Неликвидные позиции');
  XLSX.utils.book_append_sheet(twoSheets, XLSX.utils.aoa_to_sheet([matrix[0]]), 'Активные позиции');
  XLSX.writeFile(twoSheets, currentFile);
  assert.equal(snapshot('2026-08-27').directoryRows.length, 0, 'Empty active list does not import inactive sheet');
  fs.renameSync(currentFile, currentFile + '.hidden');
  assert.throws(() => snapshot('2026-08-28'), /Нужен один актуальный/);
  assert.equal(app.handlers.get('data:get-state')().stockTotals[0].warehouse, 40, 'Missing directory cannot destroy data');
  fs.renameSync(currentFile + '.hidden', currentFile);
  testToday = '2026-09-02';
  snapshot('2026-08-27');
  const state = app.handlers.get('data:get-state')();
  assert.equal(state.selectedDate, '2026-09-01', 'Directory-only refresh does not create a report date');
  assert.ok(!state.dates.includes('2026-09-02'));
  // Numeric source cells must survive Excel thousands formatting and multiple locations.
  testToday = '2026-09-03';
  app.reports.forEach((report) => fixture(report, 1));
  function locations(reportType, items) {
    const report = app.reports.find((item) => item.type === reportType);
    const file = path.join(input, report.names[0] + '.xlsx');
    const book = XLSX.readFile(file);
    const matrix = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true });
    const fields = matrix[0].map((header) => report.columns[header]?.[0]);
    const sheet = XLSX.utils.aoa_to_sheet([matrix[0], ...items.map((item) => fields.map((field, index) => Object.hasOwn(item, field) ? item[field] : matrix[1][index]))]);
    items.forEach((item, index) => {
      for (const field of ['quantity', 'free_stock']) {
        const column = fields.indexOf(field);
        if (column >= 0) sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })].z = '#,##0.00';
      }
    });
    book.Sheets[book.SheetNames[0]] = sheet;
    XLSX.writeFile(book, file);
    return file;
  }
  const warehouseFile = locations('warehouse_stock', [
    { product: '123', quantity: 7200, storage_bin: 'A' },
    { product: '000123', quantity: 7200, storage_bin: 'B' },
    ...[10000, 20000, 30000, 40000, 5000, 3000, 3000, 850].map((quantity, index) => ({ product: index % 2 ? '000789' : '789', quantity, storage_bin: 'S' + index })),
  ]);
  locations('workshop_stock', [50000, 40000, 30000, 20000, 20000, 10000.47].map((free_stock, index) => ({ material_number: index % 2 ? '000123' : '123', warehouse: ['C063', 'C063', 'C062', 'C051', 'C051', 'C050'][index], free_stock, quality_stock: 500, blocked_stock: 10 })));
  update('2026-09-03');
  assert.deepEqual(Array.from(app.handlers.get('data:get-state')().dates), ['2026-09-03'], 'Current refresh removes temporary archive snapshots');
  assert.equal(app.rows('PRAGMA foreign_key_check').length, 0, 'Current refresh leaves no foreign-key violations');
  const stockResult = snapshot('2026-09-03').stockTotals;
  assert.equal(stockResult.filter((item) => item.materialNumber === '123').length, 1, 'One normalized material key across locations and reports');
  const tray = stockResult.find((item) => item.materialNumber === '123');
  assert.equal(tray.warehouse, 14400);
  assert.ok(Math.abs(tray.production - 170000.47) < 1e-8, 'All six workshop rows, free stock only, no rounding');
  assert.ok(Math.abs(tray.warehouse + tray.production - 184400.47) < 1e-8);
  assert.equal(stockResult.find((item) => item.materialNumber === '789').warehouse, 111850, 'All eight storage locations');
  const numericBook = XLSX.readFile(warehouseFile);
  const numericSheet = numericBook.Sheets[numericBook.SheetNames[0]];
  const quantityColumn = XLSX.utils.sheet_to_json(numericSheet, { header: 1 })[0].indexOf('Количество');
  const numericCell = numericSheet[XLSX.utils.encode_cell({ r: 1, c: quantityColumn })];
  numericCell.v = 7.2; numericCell.z = '0.000'; delete numericCell.w;
  XLSX.writeFile(numericBook, warehouseFile);
  update('2026-09-03');
  assert.equal(snapshot('2026-09-03').stockTotals.find((item) => item.materialNumber === '123').warehouse, 7207.2, 'Genuine decimals are never multiplied by 1000');
  numericCell.t = 's'; numericCell.v = '7.200'; delete numericCell.w;
  XLSX.writeFile(numericBook, warehouseFile);
  assert.throws(() => update('2026-09-03'), /Неоднозначное количество/);
  assert.equal(snapshot('2026-09-03').stockTotals.find((item) => item.materialNumber === '123').warehouse, 7207.2, 'Ambiguous text cannot corrupt saved totals');
  console.log('PASS: 2 locations = 14400; 8 locations = 111850; 6 workshop rows = 170000.47; normalized codes; numeric raw precision; ambiguous text rollback');
  console.log('PASS: current directory with old stocks, removed/new items, empty active sheet, inactive sheet excluded, no Excel writes, no false report dates');
  console.log('PASS: history, replacement, restart, rollback, archive paths, cache, explicit reread, missing/duplicate/invalid files, no Excel writes');
  fs.rmSync(temp, { recursive: true, force: true });
})().catch((error) => { console.error(error); console.error('Test fixtures:', temp); process.exitCode = 1; });
