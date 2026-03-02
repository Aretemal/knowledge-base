<script lang="ts">
  import { onMount } from 'svelte'
  import type { Folder, FileItem } from './types'

  let loading = false
  let error: string | null = null

  let currentFolderId: string = 'root'
  let currentFolderPath: Folder[] = []
  let childFolders: Folder[] = []
  let files: FileItem[] = []

  onMount(async () => {
    await loadRoot()
  })

  async function loadRoot() {
    await selectFolder('root', true)
  }

  async function selectFolder(id: string, isRoot = false) {
    loading = true
    error = null
    try {
      currentFolderId = id

      const [foldersRes, filesRes] = await Promise.all([
        fetch(`/api/folders?parentId=${id === 'root' ? 'null' : id}`),
        fetch(`/api/files?folderId=${encodeURIComponent(id)}`),
      ])

      if (!foldersRes.ok || !filesRes.ok) {
        throw new Error('Ошибка загрузки данных')
      }

      childFolders = await foldersRes.json()
      files = await filesRes.json()

      await loadPath(id, isRoot)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }

  async function loadPath(id: string, isRoot: boolean) {
    if (isRoot || id === 'root') {
      currentFolderPath = [{ id: 'root', name: 'Root', parentId: null, createdAt: '', updatedAt: '' }]
      return
    }
    const res = await fetch('/api/folders?parentId=null')
    if (!res.ok) {
      currentFolderPath = []
      return
    }
    const rootFolders: Folder[] = await res.json()
    const root = rootFolders.find(f => f.id === 'root')
    if (!root) {
      currentFolderPath = []
      return
    }
    // Для простоты: показываем только текущую папку + Root,
    // без полного восстановления дерева по id родителя.
    const currentRes = await fetch(`/api/folders?parentId=${encodeURIComponent(root.id)}`)
    const children: Folder[] = currentRes.ok ? await currentRes.json() : []
    const current = children.find(f => f.id === id)
    currentFolderPath = current ? [root, current] : [root]
  }

  async function createFolder() {
    const name = window.prompt('Имя новой папки:')
    if (!name) return

    loading = true
    error = null
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parentId: currentFolderId === 'root' ? null : currentFolderId,
        }),
      })
      if (!res.ok) throw new Error('Не удалось создать папку')
      await selectFolder(currentFolderId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }

  async function renameFolder(folder: Folder) {
    const name = window.prompt('Новое имя папки:', folder.name)
    if (!name || name === folder.name) return
    loading = true
    error = null
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Не удалось переименовать папку')
      await selectFolder(currentFolderId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }

  async function deleteFolder(folder: Folder) {
    if (!window.confirm(`Удалить папку "${folder.name}" и всё её содержимое?`)) return
    loading = true
    error = null
    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Не удалось удалить папку')
      await selectFolder(currentFolderId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }

  async function onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement
    if (!input.files?.length) return

    loading = true
    error = null
    try {
      for (const file of Array.from(input.files)) {
        const formData = new FormData()
        formData.append('folderId', currentFolderId)
        formData.append('file', file)
        const res = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          throw new Error(`Не удалось загрузить файл ${file.name}`)
        }
      }
      input.value = ''
      await selectFolder(currentFolderId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }

  async function renameFile(file: FileItem) {
    const name = window.prompt('Новое имя файла:', file.name)
    if (!name || name === file.name) return
    loading = true
    error = null
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error('Не удалось переименовать файл')
      await selectFolder(currentFolderId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }

  async function deleteFile(file: FileItem) {
    if (!window.confirm(`Удалить файл "${file.name}"?`)) return
    loading = true
    error = null
    try {
      const res = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Не удалось удалить файл')
      await selectFolder(currentFolderId)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Неизвестная ошибка'
    } finally {
      loading = false
    }
  }
</script>

<main class="app">
  <header class="app-header">
    <h1>Личная база знаний</h1>
  </header>

  <section class="toolbar">
    <button on:click={createFolder}>Новая папка</button>
    <label class="upload-btn">
      Загрузить файлы
      <input type="file" multiple on:change={onFilesSelected} />
    </label>
    {#if loading}
      <span class="status">Загрузка...</span>
    {/if}
    {#if error}
      <span class="status error">{error}</span>
    {/if}
  </section>

  <section class="breadcrumbs">
    {#each currentFolderPath as folder, index}
      <span
        class="crumb"
        on:click={() => selectFolder(folder.id, folder.id === 'root')}
      >
        {folder.name}
      </span>
      {#if index < currentFolderPath.length - 1}
        <span class="crumb-separator">/</span>
      {/if}
    {/each}
  </section>

  <section class="content">
    <aside class="sidebar">
      <h2>Папки</h2>
      {#if childFolders.length === 0}
        <p class="empty">Нет подпапок</p>
      {:else}
        <ul class="folder-list">
          {#each childFolders as folder}
            <li class="folder-item">
              <button
                class:active={folder.id === currentFolderId}
                on:click={() => selectFolder(folder.id)}
              >
                {folder.name}
              </button>
              <div class="folder-actions">
                <button on:click={() => renameFolder(folder)}>✎</button>
                <button on:click={() => deleteFolder(folder)}>✕</button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <section class="files">
      <h2>Файлы</h2>
      {#if files.length === 0}
        <p class="empty">Файлов нет</p>
      {:else}
        <table>
          <thead>
            <tr>
              <th>Имя</th>
              <th>Тип</th>
              <th>Размер</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each files as file}
              <tr>
                <td>
                  <a href={`/api/files/${file.id}/download`} target="_blank" rel="noreferrer">
                    {file.name}
                  </a>
                </td>
                <td>{file.mimeType}</td>
                <td>{Math.round(file.size / 1024)} КБ</td>
                <td class="file-actions">
                  <button on:click={() => renameFile(file)}>✎</button>
                  <button on:click={() => deleteFile(file)}>✕</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: #0f172a;
    color: #e5e7eb;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #1f2937;
    background: linear-gradient(to right, #020617, #111827);
  }

  .app-header h1 {
    margin: 0;
    font-size: 1.25rem;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem;
    border-bottom: 1px solid #1f2937;
    background-color: #020617;
  }

  button {
    background-color: #2563eb;
    color: #e5e7eb;
    border: none;
    border-radius: 0.375rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
    font-size: 0.875rem;
  }

  button:hover {
    background-color: #1d4ed8;
  }

  .upload-btn {
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem 0.75rem;
    border-radius: 0.375rem;
    background-color: #374151;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .upload-btn input[type='file'] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .status {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .status.error {
    color: #fca5a5;
  }

  .breadcrumbs {
    padding: 0.5rem 1.5rem;
    border-bottom: 1px solid #1f2937;
    background-color: #020617;
    font-size: 0.875rem;
  }

  .crumb {
    cursor: pointer;
    color: #60a5fa;
  }

  .crumb:hover {
    text-decoration: underline;
  }

  .crumb-separator {
    margin: 0 0.25rem;
    color: #6b7280;
  }

  .content {
    flex: 1;
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 0;
  }

  .sidebar {
    border-right: 1px solid #1f2937;
    padding: 0.75rem 1rem;
    background-color: #020617;
  }

  .sidebar h2,
  .files h2 {
    margin: 0 0 0.75rem;
    font-size: 0.95rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .folder-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .folder-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
  }

  .folder-item > button {
    flex: 1;
    text-align: left;
    background-color: transparent;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
  }

  .folder-item > button:hover {
    background-color: #111827;
  }

  .folder-item > button.active {
    background-color: #1d4ed8;
  }

  .folder-actions button {
    background: transparent;
    color: #9ca3af;
    padding: 0.2rem;
  }

  .folder-actions button:hover {
    color: #e5e7eb;
    background: transparent;
  }

  .files {
    padding: 0.75rem 1rem;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  th,
  td {
    padding: 0.4rem 0.5rem;
    border-bottom: 1px solid #1f2937;
  }

  th {
    text-align: left;
    color: #9ca3af;
    font-weight: 500;
  }

  a {
    color: #e5e7eb;
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  .file-actions button {
    background: transparent;
    color: #9ca3af;
    padding: 0.2rem;
  }

  .file-actions button:hover {
    color: #e5e7eb;
  }

  .empty {
    font-size: 0.875rem;
    color: #6b7280;
  }

  @media (max-width: 768px) {
    .content {
      grid-template-columns: 1fr;
    }

    .sidebar {
      border-right: none;
      border-bottom: 1px solid #1f2937;
    }
  }
</style>
