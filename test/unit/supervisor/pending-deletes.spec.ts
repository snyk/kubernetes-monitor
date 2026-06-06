import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

// Mock the scanner module before importing anything else
const mockSendDeleteWorkloadRequest = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/scanner', () => ({
  sendDeleteWorkloadRequest: mockSendDeleteWorkloadRequest,
}));

// Mock config with grace period enabled
jest.mock('../../../src/common/config', () => ({
  config: {
    DELETE_GRACE_PERIOD_ENABLED: true,
    DELETE_GRACE_PERIOD_MAX_DURATION: '30d',
  },
}));

// Mock logger
jest.mock('../../../src/common/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the file path constants so we can test persistence with a temp directory
const STATE_DIR = join(__dirname, 'test-grace-period-state');
const STATE_PATH = join(STATE_DIR, 'pending-deletes.json');

import {
  parseDuration,
  getGracePeriodAnnotation,
  addPendingDelete,
  cancelPendingDelete,
  hasPendingDelete,
  getPendingDeletesCount,
  getPendingDeleteEntries,
  sweep,
  clearPendingDeletesState,
  setPendingDeleteEntry,
} from '../../../src/supervisor/pending-deletes';
import { ILocalWorkloadLocator } from '../../../src/transmitter/types';

describe('pending-deletes module', () => {
  beforeEach(() => {
    clearPendingDeletesState();
    mockSendDeleteWorkloadRequest.mockClear();
  });

  describe('parseDuration()', () => {
    test.each([
      ['30m', 30 * 60_000],
      ['1h', 3_600_000],
      ['24h', 24 * 3_600_000],
      ['7d', 7 * 86_400_000],
      ['1d', 86_400_000],
      ['90d', 90 * 86_400_000],
    ])('parses valid duration "%s" to %i ms', (input, expectedMs) => {
      expect(parseDuration(input)).toEqual(expectedMs);
    });

    test.each([
      ['', -1],
      ['7', -1],
      ['7x', -1],
      ['-7d', -1],
      ['0d', -1],
      ['7.5d', -1],
    ])('returns -1 for invalid duration "%s"', (input, expected) => {
      expect(parseDuration(input)).toEqual(expected);
    });
  });

  describe('getGracePeriodAnnotation()', () => {
    it('returns undefined when annotations are missing or key absent', () => {
      expect(getGracePeriodAnnotation(undefined)).toBeUndefined();
      expect(
        getGracePeriodAnnotation({ 'other/key': 'val' }),
      ).toBeUndefined();
    });

    it('returns the annotation value when present', () => {
      expect(
        getGracePeriodAnnotation({ 'snyk.io/delete-grace-period': '7d' }),
      ).toEqual('7d');
    });
  });

  describe('addPendingDelete()', () => {
    it('stores entry with correct deadline in the future', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'user-session',
      };
      const before = Date.now();

      addPendingDelete(locator, 'user-session', '7d');

      expect(hasPendingDelete(locator)).toBe(true);
      expect(getPendingDeletesCount()).toBe(1);
      const entry = getPendingDeleteEntries().get('default/Deployment/user-session');
      expect(entry!.deadline).toBeGreaterThanOrEqual(before + 7 * 86_400_000);
    });

    it('does not add entry for invalid duration', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'bad-workload',
      };

      addPendingDelete(locator, 'bad-workload', 'invalid');

      expect(hasPendingDelete(locator)).toBe(false);
      expect(getPendingDeletesCount()).toBe(0);
    });

    it('clamps duration exceeding max to max', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'long-lived',
      };
      const now = Date.now();

      addPendingDelete(locator, 'long-lived', '90d');

      const entry = getPendingDeleteEntries().get('default/Deployment/long-lived')!;
      const effectiveDelay = entry.deadline - now;
      const maxMs = 30 * 86_400_000;
      expect(effectiveDelay).toBeLessThanOrEqual(maxMs + 100);
      expect(effectiveDelay).toBeGreaterThan(maxMs - 100);
    });

    it('does NOT clamp when duration equals max exactly', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'at-max',
      };
      const now = Date.now();

      addPendingDelete(locator, 'at-max', '30d');

      const entry = getPendingDeleteEntries().get('default/Deployment/at-max')!;
      const effectiveDelay = entry.deadline - now;
      const maxMs = 30 * 86_400_000;
      // Should be exactly 30d, not clamped down
      expect(effectiveDelay).toBeGreaterThan(maxMs - 100);
      expect(effectiveDelay).toBeLessThanOrEqual(maxMs + 100);
    });

    it('overwrites existing entry for the same workload (upsert)', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'reused',
      };

      addPendingDelete(locator, 'reused', '1d');
      addPendingDelete(locator, 'reused', '7d');

      expect(getPendingDeletesCount()).toBe(1);
      const entry = getPendingDeleteEntries().get('default/Deployment/reused');
      expect(entry!.gracePeriod).toEqual('7d');
    });
  });

  describe('cancelPendingDelete()', () => {
    it('removes existing entry and returns true', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'user-session',
      };

      addPendingDelete(locator, 'user-session', '7d');
      const result = cancelPendingDelete(locator);

      expect(result).toBe(true);
      expect(hasPendingDelete(locator)).toBe(false);
    });

    it('returns false when no pending delete exists', () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'never-added',
      };

      expect(cancelPendingDelete(locator)).toBe(false);
    });
  });

  describe('sweep()', () => {
    it('sends delete for expired entries and removes them', async () => {
      setPendingDeleteEntry('default/Deployment/expired', {
        deletedAt: new Date(Date.now() - 100_000).toISOString(),
        deadline: Date.now() - 1000,
        gracePeriod: '1m',
        namespace: 'default',
        type: 'Deployment',
        name: 'expired',
        workloadName: 'expired',
      });

      await sweep();

      expect(mockSendDeleteWorkloadRequest).toHaveBeenCalledWith(
        'expired',
        { namespace: 'default', type: 'Deployment', name: 'expired' },
      );
      expect(getPendingDeletesCount()).toBe(0);
    });

    it('leaves non-expired entries untouched', async () => {
      setPendingDeleteEntry('default/Deployment/future', {
        deletedAt: new Date().toISOString(),
        deadline: Date.now() + 86_400_000,
        gracePeriod: '1d',
        namespace: 'default',
        type: 'Deployment',
        name: 'future',
        workloadName: 'future',
      });

      await sweep();

      expect(mockSendDeleteWorkloadRequest).not.toHaveBeenCalled();
      expect(getPendingDeletesCount()).toBe(1);
    });

    it('retains entry on upstream failure for retry on next sweep', async () => {
      mockSendDeleteWorkloadRequest.mockRejectedValueOnce(new Error('network error'));

      setPendingDeleteEntry('default/Deployment/retry-me', {
        deletedAt: new Date(Date.now() - 100_000).toISOString(),
        deadline: Date.now() - 1000,
        gracePeriod: '1m',
        namespace: 'default',
        type: 'Deployment',
        name: 'retry-me',
        workloadName: 'retry-me',
      });

      await sweep();

      expect(getPendingDeletesCount()).toBe(1);
    });

    it('processes all expired entries in one pass', async () => {
      // Guards against iterator-invalidation bugs when deleting from Map during iteration
      for (let i = 0; i < 5; i++) {
        setPendingDeleteEntry(`ns/Deployment/workload-${i}`, {
          deletedAt: new Date(Date.now() - 100_000).toISOString(),
          deadline: Date.now() - 1000,
          gracePeriod: '1m',
          namespace: 'ns',
          type: 'Deployment',
          name: `workload-${i}`,
          workloadName: `workload-${i}`,
        });
      }

      await sweep();

      expect(mockSendDeleteWorkloadRequest).toHaveBeenCalledTimes(5);
      expect(getPendingDeletesCount()).toBe(0);
    });
  });

  describe('rapid flapping', () => {
    it('multiple add/cancel cycles do not leak entries', async () => {
      const locator: ILocalWorkloadLocator = {
        namespace: 'default',
        type: 'Deployment',
        name: 'flapping',
      };

      addPendingDelete(locator, 'flapping', '1h');
      cancelPendingDelete(locator);
      addPendingDelete(locator, 'flapping', '1h');
      cancelPendingDelete(locator);
      addPendingDelete(locator, 'flapping', '1h');

      expect(getPendingDeletesCount()).toBe(1);
      await sweep();
      expect(mockSendDeleteWorkloadRequest).not.toHaveBeenCalled();
    });
  });
});
