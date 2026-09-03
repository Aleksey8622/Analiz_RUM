const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const XLSX = require('xlsx-js-style');

const mode = process.argv[2];
const root = path.resolve(__dirname, '..');
const stateDir = path.join(root, '.analysis-room-sync');
const baselineDir = path.join(stateDir, 'baseline');
const configPath = path.join(root, '.analysis-room-sync.json');
const rootFiles = ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json', 'vite.config.ts', 'index.html'];
const roots = ['src', 'electron', 'database', 'scripts', 'assets', 'public'];
const extensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.css', '.html', '.json', '.sql', '.ps1', '.cmd', '.md', '.png', '.ico']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.cjs', '.css', '.html', '.json', '.sql', '.ps1', '.cmd', '.md']);
const chunkSize = 28000;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const normalizeText = (value) => value.replace(/\r\n/g, '\n');
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
const hashText = (value) => hash(Buffer.from(normalizeText(value), 'utf8'));
const relative = (file) => path.relative(root, file).split(path.sep).join('/');
const safeTarget = (relativePath) => {
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`Недопустимый путь: ${relativePath}`);
  return target;
};

const walk = (folder, result = []) => {
  if (!fs.existsSync(folder)) return result;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) walk(target, result);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) result.push(target);
  }
  return result;
};

const trackedFiles = () => {
  const files = roots.flatMap((folder) => walk(path.join(root, folder)));
  for (const file of rootFiles) if (fs.existsSync(path.join(root, file))) files.push(path.join(root, file));
  return [...new Set(files)].filter((file) => !relative(file).startsWith('scripts/work-sync.local.')).sort();
};

const readFile = (file) => {
  if (!fs.existsSync(file)) return null;
  const extension = path.extname(file).toLowerCase();
  const buffer = fs.readFileSync(file);
  return textExtensions.has(extension) ? normalizeText(buffer.toString('utf8').replace(/^\uFEFF/, '')) : buffer.toString('base64');
};

const writeFile = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const extension = path.extname(file).toLowerCase();
  if (textExtensions.has(extension)) fs.writeFileSync(file, normalizeText(content), 'utf8');
  else fs.writeFileSync(file, Buffer.from(content, 'base64'));
};

const contentHash = (file, content) => {
  if (content == null) return '';
  return textExtensions.has(path.extname(file).toLowerCase()) ? hashText(content) : hash(Buffer.from(content, 'base64'));
};

const snapshotBaseline = () => {
  fs.rmSync(baselineDir, { recursive: true, force: true });
  for (const file of trackedFiles()) {
    const destination = path.join(baselineDir, relative(file));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(file, destination);
  }
};

const baselineMap = () => {
  const map = new Map();
  for (const file of walk(baselineDir)) map.set(relative(path.join(root, path.relative(baselineDir, file))), readFile(file));
  return map;
};

const currentMap = () => new Map(trackedFiles().map((file) => [relative(file), readFile(file)]));

const changesFromBaseline = () => {
  const before = baselineMap();
  const after = currentMap();
  const names = [...new Set([...before.keys(), ...after.keys()])].sort();
  return names.flatMap((name) => {
    const oldText = before.has(name) ? before.get(name) : null;
    const newText = after.has(name) ? after.get(name) : null;
    if (oldText === newText) return [];
    let start = 0;
    const oldValue = oldText ?? '';
    const newValue = newText ?? '';
    while (start < oldValue.length && start < newValue.length && oldValue[start] === newValue[start]) start += 1;
    let suffix = 0;
    while (suffix < oldValue.length - start && suffix < newValue.length - start && oldValue[oldValue.length - 1 - suffix] === newValue[newValue.length - 1 - suffix]) suffix += 1;
    return [{
      path: name,
      operation: oldText == null ? 'add' : newText == null ? 'delete' : 'replace',
      start,
      oldFragment: oldValue.slice(start, oldValue.length - suffix),
      newFragment: newValue.slice(start, newValue.length - suffix),
      baseHash: contentHash(name, oldText),
      targetHash: contentHash(name, newText),
    }];
  });
};

const openWorkbook = (file) => XLSX.readFile(file, { cellStyles: true });
const rowsOf = (workbook, name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: '', raw: false });
const appendRows = (sheet, rows) => XLSX.utils.sheet_add_json(sheet, rows, { skipHeader: true, origin: -1 });

const updateDevice = (workbook, config, status) => {
  const sheet = workbook.Sheets['Устройства'];
  const rows = rowsOf(workbook, 'Устройства');
  let index = rows.findIndex((row) => String(row['Устройство']) === config.device);
  const item = { 'Устройство': config.device, 'Папка проекта': root, 'Последняя версия': config.installedVersion, 'Дата синхронизации': new Date().toLocaleString('ru-RU'), 'Статус': status };
  if (index < 0) appendRows(sheet, [item]);
  else {
    index += 2;
    Object.values(item).forEach((value, column) => { sheet[XLSX.utils.encode_cell({ r: index - 1, c: column })] = { t: 's', v: String(value) }; });
  }
};

const withLock = (workbookPath, action) => {
  const lock = `${workbookPath}.lock`;
  let descriptor;
  try {
    descriptor = fs.openSync(lock, 'wx');
    fs.writeFileSync(descriptor, `${process.pid}|${new Date().toISOString()}|${root}`);
    return action();
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Файл синхронизации сейчас используется другим устройством. Закройте Excel и повторите позже.');
    throw error;
  } finally {
    if (descriptor != null) fs.closeSync(descriptor);
    if (descriptor != null) fs.rmSync(lock, { force: true });
  }
};

const ensureClean = () => {
  if (!fs.existsSync(baselineDir)) return;
  const changes = changesFromBaseline().filter((item) => item.path !== 'scripts/work-sync.cjs');
  if (changes.length) throw new Error(`Перед синхронизацией есть неопубликованные изменения: ${changes.map((item) => item.path).join(', ')}`);
};

const sync = (config) => withLock(config.workbook, () => {
  ensureClean();
  const workbook = openWorkbook(config.workbook);
  const updates = rowsOf(workbook, 'Обновления');
  const currentIndex = updates.findIndex((row) => String(row['Версия']) === config.installedVersion);
  if (currentIndex < 0) throw new Error(`Версия ${config.installedVersion} отсутствует в Excel.`);
  const pending = updates.slice(currentIndex + 1).filter((row) => row['Версия']);
  if (!pending.length) {
    console.log('Новых обновлений нет. Проект уже синхронизирован.');
    return;
  }
  const allChanges = rowsOf(workbook, 'Изменения');
  const backupRoot = path.join(stateDir, 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  for (const update of pending) {
    const version = String(update['Версия']);
    if (String(update['Предыдущая версия']) !== config.installedVersion) throw new Error(`Нарушена последовательность версий перед ${version}.`);
    const versionRows = allChanges.filter((row) => String(row['Версия']) === version);
    const fileNames = [...new Set(versionRows.map((row) => String(row['Путь файла'])))];
    for (const fileName of fileNames) {
      const parts = versionRows.filter((row) => String(row['Путь файла']) === fileName).sort((a, b) => Number(a['Порядок']) - Number(b['Порядок']));
      const first = parts[0];
      const target = safeTarget(fileName);
      const current = readFile(target);
      const operation = String(first['Операция']);
      if (operation !== 'full' && contentHash(fileName, current) !== String(first['Исходная сумма'])) throw new Error(`Файл изменён локально и не может быть обновлён: ${fileName}`);
      if (current != null) {
        const backup = path.join(backupRoot, fileName);
        fs.mkdirSync(path.dirname(backup), { recursive: true });
        fs.copyFileSync(target, backup);
      }
      const oldFragment = parts.map((row) => String(row['Старый текст'])).join('');
      const newFragment = parts.map((row) => String(row['Новый текст'])).join('');
      const start = Number(first['Начало фрагмента']);
      const source = current ?? '';
      if (operation !== 'full' && source.slice(start, start + oldFragment.length) !== oldFragment) throw new Error(`Не совпал изменяемый фрагмент: ${fileName}`);
      const result = operation === 'full' ? newFragment : source.slice(0, start) + newFragment + source.slice(start + oldFragment.length);
      if (operation === 'delete') fs.rmSync(target, { force: true }); else writeFile(target, result);
      if (contentHash(fileName, readFile(target)) !== String(first['Новая сумма'])) throw new Error(`Ошибка проверки после записи: ${fileName}`);
    }
    config.installedVersion = version;
    writeJson(configPath, config);
  }
  snapshotBaseline();
  updateDevice(workbook, config, 'Синхронизировано');
  XLSX.writeFile(workbook, config.workbook);
  console.log(`Применено обновлений: ${pending.length}. Текущая версия: ${config.installedVersion}`);
});

const publish = (config) => withLock(config.workbook, () => {
  const workbook = openWorkbook(config.workbook);
  const updates = rowsOf(workbook, 'Обновления').filter((row) => row['Версия']);
  const latest = String(updates[updates.length - 1]['Версия']);
  if (latest !== config.installedVersion) throw new Error(`Сначала выполните start-work: в Excel уже есть версия ${latest}.`);
  const changes = changesFromBaseline().filter((item) => item.path !== '.analysis-room-sync.json');
  if (!changes.length) {
    console.log('Изменений для публикации нет.');
    updateDevice(workbook, config, 'Без изменений');
    XLSX.writeFile(workbook, config.workbook);
    return;
  }
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const version = `AR-${stamp}-${config.device.replace(/[^a-zа-я0-9]+/gi, '-').slice(0, 30)}`;
  const changeRows = [];
  let sequence = 1;
  for (const change of changes) {
    const chunks = Math.max(1, Math.ceil(Math.max(change.oldFragment.length, change.newFragment.length) / chunkSize));
    for (let index = 0; index < chunks; index += 1) {
      changeRows.push({
        'Версия': version,
        'Порядок': sequence++,
        'Операция': change.operation,
        'Путь файла': change.path,
        'Исходная сумма': change.baseHash,
        'Новая сумма': change.targetHash,
        'Начало фрагмента': change.start,
        'Старый текст': change.oldFragment.slice(index * chunkSize, (index + 1) * chunkSize),
        'Новый текст': change.newFragment.slice(index * chunkSize, (index + 1) * chunkSize),
      });
    }
  }
  appendRows(workbook.Sheets['Обновления'], [{
    'Версия': version,
    'Предыдущая версия': config.installedVersion,
    'Дата': new Date().toLocaleString('ru-RU'),
    'Устройство': config.device,
    'Описание': `Изменения ${changes.map((item) => item.path).join(', ')}`,
    'Количество изменений': changes.length,
    'Контрольная сумма': hashText(JSON.stringify(changeRows)),
    'Статус': 'Опубликовано',
  }]);
  appendRows(workbook.Sheets['Изменения'], changeRows);
  config.installedVersion = version;
  writeJson(configPath, config);
  snapshotBaseline();
  updateDevice(workbook, config, 'Опубликовано');
  XLSX.writeFile(workbook, config.workbook);
  console.log(`Опубликована версия ${version}. Изменено файлов: ${changes.length}.`);
});

try {
  if (!fs.existsSync(configPath)) throw new Error('Не найден .analysis-room-sync.json');
  const config = readJson(configPath);
  if (!fs.existsSync(config.workbook)) throw new Error(`Не найден Excel: ${config.workbook}`);
  if (mode === 'sync') sync(config);
  else if (mode === 'publish') publish(config);
  else if (mode === 'baseline') { snapshotBaseline(); console.log('Базовая копия обновлена.'); }
  else throw new Error('Режим должен быть sync, publish или baseline.');
} catch (error) {
  console.error(`ОШИБКА СИНХРОНИЗАЦИИ: ${error.message}`);
  process.exit(1);
}
