import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { InfrastructureGroup } from '@app/models/infrastructure-group';
import { InfrastruturesService } from '@app/services/infrastrutures-service';

@Component({
    selector: 'app-create-infra-group-modal',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './create-infra-group-modal.html'
})
export class CreateInfraGroupModal {
    name: string = '';
    readonly nameMaxLength = 100;

    currentGroup: InfrastructureGroup | null = null;

    constructor(public activeModal: NgbActiveModal, private infrastructuresService: InfrastruturesService) {
        this.currentGroup = infrastructuresService.selectedInfraGroup();
    }

    get nameExistsError(): string | null {
        const nom = this.name.trim().toLowerCase();
        if (!nom) return null;
        const existing = this.infrastructuresService.infraGroups().find(g => g.nom.trim().toLowerCase() === nom);
        if (existing) return "Un groupe d'infrastructures avec ce nom existe déjà.";
        return null;
    }

    create() {
        if (!this.name || this.name.length > this.nameMaxLength || this.nameExistsError) return;

        const newGroup: InfrastructureGroup = {
            id: 0,
            nom: this.name,
            parc_eoliens: this.currentGroup?.parc_eoliens || [],
            parc_solaires: this.currentGroup?.parc_solaires || [],
            central_hydroelectriques: this.currentGroup?.central_hydroelectriques || [],
            central_thermique: this.currentGroup?.central_thermique || [],
            central_nucleaire: this.currentGroup?.central_nucleaire || []
        };

        this.infrastructuresService.createInfraGroup(newGroup);
        this.activeModal.close('created');
    }
}
