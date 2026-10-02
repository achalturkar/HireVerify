'use strict';

const { prisma } = require('../../common/prisma');

const list = (includeInactive = false) => prisma.geoCountry.findMany({
  where: includeInactive ? {} : { isActive: true },
  include: {
    states: {
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    },
  },
  orderBy: { name: 'asc' },
});

const findCountryByName = (name, client = prisma) => client.geoCountry.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
const findCountryById = (id) => prisma.geoCountry.findUnique({ where: { id } });
const createCountry = (data) => prisma.geoCountry.create({ data });
const updateCountry = (id, data) => prisma.geoCountry.update({ where: { id }, data });
const findStateByName = (countryId, name, client = prisma) => client.geoState.findFirst({ where: { countryId, name: { equals: name, mode: 'insensitive' } } });
const findStateById = (id) => prisma.geoState.findUnique({ where: { id } });
const createState = (data) => prisma.geoState.create({ data });
const updateState = (id, data) => prisma.geoState.update({ where: { id }, data });

module.exports = { prisma, list, findCountryByName, findCountryById, createCountry, updateCountry, findStateByName, findStateById, createState, updateState };