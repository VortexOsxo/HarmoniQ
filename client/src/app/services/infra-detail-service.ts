import { Injectable, computed, signal } from '@angular/core';
import { InfrastruturesService } from './infrastrutures-service';
import { prettyNames } from '@app/utils/map-utils';

export interface InfraDetail {
  type: string;
  id: string;
  data: any;
  categoryName: string;
}

@Injectable({
  providedIn: 'root',
})
export class InfraDetailService {
  private _selectedInfra = signal<InfraDetail | null>(null);

  selectedInfra = this._selectedInfra.asReadonly();
  isOpen = computed(() => this._selectedInfra() !== null);

  constructor(private infrasService: InfrastruturesService) {}

  openDetail(type: string, id: string) {
    const infras = this.infrasService.getInfrasSignalByType(type)();
    const data = infras.find((i: any) => String(i.id) === String(id));
    if (!data) return;

    document.body.classList.add('detail-panel-open');
    this._selectedInfra.set({
      type,
      id: String(id),
      data,
      categoryName: prettyNames[type] || type,
    });
  }

  closeDetail() {
    document.body.classList.remove('detail-panel-open');
    this._selectedInfra.set(null);
  }
}
