# Analiz_RUM

Проект DELEKTO для анализа запасов, заказов, упаковки и этикетки.

## Локальная desktop-конфигурация

Рабочие пути не записываются в исходный код. Скопируйте
`analiz-rum.config.example.json` в `analiz-rum.config.json` и укажите только на
рабочем компьютере путь к папке Excel. Значение `./data` создаёт SQLite-базу в
подпапке `data` проекта. Локальный конфигурационный файл исключён из Git.

## Стек

- React
- TypeScript
- Vite
- Electron
- SQLite (`sql.js`)
- импорт Excel
- Tailwind CSS
- React Router

## Структура

- `src/` - интерфейс приложения
- `electron/` - desktop-оболочка следующего этапа
- `database/` - схема SQLite и миграции следующего этапа
- `storage/` - импорты и экспорты
- `docs/` - проектная документация
