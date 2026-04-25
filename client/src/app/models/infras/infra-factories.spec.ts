import { SolarFarm, SolarFarmFactory } from './solar-farm';
import { WindFarm, WindFarmFactory } from './wind-farm';
import { NuclearPowerPlant, NuclearPowerPlantFactory } from './nuclear-power-plant';
import { ThermalPowerPlant, ThermalPowerPlantFactory } from './thermal-power-plant';

describe('SolarFarmFactory', () => {
    let factory: SolarFarmFactory;

    beforeEach(() => {
        factory = new SolarFarmFactory();
    });

    it('getType should return solaire', () => {
        expect(factory.getType()).toBe('solaire');
    });

    it('fromJson should map all fields from JSON', () => {
        const json = { id: 1, nom: 'Parc solaire', latitude: 45.5, longitude: -73.6, angle_panneau: 30, orientation_panneau: 180, puissance_nominal: 500, nombre_panneau: 1000, annee_commission: 2020, panneau_type: 'Monocrystallin', materiau_panneau: 'Silicium' };
        const result = factory.fromJson(json);
        expect(result).toBeInstanceOf(SolarFarm);
        expect(result.id).toBe(1);
        expect(result.nom).toBe('Parc solaire');
        expect(result.angle_panneau).toBe(30);
        expect(result.puissance_nominal).toBe(500);
        expect(result.nombre_panneau).toBe(1000);
    });

    it('toJson should serialize all fields', () => {
        const farm = factory.fromJson({ id: 1, nom: 'Test', latitude: 45, longitude: -73, angle_panneau: 30, orientation_panneau: 180, puissance_nominal: 100, nombre_panneau: 200, annee_commission: 2020, panneau_type: 'A', materiau_panneau: 'B' });
        const json = factory.toJson(farm);
        expect(json.nom).toBe('Test');
        expect(json.angle_panneau).toBe(30);
        expect(json.nombre_panneau).toBe(200);
    });

    it('createEmpty should return a SolarFarm with zero values', () => {
        const empty = factory.createEmpty();
        expect(empty).toBeInstanceOf(SolarFarm);
        expect(empty.id).toBe(0);
        expect(empty.nom).toBe('');
        expect(empty.puissance_nominal).toBe(0);
    });
});

describe('WindFarmFactory', () => {
    let factory: WindFarmFactory;

    beforeEach(() => {
        factory = new WindFarmFactory();
    });

    it('getType should return eolienneparc', () => {
        expect(factory.getType()).toBe('eolienneparc');
    });

    it('fromJson should map all fields from JSON', () => {
        const json = { id: 2, nom: 'Parc éolien', latitude: 50, longitude: -70, nombre_eoliennes: 20, capacite_total: 100, hauteur_moyenne: 100, modele_turbine: 'V150', puissance_nominal: 5, is_offshore: true };
        const result = factory.fromJson(json);
        expect(result).toBeInstanceOf(WindFarm);
        expect(result.id).toBe(2);
        expect(result.nombre_eoliennes).toBe(20);
        expect(result.is_offshore).toBe(true);
        expect(result.modele_turbine).toBe('V150');
    });

    it('toJson should serialize all fields', () => {
        const farm = factory.fromJson({ id: 2, nom: 'Test', latitude: 50, longitude: -70, nombre_eoliennes: 10, capacite_total: 50, hauteur_moyenne: 80, modele_turbine: 'V90', puissance_nominal: 3, is_offshore: false });
        const json = factory.toJson(farm);
        expect(json.nombre_eoliennes).toBe(10);
        expect(json.is_offshore).toBe(false);
        expect(json.modele_turbine).toBe('V90');
    });

    it('createEmpty should return a WindFarm with default values', () => {
        const empty = factory.createEmpty();
        expect(empty).toBeInstanceOf(WindFarm);
        expect(empty.id).toBe(0);
        expect(empty.is_offshore).toBe(false);
        expect(empty.nombre_eoliennes).toBe(0);
    });
});

describe('NuclearPowerPlantFactory', () => {
    let factory: NuclearPowerPlantFactory;

    beforeEach(() => {
        factory = new NuclearPowerPlantFactory();
    });

    it('getType should return nucleaire', () => {
        expect(factory.getType()).toBe('nucleaire');
    });

    it('fromJson should map all fields from JSON', () => {
        const json = { id: 3, nom: 'Centrale nucléaire', latitude: 45, longitude: -74, puissance_nominal: 1200, semaine_maintenance: 4, annee_commission: 1983, type_generateur: 'CANDU' };
        const result = factory.fromJson(json);
        expect(result).toBeInstanceOf(NuclearPowerPlant);
        expect(result.id).toBe(3);
        expect(result.puissance_nominal).toBe(1200);
        expect(result.semaine_maintenance).toBe(4);
        expect(result.type_generateur).toBe('CANDU');
    });

    it('toJson should serialize all fields', () => {
        const plant = factory.fromJson({ id: 3, nom: 'Test', latitude: 45, longitude: -74, puissance_nominal: 900, semaine_maintenance: 2, annee_commission: null, type_generateur: null });
        const json = factory.toJson(plant);
        expect(json.puissance_nominal).toBe(900);
        expect(json.semaine_maintenance).toBe(2);
        expect(json.annee_commission).toBeNull();
    });

    it('createEmpty should return defaults including 1200 MW and 20 weeks maintenance', () => {
        const empty = factory.createEmpty();
        expect(empty).toBeInstanceOf(NuclearPowerPlant);
        expect(empty.puissance_nominal).toBe(1200);
        expect(empty.semaine_maintenance).toBe(20);
        expect(empty.annee_commission).toBeNull();
    });
});

describe('ThermalPowerPlantFactory', () => {
    let factory: ThermalPowerPlantFactory;

    beforeEach(() => {
        factory = new ThermalPowerPlantFactory();
    });

    it('getType should return thermique', () => {
        expect(factory.getType()).toBe('thermique');
    });

    it('fromJson should map all fields from JSON', () => {
        const json = { id: 4, nom: 'Centrale thermique', latitude: 46, longitude: -72, type_intrant: 'Gaz naturel', puissance_nominal: 800, semaine_maintenance: 3, annee_commission: 2000, type_generateur: 'Vapeur' };
        const result = factory.fromJson(json);
        expect(result).toBeInstanceOf(ThermalPowerPlant);
        expect(result.id).toBe(4);
        expect(result.type_intrant).toBe('Gaz naturel');
        expect(result.puissance_nominal).toBe(800);
    });

    it('toJson should serialize all fields', () => {
        const plant = factory.fromJson({ id: 4, nom: 'Test', latitude: 46, longitude: -72, type_intrant: 'Mazout', puissance_nominal: 400, semaine_maintenance: 2, annee_commission: null, type_generateur: null });
        const json = factory.toJson(plant);
        expect(json.type_intrant).toBe('Mazout');
        expect(json.puissance_nominal).toBe(400);
        expect(json.annee_commission).toBeNull();
    });

    it('createEmpty should return a ThermalPowerPlant with zero values', () => {
        const empty = factory.createEmpty();
        expect(empty).toBeInstanceOf(ThermalPowerPlant);
        expect(empty.id).toBe(0);
        expect(empty.type_intrant).toBe('');
        expect(empty.puissance_nominal).toBe(0);
    });
});
