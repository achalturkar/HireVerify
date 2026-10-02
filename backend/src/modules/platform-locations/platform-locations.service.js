'use strict';

const repo = require('./platform-locations.repository');
const { BadRequestError, ConflictError, NotFoundError } = require('../../utils/errors');

const normalize = (value) => value.trim().replace(/\s+/g, ' ');

const list = async (includeInactive = false) => {
  const countries = await repo.list(includeInactive);
  return {
    countries: countries.map(({ states, ...country }) => ({ ...country, states })),
    states: countries.flatMap((country) => country.states.map((state) => ({ ...state, countryName: country.name }))),
  };
};

const createCountry = async (name) => {
  const normalizedName = normalize(name);
  if (await repo.findCountryByName(normalizedName)) throw new ConflictError('This country already exists.');
  return repo.createCountry({ name: normalizedName });
};

const updateCountry = async (id, payload) => {
  const current = await repo.findCountryById(id);
  if (!current) throw new NotFoundError('Country not found.');
  const data = {};
  if (payload.name !== undefined) {
    const name = normalize(payload.name);
    const duplicate = await repo.findCountryByName(name);
    if (duplicate && duplicate.id !== id) throw new ConflictError('This country already exists.');
    data.name = name;
  }
  if (payload.isActive !== undefined) data.isActive = payload.isActive;
  return repo.updateCountry(id, data);
};

const createState = async ({ countryId, name }) => {
  const country = await repo.findCountryById(countryId);
  if (!country || !country.isActive) throw new NotFoundError('Active country not found.');
  const normalizedName = normalize(name);
  if (await repo.findStateByName(countryId, normalizedName)) throw new ConflictError('This state already exists for the selected country.');
  return repo.createState({ countryId, name: normalizedName });
};

const updateState = async (id, payload) => {
  const current = await repo.findStateById(id);
  if (!current) throw new NotFoundError('State not found.');
  const countryId = payload.countryId ?? current.countryId;
  if (payload.countryId) {
    const country = await repo.findCountryById(payload.countryId);
    if (!country || !country.isActive) throw new NotFoundError('Active country not found.');
  }
  const data = {};
  if (payload.countryId !== undefined) data.countryId = payload.countryId;
  if (payload.name !== undefined) {
    const name = normalize(payload.name);
    const duplicate = await repo.findStateByName(countryId, name);
    if (duplicate && duplicate.id !== id) throw new ConflictError('This state already exists for the selected country.');
    data.name = name;
  } else if (payload.countryId !== undefined) {
    const duplicate = await repo.findStateByName(countryId, current.name);
    if (duplicate && duplicate.id !== id) throw new ConflictError('This state already exists for the selected country.');
  }
  if (payload.isActive !== undefined) data.isActive = payload.isActive;
  return repo.updateState(id, data);
};

const importRows = async (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new BadRequestError('The CSV has no location rows to import.');
  if (rows.length > 5000) throw new BadRequestError('Import a maximum of 5,000 country/state rows at a time.');
  const normalizedRows = rows.map((row, index) => {
    const country = typeof row.country === 'string' ? normalize(row.country) : '';
    const state = typeof row.state === 'string' ? normalize(row.state) : '';
    if (!country || country.length > 150 || state.length > 150) throw new BadRequestError(`Invalid country or state name on CSV row ${index + 2}.`);
    return { country, state };
  });

  return repo.prisma.$transaction(async (transaction) => {
    const countryCache = new Map();
    const stateCache = new Set();
    const result = { countriesAdded: 0, statesAdded: 0, existingRowsSkipped: 0 };
    for (const row of normalizedRows) {
      const countryKey = row.country.toLocaleLowerCase();
      let country = countryCache.get(countryKey);
      if (!country) {
        country = await repo.findCountryByName(row.country, transaction);
        if (!country) {
          country = await transaction.geoCountry.create({ data: { name: row.country } });
          result.countriesAdded += 1;
        } else if (!country.isActive) {
          country = await transaction.geoCountry.update({ where: { id: country.id }, data: { isActive: true } });
        }
        countryCache.set(countryKey, country);
      }
      if (!row.state) continue;
      const stateKey = `${country.id}:${row.state.toLocaleLowerCase()}`;
      if (stateCache.has(stateKey)) {
        result.existingRowsSkipped += 1;
        continue;
      }
      let state = await repo.findStateByName(country.id, row.state, transaction);
      if (!state) {
        await transaction.geoState.create({ data: { countryId: country.id, name: row.state } });
        result.statesAdded += 1;
      } else if (!state.isActive) {
        await transaction.geoState.update({ where: { id: state.id }, data: { isActive: true } });
      } else {
        result.existingRowsSkipped += 1;
      }
      stateCache.add(stateKey);
    }
    return result;
  }, { timeout: 20000 });
};

module.exports = { list, createCountry, updateCountry, createState, updateState, importRows };