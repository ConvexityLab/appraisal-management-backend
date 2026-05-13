import { describe, it, expect } from 'vitest';
import {
  stripConfidentialVendorFields,
  stripConfidentialFieldsFromVendorList,
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
