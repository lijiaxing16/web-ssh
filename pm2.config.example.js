module.exports = {
  apps: [
    {
      name: 'web-ssh-platform',
      script: './backend/app.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
        SESSION_SECRET: 'please_change_this_secret',
        ENCRYPT_KEY: '0123456789abcdef0123456789abcdef',
        AUTH_ENABLED: 'true',
        DEFAULT_USER: 'admin',
        DEFAULT_PASSWORD: 'Admin@123456',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      merge_logs: true,
    },
  ],
};
