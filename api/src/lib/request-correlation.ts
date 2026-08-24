const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestCorrelationId(request: Request): string {
  const provided = request.headers.get("x-request-id")?.trim();
  return provided && SAFE_CORRELATION_ID.test(provided) ? provided : crypto.randomUUID();
}
