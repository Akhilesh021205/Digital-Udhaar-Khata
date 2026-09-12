const getFrontendUrl = () => {
  let url = process.env.FRONTEND_URL || '';
  if (url && url.startsWith('http://localhost')) {
    return url.replace(/\/$/, '');
  }
  return 'https://digital-udhaar-khata.vercel.app';
};

module.exports = { getFrontendUrl };
