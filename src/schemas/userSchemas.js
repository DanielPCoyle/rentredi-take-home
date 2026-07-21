const { z } = require("zod");

// `.strict()` is the security boundary: it REJECTS any client-supplied field we
// don't allow — including id, latitude, longitude, and timezone. Those are
// derived server-side from OpenWeatherMap and must never be trusted from input.

const name = z.string().trim().min(1, "name is required").max(100);

// US ZIP (5 or ZIP+4). Country optional 2-letter, defaults applied in the service.
const zip = z
  .string()
  .trim()
  .regex(/^\d{5}(-\d{4})?$/, "zip must be a 5-digit US ZIP code");

const country = z
  .string()
  .trim()
  .length(2, "country must be a 2-letter ISO code")
  .transform((c) => c.toUpperCase());

const createUserSchema = z
  .object({
    name,
    zip,
    country: country.optional(),
  })
  .strict();

// Update: any subset, but at least one field, and still no untrusted fields.
const updateUserSchema = z
  .object({
    name: name.optional(),
    zip: zip.optional(),
    country: country.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one field (name, zip, country) is required",
  });

// Route param. Non-empty string covers both UUIDs (memory) and Firebase push keys.
const userIdParamSchema = z.object({
  id: z.string().trim().min(1, "id is required"),
});

module.exports = { createUserSchema, updateUserSchema, userIdParamSchema };
