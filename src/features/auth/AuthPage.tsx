import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>('login');
  const [formState, setFormState] = useState<AuthFormState>(initialState);
  const [statusText, setStatusText] = useState('Введите учетные данные для входа.');

  const heading = useMemo(
    () => (mode === 'login' ? 'Вход в систему' : 'Регистрация пользователя'),
    [mode],
  );

  const subtitle = useMemo(
    () =>
      mode === 'login'
        ? 'Введите логин и пароль, чтобы открыть рабочее пространство.'
        : 'Заполните данные сотрудника для создания учетной записи.',
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
      navigate('/workspace');
      return;
    }

    if (formState.registerPassword !== formState.registerRepeatPassword) {
      setStatusText('Пароли не совпадают.');
      return;
    }

    setStatusText(`Учетная запись создана для ${formState.registerName || 'нового сотрудника'}.`);
  };

  return (
    <div className="auth-layout">
      <section className="auth-brand-panel">
        <div className="auth-brand-panel__backdrop" />
        <div className="auth-brand-panel__content">
          <div className="auth-logo" aria-label={`${COMPANY_NAME} logo`}>
            <span className="auth-logo__wordmark">{APP_NAME}</span>
          </div>

          <div className="auth-brand-copy">
            <span className="auth-brand-copy__label">Рабочая панель</span>
            <h1>Система управления запасами</h1>
            <p>Рабочее приложение для сотрудников DELEKTO.</p>
          </div>

          <ul className="auth-brand-benefits">
            <li>Остатки и заказы в одном рабочем пространстве</li>
            <li>История импортов и ручных изменений</li>
            <li>Отчеты по потребности и статусам</li>
          </ul>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-card__topline">
            <span className="auth-form-card__eyebrow">{APP_NAME}</span>
            <span className="auth-form-card__status">Авторизация</span>
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
                    placeholder="Введите имя"
                    value={formState.registerName}
                    onChange={(event) => handleChange('registerName', event.target.value)}
                  />
                </label>

                <label className="auth-field">
                  <span>Логин или email</span>
                  <input
                    type="email"
                    placeholder="login@delekto.local"
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
