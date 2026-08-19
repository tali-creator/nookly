import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";

async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
}

export const categoryController = { list };
