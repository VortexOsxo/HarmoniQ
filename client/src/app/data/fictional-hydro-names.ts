/**
 * Préfixes des noms de barrages hydrauliques fictifs.
 * Tous les barrages dont le nom commence par l'un de ces préfixes
 * seront traités comme fictifs et exclus de la carte par défaut.
 */
const FICTIONAL_PREFIXES = [
  'Caniapisca-',
  'AlaBaleine-',
  'GdeBaleine-',
  'PteBaleine-',
  'PtMecatina-',
  'Magpie-',
];

/**
 * Vérifie si un nom de barrage correspond à un barrage fictif.
 */
export function isFictionalHydro(name: string): boolean {
  if (!name) return false;
  return FICTIONAL_PREFIXES.some(prefix => name.startsWith(prefix));
}
