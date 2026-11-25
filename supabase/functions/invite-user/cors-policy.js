export const productionInvitationOrigin = 'https://student-data-survay-app.vercel.app';

const defaultDevelopmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export function getAllowedOrigins(configuredOrigins) {
  const origins = configuredOrigins === undefined
    ? defaultDevelopmentOrigins
    : configuredOrigins.split(',');

  return new Set([
    ...origins.map((origin) => origin.trim()).filter(Boolean),
    productionInvitationOrigin,
  ]);
}

export function isAllowedOrigin(origin, allowedOrigins) {
  return origin === null || allowedOrigins.has(origin);
}

export function getCorsResponseHeaders(origin, allowedOrigins, supabaseCorsHeaders) {
  if (!origin || !isAllowedOrigin(origin, allowedOrigins)) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': supabaseCorsHeaders['Access-Control-Allow-Headers'],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
