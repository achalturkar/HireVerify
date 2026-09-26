'use strict';

const config = require('../../../config');
const { BadRequestError, UnprocessableEntityError } = require('../../../utils/errors');

const normalizeResponse = (payload) => {
  const data = payload?.data || payload?.result || payload || {};
  const success = payload?.success !== false && payload?.status !== false;
  const result = success ? (data?.pan_status === true || data?.valid === true || data?.verified === true ? 'VERIFIED' : data?.pan_status === false || data?.valid === false ? 'NOT_VERIFIED' : 'REQUIRES_REVIEW') : 'UNABLE_TO_VERIFY';
  return {
    result,
    resultData: {
      verified: result === 'VERIFIED',
      name: data?.full_name || data?.name || null,
      panStatus: data?.pan_status ?? data?.status ?? null,
      category: data?.category ?? null,
      message: payload?.message || data?.message || null,
    },
    providerRequestId: payload?.request_id || payload?.requestId || data?.request_id || null,
    providerReferenceId: payload?.reference_id || payload?.referenceId || data?.reference_id || null,
    rawResponse: payload,
  };
};

const verifyPan = async ({ pan }) => {
  if (!config.surepass.baseUrl || !config.surepass.bearerToken) {
    throw new BadRequestError('Surepass PAN verification is not configured');
  }
  if (!config.surepass.panEndpoint) {
    throw new BadRequestError('SUREPASS_PAN_ENDPOINT is not configured');
  }

  const response = await fetch(`${config.surepass.baseUrl.replace(/\/$/, '')}/${config.surepass.panEndpoint.replace(/^\//, '')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.surepass.bearerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_number: pan }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new UnprocessableEntityError('Surepass PAN verification failed');
  return normalizeResponse(body);
};

const endpointFor = (type) => ({
  UAN: config.surepass.uanEndpoint,
  ADDRESS: config.surepass.addressEndpoint,
  ADDRESS_PHYSICAL: config.surepass.addressEndpoint,
  COURT: config.surepass.courtEndpoint,
  POLICE_RECORD: config.surepass.courtEndpoint,
  DOCUMENT: config.surepass.documentEndpoint,
}[type]);

const genericResult = (payload) => {
  const data = payload?.data || payload?.result || payload || {};
  const success = payload?.success !== false && payload?.status !== false;
  const explicit = String(data?.status || data?.verification_status || data?.result || '').toLowerCase();
  const result = !success ? 'UNABLE_TO_VERIFY' : ['verified', 'success', 'completed', 'clear', 'found'].some((value) => explicit.includes(value)) ? 'VERIFIED' : explicit.includes('not') || explicit.includes('fail') ? 'NOT_VERIFIED' : 'REQUIRES_REVIEW';
  return {
    result,
    resultData: data,
    providerRequestId: payload?.request_id || payload?.requestId || data?.request_id || null,
    providerReferenceId: payload?.reference_id || payload?.referenceId || data?.reference_id || null,
    rawResponse: payload,
  };
};

const verifyCheck = async ({ type, inputData, apiVersion = 'v1' }) => {
  if (!config.surepass.baseUrl || !config.surepass.bearerToken) throw new BadRequestError('Surepass verification is not configured');
  const endpoint = endpointFor(type);
  if (!endpoint) throw new BadRequestError(`Surepass endpoint is not configured for ${type}`);
  const path = endpoint.replace(/^\//, '').replace(/^v1\//, `${apiVersion}/`);
  const response = await fetch(`${config.surepass.baseUrl.replace(/\/$/, '')}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.surepass.bearerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(inputData || {}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new UnprocessableEntityError(`Surepass ${type} verification failed`);
  return genericResult(body);
};

const verifyStandalone = ({ type, inputData, apiVersion = 'v1' }) => type === 'PAN'
  ? verifyPan({ pan: inputData.pan })
  : verifyCheck({ type, inputData, apiVersion });

module.exports = { verifyPan, verifyCheck, verifyStandalone, normalizeResponse };
