import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ReseauService, BUS_CATEGORIES, LINE_CATEGORIES } from '@app/services/reseau-service';

@Component({
  selector: 'app-reseau-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reseau-modal.html',
  styleUrls: ['./reseau-modal.css'],
})
export class ReseauModal {
  busCategories = BUS_CATEGORIES;
  lineCategories = LINE_CATEGORIES;

  constructor(
    public activeModal: NgbActiveModal,
    public reseauService: ReseauService
  ) {}
}
