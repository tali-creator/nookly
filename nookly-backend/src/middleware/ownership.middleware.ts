import type { NextFunction, Request, RequestHandler, Response } from "express";
import prisma from "../models/prisma";
import { HttpError } from "../utils/http-error";
import { getParam } from "../utils/params";

// Loads the business from the URL param and verifies the authenticated user
// is its owner. Attaches the business to req.business for downstream use.
export function requireBusinessOwner(paramName: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = getParam(req, paramName);
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });

      if (!business) {
        throw new HttpError(404, "Business not found");
      }
      if (business.ownerId !== req.user?.id) {
        throw new HttpError(403, "You do not own this business");
      }

      req.business = business;
      next();
    } catch (err) {
      next(err);
    }
  };
}
