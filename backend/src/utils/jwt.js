'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

const signAccessToken = (payload, expiresIn = config.jwt.accessExpiresIn) =>
  jwt.sign(payload, config.jwt.accessSecret, { expiresIn });

const signRefreshToken = (payload, jti) =>
  jwt.sign({ ...payload, jti }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });

const signResetToken = (payload) =>
  jwt.sign(payload, config.jwt.resetSecret, { expiresIn: config.jwt.resetExpiresIn });

const verifyAccessToken = (token) => jwt.verify(token, config.jwt.accessSecret);

const verifyRefreshToken = (token) => jwt.verify(token, config.jwt.refreshSecret);

const verifyResetToken = (token) => jwt.verify(token, config.jwt.resetSecret);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateJti = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseDurationToMs = (value) => {
  if (typeof value !== 'string') return 0;
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) return 0;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return amount * 1000;
    case 'm': return amount * 60 * 1000;
    case 'h': return amount * 60 * 60 * 1000;
    case 'd': return amount * 24 * 60 * 60 * 1000;
    default: return 0;
  }
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  signResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  hashToken,
  generateJti,
  parseDurationToMs,
};