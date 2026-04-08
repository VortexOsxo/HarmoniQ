import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { QuebecMap } from '@app/components/quebec-map/quebec-map';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService } from '@app/services/reseau-service';
import { TutorialService } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfraDetailModal } from '@app/components/infra-detail-modal/infra-detail-modal';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { WindMapService } from '@app/services/wind-map-service';

@Component({
  selector: 'app-simulation-results',
  imports: [CommonModule, FormsModule, NgbNavModule, QuebecMap, InfraDetailModal],
  templateUrl: './simulation-results.html',
  styleUrl: './simulation-results.css',
}) // TODO: Rename to like QuebecMapWrapper or something
export class SimulationResults implements OnInit, OnDestroy {
  private tutorialSub?: Subscription;

  get isDetailOpen() {
    return this.infraDetailService.isOpen();
  }

  constructor(
    public protectedAreasService: ProtectedAreasService,
    public reseauService: ReseauService,
    public windMapService: WindMapService,
    private tutorialService: TutorialService,
    private infraDetailService: InfraDetailService,
  ) { }

  get selectedWindYear(): number | null {
    return this.windMapService.selectedYear();
  }

  async toggleWindMode(): Promise<void> {
    await this.windMapService.toggleWindMode();
  }

  async onWindYearChange(year: string | number): Promise<void> {
    await this.windMapService.setYear(Number(year));
  }

  ngOnInit(): void {
    this.tutorialSub = this.tutorialService.tutorialState$.subscribe((s) => {
      if (s.active && s.showWelcome) this.protectedAreasService.hide();
    });
  }

  ngOnDestroy(): void {
    if (this.windMapService.isWindMode()) {
      this.windMapService.disableWindMode();
    }
    this.tutorialSub?.unsubscribe();
  }
}
