const logger = require("../logger");

// Thin facade over whichever driver config selected. Call init() once at startup
// (or in tests); every method delegates to the active driver.
let driver = null;

function init(config) {
  if (config.db.driver === "firebase") {
    const { createFirebaseDb } = require("./firebase");
    driver = createFirebaseDb(config.db.firebase);
    logger.info({ driver: "firebase" }, "database initialized");
  } else {
    const { createMemoryDb } = require("./memory");
    driver = createMemoryDb();
    logger.info({ driver: "memory" }, "database initialized");
  }
  return driver;
}

function requireDriver() {
  if (!driver) throw new Error("Database not initialized — call db.init(config) first");
  return driver;
}

module.exports = {
  init,
  create: (data) => requireDriver().create(data),
  list: () => requireDriver().list(),
  get: (id) => requireDriver().get(id),
  update: (id, patch) => requireDriver().update(id, patch),
  remove: (id) => requireDriver().remove(id),
};
