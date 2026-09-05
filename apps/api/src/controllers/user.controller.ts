import { Request, Response, } from "express";
import { Controller } from ".";

export type UserController = {
  register: Controller;
  login: Controller;
};

export function createUserController() {

  async function register(req: Request, res: Response) {

  }

  async function login(req: Request, res: Response) {

  }
  return {
    register,
    login
  } satisfies UserController;
}


