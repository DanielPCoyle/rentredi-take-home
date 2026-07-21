const { z } = require("zod");

// Env booleans: undefined/"0"/"false" -> false, "1"/"true" -> true.
const envBool = z
  .string()
  .optional()
  .transform((v) => v === "1" || (typeof v === "string" && v.toLowerCase() === "true"));

// Validate the environment once at startup. A bad/missing config should crash
// loudly here rather than surface as a confusing runtime error later.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  // Google Places (optional) — enables the single-input address autocomplete.
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  // OpenWeatherMap
  OWM_API_KEY: z.string().min(1, "OWM_API_KEY is required"),
  OWM_BASE_URL: z.string().url().default("https://api.openweathermap.org/data/2.5"),
  OWM_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DEFAULT_COUNTRY: z.string().length(2).default("US"),
  // Test/e2e seam: return deterministic location data instead of calling OWM.
  OWM_MOCK: envBool,

  // Database driver: "memory" (default, zero-setup) or "firebase" (the bonus).
  // If unset, we auto-select firebase when a database URL is provided.
  DB_DRIVER: z.enum(["memory", "firebase"]).optional(),
  FIREBASE_DATABASE_URL: z.string().url().optional(),
  // Server (admin) credential: path to a service-account JSON file OR inline JSON.
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),

  // Client (web) Firebase config, exposed to the browser so ReactFire can read
  // the Realtime Database directly. These are public values, safe to ship.
  FIREBASE_API_KEY: z.string().optional(),
  FIREBASE_AUTH_DOMAIN: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_APP_ID: z.string().optional(),
  FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
});

function loadConfig(env = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const e = parsed.data;

  const driver = e.DB_DRIVER || (e.FIREBASE_DATABASE_URL ? "firebase" : "memory");

  // Only expose a web config when the essentials are present; otherwise null and
  // the frontend falls back to API polling.
  const webFirebase =
    e.FIREBASE_API_KEY && e.FIREBASE_PROJECT_ID && e.FIREBASE_DATABASE_URL
      ? {
          apiKey: e.FIREBASE_API_KEY,
          authDomain: e.FIREBASE_AUTH_DOMAIN,
          projectId: e.FIREBASE_PROJECT_ID,
          databaseURL: e.FIREBASE_DATABASE_URL,
          appId: e.FIREBASE_APP_ID,
          messagingSenderId: e.FIREBASE_MESSAGING_SENDER_ID,
        }
      : null;

  return {
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    owm: {
      apiKey: e.OWM_API_KEY,
      baseUrl: e.OWM_BASE_URL,
      timeoutMs: e.OWM_TIMEOUT_MS,
      defaultCountry: e.DEFAULT_COUNTRY.toUpperCase(),
      mock: e.OWM_MOCK,
    },
    google: {
      apiKey: e.GOOGLE_MAPS_API_KEY || null,
      timeoutMs: e.OWM_TIMEOUT_MS,
    },
    db: {
      driver,
      firebase: {
        databaseURL: e.FIREBASE_DATABASE_URL,
        serviceAccount: e.FIREBASE_SERVICE_ACCOUNT,
      },
    },
    // Public config handed to the browser via GET /api/config.
    webFirebase,
  };
}

module.exports = { loadConfig };
