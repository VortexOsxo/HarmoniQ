import { render, screen } from '@testing-library/angular';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { OpenApiService } from './services/open-api-service';

const mockOpenApiService = {
  getOpenApiSchemas: vi.fn().mockReturnValue({}),
};

describe('App', () => {
  afterEach(() => vi.clearAllMocks());

  it('should render the root component', async () => {
    const { container } = await render(App, {
      providers: [
        provideRouter([]),
        { provide: OpenApiService, useValue: mockOpenApiService },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    expect(container).toBeTruthy();
  });
});
