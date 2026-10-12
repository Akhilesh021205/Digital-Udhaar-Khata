const getFrontendUrl = (customBaseUrl) => {
  // If request origin from the live client was provided, prioritize it
  if (customBaseUrl && typeof customBaseUrl === 'string') {
    const clean = customBaseUrl.trim().replace(/\/+$/, '');
    if (clean.startsWith('http') && !clean.includes('localhost') && !clean.includes('127.0.0.1') && !clean.includes('-projects.vercel.app')) {
      return clean;
    }
  }

  const envUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : '';

  // In production (Render, Vercel, Cloud), prioritize production canonical frontend domain
  // Filter out any ephemeral preview hashes (e.g. -bfpbujuzd-akhilesh021205s-projects) that cause Vercel 404 DEPLOYMENT_NOT_FOUND
  if (process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL) {
    if (
      envUrl && 
      !envUrl.includes('localhost') && 
      !envUrl.includes('127.0.0.1') &&
      !envUrl.includes('-projects.vercel.app') &&
      !/[a-z0-9]{6,}-.*\.vercel\.app/.test(envUrl)
    ) {
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
