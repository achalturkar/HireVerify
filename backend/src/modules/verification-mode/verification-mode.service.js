'use strict';

const repo = require('./verification-mode.repository');
const { ConflictError, ForbiddenError, NotFoundError } = require('../../utils/errors');

const requireCompany = (companyId) => {
  if (!companyId) throw new ForbiddenError('A company account is required to manage verification modes.');
};

const list = async ({ companyId, includeInactive = false }) => {
  requireCompany(companyId);
  return repo.list(companyId, includeInactive);
};

const create = async ({ companyId, name }) => {
  requireCompany(companyId);
  const normalizedName = name.trim();
  if (await repo.findByName(companyId, normalizedName)) throw new ConflictError('A verification mode with this name already exists.');
  return repo.create({ companyId, name: normalizedName });
};

const update = async ({ companyId, id, payload }) => {
  requireCompany(companyId);
  const current = await repo.findById(companyId, id);
  if (!current) throw new NotFoundError('Verification mode not found.');
  const data = {};
  if (payload.name !== undefined) {
    const name = payload.name.trim();
    if (await repo.findByName(companyId, name, id)) throw new ConflictError('A verification mode with this name already exists.');
    data.name = name;
  }
  if (payload.isActive !== undefined) data.isActive = payload.isActive;
  return repo.update(id, data);
};

module.exports = { list, create, update };
