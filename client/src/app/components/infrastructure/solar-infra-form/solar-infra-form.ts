import { Component, Input, OnInit, ChangeDetectorRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-solar-infra-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbTooltipModule],
  templateUrl: './solar-infra-form.html',
  styleUrl: './solar-infra-form.css'
})
export class SolarInfraForm implements OnInit, AfterViewInit {
  @Input() form!: FormGroup;
  @Input() lat!: number;
  @Input() lon!: number;

  showAdvanced = false;

  modules = [
    { key: 'CS6X_300M', name: 'Canadian Solar CS6X-300M — 284 W', w_panel: 284, area_m2: 1.91 },
    { key: 'CS5P_220M', name: 'Canadian Solar CS5P-220M — 221 W', w_panel: 221, area_m2: 1.70 },
    { key: 'SPR_315E', name: 'SunPower SPR-315E — 315 W', w_panel: 315, area_m2: 1.63 },
    { key: 'SPR_305', name: 'SunPower SPR-305 — 305 W', w_panel: 305, area_m2: 1.63 },
  ];

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.form.get('materiau_panneau')?.valueChanges.subscribe(() => {
      this.calcPanneaux();
    });
    this.form.get('puissance_nominal')?.valueChanges.subscribe(() => {
      this.calcPanneaux();
    });
    this.form.get('orientation_panneau')?.valueChanges.subscribe(val => {
      this.updateOrientationSVG(val);
    });
    this.form.get('angle_panneau')?.valueChanges.subscribe(val => {
      this.updateAngleSVG(val);
    });

    // Initial calculations based on default power/module
    this.calcPanneaux();
  }


  ngAfterViewInit() {
    // Initial SVG update
    // We use a small delay to ensure DOM is ready, then update everything
    setTimeout(() => {
      this.calcPanneaux(); 
      this.updateAngleSVG(this.form.get('angle_panneau')?.value);
      this.updateOrientationSVG(this.form.get('orientation_panneau')?.value);
      this.cdr.detectChanges();
    }, 50);
  }



  toggleAdvanced(event: Event) {
    event.preventDefault();
    this.showAdvanced = !this.showAdvanced;
  }

  onKeydown(event: KeyboardEvent) {
    if (['-', 'e', 'E', '+'].includes(event.key)) {
      event.preventDefault();
    }
  }

  onBlurRound(controlName: string) {
    const control = this.form.get(controlName);
    if (!control) return;
    const val = Number(control.value);
    if (!isNaN(val) && val >= 0) {
      const rounded = Math.round(val * 1000) / 1000;
      if (val !== rounded) {
        control.setValue(rounded);
      }
    }
  }

  onBlurClamped(controlName: string, min: number, max: number) {
    const control = this.form.get(controlName);
    if (!control) return;
    let val = parseFloat(control.value);
    if (isNaN(val)) val = min;
    const clamped = Math.max(min, Math.min(max, val));
    if (clamped !== val) {
      control.setValue(clamped);
    }
  }


  getCurrentModule() {
    const key = this.form.get('materiau_panneau')?.value;
    return this.modules.find(m => m.key === key) || this.modules[0];
  }

  updateAngleSVG(val: any) {
    let raw = parseFloat(val);
    if (isNaN(raw)) raw = 0;
    let a = Math.max(0, Math.min(90, raw));
    this.cdr.detectChanges();
    const rad = (a * Math.PI) / 180;



    const cx = 85, cy = 105, len = 58;
    const x2 = cx + len * Math.cos(rad);
    const y2 = cy - len * Math.sin(rad);

    const panelLine = document.getElementById('panelLine');
    if (panelLine) {
      panelLine.setAttribute('x2', x2.toFixed(1));
      panelLine.setAttribute('y2', y2.toFixed(1));
    }

    // Impact point for sun rays (middle of panel)
    const mx = cx + (len / 2) * Math.cos(rad);
    const my = cy - (len / 2) * Math.sin(rad);

    // Update rays
    this.updateRay('raySummer', 'raySummerHead', 61, 40, mx, my);
    this.updateRay('rayWinter', 'rayWinterHead', 20, 79, mx, my);

    // Arc angle panel
    const arcR = 22;
    const ax = cx + arcR * Math.cos(rad);
    const ay = cy - arcR * Math.sin(rad);
    const d = 'M ' + (cx + arcR) + ' ' + cy + ' A ' + arcR + ' ' + arcR + ' 0 0 0 ' + ax.toFixed(1) + ' ' + ay.toFixed(1);
    const angleArc = document.getElementById('angleArc');
    if (angleArc) angleArc.setAttribute('d', a > 0 ? d : '');

    const tx = cx + (arcR + 8) * Math.cos(rad / 2);
    const ty = cy - (arcR + 8) * Math.sin(rad / 2);
    const txt = document.getElementById('angleText');
    if (txt) {
      txt.setAttribute('x', tx.toFixed(1));
      txt.setAttribute('y', (ty + 4).toFixed(1));
      txt.textContent = Math.round(a) + '°';
    }
  }

  private updateRay(rayId: string, headId: string, sx: number, sy: number, mx: number, my: number) {
    const ray = document.getElementById(rayId);
    if (ray) {
      ray.setAttribute('x2', mx.toFixed(1));
      ray.setAttribute('y2', my.toFixed(1));
    }
    const head = document.getElementById(headId);
    if (head) {
      const dx = mx - sx, dy = my - sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / len, uy = dy / len;
      const px = -uy, py = ux;
      const h1x = mx - ux * 6 + px * 3, h1y = my - uy * 6 + py * 3;
      const h2x = mx - ux * 6 - px * 3, h2y = my - uy * 6 - py * 3;
      head.setAttribute('points', `${mx.toFixed(1)},${my.toFixed(1)} ${h1x.toFixed(1)},${h1y.toFixed(1)} ${h2x.toFixed(1)},${h2y.toFixed(1)}`);
    }
  }

  updateOrientationSVG(val: any) {
    let raw = parseFloat(val);
    if (isNaN(raw)) raw = 0;
    let deg = Math.max(0, Math.min(360, raw));
    this.cdr.detectChanges();
    const rad = (deg * Math.PI) / 180;



    const cx = 50, cy = 50, len = 32;
    const ex = cx + len * Math.sin(rad);
    const ey = cy - len * Math.cos(rad);
    const ax = Math.sin(rad), ay = -Math.cos(rad);
    const px = -ay, py = ax;

    const arrow = document.getElementById('orientArrow');
    if (arrow) {
      arrow.setAttribute('x2', ex.toFixed(1));
      arrow.setAttribute('y2', ey.toFixed(1));
    }

    const t1x = ex - ax * 8 + px * 4, t1y = ey - ay * 8 + py * 4;
    const t2x = ex - ax * 8 - px * 4, t2y = ey - ay * 8 - py * 4;
    const head = document.getElementById('orientHead');
    if (head) {
      head.setAttribute('points', `${ex.toFixed(1)},${ey.toFixed(1)} ${t1x.toFixed(1)},${t1y.toFixed(1)} ${t2x.toFixed(1)},${t2y.toFixed(1)}`);
    }

    const pw = 14, ph = 4;
    const panelEl = document.getElementById('orientPanel');
    if (panelEl) {
      panelEl.setAttribute('x', (ex - pw / 2).toFixed(1));
      panelEl.setAttribute('y', (ey - ph / 2).toFixed(1));
      panelEl.setAttribute('transform', 'rotate(' + deg + ',' + ex.toFixed(1) + ',' + ey.toFixed(1) + ')');
    }
    const orientText = document.getElementById('orientText');
    if (orientText) orientText.textContent = Math.round(deg) + '°';
  }

  calcPanneaux() {
    const mw = parseFloat(this.form.get('puissance_nominal')?.value) || 0;
    const m = this.getCurrentModule();
    const nb = mw > 0 ? Math.ceil(mw * 1000000 / m.w_panel) : 0;
    this.form.get('nombre_panneau')?.setValue(nb > 0 ? nb : '', { emitEvent: false });
    this.updateCalculatedInfo(nb, m.area_m2);
  }

  calcPuissance() {
    const nb = parseInt(this.form.get('nombre_panneau')?.value) || 0;
    const m = this.getCurrentModule();
    const mw = nb > 0 ? (nb * m.w_panel / 1000000) : 0;
    this.form.get('puissance_nominal')?.setValue(mw > 0 ? parseFloat(mw.toFixed(3)) : '', { emitEvent: false });
    this.updateCalculatedInfo(nb, m.area_m2);
  }

  updateCalculatedInfo(nbPanneaux: number, areaPerModule: number) {
    const infoNb = document.getElementById('infoNbPanneaux');
    if (infoNb) {
      infoNb.textContent = nbPanneaux > 0 ? nbPanneaux.toLocaleString('fr-CA') : '—';
    }
    const infoSurf = document.getElementById('infoSurface');
    if (infoSurf) {
      const surf = nbPanneaux * areaPerModule;
      infoSurf.textContent = nbPanneaux > 0 ? '~ ' + Math.round(surf).toLocaleString('fr-CA') + ' m²' : '—';
    }
  }

  onModuleChange() {
    this.calcPanneaux();
  }
}
