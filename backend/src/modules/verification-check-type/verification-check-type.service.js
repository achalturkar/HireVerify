'use strict';

const repo = require('./verification-check-type.repository');
const { BadRequestError, ConflictError, NotFoundError } = require('../../utils/errors');

const toTypeKey = (label) => {
  const normalized = label.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  let type = normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (/^[0-9]/.test(type)) type = `CHECK_${type}`;
  if (!/^[A-Z][A-Z0-9_]{1,59}$/.test(type)) {
    throw new BadRequestError('The check name must produce a key with at least two letters or numbers.');
  }
  return type;
};

const list = async ({ includeInactive = false } = {}) => repo.list({ includeInactive });

const create = async ({ label, description }) => {
  const type = toTypeKey(label);
  if (await repo.findByType(type)) throw new ConflictError('A verification check with this name or key already exists.');
  try {
    return await repo.create({ type, label, description: description || null, defaultProvider: 'MANUAL' });
  } catch (error) {
    if (error.code === 'P2002') throw new ConflictError('A verification check with this name or key already exists.');
    throw error;
  }
};

const update = async ({ type, payload }) => {
  const current = await repo.findByType(type);
  if (!current) throw new NotFoundError('Verification check type not found.');
  if (current.type !== type) throw new BadRequestError('Verification check keys cannot be changed.');
  try {
    return await repo.update(type, {
      ...(payload.label !== undefined ? { label: payload.label } : {}),
      ...(payload.description !== undefined ? { description: payload.description || null } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    });
  } catch (error) {
    if (error.code === 'P2002') throw new ConflictError('A verification check with this name already exists.');
    throw error;
  }
};

module.exports = { list, create, update };
