import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TutorialStep {
    title: string;
    icon: string;
    description: string;
    targetSelector: string | null;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
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
            title: 'Sources d\'Énergie',
            icon: 'fa-solid fa-bolt',
            description: 'Cliquez ici pour ouvrir le panneau des sources d\'énergie. Vous y trouverez les scénarios, groupes d\'infrastructures et le bouton de lancement de simulation.',
            targetSelector: '.sources-toggle-btn',
            position: 'bottom',
        },
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
            description: 'Activez ou désactivez l\'affichage des aires protégées sur la carte pour planifier vos installations en tenant compte des contraintes environnementales.',
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
            title: 'Tutoriel Terminé !',
            icon: 'fa-solid fa-circle-check',
            description: 'Vous êtes prêt à explorer HarmoniQ ! N\'hésitez pas à relancer le tutoriel à tout moment via le bouton flottant en bas à droite de l\'écran.',
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
