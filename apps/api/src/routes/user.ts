import { Router } from "express";
import { createUserController } from "../controllers/user.controller";


export default function createUserRoutes() {
  const controller = createUserController();
  const router = Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);

  return router;
}
