
/**
 * Creates a standardized JSON Response with optional CORS headers enabled.
 */
export function jsonResponse<T>(data: T, status = 200, enableCors = true): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
  };

  if (enableCors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Session-ID, X-Correlation-ID";
  }

  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}

/**
 * Creates a standardized error JSON Response.
 */
export function errorResponse(message: string, status = 400, enableCors = true): Response {
  return jsonResponse(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(), // AS ISO 8601 UTC
    },
    status,
    enableCors
  );
}