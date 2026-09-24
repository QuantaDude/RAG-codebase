import { Request, Response, } from "express";
import { Controller } from ".";
import { IndexingService } from "../services/code-indexing.service";

export type UserController = {
  register: Controller;
  login: Controller;
  handleZipUpload: Controller;
};

export function createUserController(indexingService: IndexingService) {

  async function register(req: Request, res: Response) {
    res.json({ user: 'me' });

  }

  async function login(req: Request, res: Response) {


  }

  async function handleZipUpload(req: Request, res: Response) {

    console.log(req.body);
    indexingService.readZipFile(req.body);
    res.status(201).send();
  }
  return {
    register,
    login,
    handleZipUpload
  } satisfies UserController;
}


