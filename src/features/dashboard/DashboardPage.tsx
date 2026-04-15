import { useEffect, useMemo, useRef, useState } from 'react';
import './DashboardPage.css';

type FilterRow = {
  id: number;
  field: string;
  operator: string;
  value: string;
};

type FilterInputName = Exclude<keyof FilterRow, 'id'>;

const rows = [
  {
    id: 'D2177054',
    supplier: 'ООО ТК АНС',
    group: 'WOO',
    category: 'Бакалея',
    orderDate: '08.04.2026',
    deliveryDate: '15.04.2026',
    pallets: 3,
    boxes: 96,
    status: 'В работе',
  },
  {
    id: 'D2177887',
    supplier: 'ООО ТОНТ',
    group: 'DPH',
    category: 'Бакалея',
    orderDate: '08.04.2026',
    deliveryDate: '15.04.2026',
    pallets: 1,
    boxes: 0,
    status: 'Проверить',
  },
  {
    id: 'D2177076',
    supplier: 'АО Ресурс',
    group: 'NON FOOD',
    category: 'Хозтовары',
    orderDate: '08.04.2026',
    deliveryDate: '20.04.2026',
    pallets: 17,
    boxes: 132,
    status: 'Готово',
  },
];

const filterFields = ['Группа закупок', 'Заказ промо', 'Дата заказа', 'Поставщик', 'Группа'];
const filterOperators = ['Содержит', 'Равно', 'Не равно', 'Больше', 'Меньше'];

function DashboardPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterRow[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterRow[]>([]);
  const sidebarRef = useRef<HTMLElement>(null);
  const filterAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!sidebarRef.current || sidebarRef.current.contains(event.target as Node)) {
        return;
      }

      setIsSidebarOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!filterAreaRef.current || filterAreaRef.current.contains(event.target as Node)) {
        return;
      }

      setIsFilterPanelOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const visibleFilters = useMemo(
    () => activeFilters.filter((filter) => filter.field || filter.operator || filter.value),
    [activeFilters],
  );

  const handleFilterChange = (id: number, field: FilterInputName, value: string) => {
    setDraftFilters((current) =>
      current.map((filter) => (filter.id === id ? { ...filter, [field]: value } : filter)),
    );
  };

  const addFilter = () => {
    setDraftFilters((current) => [
      ...current,
      {
        id: Date.now(),
        field: '',
        operator: '',
        value: '',
      },
    ]);
  };

  const removeFilter = (id: number) => {
    setDraftFilters((current) => current.filter((filter) => filter.id !== id));
  };

  const applyFilters = () => {
    setActiveFilters(draftFilters.filter((filter) => filter.field || filter.operator || filter.value));
    setIsFilterPanelOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters([]);
    setActiveFilters([]);
    setIsFilterPanelOpen(false);
  };

  return (
    <main className="dashboard-page">
      <aside
        ref={sidebarRef}
        className={`dashboard-sidebar ${isSidebarOpen ? 'is-open' : ''}`}
        aria-label="Основная навигация"
      >
        <button
          className="dashboard-sidebar__toggle"
          type="button"
          aria-label={isSidebarOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen((current) => !current)}
        >
          <svg className="dashboard-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
          <span>Меню</span>
        </button>
        <nav className="dashboard-sidebar__nav">
          <a href="/workspace">Анализ</a>
        </nav>
        <a className="dashboard-sidebar__logout" href="/" aria-label="Выход">
          <svg className="dashboard-sidebar__icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 6H6v12h4M13 8l4 4-4 4M8 12h9" />
          </svg>
          <span>Выйти</span>
        </a>
      </aside>

      <section className="dashboard-workspace">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-header__label">Рабочая панель</span>
            <h1>Текущие заказы</h1>
          </div>
          <div className="dashboard-header__actions">
            <button type="button" className="dashboard-button dashboard-button--secondary">
              Скачать отчет
            </button>
            <button type="button" className="dashboard-button dashboard-button--primary">
              Отправить заказы
            </button>
          </div>
        </header>

        <div className="dashboard-filters" ref={filterAreaRef} aria-label="Фильтры заказов">
          <button
            className="dashboard-filter-icon"
            type="button"
            aria-label="Открыть фильтры"
            aria-expanded={isFilterPanelOpen}
            onClick={() => setIsFilterPanelOpen((current) => !current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          </button>

          <div className="dashboard-filter-tags" aria-label="Активные фильтры">
            {visibleFilters.map((filter) => (
              <span className="dashboard-filter-tag" key={filter.id}>
                {[filter.field, filter.operator, filter.value].filter(Boolean).join(' ')}
              </span>
            ))}
          </div>

          <button className="dashboard-clear-button" type="button" onClick={clearFilters}>
            Очистить
          </button>

          {isFilterPanelOpen && (
            <>
              <button
                className="dashboard-filter-backdrop"
                type="button"
                aria-label="Закрыть фильтры"
                onClick={() => setIsFilterPanelOpen(false)}
              />
              <aside className="dashboard-filter-panel" aria-label="Коллектор фильтров">
                <div className="dashboard-filter-panel__header">
                  <h2>Коллектор фильтров</h2>
                  <button
                    className="dashboard-filter-close"
                    type="button"
                    aria-label="Закрыть фильтры"
                    onClick={() => setIsFilterPanelOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 7l10 10M17 7L7 17" />
                    </svg>
                  </button>
                </div>

                <div className="dashboard-filter-panel__body">
                  {draftFilters.map((filter) => (
                    <div className="dashboard-filter-row" key={filter.id}>
                      <select
                        value={filter.field}
                        aria-label="Поле фильтра"
                        onChange={(event) => handleFilterChange(filter.id, 'field', event.target.value)}
                      >
                        <option value="">Поле</option>
                        {filterFields.map((field) => (
                          <option value={field} key={field}>
                            {field}
                          </option>
                        ))}
                      </select>

                      <select
                        value={filter.operator}
                        aria-label="Условие фильтра"
                        onChange={(event) => handleFilterChange(filter.id, 'operator', event.target.value)}
                      >
                        <option value="">Условие</option>
                        {filterOperators.map((operator) => (
                          <option value={operator} key={operator}>
                            {operator}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={filter.value}
                        aria-label="Значение фильтра"
                        placeholder="Значение"
                        onChange={(event) => handleFilterChange(filter.id, 'value', event.target.value)}
                      />

                      <button
                        className="dashboard-filter-remove"
                        type="button"
                        aria-label="Удалить фильтр"
                        onClick={() => removeFilter(filter.id)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M7 7l10 10M17 7L7 17" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                <button className="dashboard-add-filter" type="button" onClick={addFilter}>
                  Добавить фильтр
                </button>

                <div className="dashboard-filter-panel__actions">
                  <button className="dashboard-button dashboard-button--primary" type="button" onClick={applyFilters}>
                    Применить
                  </button>
                  <button className="dashboard-filter-cancel" type="button" onClick={() => setIsFilterPanelOpen(false)}>
                    Отменить
                  </button>
                </div>
              </aside>
            </>
          )}
        </div>

        <div className="dashboard-table-shell">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Номер заказа</th>
                <th>Поставщик</th>
                <th>Группа</th>
                <th>Категория</th>
                <th>Дата заказа</th>
                <th>Дата поставки</th>
                <th>Паллеты</th>
                <th>Короба</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.supplier}</td>
                  <td>{row.group}</td>
                  <td>{row.category}</td>
                  <td>{row.orderDate}</td>
                  <td>{row.deliveryDate}</td>
                  <td>{row.pallets}</td>
                  <td>{row.boxes}</td>
                  <td>
                    <span className={`dashboard-status dashboard-status--${row.status === 'Готово' ? 'done' : row.status === 'Проверить' ? 'attention' : 'work'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
