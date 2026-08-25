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

module.exports = { verifyPan, normalizeResponse };
