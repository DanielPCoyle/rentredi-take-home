const crypto = require("crypto");

// In-memory driver. Default so the app runs with zero external setup and so the
// test suite is hermetic. Same interface as the Firebase driver.
function createMemoryDb() {
  const users = new Map();

  return {
    async create(data) {
      const id = crypto.randomUUID();
      const record = { id, ...data };
      users.set(id, record);
      return record;
    },
    async list() {
      return [...users.values()];
    },
    async get(id) {
      return users.get(id) || null;
    },
    async update(id, patch) {
      const existing = users.get(id);
      if (!existing) return null;
      const record = { ...existing, ...patch, id };
      users.set(id, record);
      return record;
    },
    async remove(id) {
      return users.delete(id);
    },
  };
}

module.exports = { createMemoryDb };
