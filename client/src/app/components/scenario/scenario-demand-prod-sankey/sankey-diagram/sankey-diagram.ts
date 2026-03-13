import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SankeyData } from '../sankey-data.types';

interface NodeRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  height: number;
}

interface ComputedFlow {
  path: string;
  color: string;
  type: 'demand-prod' | 'prod-co2';
  fromLabel: string;
  toLabel: string;
  valueMW: number;
  co2Tph: number;
  demandIndex: number; // -1 for prod-co2 flows
  prodIndex: number;
}

@Component({
  selector: 'app-sankey-diagram',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sankey-diagram.html',
  styleUrl: './sankey-diagram.css',
})
export class SankeyDiagramComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data!: SankeyData;

  @ViewChild('sankeyContainer') sankeyContainer!: ElementRef<HTMLElement>;
  @ViewChildren('demandNodeEl') demandNodeEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('prodNodeEl') prodNodeEls!: QueryList<ElementRef<HTMLElement>>;
  @ViewChild('co2NodeEl') co2NodeEl!: ElementRef<HTMLElement>;

  computedFlows: ComputedFlow[] = [];
  svgWidth = 0;
  svgHeight = 0;

  hoveredFlowIndex: number | null = null;
  hoveredNodeKey: string | null = null;

  tooltip: { x: number; y: number; lines: string[]; color: string } | null = null;

  private resizeObserver?: ResizeObserver;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.updateFlows(), 0);
    this.resizeObserver = new ResizeObserver(() => {
      this.updateFlows();
      this.cdr.detectChanges();
    });
    this.resizeObserver.observe(this.sankeyContainer.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.sankeyContainer) {
      setTimeout(() => this.updateFlows(), 0);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  formatMW(value: number): string {
    return value.toLocaleString('fr-FR') + ' MW';
  }

  get totalCo2(): number {
    return this.data.productionNodes.reduce(
      (s, p) => s + (p.value * p.co2FactorKgMWh) / 1000,
      0,
    );
  }

  // ── Hover: flows ──────────────────────────────────────────────────────────

  flowOpacity(i: number): number {
    const anyHover = this.hoveredFlowIndex !== null || this.hoveredNodeKey !== null;
    if (!anyHover) return 0.45;
    return this.isFlowHighlighted(i) ? 0.75 : 0.1;
  }

  private isFlowHighlighted(i: number): boolean {
    const flow = this.computedFlows[i];
    if (this.hoveredFlowIndex !== null) return i === this.hoveredFlowIndex;
    if (this.hoveredNodeKey !== null) {
      const [type, idxStr] = this.hoveredNodeKey.split('-');
      const idx = parseInt(idxStr ?? '0', 10);
      if (type === 'demand') return flow.demandIndex === idx;
      if (type === 'prod')   return flow.prodIndex === idx;
      if (type === 'co2')    return flow.type === 'prod-co2';
    }
    return false;
  }

  onFlowMouseEnter(i: number, event: MouseEvent): void {
    this.hoveredFlowIndex = i;
    this.updateTooltip(event, i);
  }

  onFlowMouseMove(event: MouseEvent, i: number): void {
    this.updateTooltip(event, i);
  }

  onFlowMouseLeave(): void {
    this.hoveredFlowIndex = null;
    this.tooltip = null;
  }

  private updateTooltip(event: MouseEvent, i: number): void {
    const rect = this.sankeyContainer.nativeElement.getBoundingClientRect();
    const flow = this.computedFlows[i];
    const lines: string[] =
      flow.type === 'demand-prod'
        ? [
            `${flow.fromLabel} → ${flow.toLabel}`,
            `${Math.round(flow.valueMW).toLocaleString('fr-FR')} MW`,
          ]
        : [
            `${flow.fromLabel} → CO\u2082`,
            `${Math.round(flow.co2Tph).toLocaleString('fr-FR')} t CO\u2082/h`,
          ];

    this.tooltip = {
      x: event.clientX - rect.left + 14,
      y: event.clientY - rect.top - 40,
      lines,
      color: flow.color,
    };
  }

  // ── Hover: node cards ─────────────────────────────────────────────────────

  onNodeMouseEnter(key: string): void {
    this.hoveredNodeKey = key;
  }

  onNodeMouseLeave(): void {
    this.hoveredNodeKey = null;
  }

  // ── Flow computation ──────────────────────────────────────────────────────

  private updateFlows(): void {
    if (!this.sankeyContainer || !this.co2NodeEl) return;

    const containerEl = this.sankeyContainer.nativeElement;
    const containerRect = containerEl.getBoundingClientRect();

    this.svgWidth = containerEl.offsetWidth;
    this.svgHeight = containerEl.offsetHeight;

    const demandEls = this.demandNodeEls.toArray();
    const prodEls = this.prodNodeEls.toArray();

    if (demandEls.length !== this.data.demandNodes.length) return;
    if (prodEls.length !== this.data.productionNodes.length) return;

    const demandRects = demandEls.map(el => this.relativeRect(el.nativeElement, containerRect));
    const prodRects   = prodEls.map(el => this.relativeRect(el.nativeElement, containerRect));
    const co2Rect     = this.relativeRect(this.co2NodeEl.nativeElement, containerRect);

    this.computedFlows = [
      ...this.computeDemandToProdFlows(demandRects, prodRects),
      ...this.computeProdToCo2Flows(prodRects, co2Rect),
    ];

    this.cdr.detectChanges();
  }

  private computeDemandToProdFlows(demandRects: NodeRect[], prodRects: NodeRect[]): ComputedFlow[] {
    const D = this.data.demandNodes;
    const P = this.data.productionNodes;
    const totalDemand = D.reduce((s, n) => s + n.value, 0);
    const R = 10;

    const flowValues = D.map(dem => P.map(prod => (dem.value / totalDemand) * prod.value));

    const cumAtDemand = D.map((dem, i) => {
      const cums: number[] = [];
      let acc = 0;
      const innerH = demandRects[i].height - 2 * R;
      for (let j = 0; j < P.length; j++) {
        cums.push(acc);
        acc += (flowValues[i][j] / dem.value) * innerH;
      }
      return cums;
    });

    const cumAtProd = P.map((prod, j) => {
      const cums: number[] = [];
      let acc = 0;
      const innerH = prodRects[j].height - 2 * R;
      for (let i = 0; i < D.length; i++) {
        cums.push(acc);
        acc += (flowValues[i][j] / prod.value) * innerH;
      }
      return cums;
    });

    const flows: ComputedFlow[] = [];

    for (let i = 0; i < D.length; i++) {
      for (let j = 0; j < P.length; j++) {
        const fVal  = flowValues[i][j];
        const dRect = demandRects[i];
        const pRect = prodRects[j];

        const hAtD = (fVal / D[i].value) * (dRect.height - 2 * R);
        const hAtP = (fVal / P[j].value) * (pRect.height - 2 * R);

        const x1   = dRect.right;
        const x2   = pRect.left;
        const midX = (x1 + x2) / 2;

        const topY1 = dRect.top + R + cumAtDemand[i][j];
        const botY1 = topY1 + hAtD;
        const topY2 = pRect.top + R + cumAtProd[j][i];
        const botY2 = topY2 + hAtP;

        flows.push({
          path: ribbon(x1, topY1, botY1, midX, x2, topY2, botY2),
          color: P[j].color,
          type: 'demand-prod',
          fromLabel: D[i].label,
          toLabel: P[j].label,
          valueMW: fVal,
          co2Tph: 0,
          demandIndex: i,
          prodIndex: j,
        });
      }
    }

    return flows;
  }

  private computeProdToCo2Flows(prodRects: NodeRect[], co2Rect: NodeRect): ComputedFlow[] {
    const P        = this.data.productionNodes;
    const co2Values = P.map(p => (p.value * p.co2FactorKgMWh) / 1000);
    const totalCo2  = co2Values.reduce((s, v) => s + v, 0);
    const R = 10; // card border-radius

    const flows: ComputedFlow[] = [];
    let co2Cum = 0;
    const co2InnerH = co2Rect.height - 2 * R;

    for (let j = 0; j < P.length; j++) {
      const pRect   = prodRects[j];
      const co2Frac = co2Values[j] / totalCo2;

      const x1   = pRect.right;
      const x2   = co2Rect.left;
      const midX = (x1 + x2) / 2;

      const topY1 = pRect.top + R;
      const botY1 = pRect.bottom - R;
      const topY2 = co2Rect.top + R + co2Cum;
      const botY2 = topY2 + co2Frac * co2InnerH;

      flows.push({
        path: ribbon(x1, topY1, botY1, midX, x2, topY2, botY2),
        color: P[j].color,
        type: 'prod-co2',
        fromLabel: P[j].label,
        toLabel: 'CO\u2082',
        valueMW: P[j].value,
        co2Tph: co2Values[j],
        demandIndex: -1,
        prodIndex: j,
      });

      co2Cum += co2Frac * co2InnerH;
    }

    return flows;
  }

  private relativeRect(el: HTMLElement, containerRect: DOMRect): NodeRect {
    const r = el.getBoundingClientRect();
    return {
      top:    r.top    - containerRect.top,
      bottom: r.bottom - containerRect.top,
      left:   r.left   - containerRect.left,
      right:  r.right  - containerRect.left,
      height: r.height,
    };
  }
}

function ribbon(
  x1: number, topY1: number, botY1: number,
  midX: number,
  x2: number, topY2: number, botY2: number,
): string {
  return (
    `M ${x1} ${topY1} ` +
    `C ${midX} ${topY1}, ${midX} ${topY2}, ${x2} ${topY2} ` +
    `L ${x2} ${botY2} ` +
    `C ${midX} ${botY2}, ${midX} ${botY1}, ${x1} ${botY1} Z`
  );
}
