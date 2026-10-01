'use strict';

const { BadRequestError } = require('../../utils/errors');
const repo = require('./platform-branding.repository');

const DEFAULT_PRIMARY_COLOR = '#0D9488';
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const getBranding = async () => ({
  primaryColor: (await repo.getPrimaryColor()) || DEFAULT_PRIMARY_COLOR,
});

const updateBranding = async ({ primaryColor }) => {
  if (typeof primaryColor !== 'string' || !HEX_COLOR_PATTERN.test(primaryColor)) {
    throw new BadRequestError('Primary color must be a six-digit hex color.');
  }

  const saved = await repo.setPrimaryColor(primaryColor.toUpperCase());
  return { primaryColor: saved.value };
};

module.exports = { getBranding, updateBranding };