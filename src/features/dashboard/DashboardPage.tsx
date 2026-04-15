import { APP_NAME } from '../../lib/config';
import './DashboardPage.css';

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

function DashboardPage() {
  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar" aria-label="Основная навигация">
        <div className="dashboard-sidebar__brand">{APP_NAME}</div>
        <nav className="dashboard-sidebar__nav">
          <a className="is-active" href="/workspace">Текущие заказы</a>
          <a href="/workspace">Отчет</a>
          <a href="/workspace">Автозаказы</a>
          <a href="/workspace">Настройки таблицы</a>
        </nav>
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

        <div className="dashboard-filters" aria-label="Фильтры заказов">
          <button type="button">Группа закупок</button>
          <button type="button">Заказ промо</button>
          <button type="button">Дата заказа</button>
          <button type="button">Очистить</button>
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
