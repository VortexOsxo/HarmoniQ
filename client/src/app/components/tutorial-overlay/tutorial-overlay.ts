import {
    Component,
    OnInit,
    OnDestroy,
    HostListener,
    ChangeDetectorRef,
    ViewChild,
    ElementRef,
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

    @ViewChild('nextButton') nextButton?: ElementRef<HTMLButtonElement>;

    private sub!: Subscription;
    private readonly BUBBLE_WIDTH = 380;
    private readonly GAP = 16;
    private activeTarget: HTMLElement | null = null;
    /** Document-level click listener for requireAction steps (capture phase) */
    private documentClickHandler: ((e: Event) => void) | null = null;
    private boostedAncestors: { el: HTMLElement; originalZIndex: string }[] = [];
    private disabledElements: HTMLElement[] = [];

    /** ID of the pending positioning timeout so we can cancel it on rapid step changes */
    private positionTimeoutId: ReturnType<typeof setTimeout> | null = null;
    /** Monotonic counter to detect stale positioning callbacks */
    private positionGeneration = 0;

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
        // Document-level click handler for requireAction steps — capture phase
        // fires before any other handler, so it reliably detects clicks on the target
        this.documentClickHandler = (e: Event) => {
            if (!this.activeTarget || !this.currentStep?.requireAction) return;
            const target = e.target as Node;
            if (this.activeTarget.contains(target)) {
                this.tutorialService.nextStep(true);
            }
        };
        document.addEventListener('click', this.documentClickHandler, true);

        this.sub = this.tutorialService.tutorialState$.subscribe((s) => {
            if (!s.active || s.showWelcome) {
                this.cleanupActiveTarget();
            }

            // Cancel any pending positioning from previous step
            this.cancelPendingPosition();

            this.state = s;
            if (s.active && !s.showWelcome) {
                this.schedulePositioning(s.currentStep);
            }
            this.cd.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this.cancelPendingPosition();
        this.cleanupActiveTarget();
        if (this.documentClickHandler) {
            document.removeEventListener('click', this.documentClickHandler, true);
            this.documentClickHandler = null;
        }
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

    onSkip(): void {
        this.cleanupActiveTarget();
        this.tutorialService.skipTutorial();
    }

    focusNext(event?: Event): void {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!this.currentStep.requireAction && this.nextButton?.nativeElement) {
            this.nextButton.nativeElement.focus();
        }
    }

    /** Cancel any pending setTimeout for positioning */
    private cancelPendingPosition(): void {
        if (this.positionTimeoutId !== null) {
            clearTimeout(this.positionTimeoutId);
            this.positionTimeoutId = null;
        }
        this.positionGeneration++;
    }

    /**
     * Schedule positioning with a retry loop.
     * If the target element is not yet in the DOM (e.g. awaiting Angular rendering
     * or CSS animation), we retry up to MAX_RETRIES times before giving up.
     */
    private schedulePositioning(stepIndex: number): void {
        const generation = ++this.positionGeneration;
        const MAX_RETRIES = 5;
        const RETRY_INTERVAL = 150; // ms

        const attempt = (retryCount: number) => {
            // Guard: if the generation changed, a newer step has taken over — abort
            if (generation !== this.positionGeneration) return;

            const step = this.tutorialService.steps[stepIndex];

            // No target selector → centered bubble, no DOM lookup needed
            if (!step.targetSelector) {
                this.positionBubble();
                this.focusNextButton();
                return;
            }

            const el = document.querySelector(step.targetSelector);
            if (el) {
                // Element found — position after the next paint via rAF
                requestAnimationFrame(() => {
                    if (generation !== this.positionGeneration) return;
                    this.positionBubble();
                    this.focusNextButton();
                });
            } else if (retryCount < MAX_RETRIES) {
                // Element not yet in DOM — retry
                this.positionTimeoutId = setTimeout(() => attempt(retryCount + 1), RETRY_INTERVAL);
            } else {
                // Give up — show centered bubble
                this.positionBubble();
                this.focusNextButton();
            }
        };

        // First attempt after a short rAF to let Angular change-detection flush
        requestAnimationFrame(() => {
            if (generation !== this.positionGeneration) return;
            attempt(0);
        });
    }

    private focusNextButton(): void {
        if (!this.currentStep.requireAction && this.nextButton?.nativeElement) {
            this.nextButton.nativeElement.focus();
        }
    }

    private cleanupActiveTarget(): void {
        if (this.activeTarget) {
            this.activeTarget.classList.remove('tutorial-interactive-target');
            this.activeTarget = null;
        }
        // Restore any ancestors whose z-index we boosted
        for (const { el, originalZIndex } of this.boostedAncestors) {
            if (originalZIndex) {
                el.style.setProperty('z-index', originalZIndex);
            } else {
                el.style.removeProperty('z-index');
            }
        }
        this.boostedAncestors = [];
        // Re-enable any elements we disabled
        for (const el of this.disabledElements) {
            (el as HTMLButtonElement | HTMLInputElement).disabled = false;
            el.style.removeProperty('opacity');
            el.style.removeProperty('pointer-events');
        }
        this.disabledElements = [];
    }

    private positionBubble(): void {
        const step = this.currentStep;

        this.cleanupActiveTarget();

        if (!step.targetSelector) {
            this.highlightRect = null;
            // centered via CSS class
            this.cd.detectChanges();
            return;
        }

        const el = document.querySelector(step.targetSelector);
        if (!el) {
            this.highlightRect = null;
            this.cd.detectChanges();
            return;
        }

        const htmlEl = el as HTMLElement;
        this.activeTarget = htmlEl;

        if (step.requireAction) {
            htmlEl.classList.add('tutorial-interactive-target');
            // The document-level capture listener (set up in ngOnInit)
            // handles the click detection for requireAction steps.
        }

        // Walk up ancestors and boost z-index of any that create a stacking context
        // so the target element (and its container) appear above the tutorial backdrop (z-index 10000)
        let ancestor = htmlEl.parentElement;
        while (ancestor && ancestor !== document.body) {
            const style = window.getComputedStyle(ancestor);
            const pos = style.position;
            const zi = style.zIndex;
            if (pos !== 'static' && zi !== 'auto') {
                this.boostedAncestors.push({ el: ancestor, originalZIndex: ancestor.style.getPropertyValue('z-index') });
                ancestor.style.setProperty('z-index', '10004', 'important');
            }
            ancestor = ancestor.parentElement;
        }

        // Disable the sources-backdrop so users don't accidentally close the panel during the tutorial
        const sourcesBackdrop = document.querySelector('.sources-backdrop') as HTMLElement;
        if (sourcesBackdrop) {
            sourcesBackdrop.style.pointerEvents = 'none';
            this.disabledElements.push(sourcesBackdrop);
        }

        // Disable any elements specified by the step
        if (step.disableSelectors) {
            for (const sel of step.disableSelectors) {
                const disableEl = document.querySelector(sel) as HTMLElement;
                if (disableEl) {
                    (disableEl as HTMLButtonElement | HTMLInputElement).disabled = true;
                    disableEl.style.opacity = '0.4';
                    disableEl.style.pointerEvents = 'none';
                    this.disabledElements.push(disableEl);
                }
            }
        }

        // Scroll into view — use 'instant' to avoid reading a stale rect mid-scroll
        htmlEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });

        const rect = htmlEl.getBoundingClientRect();
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

        // Apply optional horizontal offset
        if (step.bubbleOffsetX) {
            this.bubbleLeft = Math.max(
                this.GAP,
                Math.min(this.bubbleLeft + step.bubbleOffsetX, vw - this.BUBBLE_WIDTH - this.GAP),
            );
        }

        this.cd.detectChanges();
    }
}
