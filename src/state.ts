
import lruCache = require('lru-cache');
import config = require('./common/config');

const lruCacheOptions = {
  // limit cache size so we don't exceed memory limit
  max: config.IMAGES_SCANNED_CACHE.MAX_SIZE,
  // limit cache life so if our backend loses track of an image's data,
  // eventually we will report again for that image, if it's still relevant
  maxAge: config.IMAGES_SCANNED_CACHE.MAX_AGE_MS,
  updateAgeOnGet: false,
}

const state = {
  imagesAlreadyScanned: new lruCache(lruCacheOptions),
};

export = state;
