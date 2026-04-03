import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { OpenApiService } from '@app/services/open-api-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { prettyNames } from '@app/utils/map-utils';

@Component({
  selector: 'app-create-infra-modal',
  imports: [CommonModule, ReactiveFormsModule, NgbTooltipModule],
  templateUrl: './create-infra-modal.html',
  styleUrl: './create-infra-modal.css',
})
export class CreateInfraModal {
  @Input() schema!: any;
  @Input() lat!: number;
  @Input() lon!: number;
  @Input() type!: string;

  form!: FormGroup;
  fields: any[] = [];
  prettyName = '';
  protectedAreaName: string | null = null;
  
  isSolar = false;
  showAdvanced = false;
  
  toggleAdvanced(event: Event) {
    event.preventDefault();
    this.showAdvanced = !this.showAdvanced;
  }

  updateAngleSVG(val: any) {
    const a = Math.max(0, Math.min(90, parseFloat(val) || 0));
    const rad = a * Math.PI / 180;
    const len = 45;
    const x2 = 30 + len * Math.cos(rad);
    const y2 = 65 - len * Math.sin(rad);
    document.getElementById('panelLine')?.setAttribute('x2', x2.toString());
    document.getElementById('panelLine')?.setAttribute('y2', y2.toString());
    
    const arcR = 15;
    const ax = 30 + arcR * Math.cos(rad);
    const ay = 65 - arcR * Math.sin(rad);
    const d = 'M ' + (30 + arcR) + ' 65 A ' + arcR + ' ' + arcR + ' 0 0 0 ' + ax.toFixed(1) + ' ' + ay.toFixed(1);
    document.getElementById('angleArc')?.setAttribute('d', a > 0 ? d : '');
    
    const tx = 30 + (arcR + 8) * Math.cos(rad / 2);
    const ty = 65 - (arcR + 8) * Math.sin(rad / 2);
    const txt = document.getElementById('angleText');
    if (txt) {
      txt.setAttribute('x', tx.toString());
      txt.setAttribute('y', (ty + 4).toString());
      txt.textContent = Math.round(a) + '°';
    }
  }

  updateOrientationSVG(val: any) {
    let deg = parseFloat(val) || 0;
    deg = Math.max(0, Math.min(360, deg));
    const rad = deg * Math.PI / 180;
    const cx = 50, cy = 50, len = 32;
    const ex = cx + len * Math.sin(rad);
    const ey = cy - len * Math.cos(rad);
    const ax = Math.sin(rad), ay = -Math.cos(rad);
    const px = -ay, py = ax;
    
    document.getElementById('orientArrow')?.setAttribute('x2', ex.toFixed(1));
    document.getElementById('orientArrow')?.setAttribute('y2', ey.toFixed(1));
    
    const t1x = ex - ax*8 + px*4, t1y = ey - ay*8 + py*4;
    const t2x = ex - ax*8 - px*4, t2y = ey - ay*8 - py*4;
    document.getElementById('orientHead')?.setAttribute('points',
        ex.toFixed(1)+','+ey.toFixed(1)+' '+t1x.toFixed(1)+','+t1y.toFixed(1)+' '+t2x.toFixed(1)+','+t2y.toFixed(1));
        
    const pw = 14, ph = 4;
    const panelEl = document.getElementById('orientPanel');
    if (panelEl) {
      panelEl.setAttribute('x', (ex - pw/2).toFixed(1));
      panelEl.setAttribute('y', (ey - ph/2).toFixed(1));
      panelEl.setAttribute('transform', 'rotate('+deg+','+ex.toFixed(1)+','+ey.toFixed(1)+')');
    }
    const orientText = document.getElementById('orientText');
    if (orientText) orientText.textContent = Math.round(deg) + '°';
  }

  calcPanneaux() {
    const mw = parseFloat(this.form.get('puissance_nominal')?.value) || 0;
    const kw = mw * 1000;
    const parPanneau = 0.22; // 220W
    const nb = kw > 0 ? Math.ceil(kw / parPanneau) : 0;
    this.form.get('nombre_panneau')?.setValue(nb > 0 ? nb : '', { emitEvent: false });
  }

  calcPuissance() {
    const nb = parseInt(this.form.get('nombre_panneau')?.value) || 0;
    const parPanneau = 0.22;
    const mw = nb > 0 ? (nb * parPanneau / 1000) : 0;
    this.form.get('puissance_nominal')?.setValue(mw > 0 ? parseFloat(mw.toFixed(3)) : '', { emitEvent: false });
  }

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private openApiService: OpenApiService,
    private protectedAreasService: ProtectedAreasService,
    private infrasService: InfrastruturesService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.processPrettyName();
    this.buildForm();
    this.protectedAreasService.checkProtectedArea(this.lat, this.lon).then(name => {
      this.protectedAreaName = name;
      this.cdr.detectChanges();
    });
    setTimeout(() => { 
      if (this.isSolar) { 
        this.updateAngleSVG(this.form.get('angle_panneau')?.value); 
        this.updateOrientationSVG(this.form.get('orientation_panneau')?.value); 
      } 
    }, 50);
  }

  processPrettyName() {
    const upname = this.type.split('/').pop() || '';
    if (upname === 'hydro') {
      alert("La fonctionnalité pour les infrastructures hydroélectriques est en cours de développement. Cette démonstration est fournie à titre indicatif.");
    }
    this.prettyName = prettyNames[upname] || upname;
  }

  buildForm() {
    const controls: any = {};
    const schemas = this.openApiService.getOpenApiSchemas();
    const props = this.schema.properties;
    const required = this.schema.required || [];

    const typeKey = this.type.split('/').pop() || '';
    this.isSolar = typeKey.toLowerCase() === 'solaire';

    for (const key in props) {
      if (!required.includes(key)) continue;
      if (key === 'id') continue;

      const prop = props[key];
      const suggestion = prop.suggestion;

      const isLatLon = key === 'latitude' || key === 'longitude';
      let value: any = '';
      if (key === 'latitude') value = this.lat;
      else if (key === 'longitude') value = this.lon;

      const initialValue = suggestion || value;

      let enumValues: string[] | undefined = undefined;

      if (prop['$ref']) {
        const refPath = prop['$ref'].replace('#/components/schemas/', '');
        const enumSchema = schemas[refPath];
        if (enumSchema && enumSchema.enum) {
          enumValues = enumSchema.enum;
        }
      } else if (prop.enum) {
        enumValues = prop.enum;
      }

      const validators = [Validators.required];
      if (key === 'nom') {
        validators.push((control: AbstractControl): ValidationErrors | null => {
          const name = control.value?.trim().toLowerCase();
          if (!name) return null;
          const exists = this.infrasService.getInfrasSignalByType(typeKey)()
            .some((i: any) => i.nom?.trim().toLowerCase() === name);
          return exists ? { duplicateName: true } : null;
        });
      }

      controls[key] = [initialValue, validators];

      this.fields.push({
        key,
        title: prop.title || key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: prop.description,
        enum: enumValues,
        type: (prop.type === 'number' || prop.type === 'integer') ? 'number' : 'text',
        readonly: isLatLon,
      });
    }

    if (this.isSolar) {
      if (!controls['panneau_type']) {
        controls['panneau_type'] = ['biface', []];
      }
    }
    this.form = this.fb.group(controls);
  }

  submit() {
    this.activeModal.close(this.form.value);
  }
}
