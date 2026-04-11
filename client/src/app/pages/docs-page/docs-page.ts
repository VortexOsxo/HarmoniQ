import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationBar } from '@app/components/navigation-bar/navigation-bar';
import { docsWind, docsHydro, docsNuclear, docsSolar, docsThermal } from '@app/data/documentation.data';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [NavigationBar, CommonModule],
  templateUrl: './docs-page.html',
  styleUrl: './docs-page.css'
})
export class DocsPage {
  selectedProduction = signal<string>('eolienne');
  activeDetails = signal<Set<string>>(new Set());

  categories = [
    { id: 'eolienne', title: 'Éolienne', data: docsWind, img: "https://images.pexels.com/photos/414837/pexels-photo-414837.jpeg" },
    { id: 'hydro', title: 'Hydro-Électrique', data: docsHydro, img: "https://images.pexels.com/photos/31326222/pexels-photo-31326222/free-photo-of-aerial-view-of-dam-structure-in-alma-wi.jpeg" },
    { id: 'nucleaire', title: 'Nucléaire', data: docsNuclear, img: "https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg" },
    { id: 'solaire', title: 'Solaire', data: docsSolar, img: "https://images.pexels.com/photos/356036/pexels-photo-356036.jpeg" },
    { id: 'thermique', title: 'Thermique', data: docsThermal, img: "https://images.pexels.com/photos/3044472/pexels-photo-3044472.jpeg" }
  ];

  onSelectionChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedProduction.set(value);
    this.activeDetails.set(new Set());
  }

  getHeroStyle() {
    const selection = this.selectedProduction();
    const category = this.categories.find(c => c.id === selection);
    if (!category) {
      return {};
    }
    return {
      'background-image': `linear-gradient(to bottom right, rgba(0, 0, 0, 0.45), rgba(141, 141, 141, 0.459)), url('${category.img}')`
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

  getDisplayName(name: string) {
    if (!name) return '';
    return name[0] === name[0].toUpperCase() ? name : `${name}()`;
  }
}

