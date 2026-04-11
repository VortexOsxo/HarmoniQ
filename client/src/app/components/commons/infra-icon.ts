import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { INFRA_COLORS } from '@app/data/infra-colors.data';

@Component({
  selector: 'app-infra-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="infra-icon"
      [style.width.px]="size"
      [style.height.px]="size"
      [style.background-color]="color"
      [style.mask-image]="iconUrl"
      [style.-webkit-mask-image]="iconUrl"
    ></div>
  `,
  styles: [`
    .infra-icon {
      mask-size: contain;
      mask-repeat: no-repeat;
      mask-position: center;
      -webkit-mask-size: contain;
      -webkit-mask-repeat: no-repeat;
      -webkit-mask-position: center;
      display: inline-block;
      flex-shrink: 0;
    }
  `]
})
export class InfraIconComponent {
  @Input({ required: true }) type!: string;
  @Input() size: number = 40;

  get color(): string {
    return INFRA_COLORS[this.type] || '#888';
  }

  get iconUrl(): string {
    const baseType = this.type.startsWith('hydro_') ? 'hydro' : this.type;
    const icons: Record<string, string> = {
      hydro: '/icons/barrage.png',
      eolienneparc: '/icons/eolienne.png',
      solaire: '/icons/solaire.png',
      thermique: '/icons/thermique.png',
      nucleaire: '/icons/nucelaire.png',
    };
    const path = icons[baseType] || '';
    return path ? `url(${path})` : '';
  }
}
