const { z } = require("zod");

// `.strict()` is the security boundary: it REJECTS any client-supplied field we
// don't allow — including id, latitude, longitude, and timezone. Those are
// derived server-side from OpenWeatherMap and must never be trusted from input.

const name = z.string().trim().min(1, "name is required").max(100);

// Postal code — permissive so international formats work (UK "SW1A 1AA", Canada
// "K1A 0B1", Japan "100-0001", etc.). OpenWeatherMap is the source of truth for
// whether a given code actually resolves.
const zip = z
  .string()
  .trim()
  .min(2, "postal code is required")
  .max(12, "postal code is too long")
  .regex(/^[A-Za-z0-9][A-Za-z0-9 -]*$/, "postal code contains invalid characters");

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
