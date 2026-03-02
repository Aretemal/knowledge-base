# Личная база знаний (Svelte + NestJS)

Простой прототип личной базы знаний с иерархией папок и файлами.

## Стек

- Backend: NestJS (REST API), файловое хранилище метаданных (JSON + файловая система)
- Frontend: Vite + Svelte (TypeScript)

## Запуск

### 1. Установка зависимостей

В корне проекта `kb-svelte-nest`:

```bash
cd backend
npm install

cd ../frontend
npm install
```

> Если npm выдаёт ошибки в IDE/песочнице, попробуй выполнить команды в своей локальной консоли от имени пользователя/администратора.

### 2. Запуск backend

```bash
cd backend
npm run start:dev
```

Backend поднимается на `http://localhost:3000` и использует префикс `api`, то есть базовый URL для API:

- `http://localhost:3000/api/folders`
- `http://localhost:3000/api/files`

При первом запуске создаётся папка `storage` и файл `storage/metadata.json` с корневой папкой `root`.

### 3. Запуск frontend

```bash
cd frontend
npm run dev
```

По умолчанию Vite поднимает фронт на `http://localhost:5173`.

В `vite.config.ts` настроен прокси на backend:

- все запросы к `/api/*` проксируются на `http://localhost:3000`.

## Основной функционал

- Папки:
  - список подпапок для текущей папки;
  - создание папок;
  - переименование;
  - удаление (рекурсивно, вместе с дочерними папками и файлами).
- Файлы:
  - список файлов в выбранной папке;
  - загрузка файлов (drag-n-drop через стандартный `<input type="file" multiple>` не реализован, но можно добавить);
  - переименование;
  - удаление;
  - скачивание по ссылке.

## API (кратко)

- `GET /api/folders?parentId=<id|null>` — список папок для родителя.
- `POST /api/folders` — создать папку:

```json
{
  "name": "Docs",
  "parentId": "root"
}
```

- `PATCH /api/folders/:id` — переименовать папку:

```json
{
  "name": "New name"
}
```

- `DELETE /api/folders/:id` — удалить папку рекурсивно.

- `GET /api/files?folderId=<id>` — список файлов в папке.
- `POST /api/files` — загрузка файла (`multipart/form-data`):
  - поле `folderId`;
  - поле `file` (сам файл).
- `PATCH /api/files/:id` — переименовать файл.
- `DELETE /api/files/:id` — удалить файл.
- `GET /api/files/:id/download` — скачать файл.

## Дальнейшие улучшения

- Авторизация и приватные базы знаний для разных пользователей.
- Полнотекстовый поиск по содержимому (для текстовых/Markdown файлов).
- Рич‑редактор заметок (не только файлы, но и «страницы»).
- Теги, быстрый поиск и избранное.

