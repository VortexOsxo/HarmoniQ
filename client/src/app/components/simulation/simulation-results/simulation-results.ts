import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbNavModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { QuebecMap } from '@app/components/quebec-map/quebec-map';
import { ProtectedAreasModal } from '@app/components/protected-areas-modal/protected-areas-modal';
import { ReseauModal } from '@app/components/reseau-modal/reseau-modal';
import { InfrastructuresModal } from '@app/components/infrastructures-modal/infrastructures-modal';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { ReseauService } from '@app/services/reseau-service';
import { TutorialService } from '@app/services/tutorial-service';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { InfraDetailModal } from '@app/components/infra-detail-modal/infra-detail-modal';
import { MapService } from '@app/services/map-service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-simulation-results',
  imports: [CommonModule, NgbNavModule, QuebecMap, InfraDetailModal],
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
    private tutorialService: TutorialService,
    private infraDetailService: InfraDetailService,
    private modalService: NgbModal,
    public mapService: MapService,
  ) { }

  openProtectedAreasSettings(event: Event): void {
    event.stopPropagation(); // Avoid toggling visibility when clicking the settings icon
    this.modalService.open(ProtectedAreasModal, {
      scrollable: true,
      size: 'lg',
      windowClass: 'side-filter-modal',
      backdrop: true,
      backdropClass: 'transparent-backdrop'
    });
  }

  openReseauSettings(event: Event): void {
    event.stopPropagation();
    this.modalService.open(ReseauModal, {
      scrollable: true,
      size: 'lg',
      windowClass: 'side-filter-modal',
      backdrop: true,
      backdropClass: 'transparent-backdrop'
    });
  }

  openInfrastructuresSettings(event: Event): void {
    event.stopPropagation();
    this.modalService.open(InfrastructuresModal, {
      scrollable: true,
      size: 'lg',
      windowClass: 'side-filter-modal',
      backdrop: true,
      backdropClass: 'transparent-backdrop'
    });
  }

  ngOnInit(): void {
    this.tutorialSub = this.tutorialService.tutorialState$.subscribe((s) => {
      if (s.active && s.showWelcome) this.protectedAreasService.hide();
    });
  }

  ngOnDestroy(): void {
    this.tutorialSub?.unsubscribe();
  }
}
