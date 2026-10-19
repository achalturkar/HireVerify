'use strict';

const path = require('path');
const fs = require('fs/promises');
const config = require('../../config');
const { BadRequestError } = require('../../utils/errors');

const templateRoot = path.resolve(process.cwd(), config.upload.dir, '..', 'private-candidate-form-templates');
const legacyTemplateRoot = path.resolve(process.cwd(), config.upload.dir, 'clients');
const isUuid = (value) => /^[0-9a-f-]{36}$/i.test(value || '');
const TEMPLATE_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const getTemplateExtension = (fileName) => {
  const extension = path.extname(String(fileName || '')).toLowerCase();
  return TEMPLATE_EXTENSIONS.has(extension) ? extension : '.pdf';
};

const getClientTemplateDirectory = (clientId) => {
  if (!isUuid(clientId)) throw new BadRequestError('Client ID is invalid.');
  return path.resolve(templateRoot, clientId);
};

const getTemplatePath = (clientId, formId, fileName) => {
  if (!isUuid(formId)) throw new BadRequestError('Form template ID is invalid.');
  return path.resolve(getClientTemplateDirectory(clientId), `${formId}${getTemplateExtension(fileName)}`);
};

const getLegacyTemplatePath = (clientId, formId) => {
  getClientTemplateDirectory(clientId);
  if (!isUuid(formId)) throw new BadRequestError('Form template ID is invalid.');
  return path.resolve(legacyTemplateRoot, clientId, 'candidate-forms', `${formId}.pdf`);
};

const getLegacyTemplatePathFromUrl = (clientId, fileUrl) => {
  getClientTemplateDirectory(clientId);
  const prefix = `/uploads/clients/${clientId}/candidate-forms/`;
  if (typeof fileUrl !== 'string' || !fileUrl.startsWith(prefix)) return null;
  const fileName = fileUrl.slice(prefix.length);
  if (!/^[0-9a-f-]{36}\.pdf$/i.test(fileName)) return null;
  return path.resolve(legacyTemplateRoot, clientId, 'candidate-forms', fileName);
};

const findTemplatePath = async (clientId, formId, legacyFileUrl, fileName) => {
  const privatePaths = [
    getTemplatePath(clientId, formId, fileName),
    ...[...TEMPLATE_EXTENSIONS].map((extension) => path.resolve(getClientTemplateDirectory(clientId), `${formId}${extension}`)),
  ].filter((filePath, index, paths) => paths.indexOf(filePath) === index);
  for (const privatePath of privatePaths) {
    try {
      await fs.access(privatePath);
      return privatePath;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const legacyPaths = [
    getLegacyTemplatePath(clientId, formId),
    getLegacyTemplatePathFromUrl(clientId, legacyFileUrl),
  ].filter((filePath, index, paths) => filePath && paths.indexOf(filePath) === index);
  for (const legacyPath of legacyPaths) {
    try {
      await fs.access(legacyPath);
      return legacyPath;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
};

module.exports = { getClientTemplateDirectory, getTemplatePath, getLegacyTemplatePath, getLegacyTemplatePathFromUrl, findTemplatePath, TEMPLATE_EXTENSIONS };
