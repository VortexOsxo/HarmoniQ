import { Component, Output, EventEmitter } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { GameService } from '@app/services/game-service';

@Component({
  selector: 'app-start-area',
  imports: [],
  templateUrl: './start-area.html',
  styleUrl: './start-area.css',
})
export class StartArea {

  @Output() started = new EventEmitter<void>();

  images: string[] = [ //for the images
    '/icons/hydraulic_barrage.jpg',
    '/icons/solar_powerPlant.jpg',
    '/icons/thermal_powerPlant.jpg',
    '/icons/windTurbine.jpg'
  ];

  currentImage: string = this.images[0];
  index = 0;
  private interval!: ReturnType<typeof setInterval>;
  fade: boolean = false;

  constructor(private cdr: ChangeDetectorRef,
    private gameService: GameService) {
  }

  start(): void {
    this.gameService.setQuizStarted();
    this.started.emit();
  }

  ngAfterViewInit() {
    this.interval = setInterval(() => {
      this.fadeOutNextImage();
    }, 5000);
  }

  fadeOutNextImage() {
    this.fade = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.index = (this.index + 1) % this.images.length;
      this.currentImage = this.images[this.index];
      this.fade = false;
      this.cdr.detectChanges();
    }, 800);
  }

  ngOnDestroy() {
    clearInterval(this.interval);
  }
}
