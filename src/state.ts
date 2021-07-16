import { V1Namespace } from '@kubernetes/client-node';
import * as LruCache from 'lru-cache';

import { config } from './common/config';

const imagesLruCacheOptions = {
  // limit cache size so we don't exceed memory limit
  max: config.IMAGES_SCANNED_CACHE.MAX_SIZE,
  // limit cache life so if our backend loses track of an image's data,
  // eventually we will report again for that image, if it's still relevant
  maxAge: config.IMAGES_SCANNED_CACHE.MAX_AGE_MS,
  updateAgeOnGet: false,
};

const workloadsLruCacheOptions = {
  // limit cache size so we don't exceed memory limit
  max: config.WORKLOADS_SCANNED_CACHE.MAX_SIZE,
  // limit cache life so if our backend loses track of an image's data,
  // eventually we will report again for that image, if it's still relevant
  maxAge: config.WORKLOADS_SCANNED_CACHE.MAX_AGE_MS,
  updateAgeOnGet: false,
};

const state = {
  shutdownInProgress: false,
  imagesAlreadyScanned: new LruCache<string, string>(imagesLruCacheOptions),
  workloadsAlreadyScanned: new LruCache<string, string>(
    workloadsLruCacheOptions,
  ),
  watchedNamespaces: {} as Record<string, V1Namespace>,
};

export { state };
