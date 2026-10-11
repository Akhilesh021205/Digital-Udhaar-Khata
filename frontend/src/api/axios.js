import axios from 'axios';
import { Capacitor } from '@capacitor/core';

const apiBaseUrl = (Capacitor.isNativePlatform() || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
  ? `${import.meta.env.VITE_API_URL || 'https://digital-udhaar-khata.onrender.com'}/api`
  : 'http://localhost:4000/api';

const API = axios.create({
  baseURL: apiBaseUrl,
});

// Fast in-memory API response cache for instant client navigation & SWR hydration
const apiCache = new Map();

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
  const item = apiCache.get(key);
  if (item && Date.now() < item.expiresAt) {
    return item.data;
  }
  return null;
};

/**
 * Manually sets cached data
 */
export const setCachedData = (url, params = {}, data, ttlMs = 120000) => {
  if (!data) return;
  const key = getNormalizedCacheKey(url, params);
  apiCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs, // 120 seconds TTL
  });
};

export const clearApiCache = () => {
  apiCache.clear();
};

API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('udhaar-user'));
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }

  const method = config.method?.toLowerCase();
  
  // Instant short-circuit for GET requests if valid cache exists (<1ms)
  if (method === 'get') {
    const cachedData = getCachedData(config.url, config.params);
    if (cachedData) {
      config.adapter = () => Promise.resolve({
        data: cachedData,
        status: 200,
        statusText: 'OK',
        headers: {},
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
    
    // Save to cache on successful GET requests (120 seconds TTL)
    if (method === 'get' && response.data) {
      setCachedData(response.config.url, response.config.params, response.data, 120000);
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
