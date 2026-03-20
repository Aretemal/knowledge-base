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

/** Как показывать прямых потомков этого узла на графе */
export type ChildrenDisplayStyle = 'separate-paths' | 'single-path-block';

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
  /**
   * Как отображать дочерние узлы: отдельные ветви или общий «ствол» + группа блоком.
   * Если не задано — используется defaultChildrenDisplay у RoadmapData.
   */
  childrenDisplay?: ChildrenDisplayStyle;
  /** Координаты центра узла на графе (сохраняются в файл вместе с роадмапом) */
  x?: number;
  y?: number;
}

export interface RoadmapData {
  title: string;
  nodes: RoadmapNode[];
  /** Значение по умолчанию для childrenDisplay у узлов без своего */
  defaultChildrenDisplay?: ChildrenDisplayStyle;
}
