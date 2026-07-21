const db = require("../db");
const { resolveLocation } = require("./locationService");
const { NotFoundError } = require("../errors");
const logger = require("../logger");

// Business logic. Controllers stay thin; this layer owns the rule that location
// data is derived from OpenWeatherMap and only re-fetched when it must be.
function createUserService(config) {
  async function create({ name, zip, country }) {
    const countryCode = country || config.owm.defaultCountry;
    const location = await resolveLocation(zip, countryCode, config);
    const user = await db.create({ name, zip, country: countryCode, ...location });
    logger.info({ userId: user.id, zip }, "user created");
    return user;
  }

  async function list() {
    return db.list();
  }

  async function get(id) {
    const user = await db.get(id);
    if (!user) throw new NotFoundError(`User "${id}" not found`);
    return user;
  }

  async function update(id, patch) {
    const existing = await db.get(id);
    if (!existing) throw new NotFoundError(`User "${id}" not found`);

    const next = { ...patch };
    if (patch.country) next.country = patch.country;

    // Requirement: only call the external location API when the ZIP (or country)
    // actually changes. Otherwise keep the previously resolved coordinates.
    const nextZip = patch.zip ?? existing.zip;
    const nextCountry = patch.country ?? existing.country;
    const zipChanged = nextZip !== existing.zip || nextCountry !== existing.country;

    if (zipChanged) {
      const location = await resolveLocation(nextZip, nextCountry, config);
      Object.assign(next, location);
      logger.info({ userId: id, zip: nextZip }, "zip changed — refetched location");
    } else {
      logger.info({ userId: id }, "zip unchanged — skipping location fetch");
    }

    const user = await db.update(id, next);
    logger.info({ userId: id }, "user updated");
    return user;
  }

  async function remove(id) {
    const removed = await db.remove(id);
    if (!removed) throw new NotFoundError(`User "${id}" not found`);
    logger.info({ userId: id }, "user deleted");
  }

  return { create, list, get, update, remove };
}

module.exports = { createUserService };
