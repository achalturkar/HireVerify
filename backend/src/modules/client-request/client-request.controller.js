'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { success, created } = require('../../utils/response');
const service = require('./client-request.service');

const createRequest = asyncHandler(async (req, res) => {
  const data = await service.create({ currentUser: req.user, payload: req.body });
  return created(res, data, 'Your request was submitted.');
});

const listRequests = asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 20;
  const result = await service.list({
    currentUser: req.user,
    page,
    limit,
    search: req.query.search?.trim(),
    status: req.query.status,
  });
  return success(res, result, 'Client requests');
});

const updateRequest = asyncHandler(async (req, res) => {
  const data = await service.update({ currentUser: req.user, id: req.params.id, payload: req.body });
  return success(res, data, 'Client request updated.');
});

module.exports = { createRequest, listRequests, updateRequest };
