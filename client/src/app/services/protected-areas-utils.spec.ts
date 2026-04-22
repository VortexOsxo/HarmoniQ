import { getAttr, buildIdentifyHtml, LAYER_TREE, ALL_LAYER_IDS, LAYER_NODE_MAP, BIOME_MAP, EMPTY_VALUES } from './protected-areas-utils';

describe('getAttr', () => {
    it('should return the first non-empty value from the given keys', () => {
        const attrs = { a: 'hello', b: 'world' };
        expect(getAttr(attrs, 'a', 'b')).toBe('hello');
    });

    it('should skip null values and return the next key', () => {
        const attrs = { a: null, b: 'found' };
        expect(getAttr(attrs, 'a', 'b')).toBe('found');
    });

    it('should skip empty string values', () => {
        const attrs = { a: '', b: 'found' };
        expect(getAttr(attrs, 'a', 'b')).toBe('found');
    });

    it('should skip the string "Null"', () => {
        const attrs = { a: 'Null', b: 'found' };
        expect(getAttr(attrs, 'a', 'b')).toBe('found');
    });

    it('should skip the string "NaN"', () => {
        const attrs = { a: 'NaN', b: 'found' };
        expect(getAttr(attrs, 'a', 'b')).toBe('found');
    });

    it('should return empty string when no key has a valid value', () => {
        const attrs = { a: null, b: '' };
        expect(getAttr(attrs, 'a', 'b')).toBe('');
    });

    it('should return the value as a string', () => {
        const attrs = { a: 42 };
        expect(getAttr(attrs, 'a')).toBe('42');
    });
});

describe('buildIdentifyHtml', () => {
    it('should return an HTML div string', () => {
        const html = buildIdentifyHtml({});
        expect(html).toContain('<div');
        expect(html).toContain('</div>');
    });

    it('should include the Toponyme as the title when provided', () => {
        const html = buildIdentifyHtml({ Toponyme: 'Réserve de biodiversité' });
        expect(html).toContain('Réserve de biodiversité');
    });

    it('should use fallback title "Aire protégée" when no toponyme', () => {
        const html = buildIdentifyHtml({});
        expect(html).toContain('Aire protégée');
    });

    it('should include Superficie when provided', () => {
        const html = buildIdentifyHtml({ Superficie_ha: '500' });
        expect(html).toContain('Superficie (ha)');
        expect(html).toContain('500');
    });

    it('should include a link when LIEN is provided', () => {
        const html = buildIdentifyHtml({ LIEN: 'https://example.com' });
        expect(html).toContain('href="https://example.com"');
    });

    it('should include note in small/italic tag when provided', () => {
        const html = buildIdentifyHtml({ Note: 'Une note importante' });
        expect(html).toContain('<small>');
        expect(html).toContain('Une note importante');
    });

    it('should use BIOME_MAP for the Biome field', () => {
        const html = buildIdentifyHtml({ Biome: 'T' });
        expect(html).toContain('Milieu terrestre');
    });

    it('should show "Communauté autochtone" title when GEOCODE is present', () => {
        const html = buildIdentifyHtml({ GEOCODE: 'ABC123', Toponyme: 'Lac-Simon' });
        expect(html).toContain('Communauté autochtone de Lac-Simon');
    });
});

describe('LAYER_TREE', () => {
    it('should be a non-empty array', () => {
        expect(Array.isArray(LAYER_TREE)).toBe(true);
        expect(LAYER_TREE.length).toBeGreaterThan(0);
    });

    it('each node should have an id and name', () => {
        LAYER_TREE.forEach(node => {
            expect(typeof node.id).toBe('number');
            expect(typeof node.name).toBe('string');
        });
    });
});

describe('ALL_LAYER_IDS', () => {
    it('should contain the root level node IDs', () => {
        expect(ALL_LAYER_IDS).toContain(100);
        expect(ALL_LAYER_IDS).toContain(101);
    });

    it('should be a non-empty array', () => {
        expect(ALL_LAYER_IDS.length).toBeGreaterThan(0);
    });
});

describe('LAYER_NODE_MAP', () => {
    it('should contain nodes from LAYER_TREE', () => {
        expect(LAYER_NODE_MAP.has(100)).toBe(true);
        expect(LAYER_NODE_MAP.has(101)).toBe(true);
    });

    it('should map each id to the correct node name', () => {
        const node = LAYER_NODE_MAP.get(100);
        expect(node?.name).toContain('Aires protégées');
    });
});

describe('BIOME_MAP', () => {
    it('should map T to Milieu terrestre', () => {
        expect(BIOME_MAP['T']).toBe('Milieu terrestre');
    });

    it('should map M to Milieu marin', () => {
        expect(BIOME_MAP['M']).toBe('Milieu marin');
    });

    it('should map X to Milieu mixte', () => {
        expect(BIOME_MAP['X']).toContain('mixte');
    });
});

describe('EMPTY_VALUES', () => {
    it('should recognize empty string as empty', () => {
        expect(EMPTY_VALUES.has('')).toBe(true);
    });

    it('should recognize Null as empty', () => {
        expect(EMPTY_VALUES.has('Null')).toBe(true);
    });

    it('should not mark regular strings as empty', () => {
        expect(EMPTY_VALUES.has('hello')).toBe(false);
    });
});
