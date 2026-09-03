const assert = require('node:assert/strict');
const { search } = require('../electron/main/bom-analysis.cjs');

const rows = [
  { id: '17', level: 0, componentNumber: '3681003', materialText: 'ФК Каша молочная рисовая 250г', mainPlu: '', materialText1: '' },
  { id: '21', level: 1, componentNumber: '80396576', materialText: 'Лоток PP 115*57', mainPlu: '', materialText1: '' },
  { id: '22', level: 1, componentNumber: '80371309', materialText: 'Пленка ПЭТ/ПЭ 420мм', mainPlu: '', materialText1: '' },
  { id: '23', level: 1, componentNumber: '80413601', materialText: 'Обечайка', mainPlu: '', materialText1: '' },
  { id: '24', level: 3, componentNumber: '4920', materialText: 'Сахар-песок', mainPlu: '4920', materialText1: 'Сахар-песок' },
  { id: '29', level: 3, componentNumber: '2745', materialText: 'Соль', mainPlu: '2745', materialText1: 'Соль' },
  { id: '41', level: 0, componentNumber: '3681151', materialText: 'ФК Салат Мимоза 200г', mainPlu: '', materialText1: '' },
  { id: '48', level: 1, componentNumber: '80373103', materialText: 'Пленка ПЭТ', mainPlu: '', materialText1: '' },
  { id: '62', level: 4, componentNumber: '2745', materialText: 'Соль', mainPlu: '2745', materialText1: 'Соль' },
];

assert.deepEqual(search(rows, ''), [], 'Empty search does not render the complete BOM');
assert.deepEqual(search(rows, '3681003').map(row => row.id), ['17', '21', '22', '23', '24', '29'], 'GP search keeps root, tray, film, sleeve and ingredients in Excel order');
assert.deepEqual(search(rows, '80373103').map(row => row.id), ['41', '48', '62'], 'Nested component search returns its complete GP block');
assert.deepEqual(search(rows, '2745').map(row => row.id), ['17', '21', '22', '23', '24', '29', '41', '48', '62'], 'A shared component returns every containing GP');
assert.deepEqual(search(rows, '80396576 3681151').map(row => row.id), ['17', '21', '22', '23', '24', '29', '41', '48', '62'], 'Multiple codes preserve source GP order');
assert.deepEqual(search(rows, '404'), [], 'Unknown code returns no rows');
assert.deepEqual(search(rows, '2745').map(row => row.gpCode), ['3681003', '3681003', '3681003', '3681003', '3681003', '3681003', '3681151', '3681151', '3681151'], 'Основное PLU never replaces the level-zero GP code');

console.log('PASS: query-only BOM, level-zero GP boundaries, complete blocks and source order');
