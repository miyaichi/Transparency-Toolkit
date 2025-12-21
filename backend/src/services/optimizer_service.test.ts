import { query } from '../db/client';
import { OptimizerService, OptimizerSteps } from './optimizer_service';

// Mock DB client
jest.mock('../db/client', () => ({
  query: jest.fn(),
}));

describe('OptimizerService', () => {
  let service: OptimizerService;
  let defaultSteps: OptimizerSteps;

  beforeEach(() => {
    service = new OptimizerService();
    defaultSteps = {
      removeErrors: false,
      invalidAction: 'remove',
      duplicateAction: 'remove',
      normalizeFormat: false,
      fixOwnerDomain: false,
      fixRelationship: false,
      fixManagerDomain: false,
      managerAction: 'remove',
      verifySellers: false,
      sellersAction: 'remove',
      verifyCertAuthority: false,
    };
    jest.clearAllMocks();
  });

  describe('Step 1: Clean Up', () => {
    it('should remove invalid lines', async () => {
      const input = `google.com, pub-123, DIRECT\ninvalid-line\ngoogle.com, pub-456, RESELLER`;
      const steps = { ...defaultSteps, removeErrors: true };

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toContain('google.com, pub-123, DIRECT');
      expect(result.optimizedContent).toContain('google.com, pub-456, RESELLER');
      expect(result.optimizedContent).not.toContain('invalid-line');
      expect(result.stats.removedCount).toBe(1);
    });

    it('should comment out invalid lines if configured', async () => {
      const input = `invalid-line`;
      const steps: OptimizerSteps = { ...defaultSteps, removeErrors: true, invalidAction: 'comment' };

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toContain('# INVALID: invalid-line');
      expect(result.stats.commentedCount).toBe(1);
    });

    it('should remove duplicates', async () => {
      const input = `google.com, pub-1, DIRECT\ngoogle.com, pub-1, DIRECT\ngoogle.com, pub-2, RESELLER`;
      const steps = { ...defaultSteps, removeErrors: true };

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent.match(/pub-1/g)).toHaveLength(1);
      expect(result.stats.removedCount).toBe(1);
    });

    it('should normalize format if requested', async () => {
      const input = `Google.com, pub-1, direct`;
      const steps = { ...defaultSteps, removeErrors: true, normalizeFormat: true };

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toContain('google.com, pub-1, DIRECT');
    });
  });

  describe('Step 2: Owner Domain', () => {
    it('should add OWNERDOMAIN if missing', async () => {
      const input = `google.com, pub-1, DIRECT`;
      const steps = { ...defaultSteps, fixOwnerDomain: true };

      const result = await service.process(input, 'example.com', 'owner.com', steps);

      expect(result.optimizedContent).toContain('OWNERDOMAIN = owner.com');
      expect(result.stats.modifiedCount).toBe(1);
    });

    it('should not add OWNERDOMAIN if present', async () => {
      const input = `OWNERDOMAIN=existing.com\ngoogle.com, pub-1, DIRECT`;
      const steps = { ...defaultSteps, fixOwnerDomain: true };

      const result = await service.process(input, 'example.com', 'owner.com', steps);

      expect(result.optimizedContent).toContain('OWNERDOMAIN=existing.com');
      expect(result.stats.modifiedCount).toBe(0);
    });
  });

  it('should comment out duplicates if configured', async () => {
    const input = `google.com, pub-1, DIRECT\ngoogle.com, pub-1, DIRECT`;
    const steps: OptimizerSteps = { ...defaultSteps, removeErrors: true, duplicateAction: 'comment' };

    const result = await service.process(input, 'example.com', undefined, steps);

    expect(result.optimizedContent).toContain('# DUPLICATE: google.com, pub-1, DIRECT');
    expect(result.stats.commentedCount).toBe(1);
  });

  describe('Step 3: Manager Domain', () => {
    it('should remove manager domain lines', async () => {
      const input = `MANAGERDOMAIN=example.com\ngoogle.com, pub-1, DIRECT`;
      const steps = { ...defaultSteps, fixManagerDomain: true, managerAction: 'remove' as const };

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).not.toContain('MANAGERDOMAIN=example.com');
      expect(result.optimizedContent).toContain('google.com, pub-1, DIRECT');
      expect(result.stats.removedCount).toBe(1);
    });

    it('should comment out manager domain lines', async () => {
      const input = `MANAGERDOMAIN=example.com\ngoogle.com, pub-1, DIRECT`;
      const steps = { ...defaultSteps, fixManagerDomain: true, managerAction: 'comment' as const };

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toContain('# DISABLED_MANAGERDOMAIN: MANAGERDOMAIN=example.com');
      expect(result.stats.commentedCount).toBe(1);
    });
  });

  describe('Step 6: Certification Authority ID', () => {
    it('should fix incorrect cert ID', async () => {
      const input = `google.com, pub-1, DIRECT, WRONG_ID`;
      const steps = { ...defaultSteps, verifyCertAuthority: true };

      (query as jest.Mock).mockResolvedValue({
        rows: [{ domain: 'google.com', certification_authority_id: 'f08c47fec0942fa0' }],
      });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('google.com, pub-1, DIRECT, f08c47fec0942fa0');
      expect(result.stats.certAuthorityFixed).toBe(1);
    });

    it('should add missing cert ID', async () => {
      const input = `google.com, pub-1, DIRECT`;
      const steps = { ...defaultSteps, verifyCertAuthority: true };

      (query as jest.Mock).mockResolvedValue({
        rows: [{ domain: 'google.com', certification_authority_id: 'f08c47fec0942fa0' }],
      });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('google.com, pub-1, DIRECT, f08c47fec0942fa0');
      expect(result.stats.certAuthorityFixed).toBe(1);
    });

    it('should preserve comments when fixing cert ID', async () => {
      const input = `google.com, pub-1, DIRECT, WRONG_ID # comment`;
      const steps = { ...defaultSteps, verifyCertAuthority: true };

      (query as jest.Mock).mockResolvedValue({
        rows: [{ domain: 'google.com', certification_authority_id: 'f08c47fec0942fa0' }],
      });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('google.com, pub-1, DIRECT, f08c47fec0942fa0 # comment');
      expect(result.stats.certAuthorityFixed).toBe(1);
    });
  });

  describe('Step 4 & 5: Sellers Verification & Relationship', () => {
    beforeEach(() => {
      // Setup common DB mock for this block if needed, but per-test mocking is safer for variation
    });

    it('should fix relationship based on sellers.json (PUBLISHER -> DIRECT)', async () => {
      const input = `google.com, pub-1, RESELLER`;
      const steps = { ...defaultSteps, fixRelationship: true };

      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ domain: 'google.com' }] }).mockResolvedValueOnce({
        rows: [{ domain: 'google.com', seller_id: 'pub-1', seller_type: 'PUBLISHER' }],
      });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('google.com, pub-1, DIRECT');
      expect(result.stats.modifiedCount).toBe(1);
    });

    it('should fix relationship based on sellers.json (INTERMEDIARY -> RESELLER)', async () => {
      const input = `google.com, pub-1, DIRECT`;
      const steps = { ...defaultSteps, fixRelationship: true };

      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ domain: 'google.com' }] }).mockResolvedValueOnce({
        rows: [{ domain: 'google.com', seller_id: 'pub-1', seller_type: 'INTERMEDIARY' }],
      });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('google.com, pub-1, RESELLER');
      expect(result.stats.modifiedCount).toBe(1);
    });

    it('should fix relationship based on sellers.json (BOTH -> DIRECT preference)', async () => {
      const input = `google.com, pub-1, UNKNOWN_RELATIONSHIP`;
      const steps = { ...defaultSteps, fixRelationship: true };

      (query as jest.Mock).mockResolvedValueOnce({ rows: [{ domain: 'google.com' }] }).mockResolvedValueOnce({
        rows: [{ domain: 'google.com', seller_id: 'pub-1', seller_type: 'BOTH' }],
      });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('google.com, pub-1, DIRECT');
      expect(result.stats.modifiedCount).toBe(1);
    });

    it('should remove invalid sellers', async () => {
      const input = `google.com, pub-999, DIRECT`;
      const steps: OptimizerSteps = { ...defaultSteps, verifySellers: true, sellersAction: 'remove' };

      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ domain: 'google.com' }] })
        .mockResolvedValueOnce({ rows: [] }); // Seller NOT found

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('');
      expect(result.stats.removedCount).toBe(1);
    });

    it('should comment out invalid sellers', async () => {
      const input = `google.com, pub-999, DIRECT`;
      const steps: OptimizerSteps = { ...defaultSteps, verifySellers: true, sellersAction: 'comment' };

      (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ domain: 'google.com' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.process(input, 'example.com', undefined, steps);

      expect(result.optimizedContent).toBe('# INVALID_SELLER_ID: google.com, pub-999, DIRECT');
      expect(result.stats.commentedCount).toBe(1);
    });
  });
});
