import { useMemo, useState } from 'react';

export type SourceReportColumn = {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
};

export type SourceReportRow = Record<string, string | number> & { id: string };

type SourceFilter = {
  id: number;
  field: string;
  value: string;
};

type SourceReportProps = {
  caption: string;
  columns: SourceReportColumn[];
  rows: SourceReportRow[];
  onDeleteRow?: (row: SourceReportRow) => void;
  getRowClassName?: (row: SourceReportRow) => string | undefined;
};

const splitValues = (value: string) =>
  value
    .split(/[\n,;]+/)
    .map((item) => item.trim().toLocaleLowerCase('ru'))
    .filter(Boolean);

const formatCellValue = (row: SourceReportRow, column: SourceReportColumn) => {
  const value = row[column.key];
  if (value === '' || value == null) return '';
  return value;
};

export function SourceReport({ caption, columns, rows, onDeleteRow, getRowClassName }: SourceReportProps) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<SourceFilter[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru');
    const activeFilters = filters.filter((filter) => filter.field && filter.value.trim());

    return rows.filter((row) => {
      const matchesSearch = !query || columns.some((column) =>
        String(row[column.key] ?? '').toLocaleLowerCase('ru').includes(query),
      );

      const matchesFilters = activeFilters.every((filter) => {
        const values = splitValues(filter.value);
        const source = String(row[filter.field] ?? '').toLocaleLowerCase('ru');
        return values.some((value) => source.includes(value));
      });

      return matchesSearch && matchesFilters;
    });
  }, [columns, filters, rows, search]);

  const updateFilter = (id: number, field: 'field' | 'value', value: string) => {
    setFilters((current) => current.map((filter) => filter.id === id ? { ...filter, [field]: value } : filter));
  };

  const addFilter = () => {
    setFilters((current) => [...current, { id: Date.now(), field: columns[0]?.key ?? '', value: '' }]);
    setIsFilterOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setFilters([]);
    setIsFilterOpen(false);
  };

  return (
    <div className="source-report">
      <div className="source-report__toolbar">
        <label className="source-report__search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Найти код, материал, поставщика или значение…"
            aria-label={`Поиск: ${caption}`}
          />
        </label>
        <button className={filters.length ? 'is-active' : ''} type="button" onClick={() => setIsFilterOpen((current) => !current)}>
          Фильтры {filters.length ? `· ${filters.length}` : ''}
        </button>
        <button type="button" onClick={addFilter}>+ Условие</button>
        {(search || filters.length > 0) && <button type="button" onClick={resetFilters}>Сбросить</button>}
        <span className="source-report__count">Колонок <strong>{columns.length}</strong> · показано <strong>{filteredRows.length}</strong> из {rows.length}</span>
      </div>

      {isFilterOpen && (
        <section className="source-report__filters" aria-label={`Фильтры: ${caption}`}>
          <div>
            <strong>Многоуровневый фильтр</strong>
            <span>Условия применяются одновременно. Несколько значений вводите через запятую или с новой строки.</span>
          </div>
          {filters.length === 0 && <p>Добавьте условие, чтобы отфильтровать отчёт по одному или нескольким столбцам.</p>}
          {filters.map((filter) => (
            <div className="source-report__filter-row" key={filter.id}>
              <select value={filter.field} onChange={(event) => updateFilter(filter.id, 'field', event.target.value)}>
                {columns.map((column) => <option value={column.key} key={column.key}>{column.label}</option>)}
              </select>
              <textarea
                rows={2}
                value={filter.value}
                onChange={(event) => updateFilter(filter.id, 'value', event.target.value)}
                placeholder="Одно или несколько значений"
              />
              <button type="button" aria-label="Удалить условие" onClick={() => setFilters((current) => current.filter((item) => item.id !== filter.id))}>×</button>
            </div>
          ))}
          <button className="source-report__add-filter" type="button" onClick={addFilter}>+ Добавить ещё условие</button>
        </section>
      )}

      <div className="source-report__table">
        <table>
          <colgroup>
            {columns.map((column) => <col key={column.key} style={{ width: `${column.width}px` }} />)}
            {onDeleteRow && <col style={{ width: '92px' }} />}
          </colgroup>
          <thead><tr>
            {columns.map((column) => <th className={column.align ? `is-${column.align}` : undefined} key={column.key}>{column.label}</th>)}
            {onDeleteRow && <th className="is-center source-report__action-header">Действие</th>}
          </tr></thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr className={getRowClassName?.(row)} key={row.id}>
                {columns.map((column) => (
                  <td className={column.align ? `is-${column.align}` : undefined} key={column.key}>
                    {formatCellValue(row, column)}
                  </td>
                ))}
                {onDeleteRow && (
                  <td className="source-report__delete-cell">
                    <button type="button" onClick={() => onDeleteRow(row)}>Удалить</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <div className="source-report__empty">По заданным условиям ничего не найдено</div>}
      </div>
    </div>
  );
}
