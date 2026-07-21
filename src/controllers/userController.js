// Controllers own request/response + HTTP status codes only. Each async handler
// has explicit try/catch that forwards to the central error handler via next(err),
// so one failing endpoint never crashes the process or leaks a stack trace.
function createUserController(userService) {
  return {
    async create(req, res, next) {
      try {
        const user = await userService.create(req.body);
        res.status(201).json({ data: user });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const users = await userService.list();
        res.status(200).json({ data: users });
      } catch (err) {
        next(err);
      }
    },

    async get(req, res, next) {
      try {
        const user = await userService.get(req.params.id);
        res.status(200).json({ data: user });
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const user = await userService.update(req.params.id, req.body);
        res.status(200).json({ data: user });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        await userService.remove(req.params.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { createUserController };
