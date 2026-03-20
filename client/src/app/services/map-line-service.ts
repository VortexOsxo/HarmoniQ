import { Injectable } from '@angular/core';
import * as L from 'leaflet';

// Value was 80, comment said 735, am confused
const WANTED_VOLTAGE = 80;

@Injectable({
  providedIn: 'root',
})
export class MapLineService {
  private lines: any[] = [];
  private points: any = {};

  private loadPromise: Promise<void>;
  private isDataLoaded = false;

  constructor() {
    this.loadPromise = this.loadLineData();
  }


  private async loadLineData() {
    const csvData = await fetch('/lignes_quebec.csv')
      .then(response => {
        if (!response.ok) throw new Error(`Erreur HTTP: ${response.status}`);
        return response.text();
      });

    const rawLines = csvData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const headers = rawLines[0].split(',');

    this.lines = rawLines.map(line => {
      const values = line.split(',');
      return headers.reduce((acc: any, header, index) => {
        acc[header] = values[index];
        return acc;
      }, {});
    });

    this.lines = this.lines.filter(line => parseInt(line.voltage) === WANTED_VOLTAGE);

    this.lines.forEach(line => {
      const departKey = `${line.latitude_starting},${line.longitude_starting}`;
      const arriveeKey = `${line.latitude_ending},${line.longitude_ending}`;

      // Marquer les points comme départ ou arrivée et ajouter le nom
      this.points[departKey] = this.points[departKey] || {
        lat: line.latitude_starting,
        lon: line.longitude_starting,
        nom: line.network_node_name_starting || 'N/A',
        isDepart: false,
        isArrivee: false
      };
      this.points[departKey].isDepart = true;

      this.points[arriveeKey] = this.points[arriveeKey] || {
        lat: line.latitude_ending,
        lon: line.longitude_ending,
        nom: line.network_node_name_ending || 'N/A',
        isDepart: false,
        isArrivee: false
      };
      this.points[arriveeKey].isArrivee = true;
    });

    this.isDataLoaded = true;
  }
}
