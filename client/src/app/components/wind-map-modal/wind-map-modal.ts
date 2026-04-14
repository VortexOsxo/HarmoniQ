import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WindMapService } from '@app/services/wind-map-service';

@Component({
  selector: 'app-wind-map-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wind-map-modal.html',
  styleUrls: ['./wind-map-modal.css'],
})
export class WindMapModal {
  constructor(
    public activeModal: NgbActiveModal,
    public windMapService: WindMapService
  ) {}

  async selectYear(year: number): Promise<void> {
    await this.windMapService.setYear(year);
  }
}
