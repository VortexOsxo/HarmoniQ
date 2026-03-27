import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page/home-page';
import { AboutPage } from './pages/about-page/about-page';
import { DocsPage } from './pages/docs-page/docs-page';
import { NotFoundPage } from './pages/not-found-page/not-found-page';
import { MapPage } from './pages/map-page/map-page';
import { SimulationPage } from './pages/simulation-page/simulation-page';
import { simulationGuard } from './guards/simulation.guard';

export const routes: Routes = [
    { path: '', component: HomePage },
    { path: 'à-propos', component: AboutPage },
    { path: 'documentation', component: DocsPage },
    { path: 'map', component: MapPage },
    { path: 'simulation', component: SimulationPage, canActivate: [simulationGuard] },
    { path: '**', component: NotFoundPage },
];
