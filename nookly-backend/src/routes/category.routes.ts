import { Router } from "express";
import { categoryController } from "../controllers/category.controller";

export const categoryRouter = Router();

categoryRouter.get("/", categoryController.list);
