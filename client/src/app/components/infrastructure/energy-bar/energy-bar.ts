import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { ScenariosService } from '@app/services/scenarios-service';
import { DemandeTemporalGraphService } from '@app/services/graph-services/demande-temporal-graph-service';
import { SimulationTemporalGraphService } from '@app/services/graph-services/simulation-temporal-graph-service';

// Typical Quebec capacity factors (fraction of installed MW produced on average)
const WIND_CF  = 0.35;
const SOLAR_CF = 0.12;

@Component({
  selector: 'app-energy-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './energy-bar.html',
  styleUrl: './energy-bar.css',
})
export class EnergyBar {

  private infrasService  = inject(InfrastruturesService);
  private scenariosService = inject(ScenariosService);
  private demandeService = inject(DemandeTemporalGraphService);
  simService     = inject(SimulationTemporalGraphService);

  // ── Scenario duration in hours (live from selected scenario) ──────────────
  scenarioHours = computed(() => {
    const scenario = this.scenariosService.selectedScenario();
    if (!scenario) return 8760; // default: 1 year
    const start = new Date(scenario.date_de_debut).getTime();
    const end   = new Date(scenario.date_de_fin).getTime();
    return Math.max(1, (end - start) / (1000 * 3600));
  });

  // ── Energy values (TWh) ───────────────────────────────────────────────────

  /** Guaranteed TWh: live from infrastructure toggles × scenario hours */
  guaranteedEnergyTWh = computed(() => {
    const mw = this.infrasService.guaranteedPowerMW();
    return Math.round(mw * this.scenarioHours() / 1e6 * 10) / 10;
  });

  /**
   * Wind TWh: use actual simulation result if available,
   * otherwise estimate from installed capacity × capacity factor.
   */
  windEnergyTWh = computed(() => {
    const sim = this.simService.energySummaryTWh();
    if (sim) return sim.wind;
    const mw = this.infrasService.windInstalledMW();
    return Math.round(mw * WIND_CF * this.scenarioHours() / 1e6 * 10) / 10;
  });

  /**
   * Solar TWh: use actual simulation result if available,
   * otherwise estimate from installed capacity × capacity factor.
   */
  solarEnergyTWh = computed(() => {
    const sim = this.simService.energySummaryTWh();
    if (sim) return sim.solar;
    const mw = this.infrasService.solarInstalledMW();
    return Math.round(mw * SOLAR_CF * this.scenarioHours() / 1e6 * 10) / 10;
  });

  /** Total local production TWh (no imports) */
  localSupplyTWh = computed(() =>
    this.guaranteedEnergyTWh() + this.windEnergyTWh() + this.solarEnergyTWh()
  );

  /**
   * Total demand TWh: from demand simulation if available,
   * otherwise null (bar is hidden).
   */
  demandEnergyTWh = computed(() => this.demandeService.totalDemandEnergyTWh());

  /** Surplus (>0) or deficit (<0) in TWh */
  netBalanceTWh = computed(() => {
    const demand = this.demandEnergyTWh();
    if (!demand) return 0;
    return Math.round((this.localSupplyTWh() - demand) * 10) / 10;
  });

  // ── Bar segment widths (% of demand) ─────────────────────────────────────

  pctGuaranteed = computed(() => this._pct(this.guaranteedEnergyTWh()));
  pctWind       = computed(() => this._pct(this.windEnergyTWh()));
  pctSolar      = computed(() => this._pct(this.solarEnergyTWh()));

  windIsEstimate  = computed(() => this.simService.energySummaryTWh() === null);
  solarIsEstimate = computed(() => this.simService.energySummaryTWh() === null);

  private _pct(twh: number): number {
    const demand = this.demandEnergyTWh();
    if (!demand) return 0;
    return Math.round((twh / demand) * 100);
  }
}
