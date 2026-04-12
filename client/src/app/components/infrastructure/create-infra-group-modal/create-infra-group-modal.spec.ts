import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateInfraGroupModal } from './create-infra-group-modal';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import { InfrastructureGroup } from '@app/models/infrastructure-group';

const MOCK_NEW_GROUP: InfrastructureGroup = {
    id: 0,
    nom: 'Nouveau Groupe',
    parc_eoliens: [],
    parc_solaires: [],
    central_hydroelectriques: [],
    central_thermique: [],
    central_nucleaire: [],
};

const mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
const mockInfrastruturesService = {
    createInfraGroup: vi.fn().mockReturnValue(MOCK_NEW_GROUP),
    selectedInfraGroup: signal<any>(null),
    infraGroups: signal<any[]>([]),
    getNewGroupInfraTemplate: vi.fn().mockReturnValue({
        parc_eoliens: ['9'],
        parc_solaires: [],
        central_hydroelectriques: [],
        central_thermique: [],
        central_nucleaire: [],
    }),
};

const defaultProviders = [
    { provide: NgbActiveModal, useValue: mockActiveModal },
    { provide: InfrastruturesService, useValue: mockInfrastruturesService },
];

describe('CreateInfraGroupModal', () => {
    afterEach(() => vi.clearAllMocks());

    it('should render the modal with the name input and create button', async () => {
        await render(CreateInfraGroupModal, { providers: defaultProviders });

        expect(screen.getByLabelText(/Nom du groupe/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Créer/i })).toBeInTheDocument();
    });

    describe('initial state', () => {
        it('should render an empty name input by default', async () => {
            await render(CreateInfraGroupModal, { providers: defaultProviders });

            expect(screen.getByLabelText(/Nom du groupe/i)).toHaveValue('');
        });

        it('should render the Create button as disabled when name is empty', async () => {
            await render(CreateInfraGroupModal, { providers: defaultProviders });

            expect(screen.getByRole('button', { name: /Créer/i })).toBeDisabled();
        });
    });

    describe('create', () => {
        it('should call infrastructuresService.createInfraGroup when a name is typed and Create is clicked', async () => {
            const user = userEvent.setup();
            mockInfrastruturesService.selectedInfraGroup.set({
                parc_eoliens: ['9'],
                parc_solaires: [],
                central_hydroelectriques: [],
                central_thermique: [],
                central_nucleaire: [],
            } as any);

            await render(CreateInfraGroupModal, { providers: defaultProviders });

            await user.type(screen.getByLabelText(/Nom du groupe/i), 'Mon Groupe');
            await user.click(screen.getByRole('button', { name: /Créer/i }));

            expect(mockInfrastruturesService.createInfraGroup).toHaveBeenCalledWith(
                expect.objectContaining({
                    nom: 'Mon Groupe',
                    parc_eoliens: ['9'],
                }),
            );
        });

        it('should close the modal after creating the group', async () => {
            const user = userEvent.setup();
            await render(CreateInfraGroupModal, { providers: defaultProviders });

            await user.type(screen.getByLabelText(/Nom du groupe/i), 'Mon Groupe');
            await user.click(screen.getByRole('button', { name: /Créer/i }));

            expect(mockActiveModal.close).toHaveBeenCalled();
        });

        it('should not call createInfraGroup when name is empty', async () => {
            const user = userEvent.setup();
            await render(CreateInfraGroupModal, { providers: defaultProviders });

            await user.click(screen.getByRole('button', { name: /Créer/i }));

            expect(mockInfrastruturesService.createInfraGroup).not.toHaveBeenCalled();
        });
    });

});
