const { z } = require("zod");

const suggestQuerySchema = z.object({
  q: z.string().trim().min(2, "query is too short").max(200),
});

const detailsQuerySchema = z.object({
  placeId: z.string().trim().min(1, "placeId is required").max(400),
});

module.exports = { suggestQuerySchema, detailsQuerySchema };
