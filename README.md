# Личная база знаний (Angular + NestJS)

Простой прототип личной базы знаний с иерархией папок и файлами.

## Стек

- **Backend:** NestJS (REST API), файловое хранилище метаданных (JSON + файловая система)
- **Frontend:** Angular (папка `frontend-angular`)

## Запуск

### 1. Установка зависимостей

```bash
cd backend
npm install

cd ../frontend-angular
npm install
```

> Если npm выдаёт ошибки в IDE/песочнице, попробуй выполнить команды в своей локальной консоли от имени пользователя/администратора.

### 2. Запуск backend

```bash
cd backend
npm run start:dev
```

Backend поднимается на `http://localhost:3000` и использует префикс `api`:

- `http://localhost:3000/api/folders`
- `http://localhost:3000/api/files`

При первом запуске создаётся папка `storage` и файл `storage/metadata.json`.

### 3. Запуск frontend (Angular)

```bash
cd frontend-angular
npm start
```

По умолчанию Angular поднимает фронт на `http://localhost:4200`. В `proxy.conf.json` запросы к `/api` проксируются на `http://localhost:3000`.

## Основной функционал

- **Папки:** список подпапок, создание, переименование, удаление (рекурсивно).
- **Файлы:** список в выбранной папке, загрузка, переименование, удаление, скачивание.
- **Роадмапы:** файлы `.roadmap` (JSON) — граф узлов с основной дорогой и ответвлениями; по клику на узел — модалка с текстовым содержимым узла.

## API (кратко)

- `GET /api/folders?parentId=<id|null>` — список папок для родителя.
- `POST /api/folders` — создать папку: `{ "name": "Docs", "parentId": null }`
- `PATCH /api/folders/:id` — переименовать: `{ "name": "New name" }`
- `DELETE /api/folders/:id` — удалить папку рекурсивно.

- `GET /api/files?folderId=<id>` — список файлов в папке.
- `POST /api/files` — загрузка файла (`multipart/form-data`: `folderId`, `file`).
- `PATCH /api/files/:id` — переименовать файл.
- `DELETE /api/files/:id` — удалить файл.
- `GET /api/files/:id/download` — скачать файл.
- `GET /api/files/:id/content` — содержимое файла (для роадмапов).
- `PUT /api/files/:id/content` — сохранить содержимое файла.

## Дальнейшие улучшения

- Авторизация и приватные базы знаний для разных пользователей.
- Полнотекстовый поиск по содержимому.
- Рич‑редактор заметок, теги, избранное.
