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

  private nodesForPayload(): RoadmapNode[] {
    return this.nodes.map((n) => {
      const { childrenDisplay: _c, ...rest } = n;
      void _c;
      return rest;
    });
  }

  private serialize(): string {
    const payload: RoadmapData = {
      title: this.title,
      nodes: this.nodesForPayload(),
      defaultChildrenDisplay: 'single-path-block',
    };
    return JSON.stringify(payload);
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
      autounselectify: true,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'ellipsis',
            'text-max-width': '104px',
            'background-color': 'data(colorHex)',
            'border-color': 'rgba(0,0,0,0.1)',
            'border-width': 1,
            color: 'data(textColor)',
            width: 118,
            height: 32,
            shape: 'roundrectangle',
            'font-size': '10px',
            'font-weight': 'bold',
            'text-outline-width': 0,
          },
        },
        {
          selector: 'node[lightTile = "yes"]',
          style: {
            'background-color': '#ffffff',
            'border-color': '#000000',
            'border-width': 1,
            color: '#111111',
          },
        },
        {
          selector: 'node.cy-hover',
          style: {
            'background-blacken': 0.12,
          },
        },
        {
          selector: 'node[lightTile = "yes"].cy-hover',
          style: {
            'background-blacken': 0,
            'background-color': '#f3f4f6',
          },
        },
        {
          selector: 'node.cy-cluster',
          style: {
            label: '',
            'background-opacity': 0.06,
            'background-color': '#94a3b8',
            'border-width': 0,
            padding: '10px',
            events: 'no',
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
        {
          selector: 'edge.cy-edge-main-chain',
          style: {
            'taxi-direction': 'vertical',
            'line-color': '#94a3b8',
            width: 3,
            opacity: 1,
          },
        },
      ],
    });

    this.cy.on('tap', 'node', (evt) => {
      const t = evt.target;
      if (t.hasClass('cy-cluster')) return;
      const id = t.id();
      this.zone.run(() => {
        this.selectNode(id);
      });
    });

    this.cy.on('mouseover', 'node', (evt) => {
      const t = evt.target;
      if (t.hasClass('cy-cluster')) return;
      t.addClass('cy-hover');
    });
    this.cy.on('mouseout', 'node', (evt) => {
      evt.target.removeClass('cy-hover');
    });

    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.zone.run(() => this.clearSelection());
      }
    });

    this.cy.on('dragfreeon', 'node', (evt) => {
      const t = evt.target;
      if (t.hasClass('cy-cluster')) return;
      const id = t.id();
      if (!this.nodes.some((n) => n.id === id)) return;
      this.zone.run(() => this.persistNodePositionsFromCy());
    });

    window.addEventListener('resize', this.resizeListener);
    this.refreshCyGraph();
  }

  private clusterId(parentId: string): string {
    return `cy-cluster-${parentId}`;
  }

  private nodeDepth(id: string): number {
    let d = 0;
    let cur = this.nodes.find((n) => n.id === id);
    while (cur?.parentId) {
      d += 1;
      cur = this.nodes.find((n) => n.id === cur!.parentId);
    }
    return d;
  }

  private directChildren(parentId: string): RoadmapNode[] {
    return this.nodes.filter((n) => n.parentId === parentId);
  }

  /** Все потомки раздела (без самого main): ветки и подветки. */
  private subtreeMemberIds(mainId: string): Set<string> {
    const out = new Set<string>();
    const walk = (pid: string) => {
      for (const c of this.directChildren(pid)) {
        out.add(c.id);
        walk(c.id);
      }
    };
    walk(mainId);
    return out;
  }

  /** Compound-узлы кластеров внутри поддерева данного main. */
  private clusterIdsForSubtree(mainId: string): Set<string> {
    const scope = new Set<string>([mainId, ...this.subtreeMemberIds(mainId)]);
    const clusters = new Set<string>();
    for (const id of scope) {
      if (this.directChildren(id).length === 0) continue;
      clusters.add(this.clusterId(id));
    }
    return clusters;
  }

  /**
   * Логи раскладки: в dev по умолчанию; в prod выключите, поставив false.
   * Сообщения с префиксом [RoadmapLayout] — фильтр в консоли браузера.
   */
  private readonly roadmapLayoutDebug = false;

  private layoutLog(...args: unknown[]): void {
    if (!this.roadmapLayoutDebug) return;
    if (typeof console !== 'undefined' && console.log) {
      console.log('[RoadmapLayout]', ...args);
    }
  }

  private collectSubtreeLayoutForMain(cy: Core, mainId: string): ReturnType<Core['collection']> {
    const memberSet = this.subtreeMemberIds(mainId);
    const clusterSet = this.clusterIdsForSubtree(mainId);
    const layoutIds = new Set<string>([...memberSet, ...clusterSet]);

    let coll = cy.collection();
    for (const id of layoutIds) {
      const el = cy.getElementById(id);
      if (el.nonempty()) coll = coll.union(el);
    }
    cy.edges().forEach((e) => {
      const s = e.source().id();
      const t = e.target().id();
      if (layoutIds.has(s) && layoutIds.has(t)) {
        coll = coll.union(e);
      }
    });
    return coll;
  }

  private nodeHasSavedPosition(n: RoadmapNode): boolean {
    return (
      typeof n.x === 'number' &&
      typeof n.y === 'number' &&
      Number.isFinite(n.x) &&
      Number.isFinite(n.y)
    );
  }

  /** После автораскладки возвращаем узлы на координаты из файла (если были сохранены). */
  private restoreSavedRoadmapNodePositions(): void {
    if (!this.cy) return;
    for (const n of this.nodes) {
      if (!this.nodeHasSavedPosition(n)) continue;
      const el = this.cy.getElementById(n.id);
      if (el.nonempty()) {
        el.position({ x: n.x as number, y: n.y as number });
      }
    }
  }

  /** Записывает текущие координаты Cytoscape в модель (для сохранения в JSON). */
  private persistNodePositionsFromCy(): void {
    if (!this.cy) return;
    this.nodes = this.nodes.map((n) => {
      const el = this.cy!.getElementById(n.id);
      if (el.empty()) return n;
      const p = el.position();
      return { ...n, x: p.x, y: p.y };
    });
  }

  /**
   * Основные узлы — колонка сверху вниз, связаны только между собой.
   * Поддерево каждого раздела — компактный Dagre LR, затем сдвиг вплотную к main
   * (без огромного boundingBox — иначе Dagre растягивает ранги на всю ширину).
   */
  private applyRoadmapLayout(): void {
    if (!this.cy) return;
    const cy = this.cy;
    const MAIN_X = 64;
    const MAIN_W = 118;
    const MAIN_H = 32;
    const ROW_GAP = 36;
    const SUB_GAP = 40;

    const mains = this.mainNodes;
    let yCursor = 80;

    this.layoutLog('start', {
      mains: mains.map((x) => x.id),
      mainCount: mains.length,
    });

    for (const m of mains) {
      const mEl = cy.getElementById(m.id);
      if (mEl.empty()) continue;

      const rowTop = yCursor;
      const mainCx = MAIN_X + MAIN_W / 2;
      const mainCy = rowTop + MAIN_H / 2;
      mEl.position({ x: mainCx, y: mainCy });

      const sub = this.collectSubtreeLayoutForMain(cy, m.id);
      if (sub.nonempty()) {
        const memberSet = this.subtreeMemberIds(m.id);
        const clusterSet = this.clusterIdsForSubtree(m.id);
        this.layoutLog('subtree before dagre', {
          mainId: m.id,
          rowTop,
          mainPos: { x: mainCx, y: mainCy },
          nodeCount: memberSet.size,
          clusterIds: [...clusterSet],
          edgeCount: sub.edges().length,
        });

        sub.layout({
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: 22,
          rankSep: 36,
          edgeSep: 12,
          ranker: 'network-simplex',
          padding: 12,
        } as never).run();

        const layoutNodes = sub.filter('node');
        const bbBefore = layoutNodes.boundingBox({ includeLabels: true });
        const targetLeft = MAIN_X + MAIN_W + SUB_GAP;
        const targetTop = rowTop;
        const dx = targetLeft - bbBefore.x1;
        const dy = targetTop - bbBefore.y1;

        this.layoutLog('subtree after dagre (before translate)', {
          mainId: m.id,
          bbBefore: {
            x1: bbBefore.x1,
            y1: bbBefore.y1,
            x2: bbBefore.x2,
            y2: bbBefore.y2,
            w: bbBefore.w,
            h: bbBefore.h,
          },
          translate: { dx, dy },
          targetLeft,
          targetTop,
        });

        layoutNodes.forEach((n) => {
          const p = n.position();
          n.position({ x: p.x + dx, y: p.y + dy });
        });

        const bbAfter = layoutNodes.boundingBox({ includeLabels: true });
        this.layoutLog('subtree after translate', {
          mainId: m.id,
          bbAfter: {
            x1: bbAfter.x1,
            y1: bbAfter.y1,
            x2: bbAfter.x2,
            y2: bbAfter.y2,
            w: bbAfter.w,
            h: bbAfter.h,
          },
        });

        yCursor = Math.max(bbAfter.y2 + ROW_GAP, rowTop + MAIN_H + ROW_GAP);
      } else {
        yCursor = rowTop + MAIN_H + ROW_GAP;
      }
    }
  }

  private buildCyElements(): ElementDefinition[] {
    const out: ElementDefinition[] = [];

    if (this.nodes.length === 0) {
      return out;
    }

    const parentsNeedingCluster = this.nodes.filter((p) => this.directChildren(p.id).length > 0);
    parentsNeedingCluster.sort((a, b) => this.nodeDepth(a.id) - this.nodeDepth(b.id));

    for (const p of parentsNeedingCluster) {
      let clusterCompoundParent: string | undefined;
      if (p.parentId) {
        const gp = this.nodes.find((x) => x.id === p.parentId);
        if (gp && this.directChildren(gp.id).length > 0) {
          clusterCompoundParent = this.clusterId(gp.id);
        }
      }
      out.push({
        data: {
          id: this.clusterId(p.id),
          label: '',
          ...(clusterCompoundParent ? { parent: clusterCompoundParent } : {}),
        },
        classes: 'cy-cluster',
      });
    }

    for (const n of this.nodes) {
      const hex = this.getNodeColor(n);
      let compoundParent: string | undefined;
      if (n.parentId) {
        const par = this.nodes.find((x) => x.id === n.parentId);
        if (par && this.directChildren(par.id).length > 0) {
          compoundParent = this.clusterId(par.id);
        }
      }
      out.push({
        data: {
          id: n.id,
          label: this.tileLabel(n),
          colorHex: hex,
          textColor: this.getTileTextColor(hex),
          nodeType: n.type,
          ...(compoundParent ? { parent: compoundParent } : {}),
        },
      });
    }

    const mains = this.mainNodes;
    for (let i = 0; i < mains.length - 1; i++) {
      out.push({
        data: {
          id: `e-mainchain-${mains[i].id}-${mains[i + 1].id}`,
          source: mains[i].id,
          target: mains[i + 1].id,
        },
        classes: 'cy-edge-main-chain',
      });
    }

    for (const p of this.nodes) {
      const kids = this.directChildren(p.id);
      if (kids.length === 0) continue;
      const cid = this.clusterId(p.id);
      out.push({
        data: { id: `e-${p.id}-${cid}`, source: p.id, target: cid },
        classes: 'cy-edge-to-cluster',
      });
      for (const c of kids) {
        out.push({
          data: { id: `e-${cid}-${c.id}`, source: cid, target: c.id },
          classes: 'cy-edge-cluster-child',
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
    this.applyRoadmapLayout();
    this.restoreSavedRoadmapNodePositions();
    this.persistNodePositionsFromCy();
    this.cy.fit(undefined, 56);
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
      lightTile: this.nodeLightTileFlag(n),
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

  /** Белая плитка: отдельные стиль и hover. */
  private nodeLightTileFlag(node: RoadmapNode): 'yes' | 'no' {
    const hex = this.getNodeColor(node).replace(/\s/g, '').toUpperCase();
    if (node.colorType === 'white' || hex === '#FFFFFF') return 'yes';
    return 'no';
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
    const payload: RoadmapData = {
      title: this.title,
      nodes: this.nodesForPayload(),
      defaultChildrenDisplay: 'single-path-block',
    };
    this.save.emit(payload);
    // baseline обновляем только после успешного PUT на стороне родителя;
    // иначе при ошибке сети кнопка уже «Сохранено», а файл на диске старый.
  }

  /** Закрытие с предупреждением, если есть несохранённые изменения. */
  requestClose(): void {
    if (this.isDirty) {
      const ok = confirm('Есть несохранённые изменения. Закрыть без сохранения?');
      if (!ok) return;
    }
    this.close.emit();
  }
}
