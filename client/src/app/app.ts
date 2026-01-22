import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OpenApiService } from './services/open-api-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  protected readonly title = signal('client');

  constructor(private openApiService: OpenApiService) {
    // load openapi on start
  }
}
