const pino = require("pino");

// Single structured (JSON) logger for the whole app. Level comes from config/env.
// In production these lines ship to a log aggregator; locally they're JSON on stdout.
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined, // drop pid/hostname noise for a readable take-home
});

module.exports = logger;
