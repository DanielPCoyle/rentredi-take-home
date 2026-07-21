const placesService = require("../services/placesService");

// Thin proxy controllers so the Google key stays server-side. Explicit try/catch
// forwards to the central error handler.
function createPlacesController(config) {
  return {
    async suggest(req, res, next) {
      try {
        const data = await placesService.suggest(req.query.q, config);
        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },

    async details(req, res, next) {
      try {
        const data = await placesService.details(req.query.placeId, config);
        res.status(200).json({ data });
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { createPlacesController };
