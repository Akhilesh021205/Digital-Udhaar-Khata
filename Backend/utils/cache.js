const cacheStore = new Map();

/**
 * Get value from cache
 * @param {string} key 
 * @returns {any|null} Cached value or null if expired/missing
 */
function get(key) {
  const item = cacheStore.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expiresAt) {
    cacheStore.delete(key);
    return null;
  }
  
  return item.value;
}

/**
 * Set value in cache
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlMs Time to live in milliseconds (default 30 seconds)
 */
function set(key, value, ttlMs = 30000) {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Delete a specific key from cache
 * @param {string} key 
 */
function del(key) {
  cacheStore.delete(key);
}

/**
 * Clear all cache entries matching a prefix (e.g. invalidate all user-specific cache keys)
 * @param {string} prefix 
 */
function invalidatePrefix(prefix) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Clear the entire cache
 */
function clear() {
  cacheStore.clear();
}

module.exports = {
  get,
  set,
  del,
  invalidatePrefix,
  clear,
};
