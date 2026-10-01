'use strict';

const { prisma } = require('../../common/prisma');

const BRAND_COLOR_KEY = 'public.primaryColor';

const getPrimaryColor = async () => {
  const setting = await prisma.platformSetting.findUnique({ where: { key: BRAND_COLOR_KEY } });
  return setting?.value ?? null;
};

const setPrimaryColor = (value) => prisma.platformSetting.upsert({
  where: { key: BRAND_COLOR_KEY },
  create: { key: BRAND_COLOR_KEY, value },
  update: { value },
});

module.exports = { getPrimaryColor, setPrimaryColor };