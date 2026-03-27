import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-granularity-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-100 mb-2 d-flex align-items-center justify-content-end">
        <label class="me-2 small font-weight-bold text-muted text-uppercase">Granularité:</label>
        <select class="form-select form-select-sm w-auto shadow-sm" [value]="selected" (change)="onChange($event)">
            <option value="original">Horaires</option>
            <option value="daily">Journalier (Défaut)</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
        </select>
    </div>
  `,
  styles: [`
    .form-select-sm {
        font-size: 0.8rem;
        padding-top: 0.25rem;
        padding-bottom: 0.25rem;
    }
    label {
        font-size: 0.7rem;
        letter-spacing: 0.05rem;
    }
  `]
})
export class GranularitySelectorComponent {
  @Input() selected: string = 'daily';
  @Output() granularityChange = new EventEmitter<string>();

  onChange(event: any) {
    this.granularityChange.emit(event.target.value);
  }
}
