const key = value => String(value ?? '').trim().toUpperCase().replace(/^0+(?=\d)/, '');
function forecasts(records, overrides) {
  const totals = new Map();
  for (const row of records) {
    if (Number(row.level) === 0) continue;
    const code = key(row.componentNumber);
    if (!code) continue;
    const value = Number(row.componentQtyValue);
    if (!Number.isFinite(value)) throw Error('Некорректное количество компонента: ' + code);
    totals.set(code, (totals.get(code) ?? 0) + value);
  }
  const result = new Map([...totals].map(([materialNumber, weekly]) => [materialNumber, { materialNumber, weekly, dailyForecast: Math.ceil(weekly / 7), manual: false }]));
  for (const row of overrides) result.set(key(row.materialNumber), { materialNumber: key(row.materialNumber), weekly: totals.get(key(row.materialNumber)) ?? 0, dailyForecast: Number(row.dailyForecast), manual: true });
  return [...result.values()];
}
function search(records, input) {
  const codes = new Set(String(input ?? '').split(/[\s,;]+/).filter(Boolean).map(key));
  if (!codes.size) return [];
  if (codes.size > 200) throw Error('Введите не более 200 кодов за один поиск');
  // A GP starts at level 0. Its code and name are stored in the component
  // columns. All following nested rows belong to it until the next level 0.
  const groups = [];
  let current = null;
  for (const row of records) {
    if (Number(row.level) === 0) {
      current = { code: key(row.componentNumber), name: row.materialText, rows: [] };
      groups.push(current);
    }
    if (current) current.rows.push(row);
  }
  return groups
    .filter(group => codes.has(group.code) || group.rows.some(row => codes.has(key(row.componentNumber))))
    .flatMap(group => group.rows.map((row, index) => ({ ...row, gpCode: group.code, gpName: group.name, gpFirst: index === 0 ? 1 : 0 })));
}
module.exports = { key, forecasts, search };
