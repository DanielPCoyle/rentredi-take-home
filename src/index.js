/*
Task: User CRUD endpoints with OpenWeatherMap location enrichment + React frontend.
See README.md for setup, architecture, assumptions, and the creative addition.
*/

require("dotenv").config();

const { loadConfig } = require("./config");
const logger = require("./logger");
const db = require("./db");
const { createApp } = require("./app");

async function main() {
  const config = loadConfig();
  db.init(config);

  const app = createApp(config);
  app.listen(config.port, () => {
    logger.info({ port: config.port, dbDriver: config.db.driver }, "server listening");
  });
}

main().catch((err) => {
  logger.fatal({ err }, "failed to start server");
  process.exit(1);
});
