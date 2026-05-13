import { describe, it, expect } from 'vitest';
import {
  stripConfidentialVendorFields,
  stripConfidentialFieldsFromVendorList,
  stripConfidentialFieldsDeep,
} from '../confidential-fields';

describe('confidential-fields stripper', () => {
  const vendorWithSecrets = {
    id: 'v-1',
    name: 'Visible Vendor',
    trustedVendor: true,
    confidentialClassifications: ['go-to-for-tricky'],
  } as any;

  const userWithoutScope = { role: 'analyst' };
  const userWithScope = {
    role: 'manager',
    accessScope: { extraScopes: ['confidential:read'] },
  };
  const adminUser = { role: 'admin' };

  describe('stripConfidentialVendorFields', () => {
    it('strips trustedVendor + confidentialClassifications when caller lacks the scope', () => {
      const stripped = stripConfidentialVendorFields(vendorWithSecrets, userWithoutScope);
      expect((stripped as any).trustedVendor).toBeUndefined();
      expect((stripped as any).confidentialClassifications).toBeUndefined();
      // visible fields stay
      expect((stripped as any).name).toBe('Visible Vendor');
    });

    it('keeps confidential fields for callers with `confidential:read` via extraScopes', () => {
      const visible = stripConfidentialVendorFields(vendorWithSecrets, userWithScope);
      expect((visible as any).trustedVendor).toBe(true);
      expect((visible as any).confidentialClassifications).toEqual(['go-to-for-tricky']);
    });

    it('keeps confidential fields for admins (admin holds every scope)', () => {
      const visible = stripConfidentialVendorFields(vendorWithSecrets, adminUser);
      expect((visible as any).trustedVendor).toBe(true);
    });

    it('returns null/undefined inputs unchanged', () => {
      expect(stripConfidentialVendorFields(null as never, userWithoutScope)).toBeNull();
      expect(stripConfidentialVendorFields(undefined as never, userWithoutScope)).toBeUndefined();
    });

    it('strips even when caller is null/undefined (deny-by-default)', () => {
      const stripped = stripConfidentialVendorFields(vendorWithSecrets, null);
      expect((stripped as any).trustedVendor).toBeUndefined();
      expect((stripped as any).confidentialClassifications).toBeUndefined();
    });

    it('does not mutate the input vendor', () => {
      const original = { ...vendorWithSecrets };
      stripConfidentialVendorFields(vendorWithSecrets, userWithoutScope);
      expect(vendorWithSecrets).toEqual(original);
    });
  });

  describe('stripConfidentialFieldsDeep', () => {
    it('strips confidential keys at any depth of an arbitrary tree', () => {
      const tree = {
        outer: 1,
        nested: {
          trustedVendor: true,
          confidentialClassifications: ['classified'],
          deeper: {
            trustedVendor: false,
            normal: 'visible',
          },
        },
        list: [
          { trustedVendor: true, name: 'A' },
          { name: 'B', confidentialClassifications: ['x'] },
        ],
      };
      const out = stripConfidentialFieldsDeep(tree, userWithoutScope) as any;
      expect(out.outer).toBe(1);
      expect(out.nested.trustedVendor).toBeUndefined();
      expect(out.nested.confidentialClassifications).toBeUndefined();
      expect(out.nested.deeper.trustedVendor).toBeUndefined();
      expect(out.nested.deeper.normal).toBe('visible');
      expect(out.list[0].trustedVendor).toBeUndefined();
      expect(out.list[0].name).toBe('A');
      expect(out.list[1].confidentialClassifications).toBeUndefined();
      expect(out.list[1].name).toBe('B');
    });

    it('short-circuits (returns input identity) when caller has the scope', () => {
      const tree = { nested: { trustedVendor: true } };
      const out = stripConfidentialFieldsDeep(tree, userWithScope);
      expect(out).toBe(tree); // identity preserved on the fast path
    });

    it('does not mutate the input on the strip path', () => {
      const tree = { trustedVendor: true, confidentialClassifications: ['x'], name: 'V' };
      const copy = JSON.parse(JSON.stringify(tree));
      stripConfidentialFieldsDeep(tree, userWithoutScope);
      expect(tree).toEqual(copy);
    });

    it('handles null/undefined/primitives unchanged', () => {
      expect(stripConfidentialFieldsDeep(null, userWithoutScope)).toBeNull();
      expect(stripConfidentialFieldsDeep(undefined, userWithoutScope)).toBeUndefined();
      expect(stripConfidentialFieldsDeep(42 as any, userWithoutScope)).toBe(42);
      expect(stripConfidentialFieldsDeep('hello' as any, userWithoutScope)).toBe('hello');
    });
  });

  describe('stripConfidentialFieldsFromVendorList', () => {
    it('strips every entry when caller lacks scope', () => {
      const list = [vendorWithSecrets, { ...vendorWithSecrets, id: 'v-2' }];
      const stripped = stripConfidentialFieldsFromVendorList(list, userWithoutScope);
      for (const v of stripped) {
        expect((v as any).trustedVendor).toBeUndefined();
        expect((v as any).confidentialClassifications).toBeUndefined();
      }
    });

    it('short-circuits (returns original list) when caller has the scope', () => {
      const list = [vendorWithSecrets];
      const result = stripConfidentialFieldsFromVendorList(list, userWithScope);
      // identity preserved on the fast path
      expect(result).toBe(list);
    });

    it('returns the empty array unchanged', () => {
      const out = stripConfidentialFieldsFromVendorList([] as never, userWithoutScope);
      expect(out).toEqual([]);
    });
  });
});
