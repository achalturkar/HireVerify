'use strict';

const config = require('../../../config');
const { BadRequestError, UnprocessableEntityError } = require('../../../utils/errors');

const normalizeResponse = (payload) => {
  const data = payload?.data || payload?.result || payload || {};
  const panDetails = data?.pan_details || {};
  const address = panDetails?.address || data?.address || {};
  const success = payload?.success !== false && payload?.status !== false && payload?.status_code !== 422 && payload?.status_code !== 400;
  const hasValidPan = Boolean(data?.pan_number || data?.panNumber || panDetails?.full_name || panDetails?.fullName || payload?.pan_number);
  const result = success && hasValidPan ? 'VERIFIED' : success ? 'REQUIRES_REVIEW' : 'NOT_VERIFIED';
  const resultData = {
    verified: result === 'VERIFIED',
    clientId: data?.client_id || data?.clientId || null,
    panNumber: data?.pan_number || data?.panNumber || null,
    fullName: panDetails?.full_name || data?.full_name || data?.name || null,
    category: panDetails?.category || data?.category || null,
    scoreStatus: data?.status || payload?.status || null,
    statusCode: payload?.status_code ?? payload?.statusCode ?? null,
    message: payload?.message || data?.message || null,
    messageCode: payload?.message_code || payload?.messageCode || null,
    isSoleProprietor: data?.is_sole_proprietor ?? data?.isSoleProprietor ?? null,
    isDirector: data?.is_director ?? data?.isDirector ?? null,
    isSalaried: data?.is_salaried ?? data?.isSalaried ?? null,
    dob: panDetails?.dob || data?.dob || null,
    gender: panDetails?.gender || data?.gender || null,
    aadhaarLinked: panDetails?.aadhaar_linked ?? data?.aadhaar_linked ?? null,
    email: panDetails?.email || data?.email || null,
    phoneNumber: panDetails?.phone_number || data?.phone_number || null,
    address: {
      full: address?.full || null,
      line1: address?.line_1 || address?.line1 || null,
      line2: address?.line_2 || address?.line2 || null,
      streetName: address?.street_name || address?.streetName || null,
      city: address?.city || null,
      state: address?.state || null,
      zip: address?.zip || address?.postalCode || null,
      country: address?.country || null,
    },
    rawPanDetails: panDetails,
  };

  return {
    result,
    resultData,
    providerRequestId: payload?.request_id || payload?.requestId || data?.request_id || data?.requestId || null,
    providerReferenceId: payload?.reference_id || payload?.referenceId || data?.reference_id || data?.referenceId || null,
    rawResponse: payload,
  };
};

const defaultHeaders = () => ({
  Authorization: 'Bearer ' + String(config.surepass.bearerToken || '').trim(),
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

const buildPanPayload = (pan) => {
  const idNumber = String(pan || '').trim().toUpperCase();
  return {
    id_number: idNumber,
    masked_aadhaar_variant: '',
    get_address: true,
    get_contact: true,
  };
};

const extractErrorMessage = (payload, fallback) => {
  const message = payload?.message || payload?.error?.message || payload?.detail || payload?.error || payload?.data?.message || payload?.data?.error || null;
  if (typeof message === 'string' && message.trim()) return message;
  if (typeof payload === 'string' && payload.trim()) return payload;
  return fallback;
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
    headers: defaultHeaders(),
    body: JSON.stringify(buildPanPayload(pan)),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractErrorMessage(body, 'Surepass PAN verification failed');
    throw new UnprocessableEntityError(`Surepass PAN verification failed: ${message}`);
  }
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

const uanResult = (payload) => {
  const data = payload?.data || {};
  const success = payload?.success !== false && !(Number(payload?.status_code) >= 400);
  const hasEmploymentHistory = Array.isArray(data.employment_history);
  return {
    result: success && hasEmploymentHistory && data.employment_history.length > 0 ? 'VERIFIED' : success ? 'REQUIRES_REVIEW' : 'NOT_VERIFIED',
    resultData: payload,
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
  const requestData = type === 'UAN'
    ? { id_number: String(inputData?.uan || '').trim() }
    : inputData || {};
  const response = await fetch(`${config.surepass.baseUrl.replace(/\/$/, '')}/${path}`, {
    method: 'POST',
    headers: defaultHeaders(),
    body: JSON.stringify(requestData),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (type === 'UAN' && body && typeof body === 'object' && body.message_code) {
      return uanResult(body);
    }
    const message = extractErrorMessage(body, `Surepass ${type} verification failed`);
    throw new UnprocessableEntityError(`Surepass ${type} verification failed: ${message}`);
  }
  if (type === 'UAN') {
    if (!body || typeof body !== 'object') {
      throw new UnprocessableEntityError('Surepass UAN verification returned an invalid response.');
    }
    return uanResult(body);
  }
  return genericResult(body);
};

const verifyStandalone = ({ type, inputData, apiVersion = 'v1' }) => type === 'PAN'
  ? verifyPan({ pan: inputData.pan })
  : verifyCheck({ type, inputData, apiVersion });

module.exports = { verifyPan, verifyCheck, verifyStandalone, normalizeResponse };