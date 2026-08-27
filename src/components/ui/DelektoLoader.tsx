import './DelektoLoader.css';

type DelektoLoaderProps = {
  label?: string;
  overlay?: boolean;
};

const letters = 'DELEKTO'.split('');

export function DelektoLoader({ label = 'Загрузка данных…', overlay = false }: DelektoLoaderProps) {
  return (
    <div className={`delekto-loader${overlay ? ' delekto-loader--overlay' : ''}`} role="status" aria-live="polite">
      <div className="delekto-loader__letters" aria-label="DELEKTO">
        {letters.map((letter, index) => <span style={{ animationDelay: `${index * 0.12}s` }} key={`${letter}-${index}`}>{letter}</span>)}
      </div>
      <span className="delekto-loader__label">{label}</span>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-label="Загрузка рабочего пространства">
      <div className="dashboard-skeleton__cards">
        {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
      </div>
      <div className="dashboard-skeleton__toolbar" />
      <div className="dashboard-skeleton__table">
        {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
      </div>
    </div>
  );
}
