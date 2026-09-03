const fs = require('node:fs');
const path = require('node:path');

const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const requiredTypes = ['supplies', 'bom', 'workshop_stock', 'warehouse_stock', 'blocked_stock'];

function validateDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Выберите дату в календаре.');
  const parsed = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Некорректная дата.');
  return value;
}

function archiveFolder(sourceFolder, date) {
  validateDate(date);
  if (!sourceFolder) throw new Error('Папка SAP_Reports не настроена.');
  const clean = sourceFolder.replace(/[\\/]+$/, '');
  if (path.basename(clean).toLowerCase() !== 'sap_reports') throw new Error('Для архива источник должен указывать на папку SAP_Reports внутри «Ежедневная проверка».');
  const [year, month, day] = date.split('-');
  return path.join(path.dirname(clean), year, months[Number(month) - 1], `${day}.${month}.${year.slice(-2)}`);
}

function createDateLoader({ today, getSourceFolder, snapshot, importFolder }) {
  return (value, refresh = false) => {
    const date = validateDate(value || today());
    if (date > today()) throw new Error('Нельзя загрузить отчёты за будущую дату.');
    const saved = snapshot(date);
    const complete = requiredTypes.every((type) => saved.imports.some((item) => item.report_type === type));
    const source = getSourceFolder();
    // The directory is current even when the report snapshot is already cached.
    // Selecting today refreshes only the directory, not today's SAP reports.
    const readReports = refresh || (date < today() && !complete);
    const historical = date < today();
    return importFolder(date, readReports && historical ? archiveFolder(source, date) : source, historical, readReports);
  };
}

function selectReports(folder, recognize, historical) {
  if (!folder || !fs.existsSync(folder)) throw new Error(`Папка отчётов недоступна: ${folder || '(не настроена)'}`);
  const files = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('~$') && /\.xlsx?$/i.test(entry.name))
    .map(({ name }) => ({ name, path: path.join(folder, name), report: recognize(name), modified: fs.statSync(path.join(folder, name)).mtimeMs }))
    .filter((item) => item.report && (!historical || requiredTypes.includes(item.report.type)));
  for (const type of requiredTypes) {
    const matches = files.filter((item) => item.report.type === type);
    if (historical && matches.length !== 1) throw new Error(`Архив ${folder}: для отчёта ${type} найдено файлов: ${matches.length}. Нужен ровно один. Данные не изменены.`);
    if (!historical && matches.length === 0) throw new Error(`В текущей папке не найден обязательный отчёт ${type}. Данные не изменены.`);
  }
  if (!files.length) throw new Error('В папке нет распознаваемых SAP-отчётов.');
  return [...new Set(files.map((item) => item.report.type))].map((type) => files.filter((item) => item.report.type === type).sort((a, b) => b.modified - a.modified)[0]);
}

function selectDirectory(folder, recognize) {
  if (!folder || !fs.existsSync(folder)) throw new Error('Папка текущего справочника SAP_Reports недоступна.');
  const matches = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('~$') && /\.xlsx?$/i.test(entry.name) && recognize(entry.name)?.type === 'directory');
  if (matches.length !== 1) throw new Error(`В SAP_Reports найдено справочников: ${matches.length}. Нужен один актуальный файл. Данные не изменены.`);
  const file = path.join(folder, matches[0].name);
  return { path: file, report: recognize(matches[0].name) };
}

function saveDatabase(file, bytes) {
  const temporary = file + '.' + require('node:crypto').randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, Buffer.from(bytes), { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { createDateLoader, selectReports, selectDirectory, archiveFolder, validateDate, saveDatabase };
