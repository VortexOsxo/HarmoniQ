import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page/home-page';
import { AboutPage } from './pages/about-page/about-page';
import { NotFoundPage } from './pages/not-found-page/not-found-page';

export const routes: Routes = [
    { path: 'about', component: AboutPage },
    { path: 'home', component: HomePage },
    { path: '', component: HomePage },
    { path: 'not-found', component: NotFoundPage },
    { path: '**', component: NotFoundPage },
];
