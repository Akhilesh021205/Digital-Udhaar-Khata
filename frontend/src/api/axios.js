import axios from 'axios';

const apiBaseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000/api'
  : `${import.meta.env.VITE_API_URL || 'https://digital-udhaar-khata.onrender.com'}/api`;

const API = axios.create({
  baseURL: apiBaseUrl,
});

// Fast in-memory API response cache
const apiCache = new Map();

API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('udhaar-user'));
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }

  const method = config.method?.toLowerCase();
  
  // Cache check for GET requests
  if (method === 'get') {
    const cacheKey = config.url + JSON.stringify(config.params || {});
    const cached = apiCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expiresAt) {
      // Short-circuit the request and return cached response
      config.adapter = () => Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      });
    }
  } else if (['post', 'put', 'delete'].includes(method)) {
    // Invalidate cache immediately on write operations
    apiCache.clear();
  }

  return config;
});

API.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase();
    
    // Save to cache on successful GET requests
    if (method === 'get') {
      const cacheKey = response.config.url + JSON.stringify(response.config.params || {});
      apiCache.set(cacheKey, {
        data: response.data,
        expiresAt: Date.now() + 3000, // 3 seconds TTL for page navigation de-duplication
      });
    }
    
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('udhaar-user');
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
      const isPublicPath = publicPaths.some(path => window.location.pathname.startsWith(path));
      if (!isPublicPath) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default API;
