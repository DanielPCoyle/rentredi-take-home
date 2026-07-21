const db = require("../db");
const { resolveLocation } = require("./locationService");
const { NotFoundError } = require("../errors");
const logger = require("../logger");

// Business logic. Controllers stay thin; this layer owns the rule that location
// data is derived server-side (from OpenWeatherMap by ZIP) and only re-fetched
// when it must be.
function createUserService(config) {
  // Resolve the stored location fields from a ZIP via OpenWeatherMap.
  // Coordinates always come from the provider, never from the client.
  async function resolveLocationFor({ zip, country }) {
    const countryCode = country || config.owm.defaultCountry;
    const location = await resolveLocation(zip, countryCode, config);
    return { zip, country: countryCode, record: location };
  }

  async function create({ name, zip, country }) {
    const r = await resolveLocationFor({ zip, country });
    const user = await db.create({ name, zip: r.zip, country: r.country, ...r.record });
    logger.info({ userId: user.id, zip: r.zip }, "user created");
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

    // Only call the external location API when the ZIP (or country) actually
    // changes. Otherwise keep the previously resolved coordinates.
    const nextZip = patch.zip ?? existing.zip;
    const nextCountry = patch.country ?? existing.country;
    const zipChanged = nextZip !== existing.zip || nextCountry !== existing.country;

    if (zipChanged) {
      const r = await resolveLocationFor({ zip: nextZip, country: nextCountry });
      Object.assign(next, r.record, { zip: r.zip, country: r.country });
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
