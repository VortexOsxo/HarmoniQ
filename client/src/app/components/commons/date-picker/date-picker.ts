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

  @Input() startDate: Date = new Date();
  @Output() startDateChange = new EventEmitter<Date>();

  @Input() endDate: Date = new Date();
  @Output() endDateChange = new EventEmitter<Date>();

  constructor() { }

  get startDateStr(): string {
    return this.formatDate(this.startDate);
  }

  set startDateStr(value: string) {
    this.startDate = new Date(value);
    this.startDateChange.emit(this.startDate);
  }

  get endDateStr(): string {
    return this.formatDate(this.endDate);
  }

  set endDateStr(value: string) {
    this.endDate = new Date(value);
    this.endDateChange.emit(this.endDate);
  }

  private formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }
}
