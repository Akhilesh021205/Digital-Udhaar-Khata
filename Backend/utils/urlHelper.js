const getFrontendUrl = () => {
  let url = process.env.FRONTEND_URL || 'https://digital-udhaar-khata.vercel.app';
  if (!url || url.includes('o4isb0524') || url.includes('-git-') || url.includes('projects.vercel.app')) {
    url = 'https://digital-udhaar-khata.vercel.app';
  }
  return url.replace(/\/$/, '');
};

module.exports = { getFrontendUrl };
