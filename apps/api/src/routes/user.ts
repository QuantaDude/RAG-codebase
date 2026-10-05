import { Router } from "express";
import express from "express";
import { createUserController } from "../controllers/user.controller";
import { IndexingService } from "../services/code-indexing.service";


export default function createUserRoutes(indexingService: IndexingService) {
  const controller = createUserController(indexingService);
  const router = Router();

  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.post("/upload", express.raw({ type: 'application/zip', limit: "20mb" }), controller.handleZipUpload);
  return router;
}
