// Validates request parts against zod schemas and replaces them with the parsed
// (and coerced/stripped) values, so controllers only ever see trusted input.
// A ZodError is passed to the central error handler, which formats it as 400.
function validate({ body, params, query } = {}) {
  return (req, res, next) => {
    try {
      if (params) req.params = params.parse(req.params);
      if (query) req.query = query.parse(req.query);
      if (body) req.body = body.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { validate };
