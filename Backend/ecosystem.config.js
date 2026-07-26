module.exports = {
  apps: [
    {
      name: 'digital-udhaar-backend',
      script: './server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    }
  ]
};
