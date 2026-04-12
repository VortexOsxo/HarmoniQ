import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProtectedAreasService } from '@app/services/protected-areas-service';

@Component({
  selector: 'app-protected-areas-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './protected-areas-modal.html',
  styleUrls: ['./protected-areas-modal.css'],
})
export class ProtectedAreasModal {
  constructor(
    public activeModal: NgbActiveModal,
    public protectedAreasService: ProtectedAreasService
  ) {}
}
