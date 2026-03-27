import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';
import { SimulationStepService } from '@app/services/simulation-step-service';
import * as Plotly from 'plotly.js-dist-min';

const NETWORK_MIX_CHART_ID = 'network-mix-donut-id';

const CARRIER_COLORS: Record<string, string> = {
  hydro_fil:        '#1d9bf0',
  hydro_reservoir:  '#0d5fa3',
  eolien:           '#f4a261',
  solaire:          '#f9c74f',
  nucleaire:        '#90be6d',
  thermique:        '#e76f51',
  import:           '#b5838d',
};

@Component({
  selector: 'app-scenario-network-results',
  imports: [CommonModule],
  templateUrl: './scenario-network-results.html',
  styleUrl: './scenario-network-results.css',
})
export class ScenarioNetworkResults implements AfterViewInit, OnDestroy {
  summary: any = null;
  violations: any[] = [];
  linkFlows: any[] = [];

  constructor(
    private simulationTemporalGraphService: SimulationTemporalGraphService,
    private stepService: SimulationStepService,
  ) { }

  ngAfterViewInit(): void {
    if (this.hasResults()) {
      this.loadData();
    }
  }

  ngOnDestroy(): void { }

  hasResults(): boolean {
    const steps = this.stepService.steps();
    const myStep = steps.find(s => s.name === this.simulationTemporalGraphService.getStepName());
    return myStep?.status === 'completed';
  }

  private loadData(): void {
    const result = this.simulationTemporalGraphService.getCachedSimulationResult();
    if (!result) return;

    this.summary = result.summary ?? null;
    this.violations = result.violations ?? [];
    this.linkFlows = result.link_flows ?? [];

    setTimeout(() => this.renderMixChart(result.production), 0);
  }

  private renderMixChart(production: any[]): void {
    if (!production || production.length === 0) return;

    const carriers = ['hydro_fil', 'hydro_reservoir', 'eolien', 'solaire', 'nucleaire', 'thermique', 'import'];
    const labels = ['Hydro fil', 'Hydro réservoir', 'Éolien', 'Solaire', 'Nucléaire', 'Thermique', 'Importations'];

    const totals = carriers.map(c =>
      production.reduce((sum: number, row: any) => sum + (row[`total_${c}`] ?? 0), 0)
    );

    const nonZeroIndices = totals.map((v, i) => i).filter(i => totals[i] > 0);

    const trace: any = {
      type: 'pie',
      hole: 0.45,
      values: nonZeroIndices.map(i => totals[i]),
      labels: nonZeroIndices.map(i => labels[i]),
      marker: {
        colors: nonZeroIndices.map(i => CARRIER_COLORS[carriers[i]] ?? '#aaa'),
      },
      hovertemplate: '%{label}<br>%{value:,.0f} MW·h<br>%{percent}<extra></extra>',
      textinfo: 'percent',
    };

    Plotly.react(NETWORK_MIX_CHART_ID, [trace], {
      margin: { t: 20, b: 20, l: 20, r: 20 },
      showlegend: true,
      legend: { orientation: 'v' },
      paper_bgcolor: 'transparent',
    } as any);
  }

  formatGwh(mwh: number | undefined): string {
    if (mwh == null) return '—';
    return (mwh / 1000).toLocaleString('fr-CA', { maximumFractionDigits: 0 }) + ' GWh';
  }

  formatPercent(v: number | undefined): string {
    if (v == null) return '—';
    return v.toFixed(1) + ' %';
  }
}
