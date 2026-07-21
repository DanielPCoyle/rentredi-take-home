const express = require("express");
const { validate } = require("../middleware/validate");
const { createPlacesController } = require("../controllers/placesController");
const { suggestQuerySchema, detailsQuerySchema } = require("../schemas/placesSchemas");

function createPlacesRouter(config) {
  const router = express.Router();
  const controller = createPlacesController(config);

  router.get("/suggest", validate({ query: suggestQuerySchema }), controller.suggest);
  router.get("/details", validate({ query: detailsQuerySchema }), controller.details);

  return router;
}

module.exports = { createPlacesRouter };
