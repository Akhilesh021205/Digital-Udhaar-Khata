const getFrontendUrl = () => {
  const envUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim() : '';
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    return 'https://digital-udhaar-khata.vercel.app';
  }
  return 'http://localhost:5173';
};

module.exports = { getFrontendUrl };

