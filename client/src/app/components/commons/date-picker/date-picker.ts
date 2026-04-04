import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-picker',
  imports: [FormsModule],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
})
export class DatePicker {
  @Input() title: string = 'date';

  minDate = '2010-01-01';
  maxDate = '2050-12-31';

  @Input() startDate: string = new Date().toISOString().split('T')[0];
  @Output() startDateChange = new EventEmitter<string>();

  @Input() endDate: string = new Date().toISOString().split('T')[0];
  @Output() endDateChange = new EventEmitter<string>();

  get startDateStr(): string {
    return this.formatDate(this.startDate);
  }

  set startDateStr(value: string) {
    this.startDate = value;
    this.startDateChange.emit(this.startDate);
  }

  get endDateStr(): string {
    return this.formatDate(this.endDate);
  }

  set endDateStr(value: string) {
    if (value && this.startDate && value < this.startDate) value = this.startDate;
    this.endDate = value;
    this.endDateChange.emit(this.endDate);
  }

  private formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }
}
