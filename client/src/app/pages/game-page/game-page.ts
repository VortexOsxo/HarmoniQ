import { Component } from '@angular/core';
import { NavigationBar } from "@app/components/navigation-bar/navigation-bar";
import { GameArea } from "@app/components/game-area/game-area";
import { MatDialog } from '@angular/material/dialog'; 

@Component({
  selector: 'app-game-page',
  imports: [NavigationBar, GameArea],
  templateUrl: './game-page.html',
  styleUrl: './game-page.css',
})
export class GamePage {
  constructor(private dialog: MatDialog){}


  ngOnInit(){
    this.openDialog();
  }


  openDialog(){
    const dialogRef = this.dialog.open(GameArea, {
      width: '60vw',
      height: '60vh',
      maxWidth: 'none',
      panelClass: 'dialogPanel'
    })
  }
}
