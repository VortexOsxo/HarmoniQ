import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-date-picker',
  imports: [FormsModule, CommonModule],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
})
export class DatePicker implements OnChanges {
  @Input() allowedYears: number[] = [2035, 2050];

  @Input() startDate: string = '2035-01-01';
  @Output() startDateChange = new EventEmitter<string>();

  @Input() endDate: string = '2035-12-31';
  @Output() endDateChange = new EventEmitter<string>();

  // --- derived fields for start ---
  startYear!: number;
  startMonth!: number;
  startDay!: number;

  // --- derived fields for end ---
  endYear!: number;
  endMonth!: number;
  endDay!: number;

  // --- available options ---
  years: number[] = [];
  months = [
    { value: 1,  label: 'Janvier'   },
    { value: 2,  label: 'Février'   },
    { value: 3,  label: 'Mars'      },
    { value: 4,  label: 'Avril'     },
    { value: 5,  label: 'Mai'       },
    { value: 6,  label: 'Juin'      },
    { value: 7,  label: 'Juillet'   },
    { value: 8,  label: 'Août'      },
    { value: 9,  label: 'Septembre' },
    { value: 10, label: 'Octobre'   },
    { value: 11, label: 'Novembre'  },
    { value: 12, label: 'Décembre'  },
  ];

  ngOnChanges(): void {
    this.buildYears();
    this.syncFromStart();
    this.syncFromEnd();
  }

  private buildYears(): void {
    this.years = [...this.allowedYears].sort((a, b) => a - b);
  }

  private syncFromStart(): void {
    const parts = (this.startDate || '').split('-');
    this.startYear  = parseInt(parts[0], 10) || this.years[0];
    this.startMonth = parseInt(parts[1], 10) || 1;
    this.startDay   = parseInt(parts[2], 10) || 1;
  }

  private syncFromEnd(): void {
    const parts = (this.endDate || '').split('-');
    this.endYear  = parseInt(parts[0], 10) || this.years[0];
    this.endMonth = parseInt(parts[1], 10) || 12;
    this.endDay   = parseInt(parts[2], 10) || this.daysIn(this.endYear, this.endMonth);
  }

  daysIn(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }



  onStartInput(event: any): void {
    const val = parseInt(event.target.value, 10);
    if (!isNaN(val)) {
      const max = this.daysIn(this.startYear, this.startMonth);
      if (val > max) {
        event.target.value = max.toString();
        this.startDay = max;
        this.onStartChange();
      }
    }
  }

  onStartBlur(event: any): void {
    let val = parseInt(event.target.value, 10);
    if (isNaN(val) || val < 1) {
      val = 1;
      event.target.value = '1';
      this.startDay = 1;
      this.onStartChange();
    }
  }

  onStartChange(): void {
    if (this.startDay == null) return; // Wait for valid input

    const max = this.daysIn(this.startYear, this.startMonth);
    let clampedDay = this.startDay;
    if (clampedDay < 1) clampedDay = 1;
    if (clampedDay > max) clampedDay = max;
    this.startDay = clampedDay;

    this.startDate = this.toISO(this.startYear, this.startMonth, this.startDay);
    this.startDateChange.emit(this.startDate);
    // ensure end >= start
    if (this.endDate < this.startDate) {
      this.endDate = this.startDate;
      this.syncFromEnd();
      this.endDateChange.emit(this.endDate);
    }
  }

  onEndInput(event: any): void {
    const val = parseInt(event.target.value, 10);
    if (!isNaN(val)) {
      const max = this.daysIn(this.endYear, this.endMonth);
      if (val > max) {
        event.target.value = max.toString();
        this.endDay = max;
        this.onEndChange();
      }
    }
  }

  onEndBlur(event: any): void {
    let val = parseInt(event.target.value, 10);
    if (isNaN(val) || val < 1) {
      val = 1;
      event.target.value = '1';
      this.endDay = 1;
      this.onEndChange();
    }
  }

  onEndChange(): void {
    if (this.endDay == null) return; // Wait for valid input

    const max = this.daysIn(this.endYear, this.endMonth);
    let clampedDay = this.endDay;
    if (clampedDay < 1) clampedDay = 1;
    if (clampedDay > max) clampedDay = max;
    this.endDay = clampedDay;

    this.endDate = this.toISO(this.endYear, this.endMonth, this.endDay);
    if (this.startDate && this.endDate < this.startDate) {
      this.endDate = this.startDate;
      this.syncFromEnd();
    }
    this.endDateChange.emit(this.endDate);
  }

  private toISO(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
}
