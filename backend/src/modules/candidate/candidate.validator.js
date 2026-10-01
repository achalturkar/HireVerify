'use strict';

const Joi = require('joi');

const STATUSES = ['PENDING', 'INVITED', 'IN_PROGRESS', 'VERIFICATION_IN_PROGRESS', 'COMPLETED', 'WITHDRAWN', 'ON_HOLD'];

const createValidator = {
  body: Joi.object({
    clientId: Joi.string().uuid().required(),
    firstName: Joi.string().max(100).required(),
    lastName: Joi.string().max(100).required(),
    email: Joi.string().email().allow(null, ''),
    phone: Joi.string().max(50).allow(null, ''),
    dateOfBirth: Joi.date().iso().allow(null),
    gender: Joi.string().max(30).allow(null, ''),
    fatherName: Joi.string().max(255).allow(null, ''),
    motherName: Joi.string().max(255).allow(null, ''),
    aadhaarNumber: Joi.string().max(20).allow(null, ''),
    panNumber: Joi.string().max(20).allow(null, ''),
    uanNumber: Joi.string().max(20).allow(null, ''),
    passportNumber: Joi.string().max(30).allow(null, ''),
    drivingLicenseNumber: Joi.string().max(40).allow(null, ''),
    voterIdNumber: Joi.string().max(30).allow(null, ''),
    highestQualification: Joi.string().max(120).allow(null, ''),
    courseName: Joi.string().max(180).allow(null, ''),
    institutionName: Joi.string().max(255).allow(null, ''),
    universityName: Joi.string().max(255).allow(null, ''),
    yearOfPassing: Joi.string().max(4).allow(null, ''),
    gradeOrPercentage: Joi.string().max(50).allow(null, ''),
    employeeId: Joi.string().max(100).allow(null, ''),
    employeeDesignation: Joi.string().max(150).allow(null, ''),
    employeeDepartment: Joi.string().max(120).allow(null, ''),
    employmentType: Joi.string().max(50).allow(null, ''),
    joiningDate: Joi.date().iso().allow(null),
    workLocation: Joi.string().max(150).allow(null, ''),
    currentEmployer: Joi.string().max(255).allow(null, ''),
    currentAddress: Joi.string().allow(null, ''),
    permanentAddress: Joi.string().allow(null, ''),
  }),
};

const updateValidator = {
  params: Joi.object({ id: Joi.string().uuid().required() }),
  body: Joi.object({
    clientId: Joi.string().uuid(),
    firstName: Joi.string().max(100),
    lastName: Joi.string().max(100),
    email: Joi.string().email(),
    phone: Joi.string().max(50).allow(null, ''),
    dateOfBirth: Joi.date().iso().allow(null),
    gender: Joi.string().max(30).allow(null, ''),
    fatherName: Joi.string().max(255).allow(null, ''),
    motherName: Joi.string().max(255).allow(null, ''),
    aadhaarNumber: Joi.string().max(20).allow(null, ''),
    panNumber: Joi.string().max(20).allow(null, ''),
    uanNumber: Joi.string().max(20).allow(null, ''),
    passportNumber: Joi.string().max(30).allow(null, ''),
    drivingLicenseNumber: Joi.string().max(40).allow(null, ''),
    voterIdNumber: Joi.string().max(30).allow(null, ''),
    highestQualification: Joi.string().max(120).allow(null, ''),
    courseName: Joi.string().max(180).allow(null, ''),
    institutionName: Joi.string().max(255).allow(null, ''),
    universityName: Joi.string().max(255).allow(null, ''),
    yearOfPassing: Joi.string().max(4).allow(null, ''),
    gradeOrPercentage: Joi.string().max(50).allow(null, ''),
    employeeId: Joi.string().max(100).allow(null, ''),
    employeeDesignation: Joi.string().max(150).allow(null, ''),
    employeeDepartment: Joi.string().max(120).allow(null, ''),
    employmentType: Joi.string().max(50).allow(null, ''),
    joiningDate: Joi.date().iso().allow(null),
    workLocation: Joi.string().max(150).allow(null, ''),
    currentEmployer: Joi.string().max(255).allow(null, ''),
    currentAddress: Joi.string().allow(null, ''),
    permanentAddress: Joi.string().allow(null, ''),
    status: Joi.string().valid(...STATUSES),
  }).min(1),
};

const listValidator = {
  query: Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(200),
    search: Joi.string().allow(''),
    clientId: Joi.string().uuid(),
    status: Joi.string().valid(...STATUSES),
    sortBy: Joi.string().valid('candidateCode', 'firstName', 'lastName', 'email', 'status', 'createdAt', 'updatedAt'),
    sortOrder: Joi.string().valid('asc', 'desc'),
    includeDeleted: Joi.string().valid('true', 'false'),
  }),
};

const idParamValidator = { params: Joi.object({ id: Joi.string().uuid().required() }) };

module.exports = { createValidator, updateValidator, listValidator, idParamValidator };
