import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page/home-page';
import { AboutPage } from './pages/about-page/about-page';

export const routes: Routes = [
    { path: 'about', component: AboutPage },
    { path: '**', component: HomePage },
];
