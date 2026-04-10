import { render } from '@testing-library/angular';
import { InfraIconComponent } from './infra-icon';

describe('InfraIconComponent', () => {
  it('should return barrage icon for hydro', async () => {
    const { fixture } = await render(InfraIconComponent, { componentInputs: { type: 'hydro' } });
    expect(fixture.componentInstance.iconUrl).toBe('url(/icons/barrage.png)');
  });

  it('should return eolienne icon for eolienneparc', async () => {
    const { fixture } = await render(InfraIconComponent, { componentInputs: { type: 'eolienneparc' } });
    expect(fixture.componentInstance.iconUrl).toBe('url(/icons/eolienne.png)');
  });

  it('should return solaire icon for solaire', async () => {
    const { fixture } = await render(InfraIconComponent, { componentInputs: { type: 'solaire' } });
    expect(fixture.componentInstance.iconUrl).toBe('url(/icons/solaire.png)');
  });

  it('should return thermique icon for thermique', async () => {
    const { fixture } = await render(InfraIconComponent, { componentInputs: { type: 'thermique' } });
    expect(fixture.componentInstance.iconUrl).toBe('url(/icons/thermique.png)');
  });

  it('should return nucleaire icon for nucleaire', async () => {
    const { fixture } = await render(InfraIconComponent, { componentInputs: { type: 'nucleaire' } });
    expect(fixture.componentInstance.iconUrl).toBe('url(/icons/nucelaire.png)');
  });

  it('should return empty string for unknown type', async () => {
    const { fixture } = await render(InfraIconComponent, { componentInputs: { type: 'unknown' } });
    expect(fixture.componentInstance.iconUrl).toBe('');
  });
});
