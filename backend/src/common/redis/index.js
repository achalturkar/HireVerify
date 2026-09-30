'use strict';

const logger = require('../logger');

const createRedisStub = () => {
  const store = new Map();
  return {
    get: async (key) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set: async (key, value, ...options) => {
      const expirationIndex = options.findIndex((option) => String(option).toUpperCase() === 'EX');
      const ttlSeconds = expirationIndex >= 0 ? Number(options[expirationIndex + 1]) : 0;
      store.set(key, { value, expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null });
      return 'OK';
    },
    del: async (key) => {
      store.delete(key);
      return 1;
    },
    ping: async () => 'PONG',
    connect: async () => 'OK',
    quit: async () => 'OK',
    on: () => undefined,
  };
};

const redis = createRedisStub();

const connectRedis = async () => {
  logger.info('Redis support disabled; using PostgreSQL only.');
};

const disconnectRedis = async () => {
  logger.info('Redis support disabled; no disconnect needed.');
};

module.exports = { redis, connectRedis, disconnectRedis };