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
import { DecimalPipe } from '@angular/common';
import { SankeyData } from '../sankey-data.types';
import { SimulationService } from '@app/services/simulation-service';

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
    type: 'demand-energy' | 'energy-prod' | 'prod-co2' | 'fossil-co2';
    fromLabel: string;
    toLabel: string;
    valueMW: number;
    co2Tph: number;
    demandIndex: number;   // index into demandNodes (-1 for other types)
    energyIndex: number;   // index into energyTypeNodes (-1 for other types)
    prodIndex: number;     // index into productionNodes (-1 for demand-energy flows)
}

@Component({
    selector: 'app-sankey-diagram',
    standalone: true,
    imports: [DecimalPipe],
    templateUrl: './sankey-diagram.html',
    styleUrl: './sankey-diagram.css',
})
export class SankeyDiagramComponent implements AfterViewInit, OnChanges, OnDestroy {
    @Input() data!: SankeyData;
    @Input() showProduction = false;

    @ViewChild('sankeyContainer') sankeyContainer!: ElementRef<HTMLElement>;
    @ViewChildren('demandNodeEl') demandNodeEls!: QueryList<ElementRef<HTMLElement>>;
    @ViewChildren('energyTypeNodeEl') energyTypeNodeEls!: QueryList<ElementRef<HTMLElement>>;
    @ViewChildren('prodNodeEl') prodNodeEls!: QueryList<ElementRef<HTMLElement>>;
    @ViewChild('co2NodeEl') co2NodeEl!: ElementRef<HTMLElement>;

    computedFlows: ComputedFlow[] = [];
    svgWidth = 0;
    svgHeight = 0;

    hoveredFlowIndex: number | null = null;
    hoveredNodeKey: string | null = null;

    tooltip: { x: number; y: number; lines: string[]; color: string } | null = null;

    private resizeObserver?: ResizeObserver;

    constructor(
        private cdr: ChangeDetectorRef,
        private simulationService: SimulationService,
    ) {}

    openSourcesPanel(): void {
        this.simulationService.openSourcesPanel$.next();
    }

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
        const formatted = value >= 10 || value == 0
            ? Math.round(value).toLocaleString('fr-FR')
            : value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return formatted + ' MW';
    }

    formatCo2(value: number): string {
        if (value === 0) return '0';
        if (value >= 10) return Math.round(value).toLocaleString('fr-FR');
        return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    private co2Tph(p: { value: number; co2FactorKgMWh?: number; co2Tph?: number }): number {
        return p.co2Tph ?? (p.value * (p.co2FactorKgMWh ?? 0)) / 1000;
    }

    get totalCo2(): number {
        const prodCo2 = this.data.productionNodes.reduce((s, p) => s + this.co2Tph(p), 0);
        const gasNode = this.data.energyTypeNodes.find(e => e.id === 'gas');
        const fossilCo2 = gasNode ? (gasNode.value * (gasNode.co2FactorKgMWh ?? 0)) / 1000 : 0;
        return prodCo2 + fossilCo2;
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
            if (type === 'energy') return flow.energyIndex === idx;
            if (type === 'prod') return flow.prodIndex === idx;
            if (type === 'co2') return flow.type === 'prod-co2' || flow.type === 'fossil-co2';
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
            flow.type === 'prod-co2' || flow.type === 'fossil-co2'
                ? [`${flow.fromLabel} → CO\u2082`, `${this.formatCo2(flow.co2Tph)} t CO\u2082/h`]
                : flow.type === 'energy-prod'
                ? [`${flow.toLabel} \u2192 ${flow.fromLabel}`, `${this.formatMW(flow.valueMW)}`]
                : [`${flow.fromLabel} → ${flow.toLabel}`, `${this.formatMW(flow.valueMW)}`];

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
        const energyTypeEls = this.energyTypeNodeEls.toArray();
        const prodEls = this.prodNodeEls.toArray();

        if (demandEls.length !== this.data.demandNodes.length) return;
        if (energyTypeEls.length !== this.data.energyTypeNodes.length) return;
        if (prodEls.length !== this.data.productionNodes.length) return;

        const demandRects = demandEls.map(el => this.relativeRect(el.nativeElement, containerRect));
        const energyTypeRects = energyTypeEls.map(el => this.relativeRect(el.nativeElement, containerRect));
        const prodRects = prodEls.map(el => this.relativeRect(el.nativeElement, containerRect));
        const co2Rect = this.relativeRect(this.co2NodeEl.nativeElement, containerRect);

        this.computedFlows = this.showProduction
            ? [
                  ...this.computeDemandToEnergyFlows(demandRects, energyTypeRects),
                  ...this.computeEnergyToProdFlows(energyTypeRects, prodRects),
                  ...this.computeAllCo2Flows(energyTypeRects, prodRects, co2Rect),
              ]
            : [];

        this.cdr.detectChanges();
    }

    // Demand nodes → Energy type nodes (split by electricityValue / gasValue)
    private computeDemandToEnergyFlows(
        demandRects: NodeRect[],
        energyRects: NodeRect[],
    ): ComputedFlow[] {
        const D = this.data.demandNodes;
        const E = this.data.energyTypeNodes;
        const R = 10;
        const flows: ComputedFlow[] = [];

        const energyCum = E.map(() => 0);
        const energyTotals = E.map(e =>
            D.reduce((s, d) => s + (e.id === 'electricity' ? d.electricityValue : d.gasValue), 0)
        );

        for (let i = 0; i < D.length; i++) {
            const dRect = demandRects[i];
            const totalD = D[i].value;
            if (totalD <= 0) continue;

            let demCum = 0;
            const demInnerH = dRect.height - 2 * R;

            for (let j = 0; j < E.length; j++) {
                const fVal = E[j].id === 'electricity' ? D[i].electricityValue : D[i].gasValue;
                if (fVal <= 0) continue;

                const eRect = energyRects[j];
                const eInnerH = eRect.height - 2 * R;
                const eFrac = energyTotals[j] > 0 ? fVal / energyTotals[j] : 0;

                const hAtD = (fVal / totalD) * demInnerH;
                const hAtE = eFrac * eInnerH;

                const x1 = dRect.right;
                const x2 = eRect.left;
                const midX = (x1 + x2) / 2;

                const topY1 = dRect.top + R + demCum;
                const botY1 = topY1 + hAtD;
                const topY2 = eRect.top + R + energyCum[j];
                const botY2 = topY2 + hAtE;

                flows.push({
                    path: ribbon(x1, topY1, botY1, midX, x2, topY2, botY2),
                    color: E[j].color,
                    type: 'demand-energy',
                    fromLabel: D[i].label,
                    toLabel: E[j].label,
                    valueMW: fVal,
                    co2Tph: 0,
                    demandIndex: i,
                    energyIndex: j,
                    prodIndex: -1,
                });

                demCum += hAtD;
                energyCum[j] += hAtE;
            }
        }

        return flows;
    }

    // Energy type nodes → Production nodes (matched by energyType)
    private computeEnergyToProdFlows(
        energyRects: NodeRect[],
        prodRects: NodeRect[],
    ): ComputedFlow[] {
        const E = this.data.energyTypeNodes;
        const P = this.data.productionNodes;
        const R = 10;
        const flows: ComputedFlow[] = [];

        const energyCum = E.map(() => 0);
        const energyProdTotals = E.map(e =>
            P.filter(p => p.energyType === e.id).reduce((s, p) => s + p.value, 0)
        );

        for (let j = 0; j < E.length; j++) {
            const eRect = energyRects[j];
            const eInnerH = eRect.height - 2 * R;
            const eProdTotal = energyProdTotals[j];

            for (let k = 0; k < P.length; k++) {
                if (P[k].energyType !== E[j].id) continue;
                if (P[k].value <= 0) continue;

                const fVal = P[k].value;
                const pRect = prodRects[k];
                const pInnerH = pRect.height - 2 * R;

                const hAtE = eProdTotal > 0 ? (fVal / eProdTotal) * eInnerH : 0;
                const hAtP = pInnerH;

                const x1 = eRect.right;
                const x2 = pRect.left;
                const midX = (x1 + x2) / 2;

                const topY1 = eRect.top + R + energyCum[j];
                const botY1 = topY1 + hAtE;
                const topY2 = pRect.top + R;
                const botY2 = topY2 + hAtP;

                flows.push({
                    path: ribbon(x1, topY1, botY1, midX, x2, topY2, botY2),
                    color: P[k].color,
                    type: 'energy-prod',
                    fromLabel: P[k].label,   // tooltip: Solaire → Électricité
                    toLabel: E[j].label,
                    valueMW: fVal,
                    co2Tph: 0,
                    demandIndex: -1,
                    energyIndex: j,
                    prodIndex: k,
                });

                energyCum[j] += hAtE;
            }
        }

        return flows;
    }

    private computeAllCo2Flows(
        energyTypeRects: NodeRect[],
        prodRects: NodeRect[],
        co2Rect: NodeRect,
    ): ComputedFlow[] {
        const E = this.data.energyTypeNodes;
        const P = this.data.productionNodes;
        const R = 10;
        const co2InnerH = co2Rect.height - 2 * R;

        const prodCo2Values = P.map(p => this.co2Tph(p));
        const prodTotalCo2 = prodCo2Values.reduce((s, v) => s + v, 0);

        const gasIdx = E.findIndex(e => e.id === 'gas');
        const gasNode = gasIdx >= 0 ? E[gasIdx] : null;
        const fossilCo2 = gasNode ? (gasNode.value * (gasNode.co2FactorKgMWh ?? 0)) / 1000 : 0;

        const totalCo2 = prodTotalCo2 + fossilCo2;
        if (totalCo2 <= 0) return [];

        const flows: ComputedFlow[] = [];
        let co2Cum = 0;

        for (let j = 0; j < P.length; j++) {
            if (P[j].value <= 0 || prodCo2Values[j] <= 0) continue;
            const co2Frac = prodCo2Values[j] / totalCo2;
            const pRect = prodRects[j];

            const x1 = pRect.right;
            const x2 = co2Rect.left;
            const midX = (x1 + x2) / 2;

            const topY2 = co2Rect.top + R + co2Cum;
            const botY2 = topY2 + co2Frac * co2InnerH;

            flows.push({
                path: ribbon(x1, pRect.top + R, pRect.bottom - R, midX, x2, topY2, botY2),
                color: P[j].color,
                type: 'prod-co2',
                fromLabel: P[j].label,
                toLabel: 'CO\u2082',
                valueMW: P[j].value,
                co2Tph: prodCo2Values[j],
                demandIndex: -1,
                energyIndex: -1,
                prodIndex: j,
            });

            co2Cum += co2Frac * co2InnerH;
        }

        if (fossilCo2 > 0 && gasIdx >= 0 && gasNode) {
            const fossilFrac = fossilCo2 / totalCo2;
            const gasRect = energyTypeRects[gasIdx];
            const x1 = gasRect.right;
            const x2 = co2Rect.left;

            const topY2 = co2Rect.top + R + co2Cum;
            const botY2 = topY2 + fossilFrac * co2InnerH;

            // Route below all production nodes instead of crossing them
            const bottomProd = prodRects.length > 0 ? Math.max(...prodRects.map(r => r.bottom)) : co2Rect.bottom;
            const belowY = bottomProd + 30;

            flows.push({
                path: ribbonBelow(x1, gasRect.top + R, gasRect.bottom - R, x2, topY2, botY2, belowY),
                color: gasNode.color,
                type: 'fossil-co2',
                fromLabel: gasNode.label,
                toLabel: 'CO\u2082',
                valueMW: gasNode.value,
                co2Tph: fossilCo2,
                demandIndex: -1,
                energyIndex: gasIdx,
                prodIndex: -1,
            });
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



function ribbonBelow(
    x1: number,
    topY1: number,
    botY1: number,
    x2: number,
    topY2: number,
    botY2: number,
    belowY: number,
    dipFraction = 0.67,
): string {
    const h2 = botY2 - topY2;
    const xDip = x1 + (x2 - x1) * dipFraction;
    const cp = (x2 - x1) * 0.15;
    return (
        `M ${x1} ${topY1} ` +
        `C ${xDip - cp} ${topY1}, ${xDip - cp} ${belowY}, ${xDip} ${belowY} ` +
        `C ${xDip + cp} ${belowY}, ${x2 - cp} ${topY2}, ${x2} ${topY2} ` +
        `L ${x2} ${botY2} ` +
        `C ${x2 - cp} ${botY2}, ${xDip + cp} ${belowY + h2}, ${xDip} ${belowY + h2} ` +
        `C ${xDip - cp} ${belowY + h2}, ${xDip - cp} ${botY1}, ${x1} ${botY1} Z`
    );
}

function ribbon(
    x1: number,
    topY1: number,
    botY1: number,
    midX: number,
    x2: number,
    topY2: number,
    botY2: number,
): string {
    return (
        `M ${x1} ${topY1} ` +
        `C ${midX} ${topY1}, ${midX} ${topY2}, ${x2} ${topY2} ` +
        `L ${x2} ${botY2} ` +
        `C ${midX} ${botY2}, ${midX} ${botY1}, ${x1} ${botY1} Z`
    );
}
