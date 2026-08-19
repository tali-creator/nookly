import type { NextFunction, Request, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";
import { deleteFileByUrl, toPublicUrl } from "../utils/storage";

async function addPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const business = req.business!;
    const file = req.file;

    if (!file) {
      throw new HttpError(400, "No image file provided");
    }

    const photoCount = await prisma.photo.count({
      where: { businessId: business.id },
    });

    const photo = await prisma.photo.create({
      data: {
        businessId: business.id,
        url: toPublicUrl(file.filename),
        order: photoCount,
      },
    });

    res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
}

async function deletePhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: getParam(req, "id") },
      include: { business: { select: { ownerId: true } } },
    });
    if (!photo) {
      throw new HttpError(404, "Photo not found");
    }
    if (photo.business.ownerId !== req.user!.id) {
      throw new HttpError(403, "You do not own this business");
    }

    await prisma.photo.delete({ where: { id: photo.id } });
    deleteFileByUrl(photo.url);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export const photoController = { addPhoto, deletePhoto };
