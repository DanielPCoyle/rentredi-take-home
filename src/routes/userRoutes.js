const express = require("express");
const { validate } = require("../middleware/validate");
const { createUserController } = require("../controllers/userController");
const { createUserService } = require("../services/userService");
const {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} = require("../schemas/userSchemas");

function createUserRouter(config) {
  const router = express.Router();
  const controller = createUserController(createUserService(config));

  router.post("/", validate({ body: createUserSchema }), controller.create);
  router.get("/", controller.list);
  router.get("/:id", validate({ params: userIdParamSchema }), controller.get);
  router.put(
    "/:id",
    validate({ params: userIdParamSchema, body: updateUserSchema }),
    controller.update
  );
  router.delete("/:id", validate({ params: userIdParamSchema }), controller.remove);

  return router;
}

module.exports = { createUserRouter };
