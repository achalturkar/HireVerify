'use strict';

require('dotenv').config();

const requireEnv = (key, fallback) => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  jwt: {
    accessSecret: requireEnv('JWT_ACCESS_SECRET'),
    refreshSecret: requireEnv('JWT_REFRESH_SECRET'),
    resetSecret: process.env.JWT_RESET_SECRET || process.env.JWT_ACCESS_SECRET || requireEnv('JWT_ACCESS_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    resetExpiresIn: process.env.JWT_RESET_EXPIRES_IN || '1h',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  },

  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },

   smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    fromName: process.env.SMTP_FROM_NAME || 'BGV Portal',
    fromEmail: process.env.SMTP_FROM_EMAIL || 'no-reply@portal.com',
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@portal.com',
    password: process.env.SUPER_ADMIN_PASSWORD || 'Admin@123',
  },

  contact: {
    toEmail: process.env.CONTACT_TO_EMAIL || process.env.SMTP_FROM_EMAIL || 'support@hireassess.com',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
  },

  upload: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxSizeMb: parseInt(process.env.UPLOAD_MAX_SIZE_MB || '5', 10),
  },

  azureTableStorage: {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    tableName: process.env.AZURE_STORAGE_TABLE_NAME || 'BGVReports',
  },

  surepass: {
    baseUrl: process.env.SUREPASS_BASE_URL || '',
    bearerToken: process.env.SUREPASS_BEARER_TOKEN || '',
    panEndpoint: process.env.SUREPASS_PAN_ENDPOINT || '',
  },

  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};

module.exports = config;
