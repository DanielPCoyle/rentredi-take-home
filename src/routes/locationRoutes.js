const express = require("express");
const { validate } = require("../middleware/validate");
const { suggestLocationQuerySchema } = require("../schemas/locationSchemas");
const { suggestLocations } = require("../services/locationService");

function createLocationRouter(config) {
  const router = express.Router();

  router.get("/suggest", validate({ query: suggestLocationQuerySchema }), async (req, res, next) => {
    try {
      const suggestions = await suggestLocations(req.query.q, config);
      res.status(200).json({ data: suggestions });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createLocationRouter };
