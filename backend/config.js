require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  appName: 'Web SSH Platform',
  sessionTTL: Number(process.env.SESSION_TTL || 30 * 60 * 1000),
};
