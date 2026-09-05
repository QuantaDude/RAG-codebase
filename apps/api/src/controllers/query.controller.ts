import { Request, Response } from "express";
import { Controller } from ".";

export type QueryController = {
  search: Controller
};

export function createQueryController(queryService) {

  function search(req: Request, res: Response) {


  }

  return {
    search
  } satisfies QueryController;
}
