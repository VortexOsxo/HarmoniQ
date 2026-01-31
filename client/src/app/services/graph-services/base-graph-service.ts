import { effect, Signal, signal } from "@angular/core";
import { Observable } from "rxjs";

export enum GraphState {
    Unavailable,
    Loading,
    Displayable,
}

export abstract class BaseGraphService {
    state = signal(GraphState.Unavailable);
    protected cachedData: any;
    protected isDisplayed = false;

    protected abstract fetchData(dependency: any): Observable<any>;

    protected abstract generateGraph(): void;
    protected abstract removeGraph(): void;

    constructor(dependencySignal: Signal<any>) {
        effect(() => this.onDependencyChanged(dependencySignal));
    }

    display() {
        this.isDisplayed = true;
        this.handleGraphState(this.state());
    }

    undisplay() {
        this.isDisplayed = false;
    }

    private onDependencyChanged(dependencySignal: Signal<any>) {
        const dependency = dependencySignal();
        if (!dependency) {
            this.updateGraphState(GraphState.Unavailable);
            return;
        }

        this.updateGraphState(GraphState.Loading);
        this.fetchData(dependency).subscribe(
            () => this.updateGraphState(GraphState.Displayable)
        );
    }

    private updateGraphState(state: GraphState) {
        this.state.set(state);
        if (!this.isDisplayed) return;

        this.handleGraphState(state);
    }

    private handleGraphState(state: GraphState) {
        if (state == GraphState.Loading || state == GraphState.Unavailable)
            this.removeGraph();
        else if (state == GraphState.Displayable)
            this.generateGraph();
    }
}