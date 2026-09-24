import { Router } from "express";
import express from "express";
import { createUserController } from "../controllers/user.controller";


export default function createUserRoutes() {
  const controller = createUserController();
  const router = Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/upload", express.raw({ type: 'application/octet-stream' }), controller.handleZipUpload);
  return router;
}
