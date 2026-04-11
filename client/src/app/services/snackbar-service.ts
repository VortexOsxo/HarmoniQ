import { Injectable } from '@angular/core';

export type SnackbarType = 'success' | 'error' | 'info';

@Injectable({
  providedIn: 'root',
})
export class SnackbarService {
  private currentSnackbar: HTMLElement | null = null;

  show(title: string, message: string, type: SnackbarType = 'success', duration = 5000): void {
    this.close();

    const snackbar = document.createElement('div');
    snackbar.className = `hq-snackbar hq-snackbar--${type}`;
    
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info';

    snackbar.innerHTML = `
      <div class="hq-snackbar-header">
        <h6><i class="fa-solid ${icon}"></i> ${title}</h6>
        <button class="hq-snackbar-close"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="hq-snackbar-body">
        <p>${message}</p>
      </div>
    `;

    document.body.appendChild(snackbar);
    this.currentSnackbar = snackbar;

    // Trigger entrance
    requestAnimationFrame(() => {
      snackbar.classList.add('hq-snackbar--visible');
    });

    // Close on click
    const closeBtn = snackbar.querySelector('.hq-snackbar-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Auto-close
    if (duration > 0) {
      setTimeout(() => {
        if (this.currentSnackbar === snackbar) {
          this.close();
        }
      }, duration);
    }
  }

  close(): void {
    if (!this.currentSnackbar) return;

    const snackbar = this.currentSnackbar;
    this.currentSnackbar = null;

    snackbar.classList.remove('hq-snackbar--visible');
    snackbar.classList.add('hq-snackbar--exit');

    snackbar.addEventListener('transitionend', () => {
      snackbar.remove();
    });

    // Fallback removal
    setTimeout(() => {
      if (snackbar.parentNode) {
        snackbar.remove();
      }
    }, 500);
  }
}
