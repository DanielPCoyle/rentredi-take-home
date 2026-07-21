const crypto = require("crypto");
const logger = require("../logger");

// Attaches a per-request child logger (with a request id) and logs one line on
// completion with method, path, status, and duration. Structured request logging.
function requestLogger(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = requestId;
  req.log = logger.child({ requestId });

  const startedAt = process.hrtime.bigint();
  req.log.info({ method: req.method, url: req.originalUrl }, "request received");

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    req.log[level](
      { method: req.method, url: req.originalUrl, status: res.statusCode, durationMs: Math.round(durationMs) },
      "request completed"
    );
  });

  next();
}

module.exports = { requestLogger };
