import { Component, computed, effect, untracked, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InfraDetailService } from '@app/services/infra-detail-service';
import { ProtectedAreasService } from '@app/services/protected-areas-service';
import { InfrastruturesService } from '@app/services/infrastrutures-service';
import {
    CYCLE_DE_VIE_DATA,
    CycleDeVieData,
    IMPACTS_ENVIRONNEMENTAUX_DATA,
    ImpactItem,
} from '@app/data/infra-details.data';
import { HQ_IMAGE_URLS } from '@app/data/hq-images.data';
import { InfraIconComponent } from '@app/components/commons/infra-icon';
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmationModal } from '@app/components/commons/confirmation-modal/confirmation-modal';
import { INFRA_COLORS } from '@app/data/infra-colors.data';
import { ScenariosService } from '@app/services/scenarios-service';
import { SimulationSingleInfraModal } from '@app/components/simulation/simulation-single-infra-modal/simulation-single-infra-modal';
import { FIRST_NATION_DATA } from '@app/data/first-nation.data';

@Component({
    selector: 'app-infra-detail-modal',
    imports: [CommonModule, NgbTooltipModule, InfraIconComponent],
    templateUrl: './infra-detail-modal.html',
    styleUrl: './infra-detail-modal.css',
})
export class InfraDetailModal {
    infraColors = INFRA_COLORS;
    showCycleVieModal: boolean = false;
    showImageOverlay: boolean = false;

    isOpen = computed(() => this.infraDetailService.isOpen());
    infra = computed(() => this.infraDetailService.selectedInfra());

    // Hydro power slider
    sliderValue = signal<number>(0);
    private basePuissance = signal<number>(0);

    isNewDam = computed(() => {
        const infra = this.infra();
        return infra?.type === 'hydro' && !!infra.data?.nom?.endsWith('_new');
    });

    pMin = computed(() => {
        const infra = this.infra();
        const base = this.basePuissance();
        if (!infra || infra.type !== 'hydro' || base === 0) return 0;
        if (this.isNewDam()) return Math.round(base / (infra.data.nb_turbines || 1));
        return base;
    });

    pMax = computed(() => {
        const base = this.basePuissance();
        if (base === 0) return 0;
        return this.isNewDam() ? Math.round(base * 1.15) : Math.round(base * 1.1);
    });

    protectedAreaName: string | null = null;
    protectedAreaIcon: string | null = null;
    protectedAreaImpact: string | null = null;
    protectedAreaTypeLabel: string = 'une aire protégée';
    loadingProtectionStatus: boolean = false;

    selectedExplanationTitle: string | null = null;
    selectedExplanationText: string | null = null;

    showExplanationFromTooltip(tooltip: string) {
        if (!tooltip) return;
        const parts = tooltip.split(' : ');
        if (parts.length > 1) {
            this.selectedExplanationTitle = parts[0];
            this.selectedExplanationText = parts.slice(1).join(' : ');
        } else {
            this.selectedExplanationTitle = 'Information';
            this.selectedExplanationText = tooltip;
        }
    }

    closeExplanation() {
        this.selectedExplanationTitle = null;
        this.selectedExplanationText = null;
    }

    lat: number = 0;
    lon: number = 0;
    private checkedLat: number | null = null;
    private checkedLon: number | null = null;

    constructor(
        public infraDetailService: InfraDetailService,
        private infrasService: InfrastruturesService,
        private modalService: NgbModal,
        private protectedAreasService: ProtectedAreasService,
        private scenariosService: ScenariosService,
        private cdr: ChangeDetectorRef,
    ) {
        effect(
            () => {
                // Déclencheur sur le changement d'infrastructure
                const currentInfra = this.infra();
                untracked(() => {
                    if (!currentInfra || !currentInfra.data) {
                        this.showCycleVieModal = false;
                        this.showImageOverlay = false;
                        this.protectedAreaName = null;
                        this.protectedAreaImpact = null;
                        this.protectedAreaIcon = null;
                        this.loadingProtectionStatus = false;
                        this.closeExplanation();
                        this.checkedLat = null;
                        this.checkedLon = null;
                        return;
                    }

                    const newLat = parseFloat(currentInfra.data.latitude || currentInfra.data.lat);
                    const newLon = parseFloat(currentInfra.data.longitude || currentInfra.data.lng);

                    if (this.checkedLat === newLat && this.checkedLon === newLon) {
                        return; // Already checked this location, no refresh needed
                    }

                    this.lat = newLat;
                    this.lon = newLon;
                    this.checkedLat = newLat;
                    this.checkedLon = newLon;

                    this.showCycleVieModal = false;
                    this.showImageOverlay = false;
                    this.protectedAreaName = null;
                    this.protectedAreaIcon = null;
                    this.protectedAreaImpact = null;
                    this.loadingProtectionStatus = false;
                    this.closeExplanation();

                    if (currentInfra.type === 'hydro' && currentInfra.data.puissance_nominal) {
                        const p = parseFloat(currentInfra.data.puissance_nominal);
                        this.basePuissance.set(p);
                        const override = this.infrasService
                            .hydroPuissanceOverrides()
                            .get(currentInfra.data.id);
                        this.sliderValue.set(override ?? p);
                    }

                    if (!isNaN(this.lat) && !isNaN(this.lon)) {
                        this.loadingProtectionStatus = true;
                        this.protectedAreasService
                            .checkProtectedAreaWithDetails(this.lat, this.lon)
                            .then((res) => {
                                const name = res ? res.name : null;
                                const categoryId = res ? res.categoryId : -1;

                                this.protectedAreaName = name;
                                this.protectedAreaImpact = null;
                                this.protectedAreaIcon = null;
                                this.protectedAreaTypeLabel = 'une aire protégée';
                                if (name) {
                                    if (categoryId === 24) {
                                        this.protectedAreaIcon = '/icons/fish.png';
                                        this.protectedAreaTypeLabel =
                                            "un territoire d'importance pour la conservation";
                                    } else if (categoryId === 100) {
                                        this.protectedAreaIcon = '/icons/cerf.png';
                                        this.protectedAreaTypeLabel = 'une zone environnementale';
                                    } else if (categoryId === 101) {
                                        this.protectedAreaIcon = '/icons/tree-icon.svg';
                                        this.protectedAreaTypeLabel = 'un milieu forestier';
                                    } else if (categoryId === 52) {
                                        this.protectedAreaIcon = '/icons/tipi.png';
                                        this.protectedAreaTypeLabel =
                                            'un territoire autochtone. Une entente doit être conclue avec les communautés autochtones afin de construire une infrastructure sur ce territoire.';
                                    } else if (categoryId === 102) {
                                        this.protectedAreaTypeLabel = 'une aire protégée fédérale';
                                    }

                                    const habitatArray = Array.isArray(FIRST_NATION_DATA)
                                        ? FIRST_NATION_DATA
                                        : (FIRST_NATION_DATA as any).default || [];
                                    for (const habitat of habitatArray) {
                                        if (
                                            habitat['Région'] &&
                                            name
                                                .toUpperCase()
                                                .includes(
                                                    (habitat['Région'] as string).toUpperCase(),
                                                )
                                        ) {
                                            this.protectedAreaImpact = habitat['Impact'] || null;
                                            break;
                                        }
                                    }
                                }
                                this.loadingProtectionStatus = false;
                                setTimeout(() => {
                                    this.cdr.markForCheck();
                                    this.cdr.detectChanges();
                                });
                            })
                            .catch(() => {
                                this.loadingProtectionStatus = false;
                                setTimeout(() => {
                                    this.cdr.markForCheck();
                                    this.cdr.detectChanges();
                                });
                            });
                    }
                });
            },
            { allowSignalWrites: true },
        );
    }

    hasSelectedScenario(): boolean {
        return !!this.scenariosService.selectedScenario();
    }

    simulateSingle(): void {
        const infra = this.infra();
        if (!infra || !this.scenariosService.selectedScenario()) return;
        const modalRef = this.modalService.open(SimulationSingleInfraModal, { size: 'xl', windowClass: 'sim-infra-modal' });
        modalRef.componentInstance.id = infra.data.id;
        modalRef.componentInstance.name = infra.data.nom;
        modalRef.componentInstance.type = infra.type;
    }

    deleteInfra() {
        const infra = this.infra();
        if (infra && infra.data.isUserCreated) {
            const modalRef = this.modalService.open(ConfirmationModal, { centered: true });
            modalRef.componentInstance.title = "Supprimer l'infrastructure";
            modalRef.componentInstance.message =
                "Êtes-vous sûr de vouloir supprimer cette infrastructure? L'action est irréversible.";
            modalRef.componentInstance.confirmText = 'Supprimer';
            modalRef.componentInstance.cancelText = '';

            modalRef.result
                .then((confirmed) => {
                    if (confirmed) {
                        this.infrasService.deleteLocalInfra(infra.type, infra.data.id);
                        this.close();
                    }
                })
                .catch(() => {}); // Dismissal ignored
        }
    }

    onPuissanceSliderInput(event: Event) {
        const val = parseFloat((event.target as HTMLInputElement).value);
        this.sliderValue.set(val);
    }

    onPuissanceSliderChange(event: Event) {
        const val = parseFloat((event.target as HTMLInputElement).value);
        this.sliderValue.set(val);
        const infra = this.infra();
        if (!infra || infra.type !== 'hydro') return;
        this.infrasService.overrideHydroPuissance(infra.data.id, val);
    }

    close() {
        this.infraDetailService.closeDetail();
        this.showCycleVieModal = false;
        this.showImageOverlay = false;
        this.closeExplanation();
    }

    getHQImageUrl(): string | null {
        const infra = this.infra();
        if (!infra || !infra.data || !infra.data.nom) return null;

        // Base normalization: remove accents, lowercase
        const baseNom = infra.data.nom
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();

        // Generate variants to map to HQ URLs
        const variants: string[] = [];

        // 1. Direct hyphenated: "les-cedres", "laforge-1"
        variants.push(baseNom.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

        // 2. Direct without hyphens: "lescedres", "laforge1"
        variants.push(baseNom.replace(/[^a-z0-9]+/g, ''));

        // 3. Remove articles ("les ", "le ", "la ", "l'") and hyphenate: "cedres"
        const noArticle = baseNom.replace(/^(le\s|la\s|les\s|l['’]\s*)/, '');
        variants.push(noArticle.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

        // 4. Remove articles without hyphens
        variants.push(noArticle.replace(/[^a-z0-9]+/g, ''));

        for (const variant of variants) {
            if (!variant) continue;

            // Try exact suffixes
            for (const suffix of [
                '-01.jpg',
                '-1.jpg',
                '-03.jpg',
                '.jpg',
                '1-01.jpg',
                '2-01.jpg',
                '2A-01.jpg',
            ]) {
                const expectedMatch = `/images/centrales/${variant}${suffix}`;
                const found = HQ_IMAGE_URLS.find((url) => url.includes(expectedMatch));
                if (found) return found;
            }

            // Fuzzy prefix search
            const foundFuzzy = HQ_IMAGE_URLS.find((url) => {
                const filename = url.split('/').pop() || '';
                return filename.startsWith(variant + '-') || filename === variant + '.jpg';
            });
            if (foundFuzzy) return foundFuzzy;
        }

        return null;
    }

    getIconForType(type: string): string {
        const icons: Record<string, string> = {
            hydro: '/icons/barrage.png',
            eolienneparc: '/icons/eolienne.png',
            solaire: '/icons/solaire.png',
            thermique: '/icons/thermique.png',
            nucleaire: '/icons/nucelaire.png',
        };
        return icons[type] || '';
    }

    openCycleVie() {
        this.showCycleVieModal = true;
    }

    closeCycleVie() {
        this.showCycleVieModal = false;
    }

    getCycleVieData(): CycleDeVieData | null {
        const infra = this.infra();
        if (!infra) return null;
        return CYCLE_DE_VIE_DATA[infra.type] || null;
    }

    getPluralCategoryName(): string {
        const infra = this.infra();
        if (!infra) return '';
        const type = infra.type;
        switch (type) {
            case 'hydro':
                return 'barrages hydroélectriques';
            case 'eolienneparc':
                return 'parcs éoliens';
            case 'solaire':
                return 'parcs solaires';
            case 'thermique':
                return 'centrales thermiques';
            case 'nucleaire':
                return 'centrales nucléaires';
            default:
                return infra.categoryName.toLowerCase() + 's';
        }
    }

    getCapitalizedPluralCategoryName(): string {
        const name = this.getPluralCategoryName();
        return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
    }

    getImpactsData(): ImpactItem[] {
        const infra = this.infra();
        if (!infra) return [];
        return IMPACTS_ENVIRONNEMENTAUX_DATA[infra.type] || [];
    }

    getInfoFields(): {
        icon: string;
        label: string;
        value: string;
        isVulgarisation?: boolean;
        tooltip?: string;
    }[] {
        const infra = this.infra();
        if (!infra) return [];

        const d = infra.data;
        const fields: {
            icon: string;
            label: string;
            value: string;
            isVulgarisation?: boolean;
            tooltip?: string;
        }[] = [];

        if (infra.type === 'hydro') {
            fields.push({
                icon: 'fa-solid fa-water',
                label: 'Type de barrage',
                value: d.type_barrage || 'N/A',
            });
            fields.push({
                icon: 'fa-solid fa-gauge-high',
                label: 'Débit nominal',
                value: d.debits_nominal ? `${parseFloat(d.debits_nominal).toFixed(1)} m³/s` : 'N/A',
                tooltip:
                    "Mètres cubes par seconde (m³/s) : Mesure le volume d'eau qui s'écoule chaque seconde.",
            });
            fields.push({
                icon: 'fa-solid fa-bolt',
                label: 'Puissance nominale',
                value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A',
                tooltip:
                    'Mégawatt (MW) : Unité de mesure de puissance électrique équivalant à un million de watts. Elle représente la capacité maximale de production.',
            });
            fields.push({
                icon: 'fa-solid fa-database',
                label: 'Volume du réservoir',
                value: this.formatVolume(d.volume_reservoir),
                tooltip:
                    "Volume d'eau emmagasiné dans le réservoir. Référé en km³, Mm³ (Millions de m³), ou Gm³.",
            });
        } else if (infra.type === 'eolienneparc') {
            fields.push({
                icon: 'fa-solid fa-wind',
                label: "Nombre d'éoliennes",
                value: d.nombre_eoliennes || 'N/A',
            });
            fields.push({
                icon: 'fa-solid fa-bolt',
                label: 'Puissance nominale',
                value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A',
                tooltip:
                    'Mégawatt (MW) : Unité de mesure de puissance électrique équivalant à un million de watts. Elle représente la capacité maximale de production.',
            });
            fields.push({
                icon: 'fa-solid fa-battery-full',
                label: 'Capacité totale',
                value: d.capacite_total ? `${d.capacite_total} MW` : 'N/A',
                tooltip:
                    'Mégawatt (MW) : Unité de mesure de puissance électrique équivalant à un million de watts.',
            });
        } else if (infra.type === 'solaire') {
            fields.push({
                icon: 'fa-solid fa-solar-panel',
                label: 'Nombre de panneaux',
                value: d.nombre_panneau || 'N/A',
            });
            fields.push({
                icon: 'fa-solid fa-compass',
                label: 'Orientation des panneaux',
                value: d.orientation_panneau ? `${d.orientation_panneau}° S` : 'N/A',
                tooltip: "Degrés Sud (° S) : Angle d'orientation des panneaux par rapport au Sud.",
            });
            fields.push({
                icon: 'fa-solid fa-bolt',
                label: 'Puissance nominale',
                value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A',
                tooltip:
                    'Mégawatt (MW) : Unité de mesure de puissance électrique équivalant à un million de watts. Elle représente la capacité maximale de production.',
            });
        } else if (infra.type === 'thermique' || infra.type === 'nucleaire') {
            fields.push({
                icon: 'fa-solid fa-bolt',
                label: 'Puissance nominale',
                value: d.puissance_nominal ? `${d.puissance_nominal} MW` : 'N/A',
                tooltip:
                    'Mégawatt (MW) : Unité de mesure de puissance électrique équivalant à un million de watts. Elle représente la capacité maximale de production.',
            });
            fields.push({
                icon: 'fa-solid fa-fire',
                label: "Type d'intrant",
                value: d.type_intrant || 'N/A',
            });
        }

        // Vulgarisation (Comparaison)
        if (d.puissance_nominal) {
            const puissanceMW = parseFloat(d.puissance_nominal);
            if (!isNaN(puissanceMW) && puissanceMW > 0) {
                const telephones = (puissanceMW * 1000000) / 20;
                // User's formula: Puissance x 365 x 24 x 60 x 10^9 divisé par 20 000
                const foyers = (puissanceMW * 365 * 24 * 60 * 1000000000) / 20000;

                const millionsTelephones = (telephones / 1000000).toFixed(1);
                const foyersFormatted = this.formatBigNumber(foyers);

                fields.push({
                    icon: 'fa-solid fa-mobile-screen-button',
                    label: 'Comparaison globale',
                    value: `Pourrait recharger ${millionsTelephones} millions de téléphones simultanément.`,
                    isVulgarisation: true,
                });
                fields.push({
                    icon: 'fa-solid fa-house',
                    label: 'Foyers alimentés',
                    value: `${foyersFormatted} foyers théoriquement.`,
                    isVulgarisation: true,
                });
            }
        }

        return fields;
    }

    private formatBigNumber(num: number): string {
        if (num >= 1e12) return `${(num / 1e12).toFixed(1)} billions`;
        if (num >= 1e9) return `${(num / 1e9).toFixed(1)} milliards`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(1)} millions`;
        return Math.floor(num).toLocaleString('fr-FR');
    }

    private formatVolume(vol: number | null | undefined): string {
        if (!vol) return 'N/A';
        if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)} Gm³`;
        if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)} Mm³`;
        return `${(vol / 1e3).toFixed(1)} km³`;
    }
}
