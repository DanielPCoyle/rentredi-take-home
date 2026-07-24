const { z } = require("zod");

const suggestLocationQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "search query is required")
    .max(120, "search query is too long")
    .regex(/^[\p{L}\p{N} .,'-]+$/u, "search query contains invalid characters"),
});

module.exports = { suggestLocationQuerySchema };
