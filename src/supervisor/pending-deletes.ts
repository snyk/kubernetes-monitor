import {
  writeFileSync,
  renameSync,
  readFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { dirname } from 'path';

import { logger } from '../common/logger';
import { config } from '../common/config';
import { sendDeleteWorkloadRequest } from '../scanner';
import { ILocalWorkloadLocator } from '../transmitter/types';

const DELETE_GRACE_ANNOTATION = 'snyk.io/delete-grace-period';
const SWEEP_INTERVAL_MS = 60 * 1000;
const STATE_PATH = '/var/data/grace-period/pending-deletes.json';

export interface PendingDeleteEntry {
  deletedAt: string;
  deadline: number;
  gracePeriod: string;
  namespace: string;
  type: string;
  name: string;
  workloadName: string;
}

const pendingDeletes = new Map<string, PendingDeleteEntry>();
let writeScheduled = false;
let sweepInProgress = false;
let sweepInterval: NodeJS.Timeout | undefined;

export function getLocatorKey(locator: ILocalWorkloadLocator): string {
  return `${locator.namespace}/${locator.type}/${locator.name}`;
}

export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) {
    return -1;
  }
  const value = parseInt(match[1], 10);
  if (value <= 0) {
    return -1;
  }
  switch (match[2]) {
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return -1;
  }
}

export function getMaxDurationMs(): number {
  const maxMs = parseDuration(config.DELETE_GRACE_PERIOD_MAX_DURATION);
  if (maxMs <= 0) {
    return 30 * 24 * 60 * 60 * 1000; // fallback 30d
  }
  return maxMs;
}

export function getGracePeriodAnnotation(
  annotations: Record<string, string> | undefined,
): string | undefined {
  if (!annotations) {
    return undefined;
  }
  return annotations[DELETE_GRACE_ANNOTATION];
}

export function addPendingDelete(
  locator: ILocalWorkloadLocator,
  workloadName: string,
  gracePeriod: string,
): boolean {
  const durationMs = parseDuration(gracePeriod);
  if (durationMs <= 0) {
    logger.warn(
      { workloadName, gracePeriod },
      'invalid delete-grace-period annotation, skipping deferred delete',
    );
    return false;
  }

  const maxMs = getMaxDurationMs();
  const effectiveMs = Math.min(durationMs, maxMs);
  if (durationMs > maxMs) {
    logger.warn(
      {
        workloadName,
        gracePeriod,
        maxDuration: config.DELETE_GRACE_PERIOD_MAX_DURATION,
      },
      'delete-grace-period exceeds max, clamping to max',
    );
  }

  const key = getLocatorKey(locator);
  const entry: PendingDeleteEntry = {
    deletedAt: new Date().toISOString(),
    deadline: Date.now() + effectiveMs,
    gracePeriod,
    namespace: locator.namespace,
    type: locator.type,
    name: locator.name,
    workloadName,
  };

  pendingDeletes.set(key, entry);
  logger.info(
    { workloadName, gracePeriod, key },
    'workload delete deferred with grace period',
  );
  schedulePersist();
  return true;
}

export function cancelPendingDelete(
  locator: ILocalWorkloadLocator,
): boolean {
  const key = getLocatorKey(locator);
  if (pendingDeletes.has(key)) {
    pendingDeletes.delete(key);
    logger.info({ key }, 'cancelled pending delete - workload re-appeared');
    schedulePersist();
    return true;
  }
  return false;
}

export function hasPendingDelete(locator: ILocalWorkloadLocator): boolean {
  return pendingDeletes.has(getLocatorKey(locator));
}

export function getPendingDeletesCount(): number {
  return pendingDeletes.size;
}

/** Returns a snapshot of pending entries. Mutations to the returned map do not affect state. */
export function getPendingDeleteEntries(): Map<string, PendingDeleteEntry> {
  return new Map(pendingDeletes);
}

export async function sweep(): Promise<void> {
  if (sweepInProgress) {
    return;
  }
  sweepInProgress = true;

  try {
    const now = Date.now();
    const expired: Array<[string, PendingDeleteEntry]> = [];

    for (const [key, entry] of pendingDeletes) {
      if (now >= entry.deadline) {
        expired.push([key, entry]);
      }
    }

    for (const [key, entry] of expired) {
      const locator: ILocalWorkloadLocator = {
        namespace: entry.namespace,
        type: entry.type,
        name: entry.name,
      };
      try {
        logger.info(
          { key, workloadName: entry.workloadName },
          'grace period expired, deleting workload from upstream',
        );
        await sendDeleteWorkloadRequest(entry.workloadName, locator);
        pendingDeletes.delete(key);
      } catch (error) {
        logger.error(
          { error, key },
          'failed to send deferred delete, will retry on next sweep',
        );
      }
    }

    if (expired.length > 0) {
      schedulePersist();
    }
  } finally {
    sweepInProgress = false;
  }
}

export function startSweep(): void {
  if (sweepInterval) {
    return;
  }
  sweepInterval = setInterval(() => {
    sweep().catch((error) => {
      logger.error({ error }, 'error during pending-deletes sweep');
    });
  }, SWEEP_INTERVAL_MS);
  sweepInterval.unref();
}

export function stopSweep(): void {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = undefined;
  }
}

function schedulePersist(): void {
  if (writeScheduled) {
    return;
  }
  writeScheduled = true;
  process.nextTick(() => {
    writeScheduled = false;
    persistState();
  });
}

export function persistState(): void {
  try {
    const data = JSON.stringify(Object.fromEntries(pendingDeletes), null, 2);
    const tmpPath = STATE_PATH + '.tmp';
    writeFileSync(tmpPath, data, 'utf-8');
    renameSync(tmpPath, STATE_PATH);
  } catch (error) {
    logger.error({ error }, 'failed to persist pending-deletes state');
  }
}

function isValidEntry(entry: unknown): entry is PendingDeleteEntry {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }
  const e = entry as Record<string, unknown>;
  return (
    typeof e.deadline === 'number' &&
    typeof e.namespace === 'string' &&
    typeof e.type === 'string' &&
    typeof e.name === 'string' &&
    typeof e.workloadName === 'string'
  );
}

export function loadState(): void {
  try {
    if (!existsSync(STATE_PATH)) {
      return;
    }
    const data = readFileSync(STATE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null) {
      logger.warn({}, 'pending-deletes state file has unexpected format, ignoring');
      return;
    }
    const entries = parsed as Record<string, unknown>;
    let loaded = 0;
    for (const [key, entry] of Object.entries(entries)) {
      if (isValidEntry(entry)) {
        pendingDeletes.set(key, entry);
        loaded++;
      } else {
        logger.warn({ key }, 'skipping invalid pending-delete entry');
      }
    }
    logger.info(
      { count: loaded },
      'loaded pending-deletes state from disk',
    );
  } catch (error) {
    logger.warn(
      { error },
      'failed to load pending-deletes state, starting fresh',
    );
  }
}

export async function reconcile(): Promise<void> {
  const now = Date.now();
  const toDelete: Array<[string, PendingDeleteEntry]> = [];
  const toKeep: string[] = [];

  for (const [key, entry] of pendingDeletes) {
    if (now >= entry.deadline) {
      toDelete.push([key, entry]);
    } else {
      toKeep.push(key);
    }
  }

  logger.info(
    { expired: toDelete.length, pending: toKeep.length },
    'reconciling pending-deletes on startup',
  );

  for (const [key, entry] of toDelete) {
    const locator: ILocalWorkloadLocator = {
      namespace: entry.namespace,
      type: entry.type,
      name: entry.name,
    };
    try {
      await sendDeleteWorkloadRequest(entry.workloadName, locator);
      pendingDeletes.delete(key);
    } catch (error) {
      logger.error(
        { error, key },
        'failed to process expired pending delete during reconciliation',
      );
    }
  }

  if (toDelete.length > 0) {
    schedulePersist();
  }
}

export async function initPendingDeletes(): Promise<void> {
  if (!config.DELETE_GRACE_PERIOD_ENABLED) {
    return;
  }
  const dir = dirname(STATE_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  loadState();
  await reconcile();
  startSweep();
}

export function shutdownPendingDeletes(): void {
  if (!config.DELETE_GRACE_PERIOD_ENABLED) {
    return;
  }
  stopSweep();
  if (pendingDeletes.size > 0) {
    persistState();
  }
}

/** Exported for testing */
export function clearPendingDeletesState(): void {
  pendingDeletes.clear();
}

/** Exported for testing — allows inserting entries with arbitrary deadlines */
export function setPendingDeleteEntry(
  key: string,
  entry: PendingDeleteEntry,
): void {
  pendingDeletes.set(key, entry);
}
