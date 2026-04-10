import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TutorialStep {
    title: string;
    icon: string;
    description: string;
    targetSelector: string | null;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    requireAction?: boolean;
    actionHint?: string;
    bubbleOffsetX?: number;
    disableSelectors?: string[];
    delayBeforePosition?: number;
}

export interface TutorialState {
    active: boolean;
    currentStep: number;
    showWelcome: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class TutorialService {
    private readonly STORAGE_KEY = 'harmoniq_tutorial_completed';

    readonly steps: TutorialStep[] = [
        {
            title: 'Ajouter des Infrastructures',
            icon: 'fa-solid fa-plus-circle',
            description: 'Glissez-déposez les icônes d\'infrastructure (hydraulique, éolien, solaire, thermique, nucléaire) directement sur la carte pour ajouter de nouvelles installations à votre réseau.',
            targetSelector: '.map-overlay',
            position: 'top',
        },
        {
            title: 'Carte Interactive',
            icon: 'fa-solid fa-map-location-dot',
            description: 'Utilisez la carte pour visualiser votre réseau électrique. Cliquez sur les infrastructures pour voir leurs détails et performances en temps réel.',
            targetSelector: '#map',
            position: 'center',
        },
        {
            title: 'Vues de Résultats',
            icon: 'fa-solid fa-chart-pie',
            description: 'Basculez entre la vue Carte, la vue Production et la vue Temporelle pour analyser vos résultats de simulation sous différents angles.',
            targetSelector: '.view-buttons',
            position: 'bottom',
        },
        {
            title: 'Aires Protégées',
            icon: 'fa-solid fa-shield-halved',
            description: 'Activez ou désactivez l\'affichage des aires protégées sur la carte. Vous pouvez ouvrir la légende pour filtrer les types de zones à afficher.',
            targetSelector: '.protected-areas-btn-container',
            position: 'bottom',
        },
        {
            title: 'Barre de Navigation',
            icon: 'fa-solid fa-compass',
            description: 'Naviguez entre les différentes sections de l\'application : À Propos, Documentation, Flux d\'Énergie et Simulation.',
            targetSelector: 'app-navigation-bar',
            position: 'bottom',
        },
        {
            title: 'Sources d\'Énergie',
            icon: 'fa-solid fa-bolt',
            description: 'Cliquez sur ce bouton pour ouvrir le panneau des sources d\'énergie. C\'est ici que tout se configure !',
            targetSelector: '.sources-toggle-btn',
            position: 'bottom',
            requireAction: true,
            actionHint: 'Cliquez sur « Sources d\'Énergie »',
        },
        {
            title: 'Paramètres du Scénario',
            icon: 'fa-solid fa-sliders',
            description: 'Le scénario détermine la durée de la simulation, le pas de temps et les conditions météorologiques.',
            targetSelector: 'app-scenario-selector',
            position: 'right',
            delayBeforePosition: 350,
        },
        {
            title: 'Créer un Scénario',
            icon: 'fa-solid fa-plus',
            description: 'Cliquez sur ce bouton pour créer un nouveau scénario et découvrir la configuration possible.',
            targetSelector: '#tutorial-create-scenario-btn',
            position: 'bottom',
            requireAction: true,
            actionHint: 'Cliquez sur « + » pour créer un scénario',
        },
        {
            title: 'Identité du Scénario',
            icon: 'fa-solid fa-file-lines',
            description: 'Donnez un nom, une description et sélectionnez les dates de début et de fin de votre simulation.',
            targetSelector: '#scenario-identity-group',
            position: 'right',
            delayBeforePosition: 200,
        },
        {
            title: 'Pas de Temps',
            icon: 'fa-solid fa-stopwatch',
            description: 'Le pas de temps définit la précision de la simulation (ex: toutes les heures, tous les jours).',
            targetSelector: '#scenario-pas-de-temps-group',
            position: 'right',
        },
        {
            title: 'Conditions',
            icon: 'fa-solid fa-cloud-sun',
            description: 'Configurez la météo ainsi que le modèle de consommation pour votre scénario.',
            targetSelector: '#scenario-conditions-group',
            position: 'right',
        },
        {
            title: 'Fermer le Formulaire',
            icon: 'fa-solid fa-xmark',
            description: 'C\'est un tutoriel, donc on ne crée rien pour le moment. Cliquez sur la croix en haut à droite pour revenir au panneau principal.',
            targetSelector: '#tutorial-close-scenario',
            position: 'bottom',
            requireAction: true,
            actionHint: 'Cliquez sur la croix en haut à droite',
            disableSelectors: ['#tutorial-submit-scenario'],
        },
        {
            title: 'Groupes d\'Infrastructures',
            icon: 'fa-solid fa-city',
            description: 'Sélectionnez un groupe d\'infrastructures prédéfini. Vos installations de base y sont enregistrées.',
            targetSelector: 'app-infrastructure-selector',
            position: 'left',
            delayBeforePosition: 200,
        },
        {
            title: 'Lancement',
            icon: 'fa-solid fa-play',
            description: 'Vérifiez le scénario et le groupe actifs, puis lancez la simulation depuis ce panneau pour voir les résultats.',
            targetSelector: 'app-simulation-panel-launch-button',
            position: 'right',
        },
        {
            title: 'Tutoriel Terminé !',
            icon: 'fa-solid fa-circle-check',
            description: 'Vous êtes prêt à explorer HarmoniQ ! N\'hésitez pas à relancer le tutoriel à tout moment via le bouton Aide dans la barre de navigation.',
            targetSelector: null,
            position: 'center',
        },
    ];

    private state$ = new BehaviorSubject<TutorialState>({
        active: false,
        currentStep: 0,
        showWelcome: false,
    });

    get tutorialState$() {
        return this.state$.asObservable();
    }

    get currentState(): TutorialState {
        return this.state$.value;
    }

    get totalSteps(): number {
        return this.steps.length;
    }

    /** Called on simulation page init. If the user has never completed the tutorial, show welcome. */
    autoStart(): void {
        const completed = localStorage.getItem(this.STORAGE_KEY);
        if (!completed) {
            this.state$.next({ active: true, currentStep: 0, showWelcome: true });
        }
    }

    startTutorial(): void {
        this.state$.next({ active: true, currentStep: 0, showWelcome: false });
    }

    nextStep(): void {
        const s = this.state$.value;
        if (s.currentStep < this.steps.length - 1) {
            this.state$.next({ ...s, currentStep: s.currentStep + 1 });
        } else {
            this.completeTutorial();
        }
    }

    previousStep(): void {
        const s = this.state$.value;
        if (s.currentStep > 0) {
            this.state$.next({ ...s, currentStep: s.currentStep - 1 });
        }
    }

    skipTutorial(): void {
        this.completeTutorial();
    }

    resetTutorial(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        this.state$.next({ active: true, currentStep: 0, showWelcome: true });
    }

    private completeTutorial(): void {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        this.state$.next({ active: false, currentStep: 0, showWelcome: false });
    }
}
