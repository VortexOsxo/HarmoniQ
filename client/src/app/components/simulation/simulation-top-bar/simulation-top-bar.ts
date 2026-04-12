import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SimulationService } from '@app/services/simulation-service';
import { CommonModule } from '@angular/common';
import { TopBarLogo } from "@app/components/top-bar-logo/top-bar-logo";
import { ScenariosService } from '@app/services/scenarios-service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmationModal } from '@app/components/commons/confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-simulation-top-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, TopBarLogo],
  templateUrl: './simulation-top-bar.html',
  styleUrl: './simulation-top-bar.css',
})
export class SimulationTopBar {
  scenarioService = inject(ScenariosService);
  simulationService = inject(SimulationService);
  private router = inject(Router);
  private modalService = inject(NgbModal);

  goBack() {
    const modalRef = this.modalService.open(ConfirmationModal, { centered: true });
    modalRef.componentInstance.title = 'Quitter la simulation';
    modalRef.componentInstance.message = 'Êtes-vous sûr de vouloir retourner à la carte ? Vous allez quitter la simulation.';
    modalRef.componentInstance.confirmText = 'Quitter';
    modalRef.componentInstance.cancelText = 'Annuler';
    modalRef.componentInstance.confirmBtnClass = 'btn-danger';

    modalRef.result.then((result) => {
      if (result === true) {
        this.router.navigate(['/map']);
      }
    }).catch(() => { });
  }
}
