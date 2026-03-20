import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { FileItem, RoadmapData, RoadmapNode } from '../../models';

cytoscape.use(dagre);

type NodeColorType = NonNullable<RoadmapNode['colorType']>;

const CY_VIRTUAL_ROOT = '__cy_virtual_root__';

@Component({
  selector: 'app-roadmap-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './roadmap-editor.component.html',
  styleUrl: './roadmap-editor.component.css',
})
export class RoadmapEditorComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) file!: FileItem;
  @Input({ required: true }) data!: RoadmapData;
  @Input() saving = false;

  @Output() save = new EventEmitter<RoadmapData>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('cyContainer') private cyContainer?: ElementRef<HTMLDivElement>;

  private readonly zone = inject(NgZone);

  title = '';
  nodes: RoadmapNode[] = [];
  error: string | null = null;

  private baseline = '';
  private cy: Core | null = null;
  private resizeListener = (): void => {
    if (this.cy) {
      this.cy.resize();
      this.cy.fit(undefined, 48);
    }
  };

  selectedNodeId: string | null = null;
  selectedLabel = '';
  selectedContent = '';
  selectedColorType: NodeColorType = 'blue';

  readonly colorOptions: { value: NodeColorType; label: string; hex: string }[] = [
    { value: 'blue', label: 'Синий', hex: '#3498DB' },
    { value: 'red', label: 'Красный', hex: '#E74C3C' },
    { value: 'yellow', label: 'Желтый', hex: '#F6C445' },
    { value: 'white', label: 'Белый', hex: '#FFFFFF' },
    { value: 'orange', label: 'Оранжевый', hex: '#F2994A' },
    { value: 'green', label: 'Зеленый', hex: '#33C46B' },
  ];

  get mainNodes(): RoadmapNode[] {
    return this.nodes
      .filter((n) => n.type === 'main')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  get isDirty(): boolean {
    return this.baseline !== this.serialize();
  }

  get selectedNode(): RoadmapNode | null {
    if (!this.selectedNodeId) return null;
    return this.nodes.find((n) => n.id === this.selectedNodeId) ?? null;
  }

  ngOnInit(): void {
    this.resetFromInputs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this.resetFromInputs();
      this.refreshCyGraph();
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.initCyIfNeeded());
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeListener);
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }
  }

  private resetFromInputs(): void {
    this.title = this.data?.title ?? '';
    this.nodes = this.data?.nodes ?? [];
    this.clearSelection();
    this.baseline = this.serialize();
  }

  private serialize(): string {
    return JSON.stringify({ title: this.title, nodes: this.nodes });
  }

  private genId(): string {
    return 'n-' + Math.random().toString(36).slice(2, 10);
  }

  private initCyIfNeeded(): void {
    if (this.cy || !this.cyContainer?.nativeElement) return;

    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements: [],
      minZoom: 0.2,
      maxZoom: 2,
      wheelSensitivity: 0.35,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'ellipsis',
            'text-max-width': '144px',
            'background-color': 'data(colorHex)',
            'border-color': 'rgba(0,0,0,0.14)',
            'border-width': 2,
            color: 'data(textColor)',
            width: 160,
            height: 44,
            shape: 'roundrectangle',
            'font-size': '12px',
            'font-weight': 'bold',
            'text-outline-width': 0,
          },
        },
        {
          selector: 'node.cy-virtual',
          style: {
            opacity: 0,
            width: 1,
            height: 1,
            events: 'no',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#e74c3c',
          },
        },
        {
          selector: 'edge',
          style: {
            'curve-style': 'taxi',
            'taxi-direction': 'horizontal',
            'taxi-turn': '50%',
            width: 2.5,
            'line-color': '#cbd5e1',
            'target-arrow-shape': 'none',
            opacity: 0.95,
          },
        },
      ],
    });

    this.cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      if (id === CY_VIRTUAL_ROOT) return;
      this.zone.run(() => {
        this.selectNode(id);
      });
    });

    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.zone.run(() => this.clearSelection());
      }
    });

    window.addEventListener('resize', this.resizeListener);
    this.refreshCyGraph();
  }

  private buildCyElements(): ElementDefinition[] {
    const out: ElementDefinition[] = [];

    if (this.nodes.length === 0) {
      return out;
    }

    out.push({
      data: { id: CY_VIRTUAL_ROOT, label: '' },
      classes: 'cy-virtual',
    });

    for (const n of this.nodes) {
      const hex = this.getNodeColor(n);
      out.push({
        data: {
          id: n.id,
          label: this.tileLabel(n),
          colorHex: hex,
          textColor: this.getTileTextColor(hex),
          nodeType: n.type,
        },
      });
    }

    const mains = this.mainNodes;
    for (const m of mains) {
      out.push({
        data: {
          id: `e-${CY_VIRTUAL_ROOT}-${m.id}`,
          source: CY_VIRTUAL_ROOT,
          target: m.id,
        },
      });
    }

    for (const n of this.nodes) {
      if (n.parentId) {
        out.push({
          data: {
            id: `e-${n.parentId}-${n.id}`,
            source: n.parentId,
            target: n.id,
          },
        });
      }
    }

    return out;
  }

  private refreshCyGraph(): void {
    if (!this.cy) return;
    this.cy.elements().remove();
    const elems = this.buildCyElements();
    if (elems.length === 0) {
      return;
    }
    this.cy.add(elems);
    this.cy.layout({
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 28,
      rankSep: 64,
      edgeSep: 12,
      ranker: 'network-simplex',
      padding: 24,
    } as never).run();
    this.cy.fit(undefined, 48);
    this.syncCySelection();
  }

  private syncCySelection(): void {
    if (!this.cy) return;
    this.cy.elements().unselect();
    if (this.selectedNodeId) {
      const t = this.cy.getElementById(this.selectedNodeId);
      if (t.nonempty()) t.select();
    }
  }

  private patchCyNodeVisual(id: string): void {
    if (!this.cy) return;
    const n = this.nodes.find((x) => x.id === id);
    if (!n) return;
    const el = this.cy.getElementById(id);
    if (el.empty()) return;
    const hex = this.getNodeColor(n);
    el.data({
      label: this.tileLabel(n),
      colorHex: hex,
      textColor: this.getTileTextColor(hex),
    });
  }

  /** Сразу создаёт пустой узел и открывает карточку редактирования. */
  createEmptyNode(type: RoadmapNode['type'], parentId: string | null = null): void {
    const colorType = this.getDefaultColorTypeForNode(type, parentId);
    const base: RoadmapNode = {
      id: this.genId(),
      label: '',
      type,
      colorType,
    };

    let node: RoadmapNode;
    if (type === 'main') {
      const order = this.mainNodes.length;
      node = { ...base, order };
    } else {
      node = { ...base, parentId: parentId ?? undefined };
    }

    this.nodes = [...this.nodes, node];
    this.refreshCyGraph();
    this.selectNode(node.id);
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId = nodeId;
    const node = this.nodes.find((n) => n.id === nodeId);
    this.selectedLabel = node?.label ?? '';
    this.selectedContent = node?.content ?? '';
    this.selectedColorType = node?.colorType ?? this.getDefaultColorTypeForNode(node?.type ?? 'main', node?.parentId);
    this.syncCySelection();
  }

  clearSelection(): void {
    this.selectedNodeId = null;
    this.selectedLabel = '';
    this.selectedContent = '';
    this.selectedColorType = 'blue';
    if (this.cy) this.cy.elements().unselect();
  }

  openCreateChildFromDrawer(): void {
    if (!this.selectedNodeId) return;
    this.createEmptyNode('branch', this.selectedNodeId);
  }

  updateSelectedLabel(next: string): void {
    if (!this.selectedNodeId) return;
    this.selectedLabel = next;
    this.nodes = this.nodes.map((n) => (n.id === this.selectedNodeId ? { ...n, label: next } : n));
    this.patchCyNodeVisual(this.selectedNodeId);
  }

  updateSelectedContent(next: string): void {
    if (!this.selectedNodeId) return;
    this.selectedContent = next;
    const trimmed = next.trim();
    this.nodes = this.nodes.map((n) =>
      n.id === this.selectedNodeId ? { ...n, content: trimmed ? next : undefined } : n,
    );
  }

  updateSelectedColorType(next: NodeColorType): void {
    if (!this.selectedNodeId) return;
    this.selectedColorType = next;
    this.nodes = this.nodes.map((n) =>
      n.id === this.selectedNodeId ? { ...n, colorType: next } : n,
    );
    this.patchCyNodeVisual(this.selectedNodeId);
  }

  tileLabel(node: RoadmapNode): string {
    const t = node.label?.trim() ?? '';
    return t || 'Без названия';
  }

  getNodeColor(node: RoadmapNode): string {
    const colorType = node.colorType ?? this.getDefaultColorTypeForNode(node.type, node.parentId);
    return this.getColorHex(colorType);
  }

  getTileTextColor(color: string): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return '#111111';
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance > 0.6 ? '#111111' : '#FFFFFF';
  }

  private getDefaultColorTypeForNode(
    type: RoadmapNode['type'],
    parentId?: string | null,
  ): NodeColorType {
    if (type === 'main') return 'yellow';
    if (parentId) {
      const parent = this.nodes.find((n) => n.id === parentId);
      if (parent?.type === 'main') return 'green';
      return 'blue';
    }
    return 'green';
  }

  private getColorHex(colorType: NodeColorType): string {
    const option = this.colorOptions.find((c) => c.value === colorType);
    return option?.hex ?? '#3498DB';
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const value = hex.trim().toLowerCase();
    const match = value.match(/^#([0-9a-f]{6})$/i);
    if (!match) return null;
    const intVal = parseInt(match[1], 16);
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255,
    };
  }

  deleteNode(nodeId: string): void {
    const childrenByParent = new Map<string, RoadmapNode[]>();
    for (const n of this.nodes) {
      if (!n.parentId) continue;
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }

    const toDelete = new Set<string>();
    const stack: string[] = [nodeId];
    while (stack.length) {
      const current = stack.pop()!;
      if (toDelete.has(current)) continue;
      toDelete.add(current);
      const children = childrenByParent.get(current) ?? [];
      for (const c of children) stack.push(c.id);
    }

    this.nodes = this.nodes.filter((n) => !toDelete.has(n.id));
    this.clearSelection();
    this.refreshCyGraph();
  }

  deleteSelectedNode(): void {
    if (!this.selectedNodeId) return;
    const ok = confirm('Удалить узел и все его ответвления?');
    if (!ok) return;
    this.deleteNode(this.selectedNodeId);
  }

  onSave(): void {
    this.error = null;
    const payload: RoadmapData = { title: this.title, nodes: this.nodes };
    this.save.emit(payload);
    this.baseline = this.serialize();
  }
}
