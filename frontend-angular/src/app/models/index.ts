export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreeFolder {
  id: string;
  name: string;
  children: TreeFolder[];
}

export interface FileItem {
  id: string;
  name: string;
  folderId: string;
  size: number;
  mimeType: string;
  createdAt: string;
  originalName: string;
}

export interface RoadmapNode {
  id: string;
  label: string;
  type: 'main' | 'branch';
  order?: number;
  parentId?: string;
  /** Палитра узла, хранится отдельно от type */
  colorType?: 'blue' | 'red' | 'yellow' | 'white' | 'orange' | 'green';
  /** Текстовое содержимое узла (описание) */
  content?: string;
}

export interface RoadmapData {
  title: string;
  nodes: RoadmapNode[];
}
