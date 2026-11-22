# Развёртывание AI Fitness Coach

Документ описывает CI/CD и production-развёртывание приложения через GitHub Actions
и Docker Compose. Целевая схема:

1. Push в `main` → GitHub Actions запускает тесты Backend и Frontend.
2. При успешных тестах собираются и публикуются два приватных образа в Docker Hub.
3. GitHub Actions подключается к серверу по SSH.
4. На сервере скачиваются образы с тегом Git commit SHA и перезапускаются сервисы.
5. Выполняются проверки `/health` и `/ready`.

Приложение открывается по адресу `http://SERVER_IP:8080`. Порты `80` и `443` не
используются: они могут быть заняты другим приложением на сервере.

## Состав файлов

| Файл | Назначение |
|---|---|
| `.github/workflows/ci-cd.yml` | CI, сборка/публикация образов, SSH-деплой |
| `docker-compose.production.yml` | Production-запуск из готовых образов |
| `docs/deployment.md` | Эта инструкция |

Локальная разработка по-прежнему использует `docker-compose.yml`; production-файл
его не заменяет.

## 1. Приватный репозиторий Docker Hub

1. Войдите в Docker Hub.
2. Создайте **приватный** репозиторий `semomov/sensei`.
3. Оба образа публикуются в этот репозиторий и различаются префиксом тега:

| Образ | Теги |
|---|---|
| Backend | `semomov/sensei:backend-<git-commit-sha>`, `semomov/sensei:backend-latest` |
| Frontend | `semomov/sensei:frontend-<git-commit-sha>`, `semomov/sensei:frontend-latest` |

Тег с Git commit SHA — неизменяемый, используется для деплоя и отката. Тег
`*-latest` вспомогательный: не опирайтесь на него при откате.

Если namespace или имя образа изменятся, задайте переменную `DOCKERHUB_IMAGE`
для Compose и обновите теги в `.github/workflows/ci-cd.yml`.

## 2. Docker Hub Access Token

1. Docker Hub → **Account settings** → **Security** → **New access token**.
2. Права: **Read & Write** (нужны для push из GitHub Actions).
3. Сохраните токен: он понадобится для GitHub Secret `DOCKERHUB_TOKEN`.

Не используйте пароль от Docker Hub и не храните токен в репозитории.

## 3. GitHub Secrets

Репозиторий → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**.

| Secret | Назначение |
|---|---|
| `DOCKERHUB_USERNAME` | Логин Docker Hub (для репозитория `semomov/sensei` — `semomov`) |
| `DOCKERHUB_TOKEN` | Access Token с правами Read & Write |
| `SERVER_HOST` | Публичный IP-адрес сервера |
| `SERVER_USER` | Пользователь SSH для деплоя |
| `SERVER_SSH_KEY` | Приватный SSH-ключ (полное содержимое, включая строки BEGIN/END) |

Рекомендуется отдельный пользователь сервера для деплоя и отдельная SSH-пара ключей.

Пример создания ключа на локальной машине:

```bash
ssh-keygen -t ed25519 -C "sensei-deploy" -f ~/.ssh/sensei_deploy
ssh-copy-id -i ~/.ssh/sensei_deploy.pub SERVER_USER@SERVER_HOST
cat ~/.ssh/sensei_deploy
```

Последняя команда выводит приватный ключ — его значение идёт в `SERVER_SSH_KEY`.

Содержимое серверного `.env` (пароли БД, API-ключи) в GitHub Secrets **не добавляется**
и через GitHub Actions не передаётся.

## 4. Подготовка сервера

Требования:

- Linux-сервер с публичным IP;
- Docker Engine и плагин Docker Compose v2;
- SSH-доступ для `SERVER_USER`;
- открытый входящий порт `8080` (firewall/security group);
- `curl` (желательно; при его отсутствии workflow использует `wget` внутри
  контейнера `frontend`).

Пример установки Docker (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

После добавления в группу `docker` перезайдите по SSH. Пользователь деплоя должен
иметь право запускать `docker` и `docker compose`.

Создайте каталог приложения:

```bash
sudo mkdir -p /opt/sensei
sudo chown "$USER":"$USER" /opt/sensei
```

Скопируйте production Compose на сервер (команда выполняется на локальной машине):

```powershell
scp .\docker-compose.production.yml SERVER_USER@SERVER_HOST:/opt/sensei/
```

Если SSH-ключ не добавлен в агент, укажите его явно:

```powershell
scp -i $HOME\.ssh\sensei_deploy .\docker-compose.production.yml SERVER_USER@SERVER_HOST:/opt/sensei/
```

Итоговая структура на сервере:

```text
/opt/sensei/
├── docker-compose.production.yml
└── .env        # создаётся в разделе 5, права 600
```

Репозиторий на сервере не клонируется: там нужны только эти два файла.
Docker Compose автоматически читает `.env` из текущего каталога, а workflow
перед запуском выполняет `cd /opt/sensei`, поэтому `--env-file` указывать не нужно.

Данные PostgreSQL и Redis хранятся не в `/opt/sensei`, а в Docker volumes
`sensei_postgres_data` и `sensei_redis_data` (обычно в
`/var/lib/docker/volumes/`). Каталог `/opt/sensei` содержит только Compose и `.env`.

## 5. Серверный `.env`

Файл `/opt/sensei/.env` создаётся вручную на сервере и **никогда не коммитится**.
Основой служит `.env.example`, но значения для Docker-сети отличаются.

Пример:

```dotenv
# Приложение
APP_ENV=production
LOG_LEVEL=INFO

# PostgreSQL
POSTGRES_USER=sensei
POSTGRES_PASSWORD=CHANGE_ME_STRONG_PASSWORD
POSTGRES_DB=fitness_coach

# Внутри Docker-сети хост — имя сервиса postgres, а не localhost.
DATABASE_URL=postgresql+asyncpg://sensei:CHANGE_ME_STRONG_PASSWORD@postgres:5432/fitness_coach
REDIS_URL=redis://redis:6379/0

# Публикация frontend
FRONTEND_PORT=8080
CORS_ORIGINS=http://SERVER_IP:8080

# LLM
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=CHANGE_ME
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_TIMEOUT_SECONDS=30
LLM_MAX_RETRIES=3

# Выполнение агентов и worker
SENSEI_MAX_RETRIES=3
SENSEI_AGENT_TIMEOUT_SECONDS=10
WORKER_JOB_TIMEOUT_SECONDS=300
WORKER_MAX_TRIES=3

# Сессии
AUTH_COOKIE_NAME=sensei_session
AUTH_COOKIE_SECURE=true
AUTH_SESSION_TTL_DAYS=7
AUTH_LOGIN_RATE_LIMIT=10
AUTH_LOGIN_RATE_WINDOW_SECONDS=900
```

### Как доставить `.env` на сервер

Вариант 1 (рекомендуется) — создать файл прямо на сервере:

```bash
ssh SERVER_USER@SERVER_HOST
nano /opt/sensei/.env    # вставить шаблон выше
chmod 600 /opt/sensei/.env
```

Вариант 2 — подготовить файл локально и скопировать. Назовите локальный файл
`.env.production` (он игнорируется Git); не используйте локальный `.env` из корня
репозитория, потому что в нём dev-значения (`localhost`, `LLM_PROVIDER=mock`).

```powershell
scp .\.env.production SERVER_USER@SERVER_HOST:/opt/sensei/.env
ssh SERVER_USER@SERVER_HOST "chmod 600 /opt/sensei/.env"
```

Если файл создавался через `sudo`, верните владельца пользователю деплоя:

```bash
sudo chown "$USER":"$USER" /opt/sensei/.env
```

Compose требует `IMAGE_TAG`, `DATABASE_URL` и `POSTGRES_PASSWORD`. `IMAGE_TAG` можно
не хранить в `.env`: workflow передаёт его в окружение при деплое, а при ручном запуске
он задаётся через `export`. Имя образа по умолчанию — `semomov/sensei`; при
необходимости переопределяется переменной `DOCKERHUB_IMAGE`. При отсутствии любой
обязательной переменной `docker compose` завершится с ошибкой — это защита от запуска
с неполной конфигурацией.

Особенности:

- `DATABASE_URL` должен указывать на хост `postgres`, а не `localhost`.
- Если пароль содержит `@`, `:`, `/` или другие спецсимволы, его нужно
  URL-кодировать в `DATABASE_URL`.
- `CORS_ORIGINS` укажите с реальным IP или доменом интерфейса.

Права на файл:

```bash
chmod 600 /opt/sensei/.env
```

### Secure-cookie при работе без HTTPS

В `APP_ENV=production` cookie сессии по умолчанию помечается `Secure`, и браузер
не передаёт её по обычному HTTP. Пока HTTPS не настроен, для проверки по
`http://SERVER_IP:8080` можно временно добавить в `.env`:

```dotenv
AUTH_COOKIE_SECURE=false
```

Явное значение имеет приоритет над правилом «в production всегда Secure».
После настройки HTTPS верните `AUTH_COOKIE_SECURE=true` (или удалите строку, чтобы
снова действовало безопасное значение по умолчанию).

## 6. Первый ручной запуск

Выполните на сервере:

```bash
cd /opt/sensei

export IMAGE_TAG=GIT_COMMIT_SHA

echo "DOCKERHUB_TOKEN" | docker login -u semomov --password-stdin

docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d
```

Порядок запуска обеспечивает Compose: `postgres` и `redis` проходят healthcheck,
затем `migrate` выполняет `alembic upgrade head`, и только после его успешного
завершения стартуют `backend` и `worker`. `frontend` ждёт healthy backend.

Проверьте состояние и доступность:

```bash
docker compose -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:8080/health
curl -fsS http://127.0.0.1:8080/ready
```

Ожидаемые ответы:

- `/health` → `{"status":"ok"}`;
- `/ready` → `{"status":"ok","checks":{"database":"ok","redis":"ok"}}`.

Затем откройте `http://SERVER_IP:8080` и проверьте регистрацию, вход и создание
тренировочного плана.

## 7. Автоматический деплой

Workflow `.github/workflows/ci-cd.yml`:

- на `pull_request` в `main` выполняет только CI (тесты Backend и Frontend);
- на `push` в `main` после успешного CI собирает и публикует образы, затем деплоит.

Деплой на сервере:

1. `docker login` в Docker Hub (токен передаётся через stdin);
2. `docker compose pull` для тега текущего commit SHA;
3. `docker compose up -d --remove-orphans`;
4. ожидание `/health` (до 60 секунд) и проверка `/ready`;
5. при ошибке выводятся `ps` и последние 200 строк логов, job падает.

Данные PostgreSQL и Redis хранятся в именованных volume
`sensei_postgres_data` и `sensei_redis_data` и переживают перезапуски.
Команда `docker compose down -v` не используется — она удаляет данные.

## 8. Логи

```bash
cd /opt/sensei

# Последние логи всех сервисов
docker compose -f docker-compose.production.yml logs --tail=200

# Логи конкретного сервиса
docker compose -f docker-compose.production.yml logs -f backend
docker compose -f docker-compose.production.yml logs migrate
docker compose -f docker-compose.production.yml logs worker
```

## 9. Откат на предыдущую версию

Образы `semomov/sensei:backend-<sha>` и `semomov/sensei:frontend-<sha>` остаются
в Docker Hub, поэтому откат не требует пересборки.

1. Найдите SHA предыдущего успешного деплоя (история GitHub Actions/коммитов).
2. Укажите его в `.env` на сервере:

```dotenv
IMAGE_TAG=PREVIOUS_COMMIT_SHA
```

3. Примените:

```bash
cd /opt/sensei
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d --remove-orphans
```

Автоматический откат миграций не выполняется. Миграции должны быть совместимы
с предыдущей версией приложения; при необходимости откат схемы выполняется вручную
и осознанно.

## 10. Типичные ошибки

| Симптом | Причина и решение |
|---|---|
| `required variable ... is missing` | Не заданы `DATABASE_URL`/`POSTGRES_PASSWORD` в `/opt/sensei/.env` либо `IMAGE_TAG` в `.env` или окружении. |
| Job деплоя падает на `docker login` | Неверный `DOCKERHUB_TOKEN`, нет прав Read & Write или истёк срок токена. |
| `permission denied (publickey)` | `SERVER_SSH_KEY` не содержит полный приватный ключ либо публичный ключ не добавлен в `authorized_keys`. |
| `migrate` завершился с ошибкой | Смотрите `docker compose logs migrate`; чаще всего неверный `DATABASE_URL` (хост `localhost` вместо `postgres`) или недоступна БД. |
| `/ready` возвращает 503 | Недоступны БД или Redis; проверьте `checks` в ответе и логи `backend`/`postgres`/`redis`. |
| Ответ 502 от frontend | Backend не прошёл healthcheck или перезапускается; смотрите логи `backend`. |
| Вход не сохраняется по HTTP | Cookie `Secure` не отправляется по HTTP. Временно `AUTH_COOKIE_SECURE=false`, затем вернуть `true` после HTTPS. |
| `port is already allocated` | Порт `8080` занят; измените `FRONTEND_PORT` в `.env`. |
| Workflow не деплоит | Push был не в `main` либо CI не прошёл. PR-запуски не публикуют образы и не деплоят. |
| Данные пропали после перезапуска | Не используйте `down -v`; проверьте volume `sensei_postgres_data`. |

## 11. Ограничения текущего этапа

- Домен и HTTPS не настраиваются; используется `http://SERVER_IP:8080`.
- Порты `80` и `443` не занимаются.
- Backend, PostgreSQL и Redis не публикуются во внешнюю сеть.
- Существующие приложения и инфраструктура сервера не изменяются.
- Kubernetes и другие оркестраторы не используются.
