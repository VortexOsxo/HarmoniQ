import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'environments/environment';

@Injectable({
  providedIn: 'root',
})
export class OpenApiService {

  private openApiSchemas: any;

  constructor(private http: HttpClient) {
    this.loadOpenApi();
  }

  getOpenApiSchemas() {
    return this.openApiSchemas;
  }

  private loadOpenApi() {
    this.http.get(`${environment.defaultUrl}/openapi.json`)
      .subscribe((data: any) => {
        this.openApiSchemas = data.components.schemas;
        console.log(this.openApiSchemas);
      });
  }
}
