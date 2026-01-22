import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OpenApiService } from './services/open-api-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('client');

  constructor(private openApiService: OpenApiService) {
    // load openapi on start
  }
}
