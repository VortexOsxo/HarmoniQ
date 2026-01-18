import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [NavigationBar, CommonModule],
  templateUrl: './docs-page.html',
  styleUrl: './docs-page.css'
})
export class DocsPage {
  selectedProduction = signal<string>('');
  activeDetails = signal<Set<string>>(new Set());

  images: { [key: string]: string } = {
    "eolienne": "https://images.pexels.com/photos/414837/pexels-photo-414837.jpeg",
    "hydro": "https://images.pexels.com/photos/31326222/pexels-photo-31326222/free-photo-of-aerial-view-of-dam-structure-in-alma-wi.jpeg",
    "nucleaire": "https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg",
    "solaire": "https://images.pexels.com/photos/356036/pexels-photo-356036.jpeg",
    "thermique": "https://images.pexels.com/photos/3044472/pexels-photo-3044472.jpeg"
  };

  onSelectionChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProduction.set(value);
    this.activeDetails.set(new Set());
  }

  getHeroStyle() {
    const selection = this.selectedProduction();
    if (!selection || !this.images[selection]) {
      return {};
    }
    return {
      'background-image': `linear-gradient(to bottom right, rgba(0, 0, 0, 0.45), rgba(141, 141, 141, 0.459)), url('${this.images[selection]}')`
    };
  }

  toggleDetail(id: string) {
    const current = new Set(this.activeDetails());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.activeDetails.set(current);
  }

  isDetailActive(id: string) {
    return this.activeDetails().has(id);
  }
}
