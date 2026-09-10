import { Request, Response } from "express";
import { Controller } from ".";
import { QueryService } from "../services/query.service";

export type QueryController = {
  search: Controller
};

export function createQueryController(queryService: QueryService) {

  async function search(req: Request, res: Response) {
    console.log(req.body);
    if (req.params["id"] == "1") {
      res.status(201).json(
        await queryService.search(req.body["query"]),
      );
    } else {

      res.status(201).json({
        result: "wait"
      });
    }

  }

  return {
    search
  } satisfies QueryController;
}
