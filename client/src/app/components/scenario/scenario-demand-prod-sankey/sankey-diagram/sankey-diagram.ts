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
import { DemandNode, ProductionNode, SankeyData } from '../sankey-data.types';

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

  private resizeObserver?: ResizeObserver;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    // Let layout settle before measuring
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
    const prodRects = prodEls.map(el => this.relativeRect(el.nativeElement, containerRect));
    const co2Rect = this.relativeRect(this.co2NodeEl.nativeElement, containerRect);

    this.computedFlows = [
      ...this.computeDemandToProdFlows(demandRects, prodRects),
      ...this.computeProdToCo2Flows(prodRects, co2Rect),
    ];

    this.cdr.detectChanges();
  }

  /** Ribbon flows from demand column → production column */
  private computeDemandToProdFlows(demandRects: NodeRect[], prodRects: NodeRect[]): ComputedFlow[] {
    const D = this.data.demandNodes;
    const P = this.data.productionNodes;
    const totalDemand = D.reduce((s, n) => s + n.value, 0);

    // flowValues[i][j] = flow from demand[i] to prod[j] (proportional mixing)
    const flowValues = D.map(dem =>
      P.map(prod => (dem.value / totalDemand) * prod.value),
    );

    // Cumulative y-offset at each demand node's right edge, per prod index
    const cumAtDemand = D.map((dem, i) => {
      const cums: number[] = [];
      let acc = 0;
      for (let j = 0; j < P.length; j++) {
        cums.push(acc);
        acc += (flowValues[i][j] / dem.value) * demandRects[i].height;
      }
      return cums;
    });

    // Cumulative y-offset at each prod node's left edge, per demand index
    const cumAtProd = P.map((prod, j) => {
      const cums: number[] = [];
      let acc = 0;
      for (let i = 0; i < D.length; i++) {
        cums.push(acc);
        acc += (flowValues[i][j] / prod.value) * prodRects[j].height;
      }
      return cums;
    });

    const flows: ComputedFlow[] = [];

    for (let i = 0; i < D.length; i++) {
      for (let j = 0; j < P.length; j++) {
        const fVal = flowValues[i][j];
        const dRect = demandRects[i];
        const pRect = prodRects[j];

        const hAtD = (fVal / D[i].value) * dRect.height;
        const hAtP = (fVal / P[j].value) * pRect.height;

        const x1 = dRect.right;
        const x2 = pRect.left;
        const midX = (x1 + x2) / 2;

        const topY1 = dRect.top + cumAtDemand[i][j];
        const botY1 = topY1 + hAtD;
        const topY2 = pRect.top + cumAtProd[j][i];
        const botY2 = topY2 + hAtP;

        flows.push({
          path: ribbon(x1, topY1, botY1, midX, x2, topY2, botY2),
          color: P[j].color,
        });
      }
    }

    return flows;
  }

  /** Ribbon flows from production column → CO₂ node */
  private computeProdToCo2Flows(prodRects: NodeRect[], co2Rect: NodeRect): ComputedFlow[] {
    const P = this.data.productionNodes;
    const co2Values = P.map(p => (p.value * p.co2FactorKgMWh) / 1000);
    const totalCo2 = co2Values.reduce((s, v) => s + v, 0);

    const flows: ComputedFlow[] = [];
    let co2Cum = 0;

    for (let j = 0; j < P.length; j++) {
      const pRect = prodRects[j];
      const co2Frac = co2Values[j] / totalCo2;

      const x1 = pRect.right;
      const x2 = co2Rect.left;
      const midX = (x1 + x2) / 2;

      const topY1 = pRect.top;
      const botY1 = pRect.bottom;
      const topY2 = co2Rect.top + co2Cum;
      const botY2 = topY2 + co2Frac * co2Rect.height;

      flows.push({
        path: ribbon(x1, topY1, botY1, midX, x2, topY2, botY2),
        color: P[j].color,
      });

      co2Cum += co2Frac * co2Rect.height;
    }

    return flows;
  }

  private relativeRect(el: HTMLElement, containerRect: DOMRect): NodeRect {
    const r = el.getBoundingClientRect();
    return {
      top: r.top - containerRect.top,
      bottom: r.bottom - containerRect.top,
      left: r.left - containerRect.left,
      right: r.right - containerRect.left,
      height: r.height,
    };
  }
}

/** Build a cubic-bezier ribbon SVG path between two vertical edges. */
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
