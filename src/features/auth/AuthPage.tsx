import { FormEvent, useMemo, useState } from 'react';
import { APP_NAME, COMPANY_NAME } from '../../lib/config';
import './AuthPage.css';

type AuthMode = 'login' | 'register';

type AuthFormState = {
  loginEmail: string;
  loginPassword: string;
  registerName: string;
  registerEmail: string;
  registerPassword: string;
  registerRepeatPassword: string;
};

const initialState: AuthFormState = {
  loginEmail: '',
  loginPassword: '',
  registerName: '',
  registerEmail: '',
  registerPassword: '',
  registerRepeatPassword: '',
};

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span className="brand-mark__spark brand-mark__spark--vertical" />
      <span className="brand-mark__spark brand-mark__spark--horizontal" />
      <span className="brand-mark__spark brand-mark__spark--diagonal-left" />
      <span className="brand-mark__spark brand-mark__spark--diagonal-right" />
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [formState, setFormState] = useState<AuthFormState>(initialState);
  const [statusText, setStatusText] = useState('Готово к подключению backend-логики авторизации.');

  const heading = useMemo(
    () => (mode === 'login' ? 'Вход в систему' : 'Регистрация пользователя'),
    [mode],
  );

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Введите логин и пароль, чтобы открыть рабочее пространство Analiz_RUM.'
        : 'Создайте учетную запись сотрудника для локальной работы в приложении DELEKTO.',
    [mode],
  );

  const handleChange = (field: keyof AuthFormState, value: string) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (mode === 'login') {
      setStatusText(`Тестовый вход подготовлен для ${formState.loginEmail || 'пользователя'}.`);
      return;
    }

    if (formState.registerPassword !== formState.registerRepeatPassword) {
      setStatusText('Пароли не совпадают. На следующем этапе добавим точную валидацию.');
      return;
    }

    setStatusText(`Тестовая регистрация подготовлена для ${formState.registerName || 'нового сотрудника'}.`);
  };

  return (
    <div className="auth-layout">
      <section className="auth-brand-panel">
        <div className="auth-brand-panel__backdrop" />
        <div className="auth-brand-panel__content">
          <div className="auth-logo" aria-label={`${COMPANY_NAME} logo`}>
            <BrandMark />
            <span className="auth-logo__wordmark">{COMPANY_NAME}</span>
          </div>

          <div className="auth-brand-copy">
            <span className="auth-brand-copy__label">Analiz_RUM</span>
            <h1>Локальная система анализа запасов, заказов, упаковки и этикетки</h1>
            <p>
              Первый экран приложения для сотрудников. Дальше сюда подключим маршруты,
              Electron-оболочку и SQLite-авторизацию.
            </p>
          </div>

          <ul className="auth-brand-benefits">
            <li>Быстрый доступ к рабочим данным</li>
            <li>Без лишнего визуального шума</li>
            <li>Подготовлено под Windows desktop-сценарий</li>
          </ul>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-card__topline">
            <span className="auth-form-card__eyebrow">DELEKTO Workspace</span>
            <span className="auth-form-card__status">{APP_NAME}</span>
          </div>

          <div className="auth-mode-switch" role="tablist" aria-label="Режим авторизации">
            <button
              className={`auth-mode-switch__button ${mode === 'login' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setMode('login')}
            >
              Вход
            </button>
            <button
              className={`auth-mode-switch__button ${mode === 'register' ? 'is-active' : ''}`}
              type="button"
              onClick={() => setMode('register')}
            >
              Регистрация
            </button>
          </div>

          <div className="auth-form-copy">
            <h2>{heading}</h2>
            <p>{subtitle}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'login' ? (
              <>
                <label className="auth-field">
                  <span>Email или логин</span>
                  <input
                    type="text"
                    placeholder="manager@delekto.local"
                    value={formState.loginEmail}
                    onChange={(event) => handleChange('loginEmail', event.target.value)}
                  />
                </label>

                <label className="auth-field">
                  <span>Пароль</span>
                  <input
                    type="password"
                    placeholder="Введите пароль"
                    value={formState.loginPassword}
                    onChange={(event) => handleChange('loginPassword', event.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="auth-field">
                  <span>Имя сотрудника</span>
                  <input
                    type="text"
                    placeholder="Алексей Руднев"
                    value={formState.registerName}
                    onChange={(event) => handleChange('registerName', event.target.value)}
                  />
                </label>

                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    placeholder="user@delekto.local"
                    value={formState.registerEmail}
                    onChange={(event) => handleChange('registerEmail', event.target.value)}
                  />
                </label>

                <div className="auth-form__row">
                  <label className="auth-field">
                    <span>Пароль</span>
                    <input
                      type="password"
                      placeholder="Создайте пароль"
                      value={formState.registerPassword}
                      onChange={(event) => handleChange('registerPassword', event.target.value)}
                    />
                  </label>

                  <label className="auth-field">
                    <span>Повторите пароль</span>
                    <input
                      type="password"
                      placeholder="Повторите пароль"
                      value={formState.registerRepeatPassword}
                      onChange={(event) => handleChange('registerRepeatPassword', event.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            <div className="auth-form__actions">
              <button className="auth-primary-button" type="submit">
                {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
              </button>
              <button
                className="auth-secondary-button"
                type="button"
                onClick={() => setFormState(initialState)}
              >
                Очистить поля
              </button>
            </div>
          </form>

          <div className="auth-form-card__footer">
            <p>{statusText}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AuthPage;
