# AI Fitness Coach — мультиагентный full-stack

full-stack прототип мультиагентной системы для подготовки планов тренировок
с веб-интерфейсом: суперагент (Supervisor) принимает запрос, формирует план,
передаёт подзадачи специализированным агентам, проверяет результаты и собирает
итоговый ответ. React-интерфейс позволяет создать заявку, следить за статусом,
читать готовый план и историю запусков.


## Текущий статус

Реализованы и покрыты тестами:

- Оркестрация через Supervisor с LLM-планированием и контролем зависимостей.
- Специализированные агенты: `ProfileAgent`, `TrainingAgent`, программный `SafetyChecker`.
- LLM-абстракция: `MockLLMProvider` (без ключа) и `DeepSeekProvider` (реальный API).
- PostgreSQL (asyncpg) с Alembic-миграциями; SQLite (aiosqlite) — локальный фолбэк.
- Redis + ARQ: фоновое выполнение workflow в отдельном Worker-процессе.
- FastAPI API с постановкой задач в очередь, чтением статуса и списком истории.
- Веб-интерфейс на React 19 + TypeScript + Vite: мастер создания плана,
  живой прогресс, экран результата, история, тёмная и светлая темы.
- Полный запуск через Docker Compose (frontend, backend, worker, postgres, redis).

## Основные возможности

- Приём пользовательского запроса и нормализация профиля.
- Формирование черновика тренировочного плана в структурированном виде.
- Программная проверка безопасности (нагрузка, дни, длительность, опыт, ограничения).
- Явные статусы: `queued`, `running`, `completed`, `failed`, `cancelled`, `needs_info`.
- Сохранение состояния и результатов в PostgreSQL.
- Повторные попытки, тайм-ауты, защита от повторного выполнения одной задачи.
- Интерфейс: валидация формы, примеры запросов, поллинг статуса, карточки тренировок,
  отчёт безопасности, копирование и экспорт результата в JSON/Markdown.

## Архитектура

```text
BROWSER → React SPA (Vite) ── dev: proxy ──┐
        → nginx (prod) ── proxy ──────────┴→ FastAPI → Redis → Worker → Supervisor
                                                                    ├── LLM (DeepSeek / Mock)
                                                                    ├── ProfileAgent
                                                                    ├── TrainingAgent
                                                                    └── SafetyChecker
                                                                    → PostgreSQL
```

### Supervisor

Центральный управляющий компонент:

1. Принимает запрос пользователя.
2. Через LLM формирует структурированный `TaskPlan` (цель + задачи + зависимости).
3. Проверяет план: разрешённые типы задач, наличие обязательной `profile`, отсутствие циклов.
4. Выполняет задачи послойно по зависимостям; независимые задачи — параллельно (`asyncio.gather`).
5. Валидирует каждый результат по Pydantic-схемам, повторяет неудачные задачи с лимитом.
6. Объединяет результаты и возвращает итоговый ответ.

LLM предлагает план, но не получает неограниченный доступ к действиям приложения:
критические проверки, порядок выполнения и валидация остаются в обычном Python-коде.

### Агенты

| Агент | Назначение |
|---|---|
| `ProfileAgent` | Нормализует данные пользователя, сообщает о недостающих/противоречивых полях. |
| `TrainingAgent` | Строит черновик тренировочного плана с assumptions и limitations. |
| `SafetyChecker` | Программная проверка безопасности профиля (не LLM-агент). |

### LLM

- `MockLLMProvider` — детерминированный, для тестов и работы без API-ключа.
- `DeepSeekProvider` — асинхронный HTTP-клиент (httpx) к OpenAI-совместимому API DeepSeek:
  тайм-ауты, ограниченные повторы, обработка сетевых ошибок и невалидного JSON.

### Хранение и очереди

- **PostgreSQL** — постоянное состояние (`workflow_runs`) с временными отметками
  создания/старта/завершения. Схема управляется через Alembic.
- **Redis** — брокер очередей; **Worker** (ARQ) получает задачи и выполняет workflow.

## Структура проекта

```text
backend/
├── app/
│   ├── agents/          # base, profile_agent, training_agent, safety_checker, supervisor
│   ├── llm/             # base, deepseek, mock, factory
│   ├── schemas/         # tasks, results, llm, api
│   ├── services/        # workflow
│   ├── db/              # base, session, models/, repositories/
│   ├── workers/         # jobs, workflow_worker
│   ├── config.py
│   ├── queue.py
│   ├── api.py           # FastAPI-приложение
│   └── main.py          # CLI-пример
├── alembic/             # миграции
├── tests/
├── requirements.txt
└── Dockerfile
frontend/
├── src/
│   ├── api/             # типизированный клиент и схемы ответов
│   ├── components/      # Composer, RunProgress, ResultView, HistoryList, Navigation
│   ├── hooks/           # тема, поллинг, тосты, состояние системы
│   ├── lib/             # валидация, форматирование, markdown-экспорт
│   └── styles/          # дизайн-токены и компонентные стили
├── nginx.conf
├── Dockerfile
└── vite.config.ts
docker-compose.yml
.env.example
.gitignore
README.md
```

## Требования

- Python 3.12+
- Node.js 20+ и npm (для фронтенда и dev-сервера)
- PostgreSQL 16 (или SQLite для быстрой локальной отладки)
- Redis 7
- Docker + Docker Compose (для запуска всего стека одной командой)

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

Основные переменные:

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `APP_ENV` | Режим окружения | `development` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |
| `DATABASE_URL` | Строка подключения к БД | `sqlite+aiosqlite:///./sensei.db` |
| `REDIS_URL` | Строка подключения к Redis | `redis://localhost:6379/0` |
| `FRONTEND_PORT` | Порт веб-интерфейса в Docker Compose | `8080` |
| `BACKEND_PORT` | Порт API в Docker Compose | `8000` |
| `POSTGRES_PORT` | Порт PostgreSQL в Docker Compose | `5432` |
| `REDIS_PORT` | Порт Redis в Docker Compose | `6379` |
| `CORS_ORIGINS` | Разрешённые origins фронтенда (через запятую) | `http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173` |
| `LLM_PROVIDER` | `mock` или `deepseek` | `mock` |
| `DEEPSEEK_API_KEY` | Ключ DeepSeek | — |
| `DEEPSEEK_MODEL` | Модель DeepSeek | `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | Базовый URL API | `https://api.deepseek.com` |
| `LLM_TIMEOUT_SECONDS` | Тайм-аут запроса к LLM | `30` |
| `LLM_MAX_RETRIES` | Повторы запросов к LLM | `3` |
| `SENSEI_MAX_RETRIES` | Повторы задач агентов | `3` |
| `SENSEI_AGENT_TIMEOUT_SECONDS` | Тайм-аут агента | `10` |
| `WORKER_JOB_TIMEOUT_SECONDS` | Тайм-аут задачи Worker | `300` |
| `WORKER_MAX_TRIES` | Повторы задачи Worker | `3` |

Секреты (например, `DEEPSEEK_API_KEY`) хранятся только в `.env`; файл `.env`
добавлен в `.gitignore` и не попадает в репозиторий.

## Получение DeepSeek API key

1. Зарегистрируйтесь на платформе DeepSeek.
2. Создайте API-ключ в личном кабинете.
3. Укажите его в `.env`: `DEEPSEEK_API_KEY=...` и `LLM_PROVIDER=deepseek`.
4. Проверьте, что `DEEPSEEK_MODEL` соответствует доступной модели (например, `deepseek-chat`).

Для разработки и тестов ключ не обязателен: используйте `LLM_PROVIDER=mock`.

## Запуск без Docker

### 1. Python и виртуальное окружение

```bash
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\activate
```

Linux/macOS:

```bash
source .venv/bin/activate
```

### 2. Зависимости

```bash
cd backend
pip install -r requirements.txt
```

### 3. PostgreSQL и Redis

Установите и запустите PostgreSQL и Redis как локальные сервисы, затем укажите
их адреса в `.env` (см. раздел «Переменные окружения»).

Для быстрой отладки без PostgreSQL можно оставить
`DATABASE_URL=sqlite+aiosqlite:///./sensei.db`. Redis для фонового выполнения
обязателен: без него `POST /workflow` вернёт `503`.

### 4. Миграции

```bash
cd backend
alembic upgrade head
```

### 5. Backend

```bash
cd backend
uvicorn app.api:app --reload
```

### 6. Worker

В отдельном терминале:

```bash
cd backend
python -m app.workers.workflow_worker
```

### 7. Frontend

Установите зависимости и запустите dev-сервер Vite:

```bash
cd frontend
npm install
npm run dev
```

Интерфейс откроется на `http://localhost:5173`. Vite проксирует запросы
`/workflow`, `/health` и `/ready` на backend `http://127.0.0.1:8000`,
поэтому CORS для dev-режима не требуется.

Для проверки production-сборки:

```bash
cd frontend
npm run build
npm run preview
```

Собранный фронтенд можно раздавать и самим FastAPI: если существует каталог
`frontend/dist`, backend монтирует его и открывает интерфейс по адресу
`http://127.0.0.1:8000`.

### 8. Тесты

Backend:

```bash
cd backend
pytest -q
```

Frontend:

```bash
cd frontend
npm test
npm run build
```

## Запуск через Docker Compose

Docker Compose — оркестратор всего стека: он собирает образы frontend и backend,
применяет миграции и поднимает зависимости в правильном порядке.

### 1. Подготовка

```bash
cp .env.example .env
```

При необходимости отредактируйте порты и ключ LLM в `.env`. Для работы без ключа
оставьте `LLM_PROVIDER=mock`.

### 2. Сборка и запуск всех элементов

```bash
docker compose up --build -d
```

Собираются два образа:

| Образ | Сборка | Что внутри |
|---|---|---|
| `sensei-backend` | [backend/Dockerfile](backend/Dockerfile), контекст — корень репозитория | Python 3.12 + FastAPI, Alembic, Worker (один образ для `backend`, `worker`, `migrate`) и встроенная сборка SPA |
| `sensei-frontend` | [frontend/Dockerfile](frontend/Dockerfile) | multi-stage: `node:22-alpine` собирает React-приложение → `nginx:1.27-alpine` раздаёт статику и проксирует API |

> Backend-образ собирается из корня, потому что в него встраивается `frontend/dist`.
> Отдельная сборка: `docker build -f backend/Dockerfile -t sensei-backend .`

Контейнеры и порядок запуска:

| Сервис | Роль | Зависит от |
|---|---|---|
| `postgres` | PostgreSQL 16, данные в volume `postgres_data` | — |
| `redis` | Redis 7 с AOF-персистентностью в `redis_data` | — |
| `migrate` | однократно выполняет `alembic upgrade head` | `postgres` |
| `backend` | FastAPI API на порту `8000` | `postgres`, `redis`, `migrate` |
| `worker` | ARQ Worker, забирает задачи из Redis | `postgres`, `redis`, `migrate` |
| `frontend` | nginx: UI + прокси `/workflow`, `/health`, `/ready`, `/docs` | `backend` (healthy) |

### 3. Куда подключаться

После запуска доступны:

| Что | Адрес | Порт в `.env` |
|---|---|---|
| **Веб-интерфейс (основной вход)** | `http://localhost:8080` | `FRONTEND_PORT=8080` |
| **Веб-интерфейс и API на одном порту** | `http://localhost:8000` | `BACKEND_PORT=8000` |
| API (FastAPI) | `http://localhost:8000/workflow` | `BACKEND_PORT` |
| Swagger UI (через UI-порт) | `http://localhost:8080/docs` | `FRONTEND_PORT` |
| Swagger UI (напрямую) | `http://localhost:8000/docs` | `BACKEND_PORT` |
| Проверка живости | `http://localhost:8080/health`, `http://localhost:8000/ready` | оба порта |
| PostgreSQL (для клиентов БД) | `localhost:5432` | `POSTGRES_PORT` |
| Redis | `localhost:6379` | `REDIS_PORT` |

Интерфейс доступен на обоих портах:

- **8080** — отдельный порт UI на nginx (не пересекается с dev-сервером Vite,
  который занимает `5173`; можно держать Docker-стек и `npm run dev` одновременно);
- **8000** — тот же интерфейс отдаёт backend-контейнер, здесь же живёт API,
  поэтому `http://localhost:8000` открывает приложение, а `/workflow`, `/docs`,
  `/health` работают как API.

### 4. Смена портов

Порты задаются в `.env` и переопределяют значения по умолчанию из
[docker-compose.yml](docker-compose.yml):

```env
FRONTEND_PORT=8080   # веб-интерфейс
BACKEND_PORT=8000    # API
POSTGRES_PORT=5432
REDIS_PORT=6379
```

После изменения перезапустите стек:

```bash
docker compose up -d --no-build
```

Если UI публикуется на другом порту, добавьте его origin в `CORS_ORIGINS`,
чтобы браузер мог обращаться к API напрямую.

### 5. Подключение с другого компьютера

Порты публикуются на все интерфейсы (`0.0.0.0`), поэтому из локальной сети
интерфейс доступен по адресу `http://<IP-хоста>:8080`. Проверьте, что порт
разрешён в фаерволе (Windows: «Брандмауэр Защитника → Правила для входящих»).
Чтобы открыть доступ только с этой машины, замените публикацию порта на
`127.0.0.1:${FRONTEND_PORT:-8080}:80`.

### 6. Управление

```bash
docker compose ps                      # статусы и порты
docker compose logs -f                 # все логи
docker compose logs -f backend worker  # только API и Worker
docker compose restart backend worker  # перезапуск
docker compose up --build -d           # пересборка образов и применение изменений
docker compose build --no-cache        # полная пересборка без кеша
```

Остановка (данные PostgreSQL и Redis сохраняются в volumes):

```bash
docker compose down
```

> `docker compose down -v` удаляет volumes и приводит к потере данных БД и очереди.

Полный сброс с пересборкой:

```bash
docker compose down -v && docker compose up --build -d
```

### 7. Проверка после запуска

```bash
curl http://localhost:8080/health
# {"status":"ok"}

curl http://localhost:8080/ready
# {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

Откройте `http://localhost:8080`, заполните профиль и создайте план: запуск
пройдёт через Redis в Worker и вернётся в интерфейс как `completed`.

### 8. Типичные проблемы Docker-запуска

- **`GET http://localhost:8000/` возвращает `404 {"detail":"Not Found"}`** —
  образ собран старой версией Dockerfile без встроенного фронтенда. Пересоберите:
  `docker compose up --build -d`. В актуальной сборке интерфейс отдаётся и на
  `:8000`, и на `:8080`.
- **`bind: address already in use`** — порт занят. Измените `FRONTEND_PORT`/`BACKEND_PORT`
  (или `POSTGRES_PORT`/`REDIS_PORT`) в `.env` и выполните `docker compose up -d`.
- **Контейнер `frontend` не стартует, пока `backend` не станет healthy** — это
  ожидаемо: UI поднимается после API. Смотрите `docker compose logs backend`.
- **`POST /workflow` возвращает 503** — контейнер `worker` не запущен или Redis
  недоступен: `docker compose ps` и `docker compose logs worker redis`.
- **`migrate` завершился с ошибкой** — проверьте подключение к PostgreSQL:
  `docker compose logs migrate postgres`.

## Использование API

Проверка доступности:

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok"}
```

Проверка зависимостей (БД и Redis):

```bash
curl http://127.0.0.1:8000/ready
# {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

Запуск workflow:

```bash
curl -X POST http://127.0.0.1:8000/workflow \
  -H "Content-Type: application/json" \
  -d '{
        "request": "Подготовь базовый план тренировок.",
        "user_data": {
          "goal": "общая физическая форма",
          "age": 30,
          "experience_level": "beginner",
          "days_per_week": 3,
          "minutes_per_session": 45
        }
      }'
```

Ответ: `202 Accepted` с `run_id` и статусом `queued`.

Получение статуса:

```bash
curl http://127.0.0.1:8000/workflow/<run_id>
```

Поле `status` принимает значения `queued`, `running`, `completed`, `failed`,
`cancelled`, `needs_info`; при завершении `final_answer` содержит профиль, план,
отчёт безопасности и предупреждения. Дополнительно возвращаются `user_data`
и временные метки `created_at`, `started_at`, `finished_at`.

Список запусков (история) с фильтром и пагинацией:

```bash
curl "http://127.0.0.1:8000/workflow?limit=20&offset=0"
# {"items":[{"run_id":"...","status":"completed","request":"..."}],"total":1}

curl "http://127.0.0.1:8000/workflow?status=failed&limit=10"
```

## Веб-интерфейс

Интерфейс состоит из двух разделов:

- **Новый план** — запрос с примерами, профиль (цель, уровень, метрики, ограничения),
  клиентская валидация, прогресс выполнения агентов и экран результата.
- **История** — все запуски из базы с фильтром по статусу, обновлением и загрузкой
  следующих страниц; любой запуск можно открыть и посмотреть повторно.

На экране результата доступны: недельный план, замечания проверки безопасности,
предположения и ограничения, предупреждения, сырой JSON, копирование и скачивание
ответа в JSON/Markdown. Тема (тёмная/светлая) сохраняется в браузере.
В шапке отображается состояние `/ready` (база данных и очередь задач).

Ссылку на конкретный запуск можно сохранить: адрес вида
`http://localhost:<порт>/#run/<run_id>` открывает сохранённый результат напрямую
(`8080` или `8000` в Docker, `5173` при `npm run dev`).

## Логи

```bash
docker compose logs -f backend
docker compose logs -f worker
docker compose logs -f frontend
```

При локальном запуске логи Backend и Worker выводятся в их терминалы.

## Решение распространённых проблем

- **`POST /workflow` возвращает 503** — Redis недоступен. Запустите Redis и проверьте `REDIS_URL`.
- **`GET /ready` отдаёт `degraded`** — смотрите поле `checks`: недоступны БД или Redis.
- **Worker не выполняет задачи** — проверьте `REDIS_URL` у Worker и запущен ли он.
- **Ошибки подключения к PostgreSQL** — проверьте `DATABASE_URL` и доступность сервера.
- **DeepSeek не отвечает** — проверьте `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` и сетевой доступ.
- **Интерфейс пишет «API недоступен»** — в Docker проверьте `docker compose ps`
  (`backend` должен быть `healthy`); при `npm run dev` убедитесь, что Vite
  проксирует запросы на `http://127.0.0.1:8000`.
- **Ошибка CORS при отдельном домене фронтенда** — добавьте его origin в `CORS_ORIGINS`.
- **Не открывается `http://localhost:8080`** — посмотрите `docker compose ps`:
  контейнер `frontend` публикует `FRONTEND_PORT`; при занятом порте измените его в `.env`.

## Ограничения и безопасность

- LLM может предлагать план, но не получает неограниченного доступа к действиям.
- `SafetyChecker` — учебные программные правила, а не медицинская диагностика.
- В публичные ответы API не попадают traceback и секреты.
- Перед публикацией убедитесь, что `.env` не попал в репозиторий.

## Направления дальнейшего развития

- Регистрация и авторизация пользователей.
- Интеграции с Apple Health и Google Fit.
- Дополнительные агенты (питание, прогресс, восстановление).
- Автоматический анализ прогресса по расписанию.
- При необходимости — перенос оркестрации на LangGraph.
