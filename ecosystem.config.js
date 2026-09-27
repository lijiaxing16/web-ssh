module.exports = {
  apps: [
    {
      name: 'web-ssh-platform',
      script: 'backend/app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0'
      }
    }
  ]
};
