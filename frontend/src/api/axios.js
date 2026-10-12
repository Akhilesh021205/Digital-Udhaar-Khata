import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const apiBaseUrl = (Capacitor.isNativePlatform() || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
  ? `${import.meta.env.VITE_API_URL || 'https://digital-udhaar-khata.onrender.com'}/api`
  : 'http://localhost:4000/api';

const API = axios.create({
  baseURL: apiBaseUrl,
});

// Multi-tier (Memory + Persistent Storage) API Cache for 0ms Instant Navigation & SWR Hydration
const CACHE_STORAGE_PREFIX = 'udhaar_cache_';
const apiCache = new Map();

const getSafeStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch (e) {}
  return null;
};

/**
 * Normalizes URL and query parameters into a deterministic cache key
 */
export const getNormalizedCacheKey = (url, params = {}) => {
  if (!url) return '';
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  
  const cleanParams = {};
  if (params && typeof params === 'object') {
    Object.keys(params)
      .sort()
      .forEach(k => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
          cleanParams[k] = params[k];
        }
      });
  }

  const queryString = Object.keys(cleanParams).length > 0 ? `?${JSON.stringify(cleanParams)}` : '';
  return `${normalizedUrl}${queryString}`;
};

/**
 * Synchronously retrieves cached data for immediate 0ms component rendering
 */
export const getCachedData = (url, params = {}) => {
  const key = getNormalizedCacheKey(url, params);
  
  // 1. Check in-memory cache first (<0.1ms)
  const item = apiCache.get(key);
  if (item && Date.now() < item.expiresAt) {
    return item.data;
  }

  // 2. Fallback to persistent session storage (survives refreshes & page transitions)
  try {
    const storage = getSafeStorage();
    if (storage) {
      const raw = storage.getItem(CACHE_STORAGE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() < parsed.expiresAt) {
          // Rehydrate in-memory cache
          apiCache.set(key, parsed);
          return parsed.data;
        } else {
          storage.removeItem(CACHE_STORAGE_PREFIX + key);
        }
      }
    }
  } catch (e) {
    // Fail silently on storage errors
  }

  return null;
};

/**
 * Manually sets cached data in memory and persistent storage
 */
export const setCachedData = (url, params = {}, data, ttlMs = 180000) => {
  if (!data) return;
  const key = getNormalizedCacheKey(url, params);
  const cachePayload = {
    data,
    expiresAt: Date.now() + ttlMs, // 3 minutes TTL default
  };

  // Set memory
  apiCache.set(key, cachePayload);

  // Set persistent storage
  try {
    const storage = getSafeStorage();
    if (storage) {
      storage.setItem(CACHE_STORAGE_PREFIX + key, JSON.stringify(cachePayload));
    }
  } catch (e) {
    // Quota exceeded or private browsing
  }
};

/**
 * Helper to immediately retrieve a specific customer profile from cache or list
 */
export const getCachedCustomer = (customerId) => {
  if (!customerId) return null;
  
  // 1. Direct cache for /customers/:id
  const direct = getCachedData(`/customers/${customerId}`);
  if (direct?.customer) return direct.customer;
  if (direct?.data?.customer) return direct.data.customer;
  if (direct && !direct.customer && direct.name) return direct;

  // 2. Search in cached customer lists
  const listCached = getCachedData('/customers') || getCachedData('/customers?sort=balance-high');
  const list = listCached?.data || listCached || [];
  if (Array.isArray(list)) {
    const found = list.find(c => c._id === customerId);
    if (found) return found;
  }
  return null;
};

export const clearApiCache = () => {
  apiCache.clear();
  try {
    const storage = getSafeStorage();
    if (storage) {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && k.startsWith(CACHE_STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => storage.removeItem(k));
    }
  } catch (e) {}
};

/**
 * Immediate non-blocking background warm-up ping for Render backend
 */
export const pingBackendWarmup = () => {
  try {
    const target = (Capacitor.isNativePlatform() || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
      ? `${import.meta.env.VITE_API_URL || 'https://digital-udhaar-khata.onrender.com'}/api/health`
      : 'http://localhost:4000/api/health';
    fetch(target, { mode: 'cors', cache: 'no-store' }).catch(() => {});
  } catch (e) {}
};

// Warm up immediately upon module load
pingBackendWarmup();

API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('udhaar-user'));
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }

  const method = config.method?.toLowerCase();
  
  // Instant short-circuit for GET requests if valid cache exists (<1ms)
  if (method === 'get' && !config.headers?.['x-skip-cache'] && !config.skipCache) {
    const cachedData = getCachedData(config.url, config.params);
    if (cachedData) {
      config.adapter = () => Promise.resolve({
        data: cachedData,
        status: 200,
        statusText: 'OK',
        headers: { 'x-cache': 'HIT' },
        config,
        request: {},
      });
    }
  } else if (['post', 'put', 'delete'].includes(method)) {
    // Invalidate cache immediately on all write operations
    clearApiCache();
  }

  return config;
});

API.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    
    // Save to cache on successful GET requests (180 seconds TTL)
    if (method === 'get' && response.data) {
      setCachedData(response.config.url, response.config.params, response.data, 180000);
    }
    
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('udhaar-user');
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/pay'];
      const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path));
      if (!isPublicPath) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;
