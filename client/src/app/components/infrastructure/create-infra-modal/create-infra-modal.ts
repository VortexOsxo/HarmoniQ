import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { OpenApiService } from '@app/services/open-api-service';
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

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private openApiService: OpenApiService
  ) { }

  ngOnInit() {
    this.processPrettyName();
    this.buildForm();
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

    for (const key in props) {
      if (!required.includes(key)) continue;

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

      controls[key] = [initialValue, Validators.required];

      this.fields.push({
        key,
        title: prop.title || key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        description: prop.description,
        enum: enumValues,
        type: (prop.type === 'number' || prop.type === 'integer') ? 'number' : 'text',
        readonly: isLatLon,
      });
    }

    this.form = this.fb.group(controls);
  }

  submit() {
    this.activeModal.close(this.form.value);
  }
}
