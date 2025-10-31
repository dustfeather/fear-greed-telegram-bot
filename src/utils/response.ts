/**
 * HTTP response utility functions
 */

/**
 * Create a JSON response with status code
 */
export function jsonResponse(
  data: unknown,
  status: number = 200,
  headers?: Record<string, string>
): Response {
  const responseHeaders = new Headers({
    'Content-Type': 'application/json',
    ...headers
  });

  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders
  });
}

/**
 * Create a success response
 */
export function successResponse(data?: unknown): Response {
  return jsonResponse(data ?? { ok: true }, 200);
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status: number = 500,
  headers?: Record<string, string>
): Response {
  return jsonResponse({ ok: false, error }, status, headers);
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(error: string = 'Unauthorized'): Response {
  return errorResponse(error, 401);
}

/**
 * Create a bad request response
 */
export function badRequestResponse(error: string = 'Bad Request'): Response {
  return errorResponse(error, 400);
}

/**
 * Create a method not allowed response
 */
export function methodNotAllowedResponse(message: string = 'Method not allowed'): Response {
  return new Response(message, { status: 405 });
}

