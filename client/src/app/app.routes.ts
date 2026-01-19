import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page/home-page';
import { AboutPage } from './pages/about-page/about-page';
import { DocsPage } from './pages/docs-page/docs-page';
import { NotFoundPage } from './pages/not-found-page/not-found-page';
import { EnergyFlowPage } from './pages/energy-flow-page/energy-flow-page';
import { SimulationPage } from './pages/simulation-page/simulation-page';

export const routes: Routes = [
    { path: '', component: HomePage },
    { path: 'à-propos', component: AboutPage },
    { path: 'documentation', component: DocsPage },
    { path: 'flux-d-energie', component: EnergyFlowPage },
    { path: 'simulation', component: SimulationPage },
    { path: '**', component: NotFoundPage },
];
