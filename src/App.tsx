import './App.css';
import './styles/theme.css';
import { APP_NAME, COMPANY_NAME } from './lib/config';

function App() {
  return (
    <div className="app-shell">
      <div className="app-card">
        <span className="app-badge">DELEKTO</span>
        <h1>{APP_NAME}</h1>
        <p>
          Каркас проекта подготовлен. На следующем шаге начнем верстку экранов
          по согласованной странице.
        </p>
        <div className="app-meta">
          <span>Стек: React + TypeScript + Vite</span>
          <span>Desktop: Electron</span>
          <span>Данные: SQLite</span>
        </div>
      </div>
    </div>
  );
}

export default App;
