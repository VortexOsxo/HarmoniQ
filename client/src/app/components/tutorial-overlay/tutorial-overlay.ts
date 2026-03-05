import {
    Component,
    OnInit,
    OnDestroy,
    HostListener,
    ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { TutorialService, TutorialStep, TutorialState } from '@app/services/tutorial-service';

@Component({
    selector: 'app-tutorial-overlay',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './tutorial-overlay.html',
    styleUrl: './tutorial-overlay.css',
})
export class TutorialOverlay implements OnInit, OnDestroy {
    state: TutorialState = { active: false, currentStep: 0, showWelcome: false };
    highlightRect: DOMRect | null = null;
    bubbleTop = 0;
    bubbleLeft = 0;

    private sub!: Subscription;
    private readonly BUBBLE_WIDTH = 380;
    private readonly GAP = 16;

    constructor(
        public tutorialService: TutorialService,
        private cd: ChangeDetectorRef,
    ) { }

    get currentStep(): TutorialStep {
        return this.tutorialService.steps[this.state.currentStep];
    }

    get totalSteps(): number {
        return this.tutorialService.totalSteps;
    }

    get progressPercent(): number {
        return ((this.state.currentStep + 1) / this.totalSteps) * 100;
    }

    get isLastStep(): boolean {
        return this.state.currentStep === this.totalSteps - 1;
    }

    ngOnInit(): void {
        this.sub = this.tutorialService.tutorialState$.subscribe((s) => {
            this.state = s;
            if (s.active && !s.showWelcome) {
                // Allow DOM to render before positioning
                setTimeout(() => this.positionBubble(), 60);
            }
            this.cd.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
    }

    @HostListener('window:resize')
    onResize(): void {
        if (this.state.active && !this.state.showWelcome) {
            this.positionBubble();
        }
    }

    onStart(): void {
        this.tutorialService.startTutorial();
    }

    onNext(): void {
        this.tutorialService.nextStep();
    }

    onPrevious(): void {
        this.tutorialService.previousStep();
    }

    onSkip(): void {
        this.tutorialService.skipTutorial();
    }

    private positionBubble(): void {
        const step = this.currentStep;

        if (!step.targetSelector) {
            this.highlightRect = null;
            // centered via CSS class
            return;
        }

        const el = document.querySelector(step.targetSelector);
        if (!el) {
            this.highlightRect = null;
            return;
        }

        // Scroll into view
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        const rect = el.getBoundingClientRect();
        this.highlightRect = rect;

        // Position the bubble relative to the target
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const bubbleHeight = 260; // approximate

        switch (step.position) {
            case 'bottom':
                this.bubbleTop = rect.bottom + this.GAP;
                this.bubbleLeft = Math.max(
                    this.GAP,
                    Math.min(rect.left, vw - this.BUBBLE_WIDTH - this.GAP),
                );
                // If bubble would overflow bottom, put it above
                if (this.bubbleTop + bubbleHeight > vh) {
                    this.bubbleTop = rect.top - bubbleHeight - this.GAP;
                }
                break;

            case 'top':
                this.bubbleTop = rect.top - bubbleHeight - this.GAP;
                this.bubbleLeft = Math.max(
                    this.GAP,
                    Math.min(rect.left, vw - this.BUBBLE_WIDTH - this.GAP),
                );
                // If bubble would overflow top, put it below
                if (this.bubbleTop < this.GAP) {
                    this.bubbleTop = rect.bottom + this.GAP;
                }
                break;

            case 'left':
                this.bubbleTop = Math.max(
                    this.GAP,
                    Math.min(rect.top, vh - bubbleHeight - this.GAP),
                );
                this.bubbleLeft = rect.left - this.BUBBLE_WIDTH - this.GAP;
                if (this.bubbleLeft < this.GAP) {
                    this.bubbleLeft = rect.right + this.GAP;
                }
                break;

            case 'right':
                this.bubbleTop = Math.max(
                    this.GAP,
                    Math.min(rect.top, vh - bubbleHeight - this.GAP),
                );
                this.bubbleLeft = rect.right + this.GAP;
                if (this.bubbleLeft + this.BUBBLE_WIDTH > vw) {
                    this.bubbleLeft = rect.left - this.BUBBLE_WIDTH - this.GAP;
                }
                break;

            default: // center
                this.highlightRect = null;
                break;
        }

        this.cd.detectChanges();
    }
}
