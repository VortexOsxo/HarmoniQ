import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiService {
    private closeSourcesPanelSubject = new Subject<void>();
    closeSourcesPanel$ = this.closeSourcesPanelSubject.asObservable();

    requestCloseSourcesPanel() {
        this.closeSourcesPanelSubject.next();
    }
}
