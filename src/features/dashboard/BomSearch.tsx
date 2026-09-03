import { useEffect, useRef, useState } from 'react';
import type { DataState, DatabaseReportRow } from '../../types/desktop';
import { SourceReport, type SourceReportColumn } from './SourceReport';

const columns: SourceReportColumn[] = [
  { key: 'level', label: 'Уровень разузловки', width: 155 },
  { key: 'position', label: 'Позиция', width: 105 },
  { key: 'materialType', label: 'Вид материала', width: 125 },
  { key: 'componentNumber', label: '№ компонента', width: 135 },
  { key: 'materialText', label: 'Краткий текст материала', width: 310 },
  { key: 'phantomNode', label: 'Фиктивный узел', width: 135 },
  { key: 'alternativePosition', label: 'Альтернативная позиция', width: 165 },
  { key: 'rankedList', label: 'Ранговый список', width: 135 },
  { key: 'alternativeGroup', label: 'ГруппаАльтПоз', width: 135 },
  { key: 'mainPlu', label: 'Основное PLU', width: 125 },
  { key: 'materialText1', label: 'Краткий текст материала_1', width: 310 },
  { key: 'node', label: 'Узел', width: 90 },
  { key: 'componentQty', label: 'Кол-во компон. (БЕИ)', width: 165, align: 'right' },
  { key: 'baseUnit', label: 'БЕИ', width: 80 },
];
const key = (value: string) => value.trim().toUpperCase().replace(/^0+(?=\d)/, '');
export function BomSearch({ state, onChange }: { state: DataState | null; onChange: (state: DataState) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DatabaseReportRow[]>([]);
  const [message, setMessage] = useState('Введите GP или код компонента. Разузловка отображается только по запросу.');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const request = useRef(0);
  useEffect(() => { request.current += 1; setResult([]); setBusy(false); setMessage('Введите GP или код компонента. Разузловка отображается только по запросу.'); }, [state?.selectedDate]);
  const position = state?.directoryRows.find(row => key(row.plu) === key(code));
  const forecast = state?.forecastTotals?.find(row => key(row.materialNumber) === key(code));
  const search = async (requestedQuery = query) => {
    if (!window.analizRum) return;
    const id = ++request.current; setBusy(true); setResult([]);
    try {
      const rows = await window.analizRum.searchBom(state?.selectedDate ?? null, requestedQuery);
      if (id !== request.current) return;
      setResult(rows); setMessage(rows.length ? `Найдено строк: ${rows.length}. Показаны полные GP-блоки в исходном порядке.` : 'Совпадений нет. Для позиции из справочника можно задать ручной прогноз ниже.');
    } catch (error) { if (id === request.current) setMessage(String(error)); }
    finally { if (id === request.current) setBusy(false); }
  };
  const save = async (remove: boolean) => {
    if (!window.analizRum || !position) return;
    const number = Number(value.replace(',', '.'));
    if (!remove && (!value.trim() || !Number.isFinite(number) || number < 0)) { setMessage('Введите прогноз: число от 0 и выше.'); return; }
    setBusy(true);
    try {
      onChange(await window.analizRum.saveForecast(code, remove ? null : number, state?.selectedDate ?? null));
      setMessage(remove ? 'Ручной прогноз удалён. Используется расчёт из разузловки.' : 'Ручной прогноз сохранён в базе. Обновление отчётов его не изменит.');
      setValue('');
    } catch (error) { setMessage(String(error)); }
    finally { setBusy(false); }
  };
  return <section>
    <form className="sleeve-toolbar" onSubmit={event => { event.preventDefault(); void search(); }}>
      <textarea aria-label="Коды GP или компонентов" rows={2} value={query} onChange={event => setQuery(event.target.value)} placeholder="GP или коды компонентов — через пробел, точку с запятой или с новой строки" />
      <button className="dashboard-button dashboard-button--primary" disabled={busy || !query.trim()}>Найти</button>
      <button type="button" disabled={busy} onClick={() => { request.current += 1; setQuery(''); setResult([]); setMessage('Введите GP или код компонента. Разузловка отображается только по запросу.'); }}>Очистить</button>
    </form>
    <p role="status">{busy ? 'Выполняется запрос…' : message}</p>
    <fieldset disabled={busy}><legend>Ручной прогноз в день</legend>
      <p>Действует для всех дат до удаления, имеет приоритет над расчётом из разузловки.</p>
      <label>Код позиции <input value={code} onChange={event => { setCode(event.target.value); setValue(''); }} /></label>
      <span> {position?.name ?? 'Выберите позицию из справочника'} </span>
      {position && <span>Прогноз: {new Intl.NumberFormat('ru-RU').format(forecast?.dailyForecast ?? 0)} ({forecast?.manual ? 'ручной' : 'разузловка / 7'}) </span>}
      <label>Новое значение <input inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} /></label>
      <button type="button" disabled={!position} onClick={() => void save(false)}>Сохранить</button>
      <button type="button" disabled={!position || !forecast?.manual} onClick={() => void save(true)}>Удалить ручной прогноз</button>
    </fieldset>
    {result.length > 0 && <SourceReport key={`${state?.selectedDate ?? ''}:${query.trim()}`} caption="Найденные GP" columns={columns} rows={result} preserveSourceOrder variant="bom" getRowClassName={row => Number(row.gpFirst) === 1 ? 'source-report__bom-root' : undefined} />}
  </section>;
}
