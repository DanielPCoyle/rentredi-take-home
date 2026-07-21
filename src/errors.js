// Typed application errors. Each carries the HTTP status and a stable machine
// `code` so the central error handler can format a consistent JSON envelope
// without every controller re-deciding status codes.
class AppError extends Error {
  constructor(message, { status = 500, code = "INTERNAL_ERROR", details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = status < 500; // expected (client) vs unexpected (server/upstream)
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation failed", details) {
    super(message, { status: 400, code: "VALIDATION_ERROR", details });
  }
}

class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, { status: 404, code: "NOT_FOUND" });
  }
}

// External dependency (OpenWeatherMap) failed. Default 502; use 504 for timeouts.
class UpstreamError extends AppError {
  constructor(message = "Upstream service error", { status = 502, code = "UPSTREAM_ERROR" } = {}) {
    super(message, { status, code });
  }
}

module.exports = { AppError, ValidationError, NotFoundError, UpstreamError };
