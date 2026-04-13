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
            title: 'Aires Protégées',
            icon: 'fa-solid fa-shield-halved',
            description: 'Activez ou désactivez l\'affichage des infrastructures, aires protégées, du réseau et de la carte des vents. Vous pouvez ouvrir la légende pour filtrer les éléments à afficher.',
            targetSelector: '.protected-areas-btn-container',
            position: 'bottom',
        },
        {
            title: 'Barre de Navigation',
            icon: 'fa-solid fa-compass',
            description: 'Naviguez entre les différentes sections de l\'application : À Propos et Documentation.',
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
            description: 'Vous pouvez cliquer sur ce bouton pour créer un nouveau scénario et découvrir la configuration possible.',
            targetSelector: '#tutorial-create-scenario-btn',
            position: 'bottom',
        },
        {
            title: 'Groupes d\'Infrastructures',
            icon: 'fa-solid fa-city',
            description: 'Vous pouvez sélectionner et créer des groupes d\'infrastructures pour organiser et sauvegarder vos installations.',
            targetSelector: 'app-infrastructure-selector',
            position: 'left',
            delayBeforePosition: 200,
        },
        {
            title: 'Lancer la Simulation',
            icon: 'fa-solid fa-play',
            description: 'Tout est prêt ! Cliquez maintenant sur le bouton « Lancer Simulation » ci-dessous pour démarrer la simulation et voir les résultats.',
            targetSelector: 'app-simulation-panel-launch-button',
            position: 'right',
            requireAction: true,
            actionHint: 'Cliquez sur « Lancer Simulation » pour continuer',
        },
        {
            title: 'Graphiques et Rapports',
            icon: 'fa-solid fa-chart-line',
            description: 'Pendant et après la simulation, vous pouvez consulter les divers graphiques et rapports générés. Le calcul peut prendre quelques instants pour tout générer.',
            targetSelector: '.page-content',
            position: 'center',
            delayBeforePosition: 500,
        },
        {
            title: 'Lancer le Quiz',
            icon: 'fa-solid fa-gamepad',
            description: 'Vous pouvez également participer à un quiz interactif pour enrichir et tester vos connaissances sur les systèmes énergétiques.',
            targetSelector: '#tutorial-quiz-btn',
            position: 'right',
        },
        {
            title: 'Exporter',
            icon: 'fa-solid fa-file-arrow-down',
            description: 'Utilisez ce bouton pour exporter tous vos rapports (Production, Coûts, CO2) au format CSV.',
            targetSelector: '#tutorial-export-btn',
            position: 'right',
        },
        {
            title: 'Prêt à explorer !',
            icon: 'fa-solid fa-circle-check',
            description: 'Vous connaissez désormais l\'essentiel d\'HarmoniQ ! Vous pouvez utiliser « Retour à la carte » pour revenir au planificateur ou relancer le tutoriel à tout moment via l\'Aide.',
            targetSelector: '#tutorial-retour-btn',
            position: 'bottom',
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
        // Don't restart if the tutorial is already in progress
        if (this.state$.value.active) return;
        const completed = localStorage.getItem(this.STORAGE_KEY);
        if (!completed) {
            this.updateState({ active: true, currentStep: 0, showWelcome: true });
        }
    }

    startTutorial(): void {
        this.updateState({ active: true, currentStep: 0, showWelcome: false });
    }

    nextStep(): void {
        const s = this.state$.value;
        if (s.currentStep < this.steps.length - 1) {
            this.updateState({ ...s, currentStep: s.currentStep + 1 });
        } else {
            this.completeTutorial();
        }
    }

    previousStep(): void {
        const s = this.state$.value;
        if (s.currentStep > 0) {
            this.updateState({ ...s, currentStep: s.currentStep - 1 });
        }
    }

    skipTutorial(): void {
        this.completeTutorial();
    }

    resetTutorial(): void {
        localStorage.removeItem(this.STORAGE_KEY);
        this.updateState({ active: true, currentStep: 0, showWelcome: true });
    }

    private completeTutorial(): void {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        this.state$.next({ active: false, currentStep: 0, showWelcome: false });
    }

    private updateState(newState: TutorialState): void {
        this.state$.next(newState);
    }
}
