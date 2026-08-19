import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";
import { photoController } from "../controllers/photo.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import prisma from "../models/prisma";
import { MAX_PHOTOS_PER_BUSINESS } from "../utils/storage";

const ownerOnly = [requireAuth, requireRole("BUSINESS_OWNER")];

// Photo count limit is enforced BEFORE multer saves the file, so a rejected
// upload never leaves an orphaned file on disk.
export const enforcePhotoLimit: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const business = req.business;
    if (!business) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const count = await prisma.photo.count({
      where: { businessId: business.id },
    });
    if (count >= MAX_PHOTOS_PER_BUSINESS) {
      res.status(400).json({
        error: `Photo limit reached (max ${MAX_PHOTOS_PER_BUSINESS} photos per business)`,
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};

export const photoRouter = Router();

photoRouter.delete("/:id", ...ownerOnly, photoController.deletePhoto);
