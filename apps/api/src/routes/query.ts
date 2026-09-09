import { Router } from "express";
import { createQueryController } from "../controllers/query.controller";
import { NodePgClient, NodePgDatabase } from "drizzle-orm/node-postgres";
import { DecoderService } from "../services/llm-decoder-gen.service";
import createQueryService from "../services/query.service";

export default function createQueryRoutes(database: NodePgDatabase & { $client: NodePgClient }, decoderService: DecoderService) {

  const service = createQueryService(decoderService, {});
  const controller = createQueryController(service);
  const router = Router();

  router.post('/chat/:id', controller.search);

  return router;
}
