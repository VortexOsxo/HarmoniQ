import { ChangeDetectorRef, Component, ElementRef, ViewChild, effect } from '@angular/core';
import { SankeyDiagramComponent } from './sankey-diagram/sankey-diagram';
import { Co2DetailsPanelComponent } from './co2-details-panel/co2-details-panel';
import { Co2DetailsData, SankeyData } from './sankey-data.types';
import html2canvas from 'html2canvas';
import { buildCo2Details, PLACEHOLDER_SANKEY_DATA } from './sankey-placeholder.data';
import { DemandeSankeyGraphService } from '@app/services/graph-services/demande-sankey-graph-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationService } from '@app/services/simulation-service';

@Component({
    selector: 'app-scenario-demand-prod-sankey',
    standalone: true,
    imports: [SankeyDiagramComponent, Co2DetailsPanelComponent],
    templateUrl: './scenario-demand-prod-sankey.html',
    styleUrl: './scenario-demand-prod-sankey.css',
})
export class ScenarioDemandProdSankey {
    @ViewChild('sankeyView') sankeyView!: ElementRef<HTMLElement>;

    sankeyData: SankeyData = PLACEHOLDER_SANKEY_DATA;
    co2Data: Co2DetailsData = buildCo2Details(PLACEHOLDER_SANKEY_DATA);
    simulationRan = false;

    get selectedScenario() {
        return this.scenariosService.selectedScenario;
    }

    get totalDemandMW(): number {
        return this.sankeyData.demandNodes.reduce((s, n) => s + n.value, 0);
    }

    get totalProductionMW(): number {
        return this.sankeyData.productionNodes.reduce((s, n) => s + n.value, 0);
    }

    get coveragePercent(): number {
        return this.totalDemandMW > 0
            ? Math.round((this.totalProductionMW / this.totalDemandMW) * 100)
            : 0;
    }

    get productionDeficit(): number {
        if (!this.simulationRan) return 0;
        return Math.max(0, this.totalDemandMW - this.totalProductionMW);
    }

    get productionSurplus(): number {
        if (!this.simulationRan) return 0;
        return Math.max(0, this.totalProductionMW - this.totalDemandMW);
    }

    async downloadImage() {
        const el = this.sankeyView.nativeElement;
        const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2 });
        const link = document.createElement('a');
        link.download = 'sankey.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    constructor(
        private graphService: DemandeSankeyGraphService,
        private scenariosService: ScenariosService,
        private simulationService: SimulationService,
        private cdr: ChangeDetectorRef,
    ) {
        effect(() => {
            const demandNodes = this.graphService.demandNodes();
            const energyTypeNodes = this.graphService.energyTypeNodes();
            if (demandNodes && energyTypeNodes) {
                this.sankeyData = { ...this.sankeyData, demandNodes, energyTypeNodes };
                this.cdr.markForCheck();
            }
        });

        effect(() => {
            const nodes = this.simulationService.productionNodes();
            if (nodes) {
                this.simulationRan = true;
                this.sankeyData = { ...this.sankeyData, productionNodes: nodes };
                this.co2Data = buildCo2Details(this.sankeyData);
                this.cdr.markForCheck();
            } else {
                this.simulationRan = false;
                this.sankeyData = {
                    ...this.sankeyData,
                    productionNodes: PLACEHOLDER_SANKEY_DATA.productionNodes,
                };
                this.co2Data = buildCo2Details(this.sankeyData);
                this.cdr.markForCheck();
            }
        });
    }
}
