const { ZodError } = require("zod");
const { AppError } = require("../errors");
const logger = require("../logger");

// 404 for unmatched routes -> flows into the error handler as a NotFoundError.
function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

// Single place that turns any thrown error into a consistent JSON envelope:
//   { "error": { "code", "message", "details"? } }
// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
function errorHandler(err, req, res, next) {
  const log = req.log || logger;

  // Zod validation failures -> 400 with field-level details.
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    log.warn({ code: "VALIDATION_ERROR", details }, "request validation failed");
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request validation failed", details },
    });
  }

  if (err instanceof AppError) {
    // Expected client errors log at warn; unexpected upstream/server errors at error.
    const level = err.expected ? "warn" : "error";
    log[level]({ code: err.code, status: err.status, err }, err.message);
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Anything else is an unexpected bug: log the full error, hide internals from client.
  log.error({ err }, "unexpected error");
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
  });
}

module.exports = { notFoundHandler, errorHandler };
