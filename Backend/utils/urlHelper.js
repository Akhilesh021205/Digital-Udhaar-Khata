const getFrontendUrl = () => {
  const envUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : '';

  // In production (Render, Vercel, Cloud), prioritize production canonical frontend domain
  if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL) {
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl.replace(/\/+$/, '');
    }
    return 'https://digital-udhaar-khata.vercel.app';
  }

  // In local development, always route to local frontend port so tokens match local DB
  if (envUrl && (envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:5173';
};

module.exports = { getFrontendUrl };

