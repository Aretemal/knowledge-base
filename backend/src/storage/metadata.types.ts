export interface FolderEntity {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileEntity {
  id: string;
  name: string;
  folderId: string;
  size: number;
  mimeType: string;
  createdAt: string;
  originalName: string;
  storagePath: string;
}

export interface MetadataStore {
  folders: FolderEntity[];
  files: FileEntity[];
}

